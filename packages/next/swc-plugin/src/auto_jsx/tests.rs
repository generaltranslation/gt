#![allow(clippy::unwrap_used)] // Invalid fixtures should fail the test immediately.

use crate::{config::PluginConfig, transform_program_with_comments};
use swc_core::{
  common::{
    comments::SingleThreadedComments, sync::Lrc, BytePos, FileName, Globals, Mark, SourceMap, Span,
    DUMMY_SP, GLOBALS,
  },
  ecma::{
    ast::Pass,
    codegen::to_code_default,
    parser::{parse_file_as_program, Syntax, TsSyntax},
    transforms::base::{fixer::fixer, hygiene::hygiene, resolver},
    visit::{VisitMut, VisitMutWith},
  },
};

fn transform(source: &str, config: &str) -> String {
  transform_with_duplicate_spans(source, config, None)
}

fn transform_with_duplicate_spans(source: &str, config: &str, span: Option<Span>) -> String {
  transform_with_metadata(source, config, span, None)
}

fn transform_with_metadata(
  source: &str,
  config: &str,
  span: Option<Span>,
  filename: Option<&str>,
) -> String {
  GLOBALS.set(&Globals::new(), || {
    let source_map: Lrc<SourceMap> = Default::default();
    let source_file = source_map.new_source_file(
      FileName::Custom("input.tsx".into()).into(),
      source.to_owned(),
    );
    let mut errors = vec![];
    let comments = SingleThreadedComments::default();
    let mut program = parse_file_as_program(
      &source_file,
      Syntax::Typescript(TsSyntax {
        tsx: true,
        ..Default::default()
      }),
      Default::default(),
      Some(&comments),
      &mut errors,
    )
    .unwrap();
    assert!(errors.is_empty());
    resolver(Mark::new(), Mark::new(), true).process(&mut program);
    if let Some(span) = span {
      struct SyntheticSpans(Span);
      impl VisitMut for SyntheticSpans {
        fn visit_mut_jsx_element(&mut self, element: &mut swc_core::ecma::ast::JSXElement) {
          element.span = self.0;
          element.visit_mut_children_with(self);
        }
        fn visit_mut_jsx_fragment(&mut self, fragment: &mut swc_core::ecma::ast::JSXFragment) {
          fragment.span = self.0;
          fragment.visit_mut_children_with(self);
        }
      }
      program.visit_mut_with(&mut SyntheticSpans(span));
    }
    let config = PluginConfig::parse(config);
    let mut program = transform_program_with_comments(
      program,
      config,
      filename.map(str::to_owned),
      Some(&comments),
    );
    if let Some(span) = span {
      struct CheckRestoredSpans(Span);
      impl VisitMut for CheckRestoredSpans {
        fn visit_mut_jsx_element(&mut self, element: &mut swc_core::ecma::ast::JSXElement) {
          assert!(element.span == DUMMY_SP || element.span == self.0);
          element.visit_mut_children_with(self);
        }
        fn visit_mut_jsx_fragment(&mut self, fragment: &mut swc_core::ecma::ast::JSXFragment) {
          assert!(fragment.span == DUMMY_SP || fragment.span == self.0);
          fragment.visit_mut_children_with(self);
        }
      }
      program.visit_mut_with(&mut CheckRestoredSpans(span));
    }
    hygiene().process(&mut program);
    fixer(Some(&comments)).process(&mut program);
    to_code_default(source_map, Some(&comments), &program)
  })
}

const AUTO_ONLY: &str = r#"{"enableAutoJsxInjection":true}"#;

#[test]
fn jsx_runtime_pragmas_follow_swc_block_comment_tokenization() {
  for (comment, expected) in [
    ("/** @jsxImportSource @emotion/react */", false),
    ("/* @jsxImportSource preact */", false),
    ("/** @jsxImportSource react */", true),
    ("/** @jsxRuntime classic */", false),
    ("/** @jsxRuntime automatic */", true),
    ("/** @jsxRuntime classic @jsxImportSource react */", true),
    ("/** @jsxImportSource react @jsxRuntime classic */", false),
    (
      "/** @jsxImportSource preact @jsxImportSource react */",
      true,
    ),
    (
      "/** @jsxImportSource react @jsxImportSource preact */",
      false,
    ),
    (
      "/**\n * @jsxRuntime classic\n * @jsxImportSource react\n */",
      true,
    ),
    (
      "/** @jsxRuntime classic */\n/** @jsxRuntime automatic */",
      true,
    ),
    (
      "/** @jsxRuntime automatic */\n/** @jsxRuntime classic */",
      false,
    ),
    ("// @jsxImportSource preact", true),
    ("/** Text before @jsxRuntime classic */", true),
    (
      "/** @jsxRuntime classic */\n// @jsxRuntime automatic",
      false,
    ),
    (
      "/** @jsxRuntime classic\u{0085}@jsxImportSource react */",
      true,
    ),
    (
      "/** @jsxRuntime classic\u{feff}@jsxImportSource react */",
      true,
    ),
  ] {
    let source = format!("{comment}\nexport const Page = () => <p>Hello {{name}}</p>;");
    let output = transform(&source, AUTO_ONLY);
    assert_eq!(
      output.contains("<GtInternalTranslateJsx>"),
      expected,
      "{source}\n{output}"
    );
    assert!(
      output.contains("@jsx"),
      "The driver must preserve source pragmas"
    );
  }
}

#[test]
fn only_the_first_recognized_top_level_comment_group_selects_the_runtime() {
  for (source, expected) in [
    ("const before = 1;\n/** @jsxRuntime classic */\nexport const Page = () => <p>Hello</p>;", false),
    ("/** @jsxRuntime automatic */ const before = 1;\n/** @jsxRuntime classic */\nexport const Page = () => <p>Hello</p>;", true),
    ("const before = 1;\n/** @jsxImportSource react */ const middle = 2;\n/** @jsxImportSource preact */ export const Page = () => <p>Hello</p>;", true),
    ("const before = 1; // @jsxRuntime classic\nexport const Page = () => <p>Hello</p>;", true),
    ("export function Page() { /** @jsxRuntime classic */ return <p>Hello</p>; }", true),
    ("/** @jsxRuntime classic */\n'use client'; const page = <p>Hello</p>;", false),
    ("/** @jsxRuntime automatic */\n'use client'; const page = <p>Hello</p>;", true),
  ] {
    let output = transform(source, AUTO_ONLY);
    assert_eq!(output.contains("<GtInternalTranslateJsx>"), expected, "{source}\n{output}");
  }
}

#[test]
fn configured_runtime_source_is_overridden_by_file_pragmas() {
  let source = "export const Page = () => <p>Hello {name}</p>;";
  for config in [
    r#"{"enableAutoJsxInjection":true,"jsxImportSource":"preact"}"#,
    r#"{"enableAutoJsxInjection":true,"jsxImportSource":"@emotion/react"}"#,
    r#"{"enableAutoJsxInjection":true,"jsxRuntime":"classic"}"#,
  ] {
    assert!(!transform(source, config).contains("GtInternal"));
    let overridden = format!("/** @jsxImportSource react */\n{source}");
    assert!(transform(&overridden, config).contains("<GtInternalTranslateJsx>"));
  }
  assert!(transform(
    source,
    r#"{"enableAutoJsxInjection":true,"jsxRuntime":"automatic","jsxImportSource":"react"}"#
  )
  .contains("<GtInternalTranslateJsx>"));
}

#[test]
fn loader_context_is_consumed_before_injection_and_real_pragmas_override_it() {
  let source = "'use client'; export const Page = () => <p>Hello {name}</p>;";
  for import_source in ["react", "@emotion/react"] {
    let marked = format!("{source}\n;\n\"__GT_AUTO_JSX_IMPORT_SOURCE__:{import_source}\";\n");
    let config = r#"{"enableAutoJsxInjection":true,"jsxImportSourceFromLoader":true,"jsxImportSource":"preact"}"#;
    let output = transform(&marked, config);
    assert!(!output.contains("__GT_AUTO_JSX_IMPORT_SOURCE__"));
    assert_eq!(
      output.contains("<GtInternalTranslateJsx>"),
      import_source == "react"
    );
    let overridden = format!("/** @jsxImportSource react */\n{marked}");
    assert!(transform(&overridden, config).contains("<GtInternalTranslateJsx>"));
    let classic = format!("/** @jsxRuntime classic */\n{marked}");
    assert!(!transform(&classic, config).contains("GtInternal"));
  }
}

#[test]
fn removing_loader_context_preserves_original_statements_and_comments() {
  for source in [
    "'use client'; export const Page = () => <p>Hello</p>;",
    "'use client'; export const Page = () => <p>Hello</p>",
    "export const Page = () => <p>Hello</p>; ; ;",
    "export const Page = () => <p>Hello</p>; // Keep EOF comment",
    "export const Page = () => <p>Hello</p>;\n/* Keep license */",
    "#!/usr/bin/env node\n'use strict'; const page = <p>Hello</p>",
    "const expression = /value/",
    "/* Keep comment-only source */",
  ] {
    let marked = format!("{source}\n;\n\"__GT_AUTO_JSX_IMPORT_SOURCE__:@emotion/react\";\n");
    assert_eq!(
      transform(&marked, r#"{"enableAutoJsxInjection":true,"jsxImportSourceFromLoader":true}"#),
      transform(source, "{}"),
      "{source}"
    );
  }
}

#[test]
fn disabled_auto_insertion_preserves_loader_markers_before_manual_hashing() {
  let source = "import { T, t } from 'gt-next'; export const label = t('Label'); export const Page = () => <T>Manual</T>;";
  let marked = format!("{source}\n;\n\"__GT_AUTO_JSX_IMPORT_SOURCE__:@emotion/react\";\n");
  assert_eq!(
    transform(
      &marked,
      r#"{"compileTimeHash":true,"jsxImportSourceFromLoader":true}"#
    ),
    transform(&marked, r#"{"compileTimeHash":true}"#),
  );
}

#[test]
fn ordinary_source_never_consumes_the_private_marker_without_bridge_mode() {
  let source =
    "export const Page = () => <p>Hello</p>;\n;\n\"__GT_AUTO_JSX_IMPORT_SOURCE__:react\";\n";
  assert!(transform(source, AUTO_ONLY).contains("__GT_AUTO_JSX_IMPORT_SOURCE__:react"));
  assert!(transform(source, "{}").contains("__GT_AUTO_JSX_IMPORT_SOURCE__:react"));
  // A no-JSX dependency does not require context from the loader.
  assert_eq!(
    transform(
      "export const value = 1;",
      r#"{"enableAutoJsxInjection":true,"jsxImportSourceFromLoader":true}"#
    ),
    transform("export const value = 1;", "{}")
  );
}

#[test]
fn jsx_requires_a_valid_final_marker_when_loader_context_is_enabled() {
  for tail in [
    "",
    "\n;\n\"__GT_AUTO_JSX_IMPORT_SOURCE__:preact\";",
    "\n;\n\"__GT_AUTO_JSX_IMPORT_SOURCE__:react\"; const after = 1;",
    "\n;\n'__GT_AUTO_JSX_IMPORT_SOURCE__:react ';",
  ] {
    let source = format!("export const Page = () => <p>Hello</p>;{tail}");
    assert!(std::panic::catch_unwind(|| transform(
      &source,
      r#"{"enableAutoJsxInjection":true,"jsxImportSourceFromLoader":true}"#
    ))
    .is_err());
  }
}

#[test]
#[should_panic(expected = "The adapter's formatted runtime-context diagnostic")]
fn missing_loader_context_uses_the_adapters_formatted_diagnostic() {
  transform(
    "export const Page = () => <p>Hello</p>;",
    r#"{"enableAutoJsxInjection":true,"jsxImportSourceFromLoader":true,"missingJsxRuntimeContextDiagnostic":"The adapter's formatted runtime-context diagnostic"}"#,
  );
}

#[test]
fn classic_factories_and_non_react_runtimes_do_not_disable_manual_hashing() {
  for pragma in [
    "/** @jsxImportSource @emotion/react */",
    "/** @jsxRuntime classic */",
    "/** @jsxRuntime classic @jsx React.createElement @jsxFrag React.Fragment */",
  ] {
    let source = format!("{pragma}\nimport React from 'react'; import {{ T, t }} from 'gt-next'; export const label = t('Label'); export const Page = () => <><T>Manual</T><p>Automatic {{name}}</p></>;");
    let baseline = transform(&source, r#"{"compileTimeHash":true}"#);
    let enabled = transform(
      &source,
      r#"{"compileTimeHash":true,"enableAutoJsxInjection":true}"#,
    );
    assert_eq!(enabled, baseline);
    assert!(enabled.contains("_hash"));
    assert!(!enabled.contains("GtInternal"));
    assert!(enabled.contains(pragma));
  }
}

#[test]
fn synthetic_or_cloned_spans_keep_independent_node_identity() {
  let source = "import { Branch, Var } from 'gt-next'; export const Page = () => <><p>Hello <b>World {name}</b></p><p>Second</p><Branch branch={view} other={value}/><Var>{flag ? <b>Opaque</b> : null}</Var></>;";
  let expected = transform(source, AUTO_ONLY);
  for span in [DUMMY_SP, Span::new(BytePos(1), BytePos(2))] {
    assert_eq!(
      transform_with_duplicate_spans(source, AUTO_ONLY, Some(span)),
      expected
    );
  }
}

#[test]
fn script_mode_preserves_its_directive_prologue_when_it_becomes_a_module() {
  let output = transform("'use client'; const page = <p>Hello</p>;", AUTO_ONLY);
  assert!(output.starts_with("'use client';") || output.starts_with("\"use client\";"));
  assert!(output.contains("<GtInternalTranslateJsx>"));
}

#[test]
fn type_only_imports_and_intrinsic_aliases_are_not_gt_components() {
  let output = transform("import type { T as Typed } from 'gt-next'; import { T as t } from 'gt-next'; export const Page = () => <><Typed>Typed {value}</Typed><t>Intrinsic {other}</t></>;", AUTO_ONLY);
  assert_eq!(output.matches("<GtInternalTranslateJsx>").count(), 2);
  assert_eq!(output.matches("<GtInternalVar>").count(), 2);
}

#[test]
fn insertion_is_independent_of_hashing_and_defaults_off() {
  let source = "export const Page = () => <div>Hello {name}</div>;";
  let disabled = transform(source, "{}");
  assert!(!disabled.contains("GtInternal"));
  let enabled = transform(source, AUTO_ONLY);
  assert!(enabled.contains("<GtInternalTranslateJsx>"));
  assert!(enabled.contains("<GtInternalVar>{name}</GtInternalVar>"));
  assert!(!enabled.contains("_hash="));
}

#[test]
fn insertion_preserves_directives_and_leaves_automatic_hashing_to_runtime() {
  let output = transform(
    "'use client'; export const Page = () => <p>Hello {name}</p>;",
    r#"{"enableAutoJsxInjection":true,"compileTimeHash":true}"#,
  );
  assert!(output.starts_with("'use client';") || output.starts_with("\"use client\";"));
  assert!(output.contains("<GtInternalTranslateJsx>"));
  assert!(!output.contains("_hash="));
  assert!(output.contains("<GtInternalVar>{name}</GtInternalVar>"));
}

#[test]
fn automatic_arrays_and_static_identifiers_coexist_with_unchanged_manual_hashes() {
  let source = "import { T, Var } from 'gt-next'; export const Page = () => <><T>Hello <Var>{name}</Var></T><div>Auto {value}{NaN}{Infinity}</div><Card children={['Array', value]} /></>;";
  let baseline = transform(source, r#"{"compileTimeHash":true}"#);
  let automatic = transform(
    source,
    r#"{"enableAutoJsxInjection":true,"compileTimeHash":true}"#,
  );
  let manual_opening = |output: String| {
    output
      .split("<T ")
      .nth(1)
      .unwrap()
      .split('>')
      .next()
      .unwrap()
      .to_owned()
  };
  assert_eq!(manual_opening(baseline), manual_opening(automatic.clone()));
  assert_eq!(automatic.matches("_hash=").count(), 1);
  assert_eq!(automatic.matches("<GtInternalTranslateJsx>").count(), 1);
  assert_eq!(
    automatic
      .matches("gtAutoJsxs1(GtInternalTranslateJsx,")
      .count(),
    1
  );
  assert!(!automatic.contains("_hash=\"\""));
}

#[test]
fn inline_object_spreads_participate_in_child_selection() {
  let output = transform("export const Page = () => <><div {...{children: 'Spread text'}}/><div {...{__proto__: prototype, children: 'Opaque spread'}}/></>;", AUTO_ONLY);
  assert_eq!(output.matches("<GtInternalTranslateJsx>").count(), 1);
  assert!(output.contains("children: <GtInternalTranslateJsx>"));
  assert!(output.contains("children: 'Opaque spread'"));
}

#[test]
fn opaque_inline_spreads_process_content_but_keep_controls() {
  let output = transform("import { Branch } from 'gt-next'; export const Page = () => <Branch {...{branch: selector, one: value, children: fallback}}/>;", AUTO_ONLY);
  assert_eq!(output.matches("<GtInternalTranslateJsx>").count(), 1);
  assert_eq!(output.matches("<GtInternalVar>").count(), 2);
  assert!(output.contains("branch: selector"));
}

#[test]
fn user_variable_suppresses_attribute_callbacks_and_conditional_jsx() {
  let output = transform("import { Var as Value } from 'gt-next'; export const Page = () => <Value header={<h1>Title</h1>}>{flag ? <p>Yes</p> : <p>No</p>}</Value>;", AUTO_ONLY);
  assert!(!output.contains("GtInternal"));
}

#[test]
fn import_resolution_distinguishes_shadowed_component_parameters() {
  let output = transform("import { T as Translation } from 'gt-next'; export const Manual = () => <Translation>Manual</Translation>; export function Local(Translation) { return <Translation>Automatic {name}</Translation>; }", AUTO_ONLY);
  assert_eq!(output.matches("<GtInternalTranslateJsx>").count(), 1);
  assert!(output.contains("<Translation>Manual</Translation>"));
  assert!(output.contains("<GtInternalVar>{name}</GtInternalVar>"));
}

#[test]
fn generated_imports_cannot_be_shadowed_by_existing_parameters() {
  let output = transform(
    "export function Page(GtInternalTranslateJsx, GtInternalVar) { return <p>Hello {name}</p>; }",
    r#"{"enableAutoJsxInjection":true,"compileTimeHash":true}"#,
  );
  assert!(output.contains("GtInternalTranslateJsx as GtInternalTranslateJsx1"));
  assert!(output.contains("GtInternalVar as GtInternalVar1"));
  assert!(output.contains("<GtInternalTranslateJsx1>"));
  assert!(output.contains("<GtInternalVar1>{name}</GtInternalVar1>"));
}

#[test]
fn single_array_children_and_array_valued_siblings_are_distinct() {
  let output = transform(
    "export const Page = () => <main><p>{['Hello', name]}</p><p>Hello {[name, value]}</p></main>;",
    AUTO_ONLY,
  );
  assert_eq!(output.matches("<GtInternalTranslateJsx>").count(), 1);
  assert_eq!(
    output
      .matches("gtAutoJsxs1(GtInternalTranslateJsx,")
      .count(),
    1
  );
  assert_eq!(output.matches("<GtInternalVar>").count(), 2);
}

#[test]
fn key_after_spread_is_a_dynamic_create_element_shell() {
  let output = transform(
    "export const Page = () => <main>Hello <Card {...props} key={id}><p>Child</p></Card></main>;",
    AUTO_ONLY,
  );
  assert!(output.contains("<GtInternalVar><Card"));
  assert_eq!(output.matches("<GtInternalTranslateJsx>").count(), 2);
}

#[test]
fn unicode_trim_matches_the_compiler() {
  assert!(!super::syntax::has_text("\u{feff}\u{00a0}\u{2028}"));
  assert!(super::syntax::has_text("\u{0085}"));
  assert!(super::syntax::has_text("\u{200b}"));
}

#[test]
fn moved_quoted_children_preserve_raw_shape_and_unmatched_utf16_surrogates() {
  use swc_core::ecma::{ast::*, atoms::wtf8::Wtf8Buf};
  // Source parsers may reject surrogate entities, but earlier plugins can
  // still construct these valid JavaScript string values in the AST.
  let original = Str {
    span: DUMMY_SP,
    value: Wtf8Buf::from_ill_formed_utf16(&[0xd800, 0x000a, 0xfeff, 0xdfff]).into(),
    raw: Some("\"&#xD800;\n\u{feff}&#xDFFF;\"".into()),
  };
  GLOBALS.set(&Globals::new(), || {
    let mut visitor = super::AutoJsx {
      bindings: super::bindings::Bindings::new(&Program::Module(Module {
        span: DUMMY_SP,
        body: vec![],
        shebang: None,
      })),
      styles: Default::default(),
      has_raw_text_boundaries: false,
      processed: Default::default(),
      insertions: 0,
      raw_jsx: true,
      runtime_depth: 0,
      runtime_owner: None,
    };
    let mut attribute = JSXAttrValue::Str(original.clone());
    visitor.process_children_attribute(&mut attribute, false);
    let JSXAttrValue::JSXElement(translated) = attribute else {
      panic!("Expected automatic translation element")
    };
    let JSXAttrOrSpread::JSXAttr(JSXAttr {
      value: Some(JSXAttrValue::Str(moved)),
      ..
    }) = &translated.opening.attrs[0]
    else {
      panic!("Expected quoted children attribute")
    };
    assert_eq!(moved.value, original.value);
    assert_eq!(moved.raw, original.raw);
    assert_eq!(moved.span, original.span);
    assert!(translated.children.is_empty());
  });
}

#[test]
fn untouched_static_attributes_keep_their_quoted_source() {
  let source = "import { Branch } from 'gt-next'; export const Page = () => <main><Card children=\" \t\r\n \u{00a0}\"/><Branch branch={mode} first=\"First\r\n  Second\" children=\"Fallback\t \u{00a0} text\"/></main>;";
  let output = transform(source, AUTO_ONLY);
  assert!(output.contains("children=\" \t\r\n \u{00a0}\""));
  assert!(output.contains("first=\"First\r\n  Second\""));
  assert!(output.contains("children=\"Fallback\t \u{00a0} text\""));
  assert!(!output.contains("children={\""));
}

#[test]
fn imported_runtime_calls_share_regions_with_raw_jsx() {
  let output = transform("import { jsx as make } from 'react/jsx-runtime'; export const Page = () => <main>Intro {make('p', { children: 'Already lowered' })}</main>;", AUTO_ONLY);
  assert!(output.contains("<GtInternalTranslateJsx>Intro {make("));
  assert!(!output.contains("<GtInternalVar>"));
  assert!(output.contains("children: 'Already lowered'"));
}

#[test]
fn imported_runtime_calls_preserve_manual_boundaries() {
  for component in ["T", "Var", "Num", "Currency", "DateTime", "RelativeTime"] {
    let source = format!("import {{ jsx as make }} from 'react/jsx-runtime'; import {{ {component} }} from 'gt-next'; export const Page=()=>make({component}, {{children:<p>Manual content</p>}});");
    let output = transform(&source, AUTO_ONLY);
    assert!(!output.contains("GtInternal"), "{output}");
  }
  let output = transform("import { jsx as make } from 'react/jsx-runtime'; import { Var } from 'gt-next'; export const Page=()=>make(Var, { title: <p>Attribute</p>, children: ready ? <b>Conditional</b> : fallback });", AUTO_ONLY);
  assert!(!output.contains("GtInternal"));
}

#[test]
fn runtime_helpers_resolve_bindings_and_preserve_shadowed_calls() {
  let output = transform("import { jsx as make } from 'react/jsx-runtime'; export const Page=()=>make('p',{children:'Imported'}); export function Local(make) { return make('p',{children:'Local'}); }", AUTO_ONLY);
  assert!(output.contains("make(GtInternalTranslateJsx,"));
  assert!(output.contains("children: 'Local'"));
  assert_eq!(output.matches("make(GtInternalTranslateJsx,").count(), 1);
  let namespace = transform("import * as Runtime from 'react/jsx-runtime'; export const Page=()=>Runtime.jsx('p',{children:'Namespace'});", AUTO_ONLY);
  assert!(!namespace.contains("GtInternal"));
}

#[test]
fn runtime_calls_use_the_owning_module_and_preserve_helper_values() {
  let output = transform("import { jsx as single } from 'react/jsx-runtime'; import { jsxDEV as development } from 'react/jsx-dev-runtime'; export const helpers=[single,development]; export const first=single('p',{children:['First',value]}); export const second=development('p',{children:['Second',value]},key(),true,source,self);", AUTO_ONLY);
  assert!(output.contains("jsxs as gtAutoJsxs1"));
  assert!(output.contains("gtAutoJsxs1(GtInternalTranslateJsx,"));
  assert!(output.contains("development(GtInternalTranslateJsx,"));
  assert!(output.contains("key(), false, source, self)"));
  assert!(output.contains("single,\n    development"));
}

#[test]
fn original_react_calls_still_translate_under_custom_jsx_runtimes() {
  let output = transform("/** @jsxImportSource custom-runtime */ import { jsx as make } from 'react/jsx-runtime'; export const Page=()=>make('p',{children:['Text',<b>Custom JSX</b>]});", AUTO_ONLY);
  assert!(output.contains("jsxs as gtAutoJsxs1"));
  assert!(output.contains("make(GtInternalVar,"));
  assert!(output.contains("<b>Custom JSX</b>"));
  assert!(!output.contains("<GtInternal"));
}

#[test]
fn runtime_call_properties_and_extra_arguments_keep_evaluation_order() {
  let output = transform("import { jsx as make } from 'react/jsx-runtime'; export const Page=()=>make('p',{get title(){return title()},children:['First',value],...props,children:'Last'},key(),flag(),source(),self());", AUTO_ONLY);
  assert!(output.contains("get title()") || output.contains("get title ()"));
  assert!(output.find("...props").unwrap() < output.find("children: 'Last'").unwrap());
  assert!(output.contains("key(), flag(), source(), self()"));
}

#[test]
fn style_payloads_remain_opaque_and_under_their_original_parent() {
  let output = transform(
    "export const Page=()=> <div>Hello<style jsx>{`div{color:red}`}</style>Tail {name}</div>;",
    AUTO_ONLY,
  );
  assert!(output.contains("<div><GtInternalTranslateJsx>Hello</GtInternalTranslateJsx><style jsx>{`div{color:red}`}</style><GtInternalTranslateJsx>Tail <GtInternalVar>{name}</GtInternalVar></GtInternalTranslateJsx></div>"), "{output}");
  let nested = transform("export const Page=()=> <div>Hello<section>Inside<style jsx>{`section{color:red}`}</style>Tail</section>End</div>;", AUTO_ONLY);
  assert!(nested.contains("</GtInternalTranslateJsx><section>"));
  assert!(nested.contains("</GtInternalTranslateJsx><style jsx>"));
}

#[test]
fn styled_jsx_default_bindings_are_opaque_but_local_shadows_translate() {
  for import in [
    "import Style from 'styled-jsx/style';",
    "import { default as Style } from 'styled-jsx/style';",
  ] {
    let source = format!("{import} export const Page=()=> <Style>{{`p{{color:red}}`}}</Style>; export function Local(Style) {{ return <Style>Local {{name}}</Style>; }}");
    let output = transform(&source, AUTO_ONLY);
    assert!(output.contains("<Style>{`p{color:red}`}</Style>"));
    assert_eq!(output.matches("<GtInternalTranslateJsx>").count(), 1);
  }
  let output = transform("import * as Styles from 'styled-jsx/style'; import { jsx as make } from 'react/jsx-runtime'; export const Page=()=>make(Styles.default,{children:'p{color:red}'});", AUTO_ONLY);
  assert!(!output.contains("GtInternal"));
}

#[test]
fn duplicate_children_claims_keep_later_arrays_dynamic_without_changing_text() {
  let output = transform(
    "export const Page=()=> <Card children='Before'>A &amp; B {value} &lt;x&gt;</Card>;",
    AUTO_ONLY,
  );
  assert!(
    output.contains("<Card children=<GtInternalTranslateJsx children='Before'/>>{["),
    "{output}"
  );
  assert!(output.contains("\"A & B \""));
  assert!(output.contains("\" <x>\""));
  assert!(!output.contains("<GtInternalVar>"));
}

#[test]
fn spread_first_argument_does_not_identify_a_react_element_type() {
  let output = transform("import { jsx as make } from 'react/jsx-runtime'; export const Page=()=>make(...types,{children:'Unknown shell',title:<b>Independent</b>});", AUTO_ONLY);
  assert!(output.contains("children: 'Unknown shell'"));
  assert!(!output.contains("make(GtInternalTranslateJsx,"));
  assert!(output.contains("<b><GtInternalTranslateJsx>Independent</GtInternalTranslateJsx></b>"));
}

#[test]
fn intrinsic_raw_text_elements_are_hard_region_boundaries() {
  for tag in ["title", "textarea", "script"] {
    let source = format!(
      "export const Page=()=> <div>Before<{tag}>{{`Payload ${{name}}`}}</{tag}>After</div>;"
    );
    let output = transform(&source, AUTO_ONLY);
    assert!(
      output.contains(&format!(
        "</GtInternalTranslateJsx><{tag}>{{`Payload ${{name}}`}}</{tag}><GtInternalTranslateJsx>"
      )),
      "{output}"
    );
    assert!(!output.contains("<GtInternalVar>"));
  }
}

#[test]
fn authored_create_element_only_protects_bound_raw_text_payloads() {
  for (import, factory) in [
    ("import { createElement as create } from 'react';", "create"),
    ("import React from 'react';", "React.createElement"),
    ("import * as React from 'react';", "React['createElement']"),
    (
      "import { default as React } from 'react';",
      "React.createElement",
    ),
  ] {
    let source = format!("{import} export const Page=()=> <main>Before {{{factory}('title',null,'Title')}} After</main>;");
    let output = transform(&source, AUTO_ONLY);
    assert_eq!(
      output.matches("<GtInternalTranslateJsx>").count(),
      2,
      "{output}"
    );
    assert!(!output.contains("<GtInternalVar>"));
  }
  let ordinary = transform("import { createElement as create } from 'react'; export const Page=()=> <main>Before {create('b',null,'Ordinary')} after</main>;", AUTO_ONLY);
  assert!(ordinary.contains("<GtInternalVar>{create('b'"));
  let shadowed = transform("import { createElement as create } from 'react'; export function Page(create) { return <main>Before {create('title',null,'Local')} after</main>; }", AUTO_ONLY);
  assert!(shadowed.contains("<GtInternalVar>{create('title'"));
}

#[test]
fn custom_runtime_helpers_only_protect_bound_raw_text_payloads() {
  for (source, helper) in [
    ("custom/jsx-runtime", "jsx"),
    ("@custom/runtime/jsx-runtime", "jsxs"),
    ("custom/jsx-dev-runtime", "jsxDEV"),
  ] {
    let input = format!("import {{ {helper} as make }} from '{source}'; export const Page=()=> <main>Before {{make('title',{{children:'Title'}})}} After</main>;");
    let output = transform(&input, AUTO_ONLY);
    assert_eq!(
      output.matches("<GtInternalTranslateJsx>").count(),
      2,
      "{output}"
    );
    assert!(!output.contains("<GtInternalVar>"));
  }
  let ordinary = transform("import { jsx as make } from 'custom/jsx-runtime'; export const Page=()=> <main>Before {make('b',{children:'Ordinary'})} after</main>;", AUTO_ONLY);
  assert!(ordinary.contains("<GtInternalVar>{make('b'"));
  let shadowed = transform("import { jsx as make } from 'custom/jsx-runtime'; export function Page(make) { return <main>Before {make('title',{children:'Local'})} after</main>; }", AUTO_ONLY);
  assert!(shadowed.contains("<GtInternalVar>{make('title'"));
  let unrelated = transform("import { jsx as make } from 'custom/runtime'; export const Page=()=> <main>Before {make('title',{children:'Unrelated'})} after</main>;", AUTO_ONLY);
  assert!(unrelated.contains("<GtInternalVar>{make('title'"));
}

#[test]
fn shadowed_runtime_counterparts_do_not_rename_user_bindings() {
  let output = transform("import { jsx as single, jsxs as multi } from 'react/jsx-runtime'; export const runtimeHelper=multi; export function Page() { const multi=function(){}; return {name:multi.name,node:single('div',{children:['Hello',multi.name]})}; }", AUTO_ONLY);
  assert!(output.contains("jsxs as gtAutoJsxs1"));
  assert!(output.contains("const multi = function() {}"), "{output}");
  assert!(output.contains("name: multi.name"));
  assert!(!output.contains("multi1"));
  let reverse = transform("import { jsx as single, jsxs as multi } from 'react/jsx-runtime'; export const runtimeHelper=single; export function Page(single) { return multi('div',{children:['Hello',single]}); }", AUTO_ONLY);
  assert!(reverse.contains("jsx as gtAutoJsx1"));
  assert!(reverse.contains("function Page(single)"), "{reverse}");
  assert!(!reverse.contains("single1"));
}

#[test]
fn automatic_regions_survive_hash_collection_and_build_checks() {
  let enabled =
    r#"{"enableAutoJsxInjection":true,"compileTimeHash":true,"disableBuildChecks":false}"#;
  for source in [
    "export const Page=()=> <p>{['Sparse ',,label]}</p>;",
    "export const Page=()=> <p>{['Spread ',...items]}</p>;",
    "export const Page=()=> <p>{['Nested ',[label,other]]}</p>;",
    "import {jsx as make} from 'react/jsx-runtime'; export const Page=()=> <main>Before {make('p',{children:['Mixed ',label]})}</main>;",
    "export const Page=()=> <section>Before<style jsx>{'section{color:red}'}</style>After {label}</section>;",
  ] {
    let output = transform(source, enabled);
    assert!(output.contains("GtInternalTranslateJsx"), "{output}");
    assert_eq!(output, transform(source, AUTO_ONLY));
  }
}

#[test]
fn manual_jsx_and_string_hashes_remain_enabled_after_automatic_insertion() {
  let enabled =
    r#"{"enableAutoJsxInjection":true,"compileTimeHash":true,"disableBuildChecks":false}"#;
  for source in [
    "import {T,Var} from 'gt-next'; export const Page=()=> <main><T>Hello <Var>{label}</Var></T><p>Automatic {label}</p></main>;",
    "import {useGT} from 'gt-next'; export const Page=()=> { const t=useGT(); return <main>{t('Manual string')}<p>Automatic {label}</p></main>; };",
  ] {
    let output = transform(source, enabled);
    assert!(output.contains("GtInternalTranslateJsx"), "{output}");
    assert!(output.contains("_hash"), "{output}");
  }
}

#[test]
fn runtime_package_scope_excludes_only_automatic_insertion() {
  let source = "import {Branch,T,Var,useGT} from 'gt-next'; export const Page=()=> {const t=useGT(); return <main><Branch branch={mode} first='First'/><T>Manual <Var>{label}</Var></T><p>Automatic {label}</p>{t('Manual string')}</main>;};";
  let config = r#"{"enableAutoJsxInjection":true,"compileTimeHash":true,"disableBuildChecks":false,"autoJsxRuntimePackageRoots":["/runtime/gt-next"]}"#;
  let output = transform_with_metadata(
    source,
    config,
    None,
    Some("/runtime/gt-next/dist/Branch.mjs?server"),
  );
  assert!(!output.contains("GtInternalTranslateJsx"), "{output}");
  assert!(output.contains("_hash"));
  let user = transform_with_metadata(source, config, None, Some("/runtime/gt-next-user/Page.tsx"));
  assert!(user.contains("GtInternalTranslateJsx"), "{user}");
  assert!(user.contains("_hash"));
}
