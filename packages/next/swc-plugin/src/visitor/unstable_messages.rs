//! Experimental: hash the tagged-template messages of the unstable `t`,
//! `useGT()` and `getGT()` (gt`...`, gt({ context })`...`) to find the
//! translations to embed at their call sites.
//!
//! Only the subset every tool agrees on is handled: literal options with
//! identifier keys, and holes that are all named variables like `${{ name }}`.
//! @generaltranslation/compiler embeds the same call sites, and the CLI leaves
//! them out of `files.gt.inlineTranslations.msgOutput` files
//! (packages/cli/src/react/jsx/utils/stringParsing/extractMessageTrees/isEmbeddedMessage.ts).
//! Other templates are left to loaded translations.

use crate::hash::JsxHasher;
use serde_json::{Map, Value};
use swc_core::ecma::ast::*;

/// Mirrors UNSTABLE_GT_IMPORT_SOURCES in packages/core/src/settings/unstableImportSources.ts
const UNSTABLE_IMPORT_SOURCES: &[&str] = &[
  "gt-i18n/unstable",
  "gt-react/unstable",
  "gt-next/unstable",
  "gt-next/unstable/server",
  "gt-tanstack-start/unstable",
  "gt-react-native/unstable",
  "gt-node/unstable",
  "@generaltranslation/react-core/unstable",
];

/// Names the scope tracker records for unstable imports and their results.
/// The prefix keeps them apart from the stable `useGT`/`getGT` names.
pub const UNSTABLE_T: &str = "unstable:t";
pub const UNSTABLE_USE_GT: &str = "unstable:useGT";
pub const UNSTABLE_GET_GT: &str = "unstable:getGT";
/// `const gt = useGT()` / `const gt = await getGT()` from an unstable source
pub const UNSTABLE_GT_CALLBACK: &str = "unstable:gt";

// Anonymous values are named `_gt_N`; user names must not collide.
const RESERVED_NAME_PREFIX: &str = "_gt_";

pub fn is_unstable_import_source(source: &str) -> bool {
  UNSTABLE_IMPORT_SOURCES.contains(&source)
}

/// Tracked name of an unstable export, or None for exports that are never embedded
pub fn unstable_tracked_name(imported: &str) -> Option<&'static str> {
  match imported {
    "t" => Some(UNSTABLE_T),
    "useGT" => Some(UNSTABLE_USE_GT),
    "getGT" => Some(UNSTABLE_GET_GT),
    _ => None,
  }
}

/// Catalog hash of a template, as the runtime computes it, or None outside
/// the supported subset.
pub fn hash_unstable_message(tpl: &Tpl, options: Option<&ObjectLit>) -> Option<String> {
  let mut data = options.map_or(Some(Map::new()), parse_options)?;

  let mut nodes: Vec<Value> = Vec::new();
  for (index, quasi) in tpl.quasis.iter().enumerate() {
    // Template text is always literal; an invalid escape has no cooked value
    let text = quasi.cooked.as_ref()?.to_string_lossy().into_owned();
    append_text(&mut nodes, text);
    if let Some(hole) = tpl.exprs.get(index) {
      nodes.push(Value::Array(vec![Value::String(named_variable(hole)?)]));
    }
  }
  // Without placeholders, a tree is its text
  let tree = match nodes.len() {
    0 => Value::String(String::new()),
    1 if nodes[0].is_string() => nodes.remove(0),
    _ => Value::Array(nodes),
  };

  data.insert("source".into(), tree);
  data.insert("dataFormat".into(), Value::String("MESSAGE_TREE".into()));
  let stringified = JsxHasher::stable_stringify(&Value::Object(data)).ok()?;
  Some(JsxHasher::hash_string(&stringified))
}

/// Merges text into the text just before it and drops empty text
fn append_text(nodes: &mut Vec<Value>, text: String) {
  if text.is_empty() {
    return;
  }
  if let Some(Value::String(last)) = nodes.last_mut() {
    last.push_str(&text);
  } else {
    nodes.push(Value::String(text));
  }
}

/// Hash metadata from literal options, as hashSource includes it
fn parse_options(options: &ObjectLit) -> Option<Map<String, Value>> {
  let mut context = None;
  let mut max_chars = None;
  let mut requires_review = None;
  for prop in &options.props {
    let PropOrSpread::Prop(prop) = prop else {
      return None;
    };
    let Prop::KeyValue(kv) = prop.as_ref() else {
      return None;
    };
    let PropName::Ident(key) = &kv.key else {
      return None;
    };
    match key.sym.as_ref() {
      "context" => context = Some(static_text(&kv.value)?),
      "maxChars" => max_chars = Some(integer(&kv.value)?),
      "requiresReview" => match kv.value.as_ref() {
        Expr::Lit(Lit::Bool(value)) => requires_review = Some(value.value),
        _ => return None,
      },
      _ => return None,
    }
  }
  let mut data = Map::new();
  if let Some(context) = context.filter(|context| !context.is_empty()) {
    data.insert("context".into(), Value::String(context));
  }
  if let Some(max_chars) = max_chars {
    data.insert("maxChars".into(), Value::from(max_chars.unsigned_abs()));
  }
  // false and absent hash the same
  if requires_review == Some(true) {
    data.insert("requiresReview".into(), Value::Bool(true));
  }
  Some(data)
}

fn static_text(expr: &Expr) -> Option<String> {
  match expr {
    Expr::Lit(Lit::Str(value)) => Some(value.value.to_string_lossy().into_owned()),
    Expr::Tpl(tpl) if tpl.exprs.is_empty() && tpl.quasis.len() == 1 => tpl.quasis[0]
      .cooked
      .as_ref()
      .map(|cooked| cooked.to_string_lossy().into_owned()),
    _ => None,
  }
}

// Integers JavaScript represents exactly
const MAX_SAFE_INTEGER: f64 = 9_007_199_254_740_991.0;

fn integer(expr: &Expr) -> Option<i64> {
  let (number, sign) = match expr {
    Expr::Lit(Lit::Num(number)) => (number.value, 1),
    Expr::Unary(UnaryExpr {
      op: UnaryOp::Minus,
      arg,
      ..
    }) => match arg.as_ref() {
      Expr::Lit(Lit::Num(number)) => (number.value, -1),
      _ => return None,
    },
    _ => return None,
  };
  (number.fract() == 0.0 && number.abs() <= MAX_SAFE_INTEGER).then(|| sign * number as i64)
}

/// Name of a `${{ name }}` or `${{ name: value }}` hole
fn named_variable(hole: &Expr) -> Option<String> {
  let Expr::Object(object) = unwrap_typescript(hole) else {
    return None;
  };
  let [PropOrSpread::Prop(prop)] = object.props.as_slice() else {
    return None;
  };
  let name = match prop.as_ref() {
    Prop::Shorthand(ident) => ident.sym.to_string(),
    Prop::KeyValue(kv) => match &kv.key {
      PropName::Ident(ident) => ident.sym.to_string(),
      PropName::Str(value) => value.value.to_string_lossy().into_owned(),
      PropName::Num(number) => integer_key(number.value)?,
      _ => return None,
    },
    _ => return None,
  };
  // A literal __proto__ key sets the prototype instead of a property
  let valid =
    name != "__proto__" && !name.starts_with(RESERVED_NAME_PREFIX) && is_argument_name(&name);
  valid.then_some(name)
}

/// A numeric key as JavaScript prints it, for the integers it prints plainly
fn integer_key(value: f64) -> Option<String> {
  (value.fract() == 0.0 && (0.0..1e21).contains(&value)).then(|| format!("{value:.0}"))
}

/// Strips TypeScript-only wrappers (as, satisfies, !, <Type>) and parentheses
fn unwrap_typescript(mut expr: &Expr) -> &Expr {
  loop {
    expr = match expr {
      Expr::Paren(inner) => &inner.expr,
      Expr::TsAs(inner) => &inner.expr,
      Expr::TsSatisfies(inner) => &inner.expr,
      Expr::TsNonNull(inner) => &inner.expr,
      Expr::TsTypeAssertion(inner) => &inner.expr,
      Expr::TsConstAssertion(inner) => &inner.expr,
      _ => return expr,
    };
  }
}

/// Whether `name` parses back as a single ICU argument name. Mirrors
/// isArgumentName and IDENTIFIER_BOUNDARY in packages/icu/src/settings/syntax.ts.
pub fn is_argument_name(name: &str) -> bool {
  !name.is_empty() && !name.chars().any(is_identifier_boundary)
}

fn is_identifier_boundary(character: char) -> bool {
  matches!(
    character as u32,
    0x09..=0x0D
      | 0x20
      | 0x85
      | 0xA0
      | 0x1680
      | 0x2000..=0x200A
      | 0x200E
      | 0x200F
      | 0x2028
      | 0x2029
      | 0x202F
      | 0x205F
      | 0x3000
      | 0x21..=0x2F
      | 0x3A..=0x40
      | 0x5B..=0x5E
      | 0x60
      | 0x7B..=0x7E
      | 0xA1..=0xA7
      | 0xA9
      | 0xAB
      | 0xAC
      | 0xAE
      | 0xB0
      | 0xB1
      | 0xB6
      | 0xBB
      | 0xBF
      | 0xD7
      | 0xF7
      | 0x2010..=0x2027
      | 0x2030..=0x203E
      | 0x2041..=0x2053
      | 0x2055..=0x205E
      | 0x2190..=0x245F
      | 0x2500..=0x2775
      | 0x2794..=0x2BFF
      | 0x2E00..=0x2E7F
      | 0x3001..=0x3003
      | 0x3008..=0x3020
      | 0x3030
      | 0xFD3E..=0xFD3F
      | 0xFE45..=0xFE46
  )
}

#[cfg(test)]
mod tests {
  use super::is_argument_name;

  #[test]
  fn accepts_identifier_names() {
    for name in ["name", "first_name", "count2", "名前", "x"] {
      assert!(is_argument_name(name), "{name}");
    }
  }

  #[test]
  fn rejects_names_icu_splits() {
    for name in [
      "",
      "first name",
      "$name",
      "a-b",
      "a.b",
      "a{b",
      "a\u{2028}b",
      "«a»",
    ] {
      assert!(!is_argument_name(name), "{name}");
    }
  }
}
