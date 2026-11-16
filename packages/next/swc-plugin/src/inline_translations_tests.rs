//! End-to-end tests for the experimental inline translations option.
//! Mirrors packages/compiler/src/__tests__/inlineTranslations.test.ts: source
//! code is parsed, run through both plugin passes, and printed.
//!
//! Hashes are the values @generaltranslation/compiler and the runtime compute
//! for the same content, so these tests also pin hash parity with babel.
#![allow(clippy::expect_used)]

use crate::config::PluginConfig;
use crate::inline_shards::shard_key;
use crate::transform_program_in;
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
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
/// JSX hash of <T>Hello world</T>
const JSX_HELLO_WORLD: &str = "ebc5c5a5022c5050";

static NEXT_DIR: AtomicUsize = AtomicUsize::new(0);

/// A temporary working directory removed on drop
struct TempCwd(PathBuf);

impl TempCwd {
  fn new() -> Self {
    let id = NEXT_DIR.fetch_add(1, Ordering::Relaxed);
    let path = std::env::temp_dir().join(format!("gt-swc-inline-{}-{id}", std::process::id()));
    std::fs::create_dir_all(&path).expect("temp dir");
    Self(path)
  }
}

impl Drop for TempCwd {
  fn drop(&mut self) {
    let _ = std::fs::remove_dir_all(&self.0);
  }
}

const SHARD_DIR: &str = ".next/cache/gt/inline/test";

/// Write `{ locales, translations }` as shards the way gt-next does and return
/// the plugin option pointing at them
fn write_shards(cwd: &Path, inline_translations: &serde_json::Value) -> serde_json::Value {
  let mut shards: BTreeMap<(String, String), serde_json::Map<String, serde_json::Value>> = BTreeMap::new();
  if let Some(locales) = inline_translations["translations"].as_object() {
    for (locale, entries) in locales {
      for (hash, value) in entries.as_object().expect("translations object") {
        shards
          .entry((locale.clone(), shard_key(hash).to_string()))
          .or_default()
          .insert(hash.clone(), value.clone());
      }
    }
  }
  // Like gt-next, write every shard key for every locale, empty or not
  let keys = (0..=255u8).map(|byte| format!("{byte:02x}")).chain(std::iter::once("_".to_string()));
  let locales: Vec<String> = inline_translations["locales"]
    .as_array()
    .map(|locales| locales.iter().filter_map(|locale| locale.as_str().map(String::from)).collect())
    .unwrap_or_default();
  for key in keys {
    for locale in &locales {
      let dir = cwd.join(SHARD_DIR).join(locale);
      std::fs::create_dir_all(&dir).expect("shard dir");
      let entries = shards.remove(&(locale.clone(), key.clone())).unwrap_or_default();
      std::fs::write(dir.join(format!("{key}.json")), serde_json::to_vec(&entries).expect("json")).expect("shard");
    }
  }
  std::fs::create_dir_all(cwd.join(SHARD_DIR)).expect("shard dir");
  serde_json::json!({
    "locales": inline_translations["locales"],
    "dir": SHARD_DIR,
    "contentHash": "test",
  })
}

fn transform(code: &str, inline_translations: serde_json::Value) -> String {
  let cwd = TempCwd::new();
  let option = if inline_translations.is_null() {
    serde_json::Value::Null
  } else {
    write_shards(&cwd.0, &inline_translations)
  };
  transform_with_option(code, option, &cwd.0)
}

fn transform_with_option(code: &str, inline_translations: serde_json::Value, cwd: &Path) -> String {
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

  let program = transform_program_in(Program::Module(module), config, None, cwd);

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
fn adds_an_inline_prop_to_t() {
  let output = transform(
    T_CODE,
    translations(&["fr"], serde_json::json!({ "fr": { JSX_HELLO_WORLD: "Bonjour le monde" } })),
  );
  assert!(output.contains(&format!("_hash=\"{JSX_HELLO_WORLD}\"")), "{output}");
  assert!(
    output.contains(r#"inline={(locale)=>locale === "fr" ? "Bonjour le monde" : undefined}"#),
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
fn skips_t_when_props_can_change_the_computed_hash() {
  for code in [
    r#"import { T } from 'gt-next'; export const el = <T $_hash="custom">Hello world</T>;"#,
    r#"import { T } from 'gt-next'; export const el = <T {...props}>Hello world</T>;"#,
  ] {
    let output = transform(
      code,
      translations(&["fr"], serde_json::json!({ "fr": { JSX_HELLO_WORLD: "Bonjour le monde" } })),
    );
    assert!(!output.contains("inline={"), "{output}");
  }
}

#[test]
fn skips_t_without_embedded_translations() {
  let output = transform(T_CODE, translations(&["fr"], serde_json::json!({ "fr": {} })));
  assert!(output.contains("_hash="), "{output}");
  assert!(!output.contains("inline={"), "{output}");
}

// ===== msg() ===== //

#[test]
fn never_embeds_translations_in_msg_calls() {
  // msg() strings load from the msg()-only translations file instead
  let output = transform(
    r#"
      import { msg } from 'gt-next';
      export const a = msg("Hello");
      export const b = msg("Hello", { $id: "greeting" });
    "#,
    translations(&["fr"], serde_json::json!({ "fr": { HELLO: "Bonjour" } })),
  );
  assert!(!output.contains("(locale)=>"), "{output}");
  assert!(output.contains(r#"msg("Hello")"#), "{output}");
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
fn skips_t_with_derive_children() {
  let output = transform(
    r#"
      import { T, Derive } from 'gt-next';
      export const el = <T>Hello <Derive>{getName()}</Derive></T>;
    "#,
    translations(&["fr"], serde_json::json!({ "fr": { JSX_HELLO_WORLD: "Bonjour le monde" } })),
  );
  assert!(!output.contains("inline={"), "{output}");
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
fn skips_gt_calls_with_a_repeated_hash() {
  let output = transform(
    r#"
      import { useGT } from 'gt-next';
      const gt = useGT();
      gt("Hello", { $_hash: "custom", $_hash: "other" });
    "#,
    hello_variants(),
  );
  assert!(!output.contains("(locale)=>"), "{output}");
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
fn skips_gt_calls_with_requires_review() {
  let output = transform(
    r#"import { useGT } from 'gt-next'; const gt = useGT(); gt("Hello", { $requiresReview: true });"#,
    hello_variants(),
  );
  assert!(!output.contains("Bonjour"), "{output}");
}

#[test]
fn embeds_gt_calls_with_requires_review_false() {
  let output = transform(
    r#"import { useGT } from 'gt-next'; const gt = useGT(); gt("Hello", { $requiresReview: false });"#,
    hello_variants(),
  );
  assert!(output.contains("\"Plain Bonjour\""), "{output}");
}

#[test]
fn skips_gt_calls_with_quoted_metadata_keys() {
  let output = transform(
    r#"import { useGT } from 'gt-next'; const gt = useGT(); gt("Hello", { '$context': 'greeting' });"#,
    hello_variants(),
  );
  assert!(!output.contains("Bonjour"), "{output}");
}

#[test]
fn skips_gt_calls_with_non_literal_context() {
  let output = transform(
    r#"
      import { useGT } from 'gt-next';
      const gt = useGT();
      const context = 'greeting';
      gt("Hello", { $context: context });
      gt("Hello", { $context });
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
      output.contains(r#"inline={(locale)=>locale === "fr" ? "Custom Bonjour" : undefined}"#),
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
  assert!(!output.contains("inline={"), "{output}");
}

#[test]
fn skips_t_when_props_can_override_a_static_hash() {
  for code in [
    r#"import { T } from 'gt-next'; export const el = <T _hash="custom" {...overrides}>Hello world</T>;"#,
    r#"import { T } from 'gt-next'; export const el = <T {...overrides} _hash="custom">Hello world</T>;"#,
    r#"import { T } from 'gt-next'; export const el = <T _hash="custom" $_hash="other">Hello world</T>;"#,
  ] {
    let output = transform(code, hello_variants());
    assert!(!output.contains("inline={"), "{output}");
  }
}

#[test]
fn keeps_an_existing_inline_prop_on_t_with_a_static_hash() {
  let output = transform(
    r#"
      import { T } from 'gt-next';
      export const el = <T _hash="custom" inline={mine}>Hello world</T>;
    "#,
    hello_variants(),
  );
  assert!(!output.contains("Custom Bonjour"), "{output}");
  assert!(output.contains("inline={mine}"), "{output}");
}

// ===== shard files ===== //

#[test]
#[should_panic(expected = "cannot read embedded translations")]
fn fails_the_build_when_the_shard_dir_is_missing() {
  let cwd = TempCwd::new();
  transform_with_option(
    USEGT_CODE,
    serde_json::json!({ "locales": ["fr"], "dir": "missing", "contentHash": "x" }),
    &cwd.0,
  );
}

#[test]
#[should_panic(expected = "cannot read embedded translations")]
fn fails_the_build_when_a_shard_is_unparsable() {
  let cwd = TempCwd::new();
  let option = write_shards(
    &cwd.0,
    &translations(&["fr"], serde_json::json!({ "fr": { HELLO_WORLD: "Bonjour le monde" } })),
  );
  std::fs::write(cwd.0.join(SHARD_DIR).join("fr").join(format!("{}.json", shard_key(HELLO_WORLD))), "{")
    .expect("corrupt shard");
  transform_with_option(USEGT_CODE, option, &cwd.0);
}

#[test]
#[should_panic(expected = "cannot read embedded translations")]
fn fails_the_build_when_a_shard_is_missing() {
  let cwd = TempCwd::new();
  let option = write_shards(
    &cwd.0,
    &translations(&["fr"], serde_json::json!({ "fr": { HELLO_WORLD: "Bonjour le monde" } })),
  );
  std::fs::remove_file(cwd.0.join(SHARD_DIR).join("fr").join(format!("{}.json", shard_key(HELLO_WORLD))))
    .expect("remove shard");
  transform_with_option(USEGT_CODE, option, &cwd.0);
}

#[test]
fn reads_hashes_from_different_shards() {
  let output = transform(
    r#"
      import { useGT } from 'gt-next';
      const gt = useGT();
      gt("Hello world");
      gt("Hello");
    "#,
    translations(
      &["fr"],
      serde_json::json!({ "fr": { HELLO_WORLD: "Bonjour le monde", HELLO: "Bonjour" } }),
    ),
  );
  assert_ne!(shard_key(HELLO_WORLD), shard_key(HELLO));
  assert!(output.contains(r#"locale === "fr" ? "Bonjour le monde""#), "{output}");
  assert!(output.contains(r#"locale === "fr" ? "Bonjour""#), "{output}");
}

// ===== message modules ===== //

const MODULES_DIR: &str = ".gt/messages";
const MODULES_IMPORT_DIR: &str = "/app/.gt/messages";

/// Write an (unread) module for each hash and transform `code` in modules mode
fn transform_with_modules(code: &str, hashes: &[&str]) -> String {
  let cwd = TempCwd::new();
  let dir = cwd.0.join(MODULES_DIR);
  std::fs::create_dir_all(&dir).expect("modules dir");
  for hash in hashes {
    std::fs::write(dir.join(format!("{hash}.js")), "export default () => undefined;").expect("module");
  }
  transform_with_option(
    code,
    serde_json::json!({
      "locales": ["fr"],
      "contentHash": "test",
      "modules": { "dir": MODULES_DIR, "importDir": MODULES_IMPORT_DIR },
    }),
    &cwd.0,
  )
}

fn module_import(hash: &str) -> String {
  format!("import __gt_inline_{hash} from \"{MODULES_IMPORT_DIR}/{hash}.js\";")
}

#[test]
fn imports_the_message_module_for_gt_calls() {
  let output = transform_with_modules(USEGT_CODE, &[HELLO_WORLD]);
  assert!(output.contains(&module_import(HELLO_WORLD)), "{output}");
  assert!(output.contains(&format!("}}, __gt_inline_{HELLO_WORLD})")), "{output}");
  assert!(!output.contains("(locale)=>"), "{output}");
}

#[test]
fn passes_the_message_module_as_the_inline_prop_of_t() {
  let output = transform_with_modules(T_CODE, &[JSX_HELLO_WORLD]);
  assert!(output.contains(&module_import(JSX_HELLO_WORLD)), "{output}");
  assert!(output.contains(&format!("inline={{__gt_inline_{JSX_HELLO_WORLD}}}")), "{output}");
}

#[test]
fn imports_a_shared_message_module_once() {
  let output = transform_with_modules(
    r#"
      import { useGT, T } from 'gt-next';
      const gt = useGT();
      gt("Hello world");
      gt("Hello");
      gt("Hello world");
      export const el = <T>Hello world</T>;
    "#,
    &[HELLO_WORLD, HELLO, JSX_HELLO_WORLD],
  );
  assert_eq!(output.matches(&module_import(HELLO_WORLD)).count(), 1, "{output}");
  assert_eq!(output.matches(&format!("}}, __gt_inline_{HELLO_WORLD})")).count(), 2, "{output}");
  assert!(output.contains(&module_import(HELLO)), "{output}");
  assert!(output.contains(&module_import(JSX_HELLO_WORLD)), "{output}");
}

#[test]
fn skips_call_sites_without_a_message_module() {
  let output = transform_with_modules(
    r#"
      import { useGT } from 'gt-next';
      const gt = useGT();
      gt("Hello world");
      gt("Hello");
    "#,
    &[HELLO],
  );
  assert!(output.contains(&module_import(HELLO)), "{output}");
  assert!(!output.contains(&format!("__gt_inline_{HELLO_WORLD}")), "{output}");
  assert_eq!(output.matches("__gt_inline_").count(), 2, "{output}");
}

#[test]
fn leaves_files_without_translation_calls_untouched() {
  let code = "export const value = 1;\n";
  assert_eq!(transform_with_modules(code, &[HELLO_WORLD]), code);
}

#[test]
fn imports_message_modules_after_directives() {
  let output = transform_with_modules(&format!("'use client';\n{USEGT_CODE}"), &[HELLO_WORLD]);
  assert!(output.starts_with(&format!("'use client';\n{}", module_import(HELLO_WORLD))), "{output}");
}

#[test]
fn imports_message_modules_for_user_supplied_hashes() {
  let output = transform_with_modules(
    r#"
      import { useGT } from 'gt-next';
      const gt = useGT();
      gt("Hello world", { $_hash: "my-hash" });
    "#,
    &["my-hash"],
  );
  assert!(
    output.contains(&format!("import __gt_inline_my$hash from \"{MODULES_IMPORT_DIR}/my-hash.js\";")),
    "{output}"
  );
  assert!(output.contains("}, __gt_inline_my$hash)"), "{output}");
}

#[test]
fn never_imports_modules_for_hashes_unsafe_as_file_names() {
  let output = transform_with_modules(
    r#"
      import { useGT } from 'gt-next';
      const gt = useGT();
      gt("Hello world", { $_hash: "../escape" });
    "#,
    &[],
  );
  assert!(!output.contains("__gt_inline_"), "{output}");
}

#[test]
#[should_panic(expected = "cannot read embedded translation modules")]
fn fails_the_build_when_the_modules_dir_is_missing() {
  let cwd = TempCwd::new();
  transform_with_option(
    USEGT_CODE,
    serde_json::json!({
      "locales": ["fr"],
      "modules": { "dir": "missing", "importDir": "/missing" },
    }),
    &cwd.0,
  );
}
