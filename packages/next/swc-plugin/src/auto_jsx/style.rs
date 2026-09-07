//! CSS and intrinsic raw-text payloads must remain outside translation regions
//! and under their original parents.

use std::{collections::HashSet, mem};

use swc_core::{
  common::DUMMY_SP,
  ecma::{
    ast::*,
    visit::{Visit, VisitWith},
  },
};

use super::{
  react_helpers::RuntimeBindings,
  syntax::{expression, expression_mut},
  AutoJsx,
};

#[derive(Default)]
pub(super) struct StyleBindings {
  defaults: HashSet<Id>,
  namespaces: HashSet<Id>,
  create_element: HashSet<Id>,
  react_objects: HashSet<Id>,
  custom_jsx: HashSet<Id>,
}

impl StyleBindings {
  pub fn new(program: &Program) -> Self {
    let mut bindings = Self::default();
    if let Program::Module(module) = program {
      for item in &module.body {
        let ModuleItem::ModuleDecl(ModuleDecl::Import(import)) = item else {
          continue;
        };
        if import.type_only {
          continue;
        }
        let source = import.src.value.to_string_lossy();
        if source.ends_with("/jsx-runtime") || source.ends_with("/jsx-dev-runtime") {
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
            if matches!(original.as_str(), "jsx" | "jsxs" | "jsxDEV") {
              bindings.custom_jsx.insert(named.local.to_id());
            }
          }
        }
        if import.src.value == "react" {
          for specifier in &import.specifiers {
            match specifier {
              ImportSpecifier::Default(default) => {
                bindings.react_objects.insert(default.local.to_id());
              }
              ImportSpecifier::Namespace(namespace) => {
                bindings.react_objects.insert(namespace.local.to_id());
              }
              ImportSpecifier::Named(named) if !named.is_type_only => {
                let original = match &named.imported {
                  Some(ModuleExportName::Ident(name)) => name.sym.to_string(),
                  Some(ModuleExportName::Str(name)) => name.value.to_string_lossy().into_owned(),
                  None => named.local.sym.to_string(),
                };
                if original == "createElement" {
                  bindings.create_element.insert(named.local.to_id());
                } else if original == "default" {
                  bindings.react_objects.insert(named.local.to_id());
                }
              }
              _ => {}
            }
          }
        }
        if import.src.value != "styled-jsx/style" {
          continue;
        }
        for specifier in &import.specifiers {
          match specifier {
            ImportSpecifier::Default(default) => {
              bindings.defaults.insert(default.local.to_id());
            }
            ImportSpecifier::Namespace(namespace) => {
              bindings.namespaces.insert(namespace.local.to_id());
            }
            ImportSpecifier::Named(named) if !named.is_type_only => {
              let default = match &named.imported {
                Some(ModuleExportName::Ident(name)) => name.sym == "default",
                Some(ModuleExportName::Str(name)) => name.value == "default",
                None => named.local.sym == "default",
              };
              if default {
                bindings.defaults.insert(named.local.to_id());
              }
            }
            _ => {}
          }
        }
      }
    }
    bindings
  }

  pub fn element(&self, element: &JSXElement) -> bool {
    match &element.opening.name {
      JSXElementName::Ident(name) => {
        matches!(name.sym.as_ref(), "style" | "script" | "title" | "textarea")
          || self.defaults.contains(&name.to_id())
      }
      JSXElementName::JSXMemberExpr(member) => {
        member.prop.sym == "default"
          && matches!(&member.obj, JSXObject::Ident(name) if self.namespaces.contains(&name.to_id()))
      }
      _ => false,
    }
  }

  fn component(&self, value: &Expr) -> bool {
    match expression(value) {
      Expr::Lit(Lit::Str(name)) => matches!(
        name.value.to_string_lossy().as_ref(),
        "style" | "script" | "title" | "textarea"
      ),
      Expr::Ident(name) => self.defaults.contains(&name.to_id()),
      Expr::Member(member) => {
        let default = match &member.prop {
          MemberProp::Ident(name) => name.sym == "default",
          MemberProp::Computed(key) => {
            matches!(expression(&key.expr), Expr::Lit(Lit::Str(name)) if name.value == "default")
          }
          _ => false,
        };
        default
          && matches!(expression(&member.obj), Expr::Ident(name) if self.namespaces.contains(&name.to_id()))
      }
      _ => false,
    }
  }

  pub fn call(&self, call: &CallExpr, runtime: &RuntimeBindings) -> bool {
    (runtime.owner(call).is_some()
      || self.is_create_element(call)
      || matches!(&call.callee, Callee::Expr(callee) if matches!(expression(callee), Expr::Ident(name) if self.custom_jsx.contains(&name.to_id()))))
      && call
        .args
        .first()
        .is_some_and(|arg| arg.spread.is_none() && self.component(&arg.expr))
  }

  fn is_create_element(&self, call: &CallExpr) -> bool {
    let Callee::Expr(callee) = &call.callee else {
      return false;
    };
    match expression(callee) {
      Expr::Ident(name) => self.create_element.contains(&name.to_id()),
      Expr::Member(member) => {
        let create_element = match &member.prop {
          MemberProp::Ident(name) => name.sym == "createElement",
          MemberProp::Computed(key) => {
            matches!(expression(&key.expr), Expr::Lit(Lit::Str(name)) if name.value == "createElement")
          }
          _ => false,
        };
        create_element
          && matches!(expression(&member.obj), Expr::Ident(name) if self.react_objects.contains(&name.to_id()))
      }
      _ => false,
    }
  }

  pub fn contains<T>(&self, node: &T, runtime: &RuntimeBindings) -> bool
  where
    T: for<'a> VisitWith<ContainsStyle<'a>>,
  {
    let mut visitor = ContainsStyle {
      bindings: self,
      runtime,
      found: false,
    };
    node.visit_with(&mut visitor);
    visitor.found
  }
}

pub(super) struct ContainsStyle<'a> {
  bindings: &'a StyleBindings,
  runtime: &'a RuntimeBindings,
  found: bool,
}

impl Visit for ContainsStyle<'_> {
  fn visit_jsx_element(&mut self, element: &JSXElement) {
    if self.bindings.element(element) {
      self.found = true;
    } else if !self.found {
      element.visit_children_with(self);
    }
  }

  fn visit_call_expr(&mut self, call: &CallExpr) {
    if self.bindings.call(call, self.runtime) {
      self.found = true;
    } else if !self.found {
      call.visit_children_with(self);
    }
  }
}

impl AutoJsx {
  pub(super) fn has_style<T>(&self, node: &T) -> bool
  where
    T: for<'a> VisitWith<ContainsStyle<'a>>,
  {
    // Most files have no CSS/raw-text elements. Avoid repeated descendant scans
    // in their independent JSX regions after the single initial inventory.
    self.has_raw_text_boundaries && self.styles.contains(node, &self.bindings.runtime)
  }

  pub(super) fn process_style_child_boundaries(&mut self, children: &mut Vec<JSXElementChild>) {
    let mut result = Vec::with_capacity(children.len());
    let mut segment = vec![];
    for mut child in mem::take(children) {
      if self.has_style(&child) {
        self.process_child_list(&mut segment, false);
        result.append(&mut segment);
        match &mut child {
          JSXElementChild::JSXElement(element) => self.process_element(element, false),
          JSXElementChild::JSXFragment(fragment) => self.process_fragment(fragment, false),
          JSXElementChild::JSXExprContainer(JSXExprContainer {
            expr: JSXExpr::Expr(expr),
            ..
          }) => {
            self.process_children_expression(expr, false);
          }
          _ => {}
        }
        result.push(child);
      } else {
        segment.push(child);
      }
    }
    self.process_child_list(&mut segment, false);
    result.append(&mut segment);
    *children = result;
  }

  pub(super) fn process_style_array_boundaries(&mut self, array: &mut ArrayLit) {
    let mut result = Vec::with_capacity(array.elems.len());
    let mut segment = vec![];
    for mut item in mem::take(&mut array.elems) {
      if item.as_ref().is_some_and(|item| self.has_style(&item.expr)) {
        self.process_style_array_segment(&mut result, mem::take(&mut segment));
        if let Some(item) = &mut item {
          if item.spread.is_none() {
            self.process_single_expression(&mut item.expr, false);
          }
        }
        result.push(item);
      } else {
        segment.push(item);
      }
    }
    self.process_style_array_segment(&mut result, segment);
    array.elems = result;
  }

  fn process_style_array_segment(
    &mut self,
    output: &mut Vec<Option<ExprOrSpread>>,
    mut segment: Vec<Option<ExprOrSpread>>,
  ) {
    if segment.is_empty() {
      return;
    }
    if segment.len() == 1 {
      if let Some(Some(item)) = segment.first_mut() {
        if item.spread.is_none() {
          self.process_children_expression(&mut item.expr, false);
        }
      }
      output.extend(segment);
      return;
    }
    let mut value = Box::new(Expr::Array(ArrayLit {
      span: DUMMY_SP,
      elems: segment,
    }));
    self.process_children_expression(&mut value, false);
    if let Expr::Array(array) = expression_mut(&mut value) {
      output.append(&mut array.elems);
    } else {
      output.push(Some(ExprOrSpread {
        spread: None,
        expr: value,
      }));
    }
  }
}
