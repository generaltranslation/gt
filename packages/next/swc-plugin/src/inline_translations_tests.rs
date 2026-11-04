//! End-to-end tests for the experimental inline translations option.
//! Mirrors packages/compiler/src/__tests__/inlineTranslations.test.ts: source
//! code is parsed, run through both plugin passes, and printed.
//!
//! Hashes are the values @generaltranslation/compiler and the runtime compute
//! for the same content, so these tests also pin hash parity with babel.
#![allow(clippy::expect_used)]

use crate::config::PluginConfig;
use crate::transform_program;
use swc_core::common::{sync::Lrc, FileName, SourceMap};
use swc_core::ecma::ast::{EsVersion, Program};
use swc_core::ecma::codegen::{text_writer::JsWriter, Config, Emitter};
use swc_core::ecma::parser::{parse_file_as_module, Syntax, TsSyntax};

/// ICU hash of "Hello world"
const HELLO_WORLD: &str = "05a87bce151d258b";
/// ICU hash of "Hello"
const HELLO: &str = "3cdffbf6452b553c";
/// ICU hash of "Hi {name}" with context "greeting"
const HI_NAME_GREETING: &str = "38c4f65da6af0191";
/// ICU hashes of "One" and "Two"
const ONE: &str = "96a93e38f1e950da";
const TWO: &str = "7c70e98c5cdb173f";
/// STRING hash of "Hello"
const STRING_HELLO: &str = "c6e2133cd6d89e5d";
/// JSX hash of <T>Hello world</T>
const JSX_HELLO_WORLD: &str = "ebc5c5a5022c5050";

fn transform(code: &str, inline_translations: serde_json::Value) -> String {
  let config: PluginConfig = serde_json::from_value(serde_json::json!({
    "compileTimeHash": true,
    "logLevel": "silent",
    "inlineTranslations": inline_translations,
  }))
  .expect("valid plugin config");

  let cm: Lrc<SourceMap> = Default::default();
  let fm = cm.new_source_file(Lrc::new(FileName::Anon), code.to_string());
  let module = parse_file_as_module(
    &fm,
    Syntax::Typescript(TsSyntax {
      tsx: true,
      ..Default::default()
    }),
    EsVersion::latest(),
    None,
    &mut vec![],
  )
  .expect("valid test source");

  let program = transform_program(Program::Module(module), config, None);

  let mut buf = vec![];
  {
    let mut emitter = Emitter {
      cfg: Config::default(),
      cm: cm.clone(),
      comments: None,
      wr: Box::new(JsWriter::new(cm.clone(), "\n", &mut buf, None)),
    };
    emitter.emit_program(&program).expect("printable program");
  }
  String::from_utf8(buf).expect("utf8 output")
}

fn translations(locales: &[&str], entries: serde_json::Value) -> serde_json::Value {
  serde_json::json!({ "locales": locales, "translations": entries })
}

const USEGT_CODE: &str = r#"
  import { useGT } from 'gt-next';
  const gt = useGT();
  gt("Hello world");
"#;

const T_CODE: &str = r#"
  import { T } from 'gt-next';
  export const el = <T>Hello world</T>;
"#;

// ===== gt() ===== //

#[test]
fn appends_an_inline_translations_callback_to_gt_calls() {
  let output = transform(
    USEGT_CODE,
    translations(
      &["fr", "es"],
      serde_json::json!({
        "fr": { HELLO_WORLD: "Bonjour le monde" },
        "es": { HELLO_WORLD: "Hola mundo" },
      }),
    ),
  );
  assert!(output.contains(&format!("$_hash: \"{HELLO_WORLD}\"")), "{output}");
  assert!(
    output.contains(
      r#"(locale)=>locale === "fr" ? "Bonjour le monde" : locale === "es" ? "Hola mundo" : undefined"#
    ),
    "{output}"
  );
}

#[test]
fn only_embeds_the_configured_locales() {
  let output = transform(
    USEGT_CODE,
    translations(
      &["fr"],
      serde_json::json!({
        "fr": { HELLO_WORLD: "Bonjour le monde" },
        "es": { HELLO_WORLD: "Hola mundo" },
      }),
    ),
  );
  assert!(output.contains("\"Bonjour le monde\""), "{output}");
  assert!(!output.contains("Hola mundo"), "{output}");
}

#[test]
fn keeps_locale_order_from_config() {
  let output = transform(
    USEGT_CODE,
    translations(
      &["es", "fr"],
      serde_json::json!({
        "fr": { HELLO_WORLD: "Bonjour le monde" },
        "es": { HELLO_WORLD: "Hola mundo" },
      }),
    ),
  );
  assert!(
    output.contains(r#"locale === "es" ? "Hola mundo" : locale === "fr" ? "Bonjour le monde""#),
    "{output}"
  );
}

#[test]
fn skips_call_sites_without_embedded_translations() {
  let output = transform(
    USEGT_CODE,
    translations(&["fr"], serde_json::json!({ "fr": { "other-hash": "Autre" } })),
  );
  assert!(output.contains(&format!("$_hash: \"{HELLO_WORLD}\"")), "{output}");
  assert!(!output.contains("(locale)=>"), "{output}");
}

#[test]
fn does_nothing_without_inline_translations() {
  let output = transform(USEGT_CODE, serde_json::Value::Null);
  assert!(output.contains(&format!("$_hash: \"{HELLO_WORLD}\"")), "{output}");
  assert!(!output.contains("(locale)=>"), "{output}");
}

#[test]
fn embeds_translations_for_gt_calls_with_options() {
  let output = transform(
    r#"
      import { useGT } from 'gt-next';
      const gt = useGT();
      gt("Hi {name}", { name: user, $context: "greeting" });
    "#,
    translations(&["fr"], serde_json::json!({ "fr": { HI_NAME_GREETING: "Salut {name}" } })),
  );
  assert!(output.contains(r#"(locale)=>locale === "fr" ? "Salut {name}" : undefined"#), "{output}");
}

#[test]
fn uses_a_user_supplied_hash_for_gt_calls() {
  let output = transform(
    r#"
      import { useGT } from 'gt-next';
      const gt = useGT();
      gt("Hello world", { $_hash: "custom" });
    "#,
    translations(&["fr"], serde_json::json!({ "fr": { "custom": "Perso" } })),
  );
  assert!(output.contains(r#"(locale)=>locale === "fr" ? "Perso" : undefined"#), "{output}");
}

// ===== <T> ===== //

#[test]
fn adds_a_translations_prop_to_t() {
  let output = transform(
    T_CODE,
    translations(&["fr"], serde_json::json!({ "fr": { JSX_HELLO_WORLD: "Bonjour le monde" } })),
  );
  assert!(output.contains(&format!("_hash=\"{JSX_HELLO_WORLD}\"")), "{output}");
  assert!(
    output.contains(r#"_translations={(locale)=>locale === "fr" ? "Bonjour le monde" : undefined}"#),
    "{output}"
  );
}

#[test]
fn embeds_jsx_children_objects_for_t() {
  let output = transform(
    T_CODE,
    translations(
      &["fr"],
      serde_json::json!({ "fr": { JSX_HELLO_WORLD: ["Bonjour ", { "c": "monde", "i": 1 }] } }),
    ),
  );
  assert!(
    output.contains(r#"locale === "fr" ? ["#) && output.contains(r#""c": "monde""#),
    "{output}"
  );
}

#[test]
fn skips_t_without_embedded_translations() {
  let output = transform(T_CODE, translations(&["fr"], serde_json::json!({ "fr": {} })));
  assert!(output.contains("_hash="), "{output}");
  assert!(!output.contains("_translations"), "{output}");
}

// ===== msg() ===== //

#[test]
fn injects_msg_callbacks_after_an_undefined_options_argument() {
  let output = transform(
    r#"
      import { msg } from 'gt-next';
      export const a = msg("Hello");
    "#,
    translations(&["fr"], serde_json::json!({ "fr": { HELLO: "Bonjour" } })),
  );
  assert!(
    output.contains(r#"msg("Hello", undefined, (locale)=>locale === "fr" ? "Bonjour" : undefined)"#),
    "{output}"
  );
}

#[test]
fn hashes_msg_options_the_same_way_as_the_runtime() {
  let output = transform(
    r#"
      import { msg } from 'gt-next';
      export const a = msg("Hi {name}", { name: "x", $context: "greeting" });
    "#,
    translations(&["fr"], serde_json::json!({ "fr": { HI_NAME_GREETING: "Salut {name}" } })),
  );
  assert!(output.contains(r#"(locale)=>locale === "fr" ? "Salut {name}" : undefined"#), "{output}");
}

#[test]
fn hashes_string_format_msg_calls() {
  let output = transform(
    r#"
      import { msg } from 'gt-next';
      export const a = msg("Hello", { $format: "STRING" });
    "#,
    translations(&["fr"], serde_json::json!({ "fr": { STRING_HELLO: "Bonjour" } })),
  );
  assert!(output.contains(r#"(locale)=>locale === "fr" ? "Bonjour" : undefined"#), "{output}");
}

#[test]
fn injects_per_element_translations_for_msg_arrays() {
  let output = transform(
    r#"
      import { msg } from 'gt-next';
      export const a = msg(["One", "Two"]);
    "#,
    translations(
      &["fr", "es"],
      serde_json::json!({
        "fr": { ONE: "Un", TWO: "Deux" },
        "es": { TWO: "Dos" },
      }),
    ),
  );
  assert!(
    output.contains(
      r#"(locale)=>locale === "fr" ? [
        "Un",
        "Deux"
    ] : locale === "es" ? [
        undefined,
        "Dos"
    ] : undefined"#
    ),
    "{output}"
  );
}

#[test]
fn leaves_msg_untouched_without_embedded_translations() {
  let output = transform(
    r#"
      import { msg } from 'gt-next';
      export const a = msg(["One", "Two"], { $id: "nums" });
      export const b = msg("Hello");
    "#,
    translations(&["fr"], serde_json::json!({ "fr": {} })),
  );
  assert!(!output.contains("(locale)=>"), "{output}");
  assert!(output.contains(r#"msg("Hello")"#), "{output}");
}

#[test]
fn ignores_msg_from_other_packages() {
  let output = transform(
    r#"
      import { msg } from 'other';
      export const a = msg("Hello");
    "#,
    translations(&["fr"], serde_json::json!({ "fr": { HELLO: "Bonjour" } })),
  );
  assert!(!output.contains("(locale)=>"), "{output}");
}

// ===== derive (not supported) ===== //

#[test]
fn skips_gt_calls_with_derive_content() {
  let output = transform(
    r#"
      import { useGT, derive } from 'gt-next';
      const gt = useGT();
      gt(`Hello ${derive(getName())}`);
    "#,
    translations(&["fr"], serde_json::json!({ "fr": { HELLO_WORLD: "Bonjour le monde" } })),
  );
  assert!(!output.contains("(locale)=>"), "{output}");
}

#[test]
fn skips_gt_calls_with_derive_context() {
  let output = transform(
    r#"
      import { useGT, derive } from 'gt-next';
      const gt = useGT();
      gt("Hello world", { $context: derive(getContext()) });
    "#,
    translations(&["fr"], serde_json::json!({ "fr": { HELLO_WORLD: "Bonjour le monde" } })),
  );
  assert!(!output.contains("(locale)=>"), "{output}");
}

#[test]
fn skips_msg_calls_with_derive_content() {
  let output = transform(
    r#"
      import { msg, derive } from 'gt-next';
      export const a = msg(`Hello ${derive(getName())}`);
      export const b = msg(["Hello", derive(getName())]);
      export const c = msg("Hello", { $context: derive(getContext()) });
    "#,
    translations(&["fr"], serde_json::json!({ "fr": { HELLO: "Bonjour" } })),
  );
  assert!(!output.contains("(locale)=>"), "{output}");
}

#[test]
fn skips_t_with_derive_children() {
  let output = transform(
    r#"
      import { T, Derive } from 'gt-next';
      export const el = <T>Hello <Derive>{getName()}</Derive></T>;
    "#,
    translations(&["fr"], serde_json::json!({ "fr": { JSX_HELLO_WORLD: "Bonjour le monde" } })),
  );
  assert!(!output.contains("_translations"), "{output}");
}

// ===== hash options the plugin can't hash statically ===== //

/// ICU hash of "Hello" with `$requiresReview: true`
const HELLO_REVIEWED: &str = "85e9a084da2d5e49";

/// Distinct translations for the plain, reviewed, and custom-hash entries, so
/// a test can tell which entry an embedded callback came from.
fn hello_variants() -> serde_json::Value {
  translations(
    &["fr"],
    serde_json::json!({
      "fr": {
        HELLO: "Plain Bonjour",
        HELLO_REVIEWED: "Reviewed Bonjour",
        "custom": "Custom Bonjour",
      },
    }),
  )
}

#[test]
fn skips_gt_calls_with_a_non_literal_hash() {
  let output = transform(
    r#"
      import { useGT } from 'gt-next';
      const gt = useGT();
      const hash = 'custom';
      gt("Hello", { $_hash: hash });
    "#,
    hello_variants(),
  );
  assert!(!output.contains("Bonjour"), "{output}");
}

#[test]
fn uses_a_literal_hash_on_gt_calls() {
  let output = transform(
    r#"
      import { useGT } from 'gt-next';
      const gt = useGT();
      gt("Hello", { $_hash: "custom" });
    "#,
    hello_variants(),
  );
  assert!(output.contains("\"Custom Bonjour\""), "{output}");
  assert!(!output.contains("Plain Bonjour"), "{output}");
}

#[test]
fn skips_msg_calls_with_requires_review() {
  for code in [
    r#"import { msg } from 'gt-next'; msg("Hello", { $requiresReview: true });"#,
    r#"import { msg } from 'gt-next'; msg(["Hello"], { $requiresReview: true });"#,
  ] {
    let output = transform(code, hello_variants());
    assert!(!output.contains("Bonjour"), "{output}");
  }
}

#[test]
fn embeds_msg_calls_with_requires_review_false() {
  let output = transform(
    r#"import { msg } from 'gt-next'; msg("Hello", { $requiresReview: false });"#,
    hello_variants(),
  );
  assert!(output.contains("\"Plain Bonjour\""), "{output}");
}

#[test]
fn skips_msg_calls_with_quoted_metadata_keys() {
  let output = transform(
    r#"import { msg } from 'gt-next'; msg("Hello", { '$context': 'greeting' });"#,
    hello_variants(),
  );
  assert!(!output.contains("Bonjour"), "{output}");
}

#[test]
fn skips_msg_and_gt_calls_with_non_literal_context() {
  let output = transform(
    r#"
      import { useGT, msg } from 'gt-next';
      const gt = useGT();
      const context = 'greeting';
      gt("Hello", { $context: context });
      msg("Hello", { $context: context });
      msg("Hello", { $context });
    "#,
    hello_variants(),
  );
  assert!(!output.contains("Bonjour"), "{output}");
}

// ===== <T> with a user-supplied _hash ===== //

#[test]
fn embeds_translations_for_t_with_a_static_hash() {
  for code in [
    r#"import { T } from 'gt-next'; export const el = <T _hash="custom">Hello world</T>;"#,
    r#"import { T } from 'gt-next'; export const el = <T _hash={'custom'}>Hello world</T>;"#,
  ] {
    let output = transform(code, hello_variants());
    assert!(
      output.contains(r#"_translations={(locale)=>locale === "fr" ? "Custom Bonjour" : undefined}"#),
      "{output}"
    );
  }
}

#[test]
fn keeps_counter_alignment_after_t_with_a_static_hash() {
  let output = transform(
    r#"
      import { T } from 'gt-next';
      export const a = <T _hash="custom">Hello world</T>;
      export const b = <T>Hello world</T>;
    "#,
    translations(
      &["fr"],
      serde_json::json!({
        "fr": { "custom": "Custom Bonjour", JSX_HELLO_WORLD: "Bonjour le monde" },
      }),
    ),
  );
  assert!(output.contains("\"Custom Bonjour\""), "{output}");
  assert!(output.contains(&format!("_hash=\"{JSX_HELLO_WORLD}\"")), "{output}");
  assert!(output.contains("\"Bonjour le monde\""), "{output}");
}

#[test]
fn skips_t_with_a_dynamic_hash() {
  let output = transform(
    r#"
      import { T } from 'gt-next';
      const hash = 'custom';
      export const el = <T _hash={hash}>Hello world</T>;
    "#,
    hello_variants(),
  );
  assert!(!output.contains("_translations"), "{output}");
}

#[test]
fn keeps_an_existing_translations_prop_on_t_with_a_static_hash() {
  let output = transform(
    r#"
      import { T } from 'gt-next';
      export const el = <T _hash="custom" _translations={mine}>Hello world</T>;
    "#,
    hello_variants(),
  );
  assert!(!output.contains("Custom Bonjour"), "{output}");
  assert!(output.contains("_translations={mine}"), "{output}");
}
