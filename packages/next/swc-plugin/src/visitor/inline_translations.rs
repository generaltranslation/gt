//! Build the inline translations callbacks embedded at translation call sites:
//! `(locale) => locale === "fr" ? … : locale === "es" ? … : undefined`.
//!
//! Mirrors @generaltranslation/compiler's
//! `transform/injection/inline-translations/buildInlineTranslationsFunction.ts`.

use crate::config::LocaleTranslations;
use swc_core::{
  common::{Span, SyntaxContext},
  ecma::ast::*,
};

const LOCALE_PARAM: &str = "locale";

/// Callback for a single translation hash. None when no embedded locale has a
/// translation for the hash.
pub fn build_inline_translations_fn(
  table: &[(String, LocaleTranslations)],
  hash: &str,
  span: Span,
) -> Option<Expr> {
  let entries: Vec<(&str, Expr)> = table
    .iter()
    .filter_map(|(locale, translations)| {
      get_translation(translations, hash).map(|value| (locale.as_str(), json_to_expr(value, span)))
    })
    .collect();
  build_locale_switch(entries, span)
}

fn get_translation<'a>(translations: &'a LocaleTranslations, hash: &str) -> Option<&'a serde_json::Value> {
  translations.get(hash).filter(|value| !value.is_null())
}

fn build_locale_switch(entries: Vec<(&str, Expr)>, span: Span) -> Option<Expr> {
  if entries.is_empty() {
    return None;
  }

  let body = entries
    .into_iter()
    .rev()
    .fold(undefined_expr(span), |alternate, (locale, translation)| {
      Expr::Cond(CondExpr {
        span,
        test: Box::new(Expr::Bin(BinExpr {
          span,
          op: BinaryOp::EqEqEq,
          left: Box::new(Expr::Ident(ident(LOCALE_PARAM, span))),
          right: Box::new(str_expr(locale, span)),
        })),
        cons: Box::new(translation),
        alt: Box::new(alternate),
      })
    });

  Some(Expr::Arrow(ArrowExpr {
    span,
    ctxt: SyntaxContext::empty(),
    params: vec![Pat::Ident(BindingIdent {
      id: ident(LOCALE_PARAM, span),
      type_ann: None,
    })],
    // `BlockStmtOrExpr` is deprecated in newer swc_core but exists in every supported one
    #[allow(deprecated)]
    body: Box::new(BlockStmtOrExpr::Expr(Box::new(body))),
    is_async: false,
    is_generator: false,
    type_params: None,
    return_type: None,
  }))
}

/// Convert a JSON translation (string, or JSX children object/array) to an
/// expression literal
pub fn json_to_expr(value: &serde_json::Value, span: Span) -> Expr {
  match value {
    serde_json::Value::Null => Expr::Lit(Lit::Null(Null { span })),
    serde_json::Value::Bool(value) => Expr::Lit(Lit::Bool(Bool { span, value: *value })),
    serde_json::Value::Number(number) => Expr::Lit(Lit::Num(Number {
      span,
      value: number.as_f64().unwrap_or_default(),
      raw: None,
    })),
    serde_json::Value::String(value) => str_expr(value, span),
    serde_json::Value::Array(values) => Expr::Array(ArrayLit {
      span,
      elems: values
        .iter()
        .map(|value| {
          Some(ExprOrSpread {
            spread: None,
            expr: Box::new(json_to_expr(value, span)),
          })
        })
        .collect(),
    }),
    serde_json::Value::Object(entries) => Expr::Object(ObjectLit {
      span,
      props: entries
        .iter()
        .map(|(key, value)| {
          PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
            key: PropName::Str(Str {
              span,
              value: key.as_str().into(),
              raw: None,
            }),
            value: Box::new(json_to_expr(value, span)),
          })))
        })
        .collect(),
    }),
  }
}

fn ident(name: &str, span: Span) -> Ident {
  Ident::new(name.into(), span, SyntaxContext::empty())
}

fn str_expr(value: &str, span: Span) -> Expr {
  Expr::Lit(Lit::Str(Str {
    span,
    value: value.into(),
    raw: None,
  }))
}

pub fn undefined_expr(span: Span) -> Expr {
  Expr::Ident(ident("undefined", span))
}
