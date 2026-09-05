use swc_core::{common::DUMMY_SP, ecma::ast::*};

/// JSX lowering removes parentheses and TypeScript-only expression wrappers
/// before the Babel compiler sees them. Inspect through them without changing
/// the original expression's syntax or evaluation.
pub(super) fn expression(expr: &Expr) -> &Expr {
  match expr {
    Expr::Paren(value) => expression(&value.expr),
    Expr::TsAs(value) => expression(&value.expr),
    Expr::TsTypeAssertion(value) => expression(&value.expr),
    Expr::TsConstAssertion(value) => expression(&value.expr),
    Expr::TsNonNull(value) => expression(&value.expr),
    Expr::TsSatisfies(value) => expression(&value.expr),
    Expr::TsInstantiation(value) => expression(&value.expr),
    _ => expr,
  }
}

pub(super) fn expression_mut(expr: &mut Expr) -> &mut Expr {
  match expr {
    Expr::Paren(value) => expression_mut(&mut value.expr),
    Expr::TsAs(value) => expression_mut(&mut value.expr),
    Expr::TsTypeAssertion(value) => expression_mut(&mut value.expr),
    Expr::TsConstAssertion(value) => expression_mut(&mut value.expr),
    Expr::TsNonNull(value) => expression_mut(&mut value.expr),
    Expr::TsSatisfies(value) => expression_mut(&mut value.expr),
    Expr::TsInstantiation(value) => expression_mut(&mut value.expr),
    _ => expr,
  }
}

/// JavaScript String#trim differs from Rust str::trim on BOM and a few Unicode
/// controls. Use the ECMAScript whitespace set for exact compiler parity.
fn is_js_whitespace(value: char) -> bool {
  matches!(value, '\u{0009}'..='\u{000d}' | '\u{0020}' | '\u{00a0}' | '\u{1680}' | '\u{2000}'..='\u{200a}' | '\u{2028}' | '\u{2029}' | '\u{202f}' | '\u{205f}' | '\u{3000}' | '\u{feff}')
}

pub(super) fn has_text(value: &str) -> bool {
  !value.trim_matches(is_js_whitespace).is_empty()
}

pub(super) fn expression_has_text(expr: &Expr) -> bool {
  match expression(expr) {
    Expr::Lit(Lit::Str(value)) => has_text(&value.value.to_string_lossy()),
    Expr::Tpl(value) if value.exprs.is_empty() => value
      .quasis
      .first()
      .and_then(|quasi| quasi.cooked.as_ref())
      .is_some_and(|value| has_text(&value.to_string_lossy())),
    _ => false,
  }
}

pub(super) fn needs_variable(expr: &Expr) -> bool {
  match expression(expr) {
    Expr::Lit(Lit::Str(_) | Lit::Num(_) | Lit::Bool(_) | Lit::Null(_)) => false,
    Expr::Tpl(value) if value.exprs.is_empty() => false,
    Expr::Unary(value)
      if value.op == UnaryOp::Minus && matches!(expression(&value.arg), Expr::Lit(Lit::Num(_))) =>
    {
      false
    }
    Expr::Ident(value) if matches!(value.sym.as_ref(), "undefined" | "NaN" | "Infinity") => false,
    Expr::JSXElement(element) => !is_runtime_jsx(element),
    Expr::JSXFragment(_) => false,
    _ => true,
  }
}

/// Automatic React lowering falls back to createElement when key follows a
/// spread. The compiler insertion pass deliberately only recognizes runtime
/// jsx/jsxs/jsxDEV calls, so that shell behaves like a dynamic expression.
pub(super) fn is_runtime_jsx(element: &JSXElement) -> bool {
  let mut saw_spread = false;
  for attr in &element.opening.attrs {
    match attr {
      JSXAttrOrSpread::SpreadElement(_) => saw_spread = true,
      JSXAttrOrSpread::JSXAttr(JSXAttr {
        name: JSXAttrName::Ident(name),
        ..
      }) if saw_spread && name.sym == "key" => return false,
      _ => {}
    }
  }
  true
}

/// Match React's JSX text cleanup when deciding how many actual children the
/// raw syntax represents. In particular, indentation and JSX comments are not
/// children, but a same-line space is.
pub(super) fn clean_jsx_text(value: &str) -> String {
  let lines: Vec<_> = value.split(['\r', '\n']).collect();
  let last_nonempty = lines
    .iter()
    .rposition(|line| line.chars().any(|ch| ch != ' ' && ch != '\t'));
  let mut result = String::new();
  for (index, line) in lines.iter().enumerate() {
    let line = line.replace('\t', " ");
    let line = if index > 0 {
      line.trim_start_matches(' ')
    } else {
      &line
    };
    let line = if index + 1 < lines.len() {
      line.trim_end_matches(' ')
    } else {
      line
    };
    if !line.is_empty() {
      result.push_str(line);
      if Some(index) != last_nonempty {
        result.push(' ');
      }
    }
  }
  result
}

pub(super) fn meaningful_child(child: &JSXElementChild) -> bool {
  match child {
    JSXElementChild::JSXText(text) => !clean_jsx_text(text.value.as_ref()).is_empty(),
    JSXElementChild::JSXExprContainer(container) => matches!(container.expr, JSXExpr::Expr(_)),
    _ => true,
  }
}

pub(super) enum ChildrenLocation {
  Attribute(usize),
  SpreadProperty(usize, usize),
}

pub(super) fn property_name(key: &PropName) -> Option<String> {
  match key {
    PropName::Ident(name) => Some(name.sym.to_string()),
    PropName::Str(name) => Some(name.value.to_string_lossy().into_owned()),
    PropName::Computed(key) => match expression(&key.expr) {
      Expr::Ident(name) => Some(name.sym.to_string()),
      Expr::Lit(Lit::Str(name)) => Some(name.value.to_string_lossy().into_owned()),
      _ => None,
    },
    _ => None,
  }
}

/// Babel inlines literal object spreads into JSX props, except objects with a
/// non-shorthand __proto__ property (whose object-construction semantics differ).
pub(super) fn inline_object(expr: &Expr) -> Option<&ObjectLit> {
  let Expr::Object(object) = expression(expr) else {
    return None;
  };
  let has_proto = object.props.iter().any(|prop| matches!(prop,
    PropOrSpread::Prop(prop) if matches!(prop.as_ref(), Prop::KeyValue(value)
      if !matches!(value.key, PropName::Computed(_)) && property_name(&value.key).as_deref() == Some("__proto__"))
  ));
  (!has_proto).then_some(object)
}

pub(super) fn children_location(element: &JSXElement) -> Option<ChildrenLocation> {
  for (index, attr) in element.opening.attrs.iter().enumerate() {
    match attr {
      JSXAttrOrSpread::JSXAttr(JSXAttr {
        name: JSXAttrName::Ident(name),
        ..
      }) if name.sym == "children" => return Some(ChildrenLocation::Attribute(index)),
      JSXAttrOrSpread::SpreadElement(spread) => {
        if let Some(object) = inline_object(&spread.expr) {
          for (prop_index, prop) in object.props.iter().enumerate() {
            let PropOrSpread::Prop(prop) = prop else {
              continue;
            };
            let is_children = match prop.as_ref() {
              Prop::Shorthand(name) => name.sym == "children",
              Prop::KeyValue(value) => match &value.key {
                PropName::Ident(name) => name.sym == "children",
                PropName::Computed(key) => {
                  matches!(expression(&key.expr), Expr::Ident(name) if name.sym == "children")
                }
                _ => false,
              },
              _ => false,
            };
            if is_children {
              return Some(ChildrenLocation::SpreadProperty(index, prop_index));
            }
          }
        }
      }
      _ => {}
    }
  }
  None
}

pub(super) fn object_property_expression(prop: &Prop) -> Option<Box<Expr>> {
  match prop {
    Prop::KeyValue(value) => Some(value.value.clone()),
    Prop::Shorthand(name) => Some(Box::new(Expr::Ident(name.clone()))),
    _ => None,
  }
}

pub(super) fn set_object_property_expression(prop: &mut Prop, expression: Box<Expr>) {
  if let (Prop::Shorthand(original), Expr::Ident(value)) = (&prop, expression.as_ref()) {
    if original.to_id() == value.to_id() {
      return;
    }
  }
  match prop {
    Prop::KeyValue(value) => value.value = expression,
    Prop::Shorthand(name) => {
      *prop = Prop::KeyValue(KeyValueProp {
        key: PropName::Ident(name.clone().into()),
        value: expression,
      })
    }
    _ => {}
  }
}

pub(super) fn wrap(name: &Ident, children: Vec<JSXElementChild>) -> JSXElement {
  JSXElement {
    span: DUMMY_SP,
    opening: JSXOpeningElement {
      name: JSXElementName::Ident(name.clone()),
      span: DUMMY_SP,
      attrs: vec![],
      self_closing: false,
      type_args: None,
    },
    children,
    closing: Some(JSXClosingElement {
      span: DUMMY_SP,
      name: JSXElementName::Ident(name.clone()),
    }),
  }
}

pub(super) fn expr_child(expr: Box<Expr>) -> JSXElementChild {
  JSXElementChild::JSXExprContainer(JSXExprContainer {
    span: DUMMY_SP,
    expr: JSXExpr::Expr(expr),
  })
}

pub(super) fn attr_expr(value: JSXAttrValue) -> Option<Box<Expr>> {
  match value {
    // Quoted JSX strings must remain attributes. Their host-specific cleanup
    // differs from ordinary JavaScript strings, and there is no JSX to visit.
    JSXAttrValue::Str(_) => None,
    JSXAttrValue::JSXExprContainer(JSXExprContainer {
      expr: JSXExpr::Expr(expr),
      ..
    }) => Some(expr),
    JSXAttrValue::JSXElement(element) => Some(Box::new(Expr::JSXElement(element))),
    JSXAttrValue::JSXFragment(fragment) => Some(Box::new(Expr::JSXFragment(fragment))),
    _ => None,
  }
}
