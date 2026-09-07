//! Resolved React helper identities and collision-safe counterpart imports.

use std::{cell::Cell, collections::HashMap};

use swc_core::{common::DUMMY_SP, ecma::ast::*};

use super::{bindings::IdentifierNames, syntax::expression};

const SOURCES: [&str; 3] = ["react", "react/jsx-runtime", "react/jsx-dev-runtime"];

struct Helper {
  source: usize,
  name: String,
  local: Ident,
  unshadowed: bool,
}

struct GeneratedHelper {
  source: usize,
  name: &'static str,
  local: Ident,
  used: Cell<bool>,
}

pub(super) struct RuntimeBindings {
  original: HashMap<Id, Helper>,
  imported: Vec<Id>,
  generated: Vec<GeneratedHelper>,
}

impl RuntimeBindings {
  pub fn new(program: &Program, names: &IdentifierNames) -> Self {
    let mut original = HashMap::new();
    let mut imported = vec![];
    if let Program::Module(module) = program {
      for item in &module.body {
        let ModuleItem::ModuleDecl(ModuleDecl::Import(import)) = item else {
          continue;
        };
        if import.type_only {
          continue;
        }
        let Some(source) = SOURCES
          .iter()
          .position(|source| import.src.value == *source)
        else {
          continue;
        };
        for specifier in &import.specifiers {
          let ImportSpecifier::Named(named) = specifier else {
            continue;
          };
          if named.is_type_only {
            continue;
          }
          let name = match &named.imported {
            Some(ModuleExportName::Ident(name)) => name.sym.to_string(),
            Some(ModuleExportName::Str(name)) => name.value.to_string_lossy().into_owned(),
            None => named.local.sym.to_string(),
          };
          if matches!(name.as_str(), "jsx" | "jsxs" | "jsxDEV") {
            let id = named.local.to_id();
            imported.push(id.clone());
            original.insert(
              id,
              Helper {
                source,
                name,
                local: named.local.clone(),
                unshadowed: names.is_unshadowed(&named.local),
              },
            );
          }
        }
      }
    }
    let generated = SOURCES
      .iter()
      .enumerate()
      .flat_map(|(source, _)| {
        ["jsx", "jsxs"]
          .into_iter()
          .map(move |name| GeneratedHelper {
            source,
            name,
            local: names.fresh(&format!(
              "gtAuto{}{}",
              if name == "jsx" { "Jsx" } else { "Jsxs" },
              source
            )),
            used: Cell::new(false),
          })
      })
      .collect();
    Self {
      original,
      imported,
      generated,
    }
  }

  pub fn owner(&self, call: &CallExpr) -> Option<Id> {
    let Callee::Expr(callee) = &call.callee else {
      return None;
    };
    let Expr::Ident(name) = expression(callee) else {
      return None;
    };
    let id = name.to_id();
    self.original.contains_key(&id).then_some(id)
  }

  pub fn development(&self, owner: Option<&Id>) -> bool {
    owner
      .and_then(|owner| self.original.get(owner))
      .is_some_and(|helper| helper.name == "jsxDEV")
  }

  pub fn callee(&self, owner: Option<&Id>, array: bool) -> Ident {
    let helper = owner.and_then(|owner| self.original.get(owner));
    let wanted = if array { "jsxs" } else { "jsx" };
    if let Some(helper) = helper {
      if helper.name == "jsxDEV" || helper.name == wanted {
        return helper.local.clone();
      }
    }
    let source = helper.map_or(1, |helper| helper.source);
    // Introducing a reference to another import in a scope which shadows it
    // makes hygiene rename the user's local binding, changing inferred function
    // names. Reuse counterparts only when their spelling is unambiguous across
    // the file; a fresh helper remains safe in every insertion scope. The actual
    // owning callee above is already proven visible by its resolved reference.
    if let Some(helper) = self
      .imported
      .iter()
      .filter_map(|id| self.original.get(id))
      .find(|helper| helper.source == source && helper.name == wanted && helper.unshadowed)
    {
      return helper.local.clone();
    }
    let helper = &self.generated[source * 2 + usize::from(array)];
    helper.used.set(true);
    helper.local.clone()
  }

  pub fn update_to_single(&self, call: &mut CallExpr, owner: &Id) {
    let Some(helper) = self.original.get(owner) else {
      return;
    };
    if helper.name == "jsxs" {
      call.callee = Callee::Expr(Box::new(Expr::Ident(self.callee(Some(owner), false))));
    } else if helper.name == "jsxDEV" {
      if let Some(arg) = call.args.get_mut(3).filter(|arg| arg.spread.is_none()) {
        if let Expr::Lit(Lit::Bool(value)) = arg.expr.as_mut() {
          value.value = false;
        }
      }
    }
  }

  pub fn imports(&self) -> Vec<ModuleItem> {
    SOURCES
      .iter()
      .enumerate()
      .filter_map(|(source, source_name)| {
        let specifiers: Vec<_> = self
          .generated
          .iter()
          .filter(|helper| helper.source == source && helper.used.get())
          .map(|helper| {
            ImportSpecifier::Named(ImportNamedSpecifier {
              span: DUMMY_SP,
              local: helper.local.clone(),
              imported: Some(ModuleExportName::Ident(Ident::new_no_ctxt(
                helper.name.into(),
                DUMMY_SP,
              ))),
              is_type_only: false,
            })
          })
          .collect();
        if specifiers.is_empty() {
          return None;
        }
        Some(ModuleItem::ModuleDecl(ModuleDecl::Import(ImportDecl {
          span: DUMMY_SP,
          specifiers,
          src: Box::new(Str {
            span: DUMMY_SP,
            value: (*source_name).into(),
            raw: None,
          }),
          type_only: false,
          with: None,
          phase: ImportPhase::Evaluation,
        })))
      })
      .collect()
  }
}
