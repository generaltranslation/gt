//! Match the JSX runtime selected by the host before inserting React helpers.

use serde::Deserialize;
use swc_core::{
  common::{
    comments::{Comment, CommentKind, Comments},
    Span, Spanned,
  },
  ecma::{
    ast::{Expr, Ident, JSXElement, JSXFragment, Lit, ModuleItem, Program, Stmt},
    visit::{Visit, VisitWith},
  },
};

/// Internal host context; Next.js normally selects the automatic runtime.
#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum JsxRuntime {
  Automatic,
  Classic,
}

const REACT_IMPORT_SOURCE: &str = "react";

/// Consume the trailing context statement emitted by the owned Turbopack loader.
/// The caller must opt into this protocol; ordinary source never uses it.
pub(crate) fn take_loader_import_source(
  program: &mut Program,
  comments: Option<&dyn Comments>,
  missing_context_diagnostic: Option<&str>,
) -> Option<&'static str> {
  let last = match program {
    Program::Module(module) => module.body.last().and_then(|item| match item {
      ModuleItem::Stmt(statement) => Some(statement),
      _ => None,
    }),
    Program::Script(script) => script.body.last(),
  };
  let marker = last.and_then(|statement| {
    let Stmt::Expr(statement) = statement else {
      return None;
    };
    let Expr::Lit(Lit::Str(value)) = statement.expr.as_ref() else {
      return None;
    };
    let source = if value.value == "__GT_AUTO_JSX_IMPORT_SOURCE__:react" {
      REACT_IMPORT_SOURCE
    } else if value.value == "__GT_AUTO_JSX_IMPORT_SOURCE__:@emotion/react" {
      "@emotion/react"
    } else {
      return None;
    };
    Some((statement.span, source))
  });
  if let Some((marker_span, source)) = marker {
    let mut removed = vec![marker_span];
    // The loader emits \n;\n"marker";\n. Its separator may terminate the
    // preceding statement instead of creating an EmptyStmt. Remove only an
    // actual EmptyStmt at that exact adjacent position, never a user's one.
    let is_separator = |statement: &Stmt| {
      matches!(statement, Stmt::Empty(empty)
        if empty.span.lo.0.checked_add(2) == Some(marker_span.lo.0)
          && empty.span.lo.0.checked_add(1) == Some(empty.span.hi.0))
    };
    let previous = match program {
      Program::Module(module) => {
        module.body.pop();
        if let Some(ModuleItem::Stmt(statement)) = module.body.last() {
          if is_separator(statement) {
            removed.push(statement.span());
            module.body.pop();
          }
        }
        module.body.last().map(Spanned::span)
      }
      Program::Script(script) => {
        script.body.pop();
        if let Some(statement) = script.body.last() {
          if is_separator(statement) {
            removed.push(statement.span());
            script.body.pop();
          }
        }
        script.body.last().map(Spanned::span)
      }
    };
    if let Some(comments) = comments {
      let mut retained = vec![];
      for span in removed.into_iter().rev() {
        retained.extend(comments.take_leading(span.lo).unwrap_or_default());
        retained.extend(comments.take_trailing(span.hi).unwrap_or_default());
      }
      if let Some(previous) = previous {
        comments.add_trailing_comments(previous.hi, retained);
      } else {
        comments.add_leading_comments(program.span().lo, retained);
      }
    }
    return Some(source);
  }

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
  assert!(
    !contains_jsx.0,
    "{}",
    // withGTConfig supplies the shared TypeScript diagnostic formatter's text.
    // Direct native tests have no framework configuration or user-facing logger.
    missing_context_diagnostic.unwrap_or("Missing JSX runtime context from the configured loader")
  );
  None
}

#[derive(Default)]
struct Directives {
  runtime: Option<JsxRuntime>,
  import_source: Option<String>,
  factory: bool,
}

impl Directives {
  fn from_comments(comments: &[Comment]) -> Self {
    let mut directives = Self::default();
    // Follow SWC's JsxDirectives::from_comments, including line boundaries,
    // block-only comments, paired tokens and last-wins ordering within a
    // comment group. @jsxImportSource also selects the automatic runtime.
    // https://github.com/swc-project/swc/blob/v1.15.3/crates/swc_ecma_transforms_react/src/jsx/mod.rs
    for comment in comments {
      if comment.kind != CommentKind::Block {
        continue;
      }
      for line in comment.text.lines() {
        let line = line.trim();
        let line = line.strip_prefix('*').map(str::trim).unwrap_or(line);
        if !line.starts_with("@jsx") {
          continue;
        }
        let mut words = line.split_whitespace();
        while let Some(directive) = words.next() {
          let value = words.next();
          match (directive, value) {
            ("@jsxRuntime", Some("automatic")) => {
              directives.runtime = Some(JsxRuntime::Automatic);
            }
            ("@jsxRuntime", Some("classic")) => {
              directives.runtime = Some(JsxRuntime::Classic);
            }
            ("@jsxImportSource", Some(source)) => {
              directives.runtime = Some(JsxRuntime::Automatic);
              directives.import_source = Some(source.into());
            }
            ("@jsx" | "@jsxFrag", Some(factory)) if valid_factory(factory) => {
              directives.factory = true;
            }
            _ => {}
          }
        }
      }
    }
    directives
  }

  fn found(&self) -> bool {
    self.runtime.is_some() || self.import_source.is_some() || self.factory
  }
}

fn valid_factory(factory: &str) -> bool {
  factory.chars().next().is_some_and(Ident::is_valid_start)
    && factory
      .chars()
      .all(|c| Ident::is_valid_continue(c) || c == '.')
}

/// The compiler recognizes only automatic JSX calls imported from React.
/// Other runtime choices leave auto insertion off, without disabling hashing.
pub(crate) fn allows_injection(
  program: &Program,
  comments: Option<&dyn Comments>,
  runtime: Option<JsxRuntime>,
  import_source: Option<&str>,
) -> bool {
  let mut runtime = runtime.unwrap_or(JsxRuntime::Automatic);
  let mut import_source = import_source.unwrap_or(REACT_IMPORT_SOURCE).to_owned();
  if let Some(comments) = comments {
    let mut apply = |span: Span| {
      let directives =
        Directives::from_comments(&comments.get_leading(span.lo).unwrap_or_default());
      let found = directives.found();
      if let Some(value) = directives.runtime {
        runtime = value;
      }
      if let Some(value) = directives.import_source {
        import_source = value;
      }
      found
    };
    // SWC inspects the program's comments, then the first top-level item
    // carrying recognized directives. Nested/trailing comments are ignored.
    apply(program.span());
    match program {
      Program::Module(module) => {
        for item in &module.body {
          if apply(item.span()) {
            break;
          }
        }
      }
      Program::Script(script) => {
        for statement in &script.body {
          if apply(statement.span()) {
            break;
          }
        }
      }
    }
  }
  runtime == JsxRuntime::Automatic && import_source == REACT_IMPORT_SOURCE
}
