//! Recover runtime pragmas when a host omits its comments proxy.

use swc_core::{
  common::{comments::SingleThreadedComments, SourceMapper, Spanned},
  ecma::{
    ast::{EsVersion, JSXElement, JSXFragment, Program},
    parser::{lexer::Lexer, EsSyntax, Parser, StringInput, Syntax, TsSyntax},
    visit::{Visit, VisitWith},
  },
};

/// Next 16's Turbopack enables its plugin comments proxy only when both the
/// leading and trailing comment maps are nonempty. A file with only a leading
/// pragma still affects the host JSX transform, so recover its original map.
/// https://github.com/vercel/next.js/blob/v16.2.9/turbopack/crates/turbopack-ecmascript-plugins/src/transform/swc_ecma_transform_plugins.rs
pub(crate) fn recover_runtime_comments(
  program: &Program,
  source_map: &dyn SourceMapper,
  filename: Option<&str>,
) -> Option<SingleThreadedComments> {
  struct ContainsJsx(bool);
  impl Visit for ContainsJsx {
    fn visit_jsx_element(&mut self, _: &JSXElement) {
      self.0 = true;
    }
    fn visit_jsx_fragment(&mut self, _: &JSXFragment) {
      self.0 = true;
    }
  }
  let mut contains_jsx = ContainsJsx(false);
  program.visit_with(&mut contains_jsx);
  if !contains_jsx.0 {
    return None;
  }

  let mut span = program.span();
  if span.is_dummy() {
    span = match program {
      Program::Module(module) => module
        .body
        .iter()
        .map(Spanned::span)
        .find(|s| !s.is_dummy()),
      Program::Script(script) => script
        .body
        .iter()
        .map(Spanned::span)
        .find(|s| !s.is_dummy()),
    }?;
  }
  let source_file = source_map.lookup_char_pos(span.lo).file;
  let source = source_file.src.as_str();
  // Ordinary JSX modules do not need another parse. A textual match is only a
  // fast gate: SWC decides whether it is a comment and where that comment goes.
  if !source.contains("@jsx") {
    return None;
  }

  let source_filename = source_file.name.to_string();
  let filename = filename.unwrap_or(&source_filename);
  let extension = filename.rsplit('.').next().unwrap_or_default();
  let syntax = if matches!(extension, "ts" | "tsx" | "mts" | "cts") {
    Syntax::Typescript(TsSyntax {
      tsx: extension == "tsx",
      decorators: true,
      no_early_errors: true,
      ..Default::default()
    })
  } else {
    Syntax::Es(EsSyntax {
      jsx: true,
      decorators: true,
      decorators_before_export: true,
      export_default_from: true,
      import_attributes: true,
      allow_super_outside_method: true,
      allow_return_outside_function: true,
      auto_accessors: true,
      explicit_resource_management: true,
      ..Default::default()
    })
  };
  let comments = SingleThreadedComments::default();
  let lexer = Lexer::new(
    syntax,
    EsVersion::EsNext,
    StringInput::new(source, source_file.start_pos, source_file.end_pos),
    Some(&comments),
  );
  let mut parser = Parser::new_from(lexer);
  // Preserve the original byte positions. Reusing the official parser also
  // handles comments following erased TypeScript items and comment-like text
  // inside strings, templates, regular expressions, and other comments.
  let parsed = match program {
    Program::Module(_) => parser.parse_module().map(|_| ()),
    Program::Script(_) => parser.parse_script().map(|_| ()),
  };
  parsed.ok()?;
  Some(comments)
}

#[cfg(test)]
mod tests {
  #![allow(clippy::unwrap_used)]

  use super::*;
  use crate::auto_jsx::allows_injection;
  use swc_core::{
    common::{sync::Lrc, FileName, Globals, SourceMap, DUMMY_SP, GLOBALS},
    ecma::{
      ast::{Decl, ModuleItem, Stmt},
      parser::parse_file_as_program,
    },
  };

  fn assert_recovered(source: &str, filename: &str, erase_types: bool, expected: bool) {
    GLOBALS.set(&Globals::new(), || {
      let source_map: Lrc<SourceMap> = Default::default();
      // Source positions must remain correct when this is not the first file.
      source_map.new_source_file(FileName::Anon.into(), "const earlier = true;".to_owned());
      let source_file = source_map.new_source_file(
        FileName::Custom(filename.into()).into(),
        source.to_owned(),
      );
      let syntax = if filename.ends_with(".tsx") {
        Syntax::Typescript(TsSyntax {
          tsx: true,
          decorators: true,
          ..Default::default()
        })
      } else {
        Syntax::Es(EsSyntax {
          jsx: true,
          decorators: true,
          decorators_before_export: true,
          auto_accessors: true,
          explicit_resource_management: true,
          ..Default::default()
        })
      };
      let comments = SingleThreadedComments::default();
      let mut errors = vec![];
      let mut program = parse_file_as_program(
        &source_file,
        syntax,
        EsVersion::EsNext,
        Some(&comments),
        &mut errors,
      )
      .unwrap();
      assert!(errors.is_empty(), "{source}: {errors:?}");
      if erase_types {
        if let Program::Module(module) = &mut program {
          module.body.retain(|item| {
            !matches!(
              item,
              ModuleItem::Stmt(Stmt::Decl(Decl::TsTypeAlias(_) | Decl::TsInterface(_)))
            ) && !matches!(item, ModuleItem::ModuleDecl(swc_core::ecma::ast::ModuleDecl::Import(import)) if import.type_only)
          });
        }
      }
      let recovered =
        recover_runtime_comments(&program, source_map.as_ref(), Some(filename)).unwrap();
      let (original_leading, original_trailing) = comments.borrow_all();
      let (recovered_leading, recovered_trailing) = recovered.borrow_all();
      assert_eq!(*original_leading, *recovered_leading, "{source}");
      assert_eq!(*original_trailing, *recovered_trailing, "{source}");
      assert_eq!(
        allows_injection(&program, Some(&comments), None, None),
        expected,
        "{source}"
      );
      assert_eq!(
        allows_injection(&program, Some(&recovered), None, None),
        expected,
        "{source}"
      );
    });
  }

  #[test]
  fn recovered_comment_maps_match_parser_attachment_and_directive_order() {
    for filename in ["page.jsx", "page.tsx", "page.mdx"] {
      for newline in ["\n", "\r\n", "\r", "\u{2028}", "\u{2029}"] {
        for (prefix, expected) in [
          ("/** @jsxImportSource preact */", false),
          ("/** @jsxRuntime classic */", false),
          ("/** @jsxRuntime classic @jsxImportSource react */", true),
          ("/** @jsxImportSource react @jsxRuntime classic */", false),
          (
            "/** @jsxImportSource preact */ /* @jsxImportSource react */",
            true,
          ),
          ("/* text /* @jsxImportSource preact */", true),
          ("// @jsxImportSource preact", true),
          ("const previous = 1; /* @jsxImportSource preact */", true),
          ("const previous = 1;\n/* @jsxImportSource preact */", false),
          (
            "function previous() {}\n/* @jsxImportSource preact */",
            false,
          ),
          ("'use client';\n/* @jsxImportSource preact */", false),
          (
            "/** @jsxImportSource react */\nconst previous = 1;\n/* @jsxRuntime classic */",
            true,
          ),
          (
            "function previous() { /* @jsxImportSource preact */ }",
            true,
          ),
          ("const previous = '/** @jsxImportSource preact */';", true),
          ("const previous = `/** @jsxImportSource preact */`;", true),
          ("const previous = /@jsxImportSource\\s+preact/;", true),
        ] {
          let source = format!(
            "{}{}export const Page = () => <main>Hello</main>;",
            prefix.replace('\n', newline),
            newline
          );
          assert_recovered(&source, filename, false, expected);
        }
      }
    }
  }

  #[test]
  fn recovery_preserves_bom_shebang_and_script_comments() {
    for prefix in [
      "\u{feff}",
      "#!/usr/bin/env node\n",
      "\u{feff}#!/usr/bin/env node\n",
    ] {
      assert_recovered(
        &format!("{prefix}/** @jsxImportSource preact */\nconst Page = () => <p>Hello</p>;"),
        "page.jsx",
        false,
        false,
      );
    }
  }

  #[test]
  fn recovery_uses_original_positions_after_typescript_items_are_erased() {
    for prefix in [
      "import type { Props } from './types';",
      "type Props = { value: string };",
      "interface Props { value: string }",
      "import type { Props } from './types'; type Other = { value: string };",
    ] {
      assert_recovered(
        &format!("{prefix}\n/** @jsxImportSource preact */\nexport const Page = (props: Props) => <main>Hello {{props.value}}</main>;"),
        "page.tsx",
        true,
        false,
      );
    }
  }

  #[test]
  fn ordinary_sources_skip_reparsing_and_synthetic_program_spans_use_original_items() {
    GLOBALS.set(&Globals::new(), || {
      for source in [
        "export const Page = () => <main>Hello</main>;",
        "/** @jsxImportSource preact */ export const value = 1;",
        "/** @jsxImportSource preact */ export const Page = () => <main>Hello</main>;",
      ] {
        let source_map: Lrc<SourceMap> = Default::default();
        let source_file = source_map.new_source_file(
          FileName::Custom("page.jsx".into()).into(),
          source.to_owned(),
        );
        let mut program = parse_file_as_program(
          &source_file,
          Syntax::Es(EsSyntax {
            jsx: true,
            ..Default::default()
          }),
          EsVersion::EsNext,
          None,
          &mut vec![],
        )
        .unwrap();
        let Program::Module(module) = &mut program else {
          panic!("Expected module")
        };
        module.span = DUMMY_SP;
        let recovered = recover_runtime_comments(&program, source_map.as_ref(), None);
        assert_eq!(
          recovered.is_some(),
          source.contains("@jsx") && source.contains("<main>")
        );
        if let Some(comments) = recovered {
          assert!(!allows_injection(&program, Some(&comments), None, None));
        }
      }
    });
  }
}
