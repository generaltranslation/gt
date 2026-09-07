//! React calls which a loader or the author already lowered before this pass.
//!
//! These share region ownership with raw JSX; retaining the original call and
//! object properties preserves keys, getters, spreads and development metadata.

use std::mem;

use swc_core::{common::DUMMY_SP, ecma::ast::*};

use super::{
  bindings::{is_opaque, is_user_variable, TRANSLATE, VARIABLE},
  syntax::{
    expression, expression_mut, object_property_expression, property_name,
    set_object_property_expression,
  },
  AutoJsx,
};

fn props(call: &CallExpr) -> Option<&ObjectLit> {
  let arg = call.args.get(1).filter(|arg| arg.spread.is_none())?;
  let Expr::Object(props) = expression(&arg.expr) else {
    return None;
  };
  Some(props)
}

fn props_mut(call: &mut CallExpr) -> Option<&mut ObjectLit> {
  let arg = call.args.get_mut(1).filter(|arg| arg.spread.is_none())?;
  let Expr::Object(props) = expression_mut(&mut arg.expr) else {
    return None;
  };
  Some(props)
}

fn is_children(prop: &Prop) -> bool {
  match prop {
    Prop::Shorthand(name) => name.sym == "children",
    // Babel checks the key's Identifier shape, including a computed identifier.
    Prop::KeyValue(value) => match &value.key {
      PropName::Ident(name) => name.sym == "children",
      PropName::Computed(key) => {
        matches!(expression(&key.expr), Expr::Ident(name) if name.sym == "children")
      }
      _ => false,
    },
    _ => false,
  }
}

fn children_index(call: &CallExpr) -> Option<usize> {
  props(call)?
    .props
    .iter()
    .position(|prop| matches!(prop, PropOrSpread::Prop(prop) if is_children(prop)))
}

fn expression_arg(expr: Expr) -> ExprOrSpread {
  ExprOrSpread {
    spread: None,
    expr: Box::new(expr),
  }
}

impl AutoJsx {
  pub(super) fn wrap_runtime(
    &self,
    component: &Ident,
    children: Box<Expr>,
    array: bool,
  ) -> CallExpr {
    let mut args = vec![
      expression_arg(Expr::Ident(component.clone())),
      expression_arg(Expr::Object(ObjectLit {
        span: DUMMY_SP,
        props: vec![PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
          key: PropName::Ident(IdentName {
            span: DUMMY_SP,
            sym: "children".into(),
          }),
          value: children,
        })))],
      })),
    ];
    if self
      .bindings
      .runtime
      .development(self.runtime_owner.as_ref())
    {
      args.push(expression_arg(Expr::Unary(UnaryExpr {
        span: DUMMY_SP,
        op: UnaryOp::Void,
        arg: Box::new(Expr::Lit(Lit::Num(Number {
          span: DUMMY_SP,
          value: 0.0,
          raw: None,
        }))),
      })));
      args.push(expression_arg(Expr::Lit(Lit::Bool(Bool {
        span: DUMMY_SP,
        value: array,
      }))));
    }
    CallExpr {
      span: DUMMY_SP,
      ctxt: Default::default(),
      callee: Callee::Expr(Box::new(Expr::Ident(
        self
          .bindings
          .runtime
          .callee(self.runtime_owner.as_ref(), array),
      ))),
      args,
      type_args: None,
    }
  }

  pub(super) fn mark_runtime_children(&mut self, call: &CallExpr) {
    let Some(index) = children_index(call) else {
      return;
    };
    let Some(props) = props(call) else {
      return;
    };
    if let PropOrSpread::Prop(prop) = &props.props[index] {
      if let Some(value) = object_property_expression(prop) {
        self.walk_and_mark(&value);
      }
    }
  }

  pub(super) fn process_runtime_children(&mut self, call: &mut CallExpr, inside: bool) {
    let owner = self.bindings.runtime.owner(call);
    let Some(index) = children_index(call) else {
      return;
    };
    let Some(props) = props_mut(call) else {
      return;
    };
    let PropOrSpread::Prop(prop) = &mut props.props[index] else {
      return;
    };
    let Some(mut value) = object_property_expression(prop) else {
      return;
    };
    let previous_owner = mem::replace(&mut self.runtime_owner, owner);
    self.runtime_depth += 1;
    self.process_expression_children(&mut value, inside);
    self.runtime_depth -= 1;
    self.runtime_owner = previous_owner;
    set_object_property_expression(prop, value);
  }

  pub(super) fn process_runtime_call(&mut self, call: &mut CallExpr, inside: bool) {
    let owner = self.bindings.runtime.owner(call);
    let previous_owner = mem::replace(&mut self.runtime_owner, owner);
    self.process_runtime_call_inner(call, inside);
    self.runtime_owner = previous_owner;
  }

  fn process_runtime_call_inner(&mut self, call: &mut CallExpr, inside: bool) {
    if self.styles.call(call, &self.bindings.runtime) {
      return;
    }
    self.mark(call.span);
    // A spread in the first argument does not identify an element type. The
    // compiler leaves that call's shell alone while still visiting its values.
    if call.args.first().is_none_or(|arg| arg.spread.is_some()) {
      return;
    }
    let component = self.bindings.call_component_name(call).map(str::to_owned);
    if component.as_deref() == Some("T") || is_user_variable(component.as_deref()) {
      self.mark_runtime_children(call);
      return;
    }
    if matches!(component.as_deref(), Some(TRANSLATE | VARIABLE)) {
      return;
    }
    if is_opaque(component.as_deref()) {
      if let Some(props) = props_mut(call) {
        self.runtime_depth += 1;
        for prop in &mut props.props {
          let PropOrSpread::Prop(prop) = prop else {
            continue;
          };
          let name = match prop.as_ref() {
            Prop::Shorthand(name) => Some(name.sym.to_string()),
            Prop::KeyValue(value) => property_name(&value.key),
            _ => None,
          };
          if let Some(mut value) = object_property_expression(prop) {
            self.process_opaque_expression(
              &mut value,
              component.as_deref().unwrap_or_default(),
              name.as_deref().unwrap_or_default(),
            );
            set_object_property_expression(prop, value);
          }
        }
        self.runtime_depth -= 1;
      }
      if !inside && !self.has_style(call) {
        let original = mem::replace(
          call,
          self.wrap_runtime(
            &self.bindings.translate,
            Box::new(Expr::Invalid(Invalid { span: DUMMY_SP })),
            false,
          ),
        );
        *call = self.wrap_runtime(
          &self.bindings.translate,
          Box::new(Expr::Call(original)),
          false,
        );
        self.insertions += 1;
      }
      return;
    }
    let Some(index) = children_index(call) else {
      return;
    };
    let Some(props) = props_mut(call) else {
      return;
    };
    let PropOrSpread::Prop(prop) = &mut props.props[index] else {
      return;
    };
    let Some(mut value) = object_property_expression(prop) else {
      return;
    };
    let claim = !inside && !self.has_style(&value) && self.expression_claims_translation(&value);
    self.runtime_depth += 1;
    self.process_expression_children(&mut value, inside || claim);
    self.runtime_depth -= 1;
    if claim {
      let array = matches!(expression(&value), Expr::Array(_));
      value = Box::new(Expr::Call(self.wrap_runtime(
        &self.bindings.translate,
        value,
        array,
      )));
      self.insertions += 1;
    }
    set_object_property_expression(prop, value);
    if claim {
      if let Some(owner) = &self.runtime_owner {
        self.bindings.runtime.update_to_single(call, owner);
      }
    }
  }
}
