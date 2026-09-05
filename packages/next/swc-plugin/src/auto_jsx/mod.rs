//! Automatic JSX insertion, independently applied before hash collection.
//!
//! This mirrors `@generaltranslation/compiler`'s JSX insertion pass on raw
//! JSX. The recursive child walk owns an automatic translation region; the
//! ordinary SWC walk subsequently discovers independent JSX in attributes,
//! callbacks and other expressions. Keeping those walks separate is essential:
//! the compiler does not propagate an automatic region through a conditional.

mod bindings;
mod identity;
mod runtime;
mod source_comments;
mod syntax;

pub use runtime::JsxRuntime;
pub(crate) use runtime::{allows_injection, take_loader_import_source};
pub(crate) use source_comments::recover_runtime_comments;

#[cfg(test)]
mod tests;

use std::{collections::HashSet, mem};

use bindings::{is_control_prop, is_opaque, is_user_variable, Bindings, TRANSLATE, VARIABLE};
use swc_core::{
  common::{Span, DUMMY_SP},
  ecma::{
    ast::*,
    visit::{VisitMut, VisitMutWith},
  },
};
use syntax::{
  attr_expr, children_location, expr_child, expression, expression_has_text, expression_mut,
  has_text, inline_object, is_runtime_jsx, meaningful_child, needs_variable,
  object_property_expression, property_name, set_object_property_expression, wrap,
  ChildrenLocation,
};

/// Insert automatic translation and variable components in a resolved program.
/// Import and reference IDs must already carry resolver syntax contexts, as in
/// the SWC plugin pipeline, so shadowed names are distinguished from imports.
pub fn inject_auto_jsx(program: &mut Program) {
  let identity = identity::NodeIdentity::assign(program);
  let mut visitor = AutoJsx {
    bindings: Bindings::new(program),
    processed: HashSet::new(),
    insertions: 0,
  };
  program.visit_mut_with(&mut visitor);
  identity.restore(program);
  if visitor.insertions == 0 {
    return;
  }
  let import = visitor.bindings.import();
  match program {
    Program::Module(module) => {
      // Preserve directive prologues such as "use client".
      let position = module.body.iter().take_while(|item| matches!(item,
        ModuleItem::Stmt(Stmt::Expr(ExprStmt { expr, .. })) if matches!(expr.as_ref(), Expr::Lit(Lit::Str(_)))
      )).count();
      module.body.insert(position, import);
    }
    Program::Script(script) => {
      let position = script
        .body
        .iter()
        .take_while(|statement| {
          matches!(statement,
            Stmt::Expr(ExprStmt { expr, .. }) if matches!(expr.as_ref(), Expr::Lit(Lit::Str(_)))
          )
        })
        .count();
      let mut body: Vec<_> = mem::take(&mut script.body)
        .into_iter()
        .map(ModuleItem::Stmt)
        .collect();
      body.insert(position, import);
      *program = Program::Module(Module {
        span: script.span,
        body,
        shebang: script.shebang.take(),
      });
    }
  }
}

struct AutoJsx {
  bindings: Bindings,
  /// Original JSX spans (or temporary keys from NodeIdentity) stay stable when
  /// children move into a wrapper. Generated wrappers have DUMMY_SP and are
  /// recognized by their dedicated import IDs instead of this set.
  processed: HashSet<Span>,
  insertions: usize,
}

impl AutoJsx {
  fn mark(&mut self, span: Span) {
    if span != DUMMY_SP {
      self.processed.insert(span);
    }
  }

  fn process_element(&mut self, element: &mut JSXElement, inside: bool) {
    if !is_runtime_jsx(element) {
      if inside {
        let original = mem::replace(element, wrap(&self.bindings.variable, vec![]));
        element
          .children
          .push(JSXElementChild::JSXElement(Box::new(original)));
      }
      return;
    }
    self.mark(element.span);
    let component = self.bindings.component_name(element).map(str::to_owned);
    if component.as_deref() == Some("T") || is_user_variable(component.as_deref()) {
      self.mark_element_children(element);
      return;
    }
    if matches!(component.as_deref(), Some(TRANSLATE | VARIABLE)) {
      return;
    }
    if is_opaque(component.as_deref()) {
      self.process_opaque_props(element, component.as_deref().unwrap_or_default());
      if !inside {
        let original = mem::replace(element, wrap(&self.bindings.translate, vec![]));
        element
          .children
          .push(JSXElementChild::JSXElement(Box::new(original)));
        self.insertions += 1;
      }
      return;
    }
    self.process_element_children(element, inside);
  }

  fn process_fragment(&mut self, fragment: &mut JSXFragment, inside: bool) {
    self.mark(fragment.span);
    self.process_child_list(&mut fragment.children, inside);
  }

  fn process_element_children(&mut self, element: &mut JSXElement, inside: bool) {
    match children_location(element) {
      Some(ChildrenLocation::Attribute(index)) => {
        if let JSXAttrOrSpread::JSXAttr(attr) = &mut element.opening.attrs[index] {
          if let Some(value) = &mut attr.value {
            self.process_children_attribute(value, inside);
          }
        }
      }
      Some(ChildrenLocation::SpreadProperty(index, prop_index)) => {
        if let JSXAttrOrSpread::SpreadElement(spread) = &mut element.opening.attrs[index] {
          if let Expr::Object(object) = expression_mut(&mut spread.expr) {
            if let PropOrSpread::Prop(prop) = &mut object.props[prop_index] {
              if let Some(mut value) = object_property_expression(prop) {
                self.process_children_expression(&mut value, inside);
                set_object_property_expression(prop, value);
              }
            }
          }
        }
      }
      None => self.process_child_list(&mut element.children, inside),
    }
  }

  fn process_children_attribute(&mut self, value: &mut JSXAttrValue, inside: bool) {
    if let JSXAttrValue::Str(text) = value {
      if !inside && has_text(&text.value.to_string_lossy()) {
        // Keep quoted JSX in quoted form. Converting this to a JavaScript
        // string expression would bypass the host's JSX-attribute cleanup.
        let mut translated = wrap(&self.bindings.translate, vec![]);
        translated.opening.self_closing = true;
        translated.closing = None;
        let original = mem::replace(value, JSXAttrValue::JSXElement(Box::new(translated)));
        if let JSXAttrValue::JSXElement(translated) = value {
          translated
            .opening
            .attrs
            .push(JSXAttrOrSpread::JSXAttr(JSXAttr {
              span: DUMMY_SP,
              name: JSXAttrName::Ident(IdentName {
                span: DUMMY_SP,
                sym: "children".into(),
              }),
              value: Some(original),
            }));
        }
        self.insertions += 1;
      }
      return;
    }
    if let Some(mut expr) = attr_expr(value.clone()) {
      self.process_children_expression(&mut expr, inside);
      *value = JSXAttrValue::JSXExprContainer(JSXExprContainer {
        span: DUMMY_SP,
        expr: JSXExpr::Expr(expr),
      });
    }
  }

  fn expression_claims_translation(&self, expr: &Expr) -> bool {
    match expression(expr) {
      Expr::Array(array) => {
        array.elems.iter().flatten().any(|item| {
          item.spread.is_none() && self.single_expression_claims_translation(&item.expr)
        })
      }
      expr => self.single_expression_claims_translation(expr),
    }
  }

  fn single_expression_claims_translation(&self, expr: &Expr) -> bool {
    expression_has_text(expr)
      || matches!(expression(expr), Expr::JSXElement(element) if is_runtime_jsx(element) && is_opaque(self.bindings.component_name(element)))
  }

  fn process_children_expression(&mut self, expr: &mut Box<Expr>, inside: bool) {
    let claim = !inside && self.expression_claims_translation(expr);
    self.process_expression_children(expr, inside || claim);
    if claim {
      let original = mem::replace(expr, Box::new(Expr::Invalid(Invalid { span: DUMMY_SP })));
      **expr = Expr::JSXElement(Box::new(wrap(
        &self.bindings.translate,
        vec![expr_child(original)],
      )));
      self.insertions += 1;
    }
  }

  fn process_expression_children(&mut self, expr: &mut Box<Expr>, inside: bool) {
    if let Expr::Array(array) = expression_mut(expr) {
      for item in array.elems.iter_mut().flatten() {
        if item.spread.is_none() {
          self.process_single_expression(&mut item.expr, inside);
        }
      }
    } else {
      self.process_single_expression(expr, inside);
    }
  }

  fn process_single_expression(&mut self, expr: &mut Box<Expr>, inside: bool) {
    let wrap = inside && needs_variable(expr);
    match expression_mut(expr) {
      Expr::JSXElement(element) => self.process_element(element, inside),
      Expr::JSXFragment(fragment) => self.process_fragment(fragment, inside),
      _ if wrap => self.wrap_variable(expr),
      _ => {}
    }
  }

  fn wrap_variable(&self, expr: &mut Box<Expr>) {
    let original = mem::replace(expr, Box::new(Expr::Invalid(Invalid { span: DUMMY_SP })));
    **expr = Expr::JSXElement(Box::new(wrap(
      &self.bindings.variable,
      vec![expr_child(original)],
    )));
  }

  fn process_child_list(&mut self, children: &mut Vec<JSXElementChild>, inside: bool) {
    let meaningful: Vec<_> = children
      .iter()
      .enumerate()
      .filter_map(|(index, child)| meaningful_child(child).then_some(index))
      .collect();
    // One expression containing an array becomes the children array itself;
    // in a multiple-child list it remains one dynamic array-valued child.
    if meaningful.len() == 1 {
      if let JSXElementChild::JSXExprContainer(JSXExprContainer {
        expr: JSXExpr::Expr(expr),
        ..
      }) = &mut children[meaningful[0]]
      {
        self.process_children_expression(expr, inside);
        self.promote_inserted_child(&mut children[meaningful[0]]);
        return;
      }
    }
    let claim = !inside
      && meaningful.iter().any(|index| match &children[*index] {
        JSXElementChild::JSXText(text) => has_text(text.value.as_ref()),
        JSXElementChild::JSXElement(element) => {
          is_runtime_jsx(element) && is_opaque(self.bindings.component_name(element))
        }
        JSXElementChild::JSXExprContainer(JSXExprContainer {
          expr: JSXExpr::Expr(expr),
          ..
        }) => self.single_expression_claims_translation(expr),
        _ => false,
      });
    for index in meaningful {
      match &mut children[index] {
        JSXElementChild::JSXElement(element) => self.process_element(element, inside || claim),
        JSXElementChild::JSXFragment(fragment) => self.process_fragment(fragment, inside || claim),
        JSXElementChild::JSXExprContainer(JSXExprContainer {
          expr: JSXExpr::Expr(expr),
          ..
        }) => self.process_single_expression(expr, inside || claim),
        _ => {}
      }
      self.promote_inserted_child(&mut children[index]);
    }
    if claim {
      let original = mem::take(children);
      children.push(JSXElementChild::JSXElement(Box::new(wrap(
        &self.bindings.translate,
        original,
      ))));
      self.insertions += 1;
    }
  }

  fn promote_inserted_child(&self, child: &mut JSXElementChild) {
    if let JSXElementChild::JSXExprContainer(JSXExprContainer {
      expr: JSXExpr::Expr(expr),
      ..
    }) = child
    {
      if let Expr::JSXElement(element) = expr.as_ref() {
        if element.span == DUMMY_SP
          && matches!(
            self.bindings.component_name(element),
            Some(TRANSLATE | VARIABLE)
          )
        {
          *child = JSXElementChild::JSXElement(element.clone());
        }
      }
    }
  }

  fn process_opaque_props(&mut self, element: &mut JSXElement, component: &str) {
    for attribute in &mut element.opening.attrs {
      if let JSXAttrOrSpread::SpreadElement(spread) = attribute {
        if inline_object(&spread.expr).is_some() {
          if let Expr::Object(object) = expression_mut(&mut spread.expr) {
            for property in &mut object.props {
              let PropOrSpread::Prop(property) = property else {
                continue;
              };
              let name = match property.as_ref() {
                Prop::KeyValue(value) => property_name(&value.key),
                Prop::Shorthand(name) => Some(name.sym.to_string()),
                _ => continue,
              };
              if let Some(mut value) = object_property_expression(property) {
                self.process_opaque_expression(
                  &mut value,
                  component,
                  name.as_deref().unwrap_or_default(),
                );
                set_object_property_expression(property, value);
              }
            }
          }
        }
        continue;
      }
      let JSXAttrOrSpread::JSXAttr(attr) = attribute else {
        continue;
      };
      let prop = match &attr.name {
        JSXAttrName::Ident(name) => name.sym.to_string(),
        JSXAttrName::JSXNamespacedName(name) => format!("{}:{}", name.ns.sym, name.name.sym),
      };
      let prop = prop.as_str();
      if matches!(prop, "key" | "__self" | "__source") || is_control_prop(component, prop) {
        continue;
      }
      let Some(value) = &mut attr.value else {
        continue;
      };
      // Static quoted content needs no insertion. Retain its raw JSX shape so
      // the actual host, rather than this pass, normalizes the attribute.
      if matches!(value, JSXAttrValue::Str(_)) {
        continue;
      }
      if let Some(mut expr) = attr_expr(value.clone()) {
        self.process_opaque_expression(&mut expr, component, prop);
        *value = JSXAttrValue::JSXExprContainer(JSXExprContainer {
          span: DUMMY_SP,
          expr: JSXExpr::Expr(expr),
        });
      }
    }
    if component != "Derive" {
      // Raw children compile to a final children property, independently from
      // any explicit children attribute earlier in the props object.
      self.process_child_list(&mut element.children, true);
    }
  }

  fn process_opaque_expression(&mut self, expr: &mut Box<Expr>, component: &str, prop: &str) {
    if is_control_prop(component, prop) {
      return;
    }
    if prop == "children" {
      if component != "Derive" {
        self.process_expression_children(expr, true);
      }
      return;
    }
    let wrap = needs_variable(expr);
    match expression_mut(expr) {
      Expr::JSXElement(child) if is_runtime_jsx(child) => {
        // The compiler treats a JSX content prop as an opaque shell and
        // processes only its children, even if the shell itself is GT.
        self.process_element_children(child, true);
        self.walk_and_mark(expr);
      }
      Expr::JSXFragment(child) => {
        self.process_child_list(&mut child.children, true);
        self.walk_and_mark(expr);
      }
      _ if wrap => self.wrap_variable(expr),
      _ => {}
    }
  }

  fn mark_element_children(&mut self, element: &JSXElement) {
    match children_location(element) {
      Some(ChildrenLocation::Attribute(index)) => {
        if let JSXAttrOrSpread::JSXAttr(JSXAttr {
          value: Some(value), ..
        }) = &element.opening.attrs[index]
        {
          if let Some(expr) = attr_expr(value.clone()) {
            self.walk_and_mark(&expr);
          }
        }
      }
      Some(ChildrenLocation::SpreadProperty(index, prop_index)) => {
        if let JSXAttrOrSpread::SpreadElement(spread) = &element.opening.attrs[index] {
          if let Some(object) = inline_object(&spread.expr) {
            if let PropOrSpread::Prop(prop) = &object.props[prop_index] {
              if let Some(value) = object_property_expression(prop) {
                self.walk_and_mark(&value);
              }
            }
          }
        }
      }
      None => self.mark_child_list(&element.children),
    }
  }

  fn mark_child_list(&mut self, children: &[JSXElementChild]) {
    for child in children {
      match child {
        JSXElementChild::JSXElement(element) if is_runtime_jsx(element) => {
          self.mark(element.span);
          self.mark_element_children(element);
        }
        JSXElementChild::JSXFragment(fragment) => {
          self.mark(fragment.span);
          self.mark_child_list(&fragment.children);
        }
        JSXElementChild::JSXExprContainer(JSXExprContainer {
          expr: JSXExpr::Expr(expr),
          ..
        }) => self.walk_and_mark(expr),
        _ => {}
      }
    }
  }

  fn walk_and_mark(&mut self, expr: &Expr) {
    match expression(expr) {
      Expr::JSXElement(element) if is_runtime_jsx(element) => {
        self.mark(element.span);
        self.mark_element_children(element);
      }
      Expr::JSXFragment(fragment) => {
        self.mark(fragment.span);
        self.mark_child_list(&fragment.children);
      }
      Expr::Array(array) => {
        for item in array.elems.iter().flatten() {
          if item.spread.is_none() {
            self.walk_and_mark(&item.expr);
          }
        }
      }
      _ => {}
    }
  }
}

impl VisitMut for AutoJsx {
  fn visit_mut_jsx_element(&mut self, element: &mut JSXElement) {
    // User Var-like components suppress the entire ordinary traversal,
    // including JSX hidden inside dynamic expressions and attribute values.
    if is_runtime_jsx(element) && is_user_variable(self.bindings.component_name(element)) {
      return;
    }
    if !self.processed.contains(&element.span) {
      self.process_element(element, false);
    }
    element.visit_mut_children_with(self);
  }

  fn visit_mut_jsx_fragment(&mut self, fragment: &mut JSXFragment) {
    if !self.processed.contains(&fragment.span) {
      self.process_fragment(fragment, false);
    }
    fragment.visit_mut_children_with(self);
  }
}
