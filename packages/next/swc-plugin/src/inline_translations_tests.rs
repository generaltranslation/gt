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
use crate::visitor::unstable_messages::hash_unstable_message;
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use swc_core::common::{sync::Lrc, FileName, SourceMap};
use swc_core::ecma::ast::{EsVersion, Expr, Program};
use swc_core::ecma::codegen::{text_writer::JsWriter, Config, Emitter};
use swc_core::ecma::parser::{parse_file_as_expr, parse_file_as_module, Syntax, TsSyntax};

/// Message tree hash of gt`Hello world`
const HELLO_WORLD: &str = "8ffa9649730810de";
/// Message tree hash of gt`Hello`
const HELLO: &str = "3621e454d7345edc";
/// Message tree hash of gt({ context: 'greeting' })`Hello world`
const HELLO_WORLD_GREETING: &str = "d13919d2202a590f";
/// Message tree hash of gt`Hello, ${{ name }}!`
const HELLO_NAME: &str = "b785eb9d5af50191";
/// ICU hash of "Hello world", what a stable gt("Hello world") looks up
const ICU_HELLO_WORLD: &str = "05a87bce151d258b";
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
  import { useGT } from 'gt-next/unstable';
  const gt = useGT();
  gt`Hello world`;
"#;

const T_CODE: &str = r#"
  import { T } from 'gt-next';
  export const el = <T>Hello world</T>;
"#;

// ===== unstable gt and t ===== //

#[test]
fn adds_an_inline_translations_option_to_unstable_gt_templates() {
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
  assert!(
    output.contains(
      r#"gt({
    inline: (locale)=>locale === "fr" ? "Bonjour le monde" : locale === "es" ? "Hola mundo" : undefined
})`Hello world`"#
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
  assert!(output.contains("gt`Hello world`"), "{output}");
  assert!(!output.contains("(locale)=>"), "{output}");
}

#[test]
fn does_nothing_without_inline_translations() {
  let output = transform(USEGT_CODE, serde_json::Value::Null);
  assert!(output.contains("gt`Hello world`"), "{output}");
  assert!(!output.contains("(locale)=>"), "{output}");
}

#[test]
fn embeds_translations_for_every_unstable_entry_point() {
  for code in [
    r#"import { t } from 'gt-react/unstable'; t`Hello world`;"#,
    r#"import { t as translate } from 'gt-i18n/unstable'; translate`Hello world`;"#,
    r#"
      import { getGT } from 'gt-next/unstable/server';
      export async function label() {
        const gt = await getGT();
        return gt`Hello world`;
      }
    "#,
    r#"
      import { useGT } from 'gt-next/unstable';
      export function Label() {
        const gt = useGT();
        return <p>{gt`Hello world`}</p>;
      }
    "#,
  ] {
    let output = transform(
      code,
      translations(&["fr"], serde_json::json!({ "fr": { HELLO_WORLD: "Bonjour le monde" } })),
    );
    assert!(
      output.contains(r#"inline: (locale)=>locale === "fr" ? "Bonjour le monde" : undefined"#),
      "{output}"
    );
  }
}

#[test]
fn embeds_under_the_hash_of_literal_options() {
  let output = transform(
    r#"
      import { useGT } from 'gt-next/unstable';
      const gt = useGT();
      gt({ context: 'greeting' })`Hello world`;
    "#,
    translations(&["fr"], serde_json::json!({ "fr": { HELLO_WORLD_GREETING: "Salut le monde" } })),
  );
  assert!(
    output.contains(
      r#"gt({
    context: 'greeting',
    inline: (locale)=>locale === "fr" ? "Salut le monde" : undefined
})`Hello world`"#
    ),
    "{output}"
  );
}

#[test]
fn embeds_message_trees_with_named_variables() {
  let output = transform(
    r#"
      import { useGT } from 'gt-next/unstable';
      const gt = useGT();
      gt`Hello, ${{ name }}!`;
      gt`Hello, ${{ name: user.name } as const}!`;
    "#,
    translations(
      &["fr"],
      serde_json::json!({ "fr": { HELLO_NAME: ["Salut, ", ["name"], " !"] } }),
    ),
  );
  assert_eq!(output.matches(r#"locale === "fr" ? ["#).count(), 2, "{output}");
  assert!(output.contains(r#""Salut, ","#), "{output}");
}

#[test]
fn skips_templates_outside_the_shared_subset() {
  // An unnamed value, a helper, a part fragment, derive, non-literal or
  // unsupported options, a configured tag and an alias are left to loaded
  // translations, like the babel compiler and the CLI's msgOutput files do
  let output = transform(
    r#"
      import { useGT, plural, part, derive } from 'gt-next/unstable';
      const gt = useGT();
      const count = 3;
      const context = 'greeting';
      gt`Hello ${count}`;
      gt`Hello ${plural({ count }, { one: 'item', other: 'items' })}`;
      gt`Hello ${part`world`}`;
      gt`Hello ${derive(getName())}`;
      gt({ context })`Hello world`;
      gt({ context: 'greeting', id: 'x' })`Hello world`;
      gt({ 'context': 'greeting' })`Hello world`;
      gt({ ...options })`Hello world`;
      gt`Hello, ${{ _gt_1: name }}!`;
      const save = gt({ context: 'greeting' });
      save`Hello world`;
      const alias = gt;
      alias`Hello world`;
    "#,
    serde_json::json!({ "locales": ["fr"], "translations": { "fr": {
      HELLO_WORLD: "Bonjour le monde",
      HELLO_WORLD_GREETING: "Salut le monde",
    } } }),
  );
  assert!(!output.contains("(locale)=>"), "{output}");
}

#[test]
fn never_embeds_unstable_msg_templates() {
  // m() renders them away from their call site
  let output = transform(
    r#"
      import { msg } from 'gt-next/unstable';
      export const label = msg`Hello world`;
    "#,
    translations(&["fr"], serde_json::json!({ "fr": { HELLO_WORLD: "Bonjour le monde" } })),
  );
  assert!(!output.contains("(locale)=>"), "{output}");
}

#[test]
fn respects_shadowed_unstable_names() {
  let output = transform(
    r#"
      import { t } from 'gt-react/unstable';
      export function label(t) {
        return t`Hello world`;
      }
    "#,
    translations(&["fr"], serde_json::json!({ "fr": { HELLO_WORLD: "Bonjour le monde" } })),
  );
  assert!(!output.contains("(locale)=>"), "{output}");
}

// ===== stable gt() and t() ===== //

#[test]
fn leaves_stable_gt_calls_without_a_callback() {
  for code in [
    r#"import { useGT } from 'gt-next'; const gt = useGT(); gt("Hello world");"#,
    r#"
      import { getGT } from 'gt-next/server';
      export async function label() {
        const gt = await getGT();
        return gt("Hello world");
      }
    "#,
  ] {
    let output = transform(
      code,
      translations(&["fr"], serde_json::json!({ "fr": { ICU_HELLO_WORLD: "Bonjour le monde" } })),
    );
    assert!(output.contains(&format!("$_hash: \"{ICU_HELLO_WORLD}\"")), "{output}");
    assert!(!output.contains("(locale)=>"), "{output}");
  }
}

// ===== hash parity ===== //

/// Every template in test-fixtures/message-tree-wire-format.json the plugin
/// hashes gets the hash the runtime, the CLI and the babel compiler compute
#[test]
fn hashes_wire_format_fixtures_like_the_runtime() {
  let fixtures: Vec<serde_json::Value> = serde_json::from_str(
    &std::fs::read_to_string(
      Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../test-fixtures/message-tree-wire-format.json"),
    )
    .expect("wire format fixtures"),
  )
  .expect("fixture json");
  let mut hashed = Vec::new();
  for fixture in &fixtures {
    let template = fixture["template"].as_str().expect("template");
    let cm: Lrc<SourceMap> = Default::default();
    let fm = cm.new_source_file(Lrc::new(FileName::Anon), template.to_string());
    let expr = parse_file_as_expr(&fm, Syntax::Typescript(TsSyntax::default()), EsVersion::latest(), None, &mut vec![])
      .expect("fixture template");
    let Expr::TaggedTpl(tagged) = *expr else {
      panic!("not a tagged template: {template}");
    };
    let options = match tagged.tag.as_ref() {
      Expr::Call(call) => match call.args[0].expr.as_ref() {
        Expr::Object(options) => Some(options),
        _ => None,
      },
      _ => None,
    };
    if let Some(hash) = hash_unstable_message(&tagged.tpl, options) {
      assert_eq!(Some(hash.as_str()), fixture["hash"].as_str(), "{template}");
      hashed.push(fixture["name"].as_str().expect("name"));
    }
  }
  assert_eq!(
    hashed,
    ["plain-literal", "context", "one-argument", "max-chars", "max-chars-negative", "requires-review"]
  );
}

#[test]
fn hashes_unicode_names_and_escapes_like_the_runtime() {
  let output = transform(
    r#"
      import { useGT } from 'gt-next/unstable';
      const gt = useGT();
      gt`Salut ${{ 名前 }}\n`;
    "#,
    translations(&["fr"], serde_json::json!({ "fr": { "e7a86759185cd22d": "Embedded" } })),
  );
  assert!(output.contains("\"Embedded\""), "{output}");
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
  // msg() strings load from the msgOutput file instead
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

/// Distinct translations for the computed and custom-hash <T> entries, so a
/// test can tell which entry an embedded callback came from.
fn hello_variants() -> serde_json::Value {
  translations(
    &["fr"],
    serde_json::json!({
      "fr": {
        JSX_HELLO_WORLD: "Plain Bonjour",
        "custom": "Custom Bonjour",
      },
    }),
  )
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
      import { useGT } from 'gt-next/unstable';
      const gt = useGT();
      gt`Hello world`;
      gt`Hello`;
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
const MODULES_IMPORT_DIR: &str = "gt-next/internal/_inline-messages";

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
fn imports_the_message_module_for_unstable_gt_templates() {
  let output = transform_with_modules(USEGT_CODE, &[HELLO_WORLD]);
  assert!(output.contains(&module_import(HELLO_WORLD)), "{output}");
  assert!(
    output.contains(&format!("gt({{\n    inline: __gt_inline_{HELLO_WORLD}\n}})`Hello world`")),
    "{output}"
  );
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
      import { useGT } from 'gt-next/unstable';
      import { T } from 'gt-next';
      const gt = useGT();
      gt`Hello world`;
      gt`Hello`;
      gt`Hello world`;
      export const el = <T>Hello world</T>;
    "#,
    &[HELLO_WORLD, HELLO, JSX_HELLO_WORLD],
  );
  assert_eq!(output.matches(&module_import(HELLO_WORLD)).count(), 1, "{output}");
  assert_eq!(output.matches(&format!("inline: __gt_inline_{HELLO_WORLD}\n")).count(), 2, "{output}");
  assert!(output.contains(&module_import(HELLO)), "{output}");
  assert!(output.contains(&module_import(JSX_HELLO_WORLD)), "{output}");
}

#[test]
fn skips_call_sites_without_a_message_module() {
  let output = transform_with_modules(
    r#"
      import { useGT } from 'gt-next/unstable';
      const gt = useGT();
      gt`Hello world`;
      gt`Hello`;
    "#,
    &[HELLO],
  );
  assert!(output.contains(&module_import(HELLO)), "{output}");
  assert!(output.contains("gt`Hello world`"), "{output}");
  assert_eq!(output.matches("__gt_inline_").count(), 2, "{output}");
}

#[test]
fn never_imports_modules_for_msg_or_stable_gt() {
  let output = transform_with_modules(
    r#"
      import { msg } from 'gt-next/unstable';
      import { useGT } from 'gt-next';
      const gt = useGT();
      gt("Hello world");
      export const m = msg`Hello world`;
    "#,
    &[HELLO_WORLD, ICU_HELLO_WORLD],
  );
  assert!(!output.contains("__gt_inline_"), "{output}");
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
fn imports_message_modules_for_static_t_hashes() {
  let output = transform_with_modules(
    r#"import { T } from 'gt-next'; export const el = <T _hash="custom_hash">Hello world</T>;"#,
    &["custom_hash"],
  );
  assert!(output.contains(&module_import("custom_hash")), "{output}");
  assert!(output.contains("inline={__gt_inline_custom_hash}"), "{output}");
}

#[test]
fn never_imports_modules_for_hashes_that_are_not_module_hashes() {
  for hash in ["../escape", "Custom", "my-hash"] {
    let output = transform_with_modules(
      &format!(r#"import {{ T }} from 'gt-next'; export const el = <T _hash="{hash}">Hello world</T>;"#),
      &[],
    );
    assert!(!output.contains("__gt_inline_"), "{output}");
  }
}

#[test]
#[should_panic(expected = "cannot read embedded translation modules")]
fn fails_the_build_when_the_modules_dir_is_missing() {
  let cwd = TempCwd::new();
  transform_with_option(
    USEGT_CODE,
    serde_json::json!({
      "locales": ["fr"],
      "modules": { "dir": "missing", "importDir": MODULES_IMPORT_DIR },
    }),
    &cwd.0,
  );
}
