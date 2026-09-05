#![allow(clippy::unwrap_used)] // Invalid fixtures should fail the test immediately.

use crate::{config::PluginConfig, transform_program};
use swc_core::{
  common::{sync::Lrc, BytePos, FileName, Globals, Mark, SourceMap, Span, DUMMY_SP, GLOBALS},
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
  GLOBALS.set(&Globals::new(), || {
    let source_map: Lrc<SourceMap> = Default::default();
    let source_file = source_map.new_source_file(
      FileName::Custom("input.tsx".into()).into(),
      source.to_owned(),
    );
    let mut errors = vec![];
    let mut program = parse_file_as_program(
      &source_file,
      Syntax::Typescript(TsSyntax {
        tsx: true,
        ..Default::default()
      }),
      Default::default(),
      None,
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
    let config: PluginConfig = serde_json::from_str(config).unwrap();
    let mut program = transform_program(program, config, None);
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
    fixer(None).process(&mut program);
    to_code_default(source_map, None, &program)
  })
}

const AUTO_ONLY: &str = r#"{"enableAutoJsxInjection":true}"#;

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
  assert_eq!(automatic.matches("<GtInternalTranslateJsx>").count(), 2);
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
  assert_eq!(output.matches("<GtInternalTranslateJsx>").count(), 2);
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
      processed: Default::default(),
      insertions: 0,
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
