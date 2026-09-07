use std::collections::{HashMap, HashSet};

use super::react_helpers::RuntimeBindings;

use swc_core::{
  common::{SyntaxContext, DUMMY_SP},
  ecma::{
    ast::*,
    visit::{Visit, VisitWith},
  },
};

pub(super) const TRANSLATE: &str = "GtInternalTranslateJsx";
pub(super) const VARIABLE: &str = "GtInternalVar";

/// The Babel insertion pass recognizes named imports, including aliases, from
/// these sources. Namespace members and similarly named local components are
/// deliberately not treated as GT components.
fn is_gt_source(source: &str) -> bool {
  matches!(
    source,
    "gt-next" | "gt-next/server" | "gt-react" | "gt-react/client" | "gt-react/browser" | "gt-i18n"
  )
}

pub(super) struct Bindings {
  imported: HashMap<Id, String>,
  pub runtime: RuntimeBindings,
  pub translate: Ident,
  pub variable: Ident,
}

#[derive(Default)]
pub(super) struct IdentifierNames(HashMap<String, HashSet<SyntaxContext>>);

impl Visit for IdentifierNames {
  fn visit_ident(&mut self, name: &Ident) {
    self
      .0
      .entry(name.sym.to_string())
      .or_default()
      .insert(name.ctxt);
  }
}

impl IdentifierNames {
  pub fn fresh(&self, base: &str) -> Ident {
    let mut name = base.to_owned();
    let mut suffix = 1;
    while self.0.contains_key(&name) {
      name = format!("{base}{suffix}");
      suffix += 1;
    }
    Ident::new(
      name.into(),
      DUMMY_SP,
      SyntaxContext::empty().apply_mark(swc_core::common::Mark::new()),
    )
  }

  pub fn is_unshadowed(&self, name: &Ident) -> bool {
    self
      .0
      .get(name.sym.as_ref())
      .is_some_and(|contexts| contexts.iter().all(|context| *context == name.ctxt))
  }
}

impl Bindings {
  pub fn new(program: &Program) -> Self {
    let mut imported = HashMap::new();
    if let Program::Module(module) = program {
      for item in &module.body {
        let ModuleItem::ModuleDecl(ModuleDecl::Import(import)) = item else {
          continue;
        };
        if import.type_only {
          continue;
        }
        let source = import.src.value.to_string_lossy();
        if !is_gt_source(&source) {
          continue;
        }
        for specifier in &import.specifiers {
          let ImportSpecifier::Named(named) = specifier else {
            continue;
          };
          if named.is_type_only {
            continue;
          }
          let original = match &named.imported {
            Some(ModuleExportName::Ident(name)) => name.sym.to_string(),
            Some(ModuleExportName::Str(name)) => name.value.to_string_lossy().into_owned(),
            None => named.local.sym.to_string(),
          };
          imported.insert(named.local.to_id(), original);
        }
      }
    }

    // Dedicated contexts keep injected references safe in functions which
    // shadow an existing import or declare the same spelling locally.
    let mut names = IdentifierNames::default();
    program.visit_with(&mut names);
    let translate = names.fresh(TRANSLATE);
    let variable = names.fresh(VARIABLE);
    let runtime = RuntimeBindings::new(program, &names);
    imported.insert(translate.to_id(), TRANSLATE.into());
    imported.insert(variable.to_id(), VARIABLE.into());
    Self {
      imported,
      runtime,
      translate,
      variable,
    }
  }

  pub fn is_runtime_call(&self, call: &CallExpr) -> bool {
    self.runtime.owner(call).is_some()
  }

  pub fn call_component_name<'a>(&'a self, call: &CallExpr) -> Option<&'a str> {
    let first = call.args.first().filter(|arg| arg.spread.is_none())?;
    let Expr::Ident(name) = super::syntax::expression(&first.expr) else {
      return None;
    };
    self.imported.get(&name.to_id()).map(String::as_str)
  }

  pub fn component_name<'a>(&'a self, element: &JSXElement) -> Option<&'a str> {
    let JSXElementName::Ident(name) = &element.opening.name else {
      return None;
    };
    // React lowers ASCII-lowercase JSX tags to string literals even when an
    // import happens to have that spelling (Unicode identifiers remain valid
    // component references, matching React's /^[a-z]/ compatibility test).
    if name
      .sym
      .as_bytes()
      .first()
      .is_some_and(u8::is_ascii_lowercase)
    {
      return None;
    }
    self.imported.get(&name.to_id()).map(String::as_str)
  }

  pub fn import(&self) -> ModuleItem {
    ModuleItem::ModuleDecl(ModuleDecl::Import(ImportDecl {
      span: DUMMY_SP,
      specifiers: [(TRANSLATE, &self.translate), (VARIABLE, &self.variable)]
        .into_iter()
        .map(|(original, local)| {
          ImportSpecifier::Named(ImportNamedSpecifier {
            span: DUMMY_SP,
            local: local.clone(),
            imported: Some(ModuleExportName::Ident(Ident::new_no_ctxt(
              original.into(),
              DUMMY_SP,
            ))),
            is_type_only: false,
          })
        })
        .collect(),
      src: Box::new(Str {
        span: DUMMY_SP,
        value: "gt-next".into(),
        raw: None,
      }),
      type_only: false,
      with: None,
      phase: ImportPhase::Evaluation,
    }))
  }
}

pub(super) fn is_user_variable(name: Option<&str>) -> bool {
  matches!(
    name,
    Some("Var" | "Num" | "Currency" | "DateTime" | "RelativeTime")
  )
}

pub(super) fn is_opaque(name: Option<&str>) -> bool {
  matches!(name, Some("Branch" | "Plural" | "Derive"))
}

pub(super) fn is_control_prop(component: &str, prop: &str) -> bool {
  match component {
    "Branch" => prop == "branch" || prop.starts_with("data-"),
    "Plural" => matches!(prop, "n" | "locales"),
    _ => false,
  }
}
