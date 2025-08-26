use swc_core::common::{Span, SyntaxContext};
use swc_core::ecma::ast::*;
use swc_core::ecma::atoms::Atom;

// Helper function to extract string values from expressions
pub fn extract_string_from_expr(expr: &Expr) -> Option<String> {
  match expr {
    Expr::Lit(Lit::Str(s)) => Some(s.value.to_string()),
    Expr::Lit(Lit::Num(n)) => Some(n.value.to_string()),
    Expr::Lit(Lit::Bool(b)) => Some(b.value.to_string()),
    Expr::Ident(ident) => Some(ident.sym.to_string()),
    Expr::Tpl(tpl) => {
      if tpl.exprs.is_empty() && tpl.quasis.len() == 1 {
        if let Some(quasi) = tpl.quasis.first() {
          if let Some(cooked) = &quasi.cooked {
            return Some(cooked.to_string());
          } else {
            return Some(quasi.raw.to_string());
          }
        }
      }
      None
    }
    // Add more cases as needed for other expression types
    _ => None,
  }
}

// Helper function to extract id and context from options
pub fn extract_id_and_context_from_options(
  options: Option<&ExprOrSpread>,
) -> (Option<String>, Option<String>) {
  let (id, context) = match options {
    Some(options) => match options.expr.as_ref() {
      Expr::Object(obj) => {
        let mut id_value = None;
        let mut context_value = None;

        for prop in &obj.props {
          if let PropOrSpread::Prop(prop) = prop {
            if let Prop::KeyValue(key_value) = prop.as_ref() {
              if let PropName::Ident(ident) = &key_value.key {
                match ident.sym.as_str() {
                  "$id" => {
                    id_value = extract_string_from_expr(&key_value.value);
                  }
                  "$context" => {
                    context_value = extract_string_from_expr(&key_value.value);
                  }
                  _ => {}
                }
              }
            }
          }
        }

        (id_value, context_value)
      }
      _ => (None, None),
    },
    None => (None, None),
  };
  (id, context)
}

pub fn create_string_prop(key: &str, value: &str, span: Span) -> PropOrSpread {
  PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
    key: PropName::Ident(Ident::new(key.into(), span, SyntaxContext::empty()).into()),
    value: Box::new(Expr::Lit(Lit::Str(Str {
      span,
      value: value.into(),
      raw: None,
    }))),
  })))
}

pub fn has_prop(props: &[PropOrSpread], key: &str) -> bool {
  props.iter().any(|prop| {
    if let PropOrSpread::Prop(p) = prop {
      if let Prop::KeyValue(kv) = p.as_ref() {
        if let PropName::Ident(ident) = &kv.key {
          return ident.sym.as_ref() == key;
        }
      }
    }
    false
  })
}

/// Create a new CallExpr that spreads an existing expression and adds hash properties
pub fn create_spread_options_call_expr(
  call_expr: &CallExpr,
  spread_expr: &Expr,
  hash: &str,
  _: Option<&str>, // json
  span: Span,
) -> CallExpr {
  // Create the spread property
  let spread_prop = PropOrSpread::Spread(SpreadElement {
    dot3_token: span,
    expr: Box::new(spread_expr.clone()),
  });

  // Start with spread, then add our props
  let mut props = vec![spread_prop];
  props.push(create_string_prop("$hash", hash, span));

  // if let Some(json_value) = json {
  //     props.push(create_string_prop("$json", json_value, span));
  // }

  // Create new options object
  let new_options = Expr::Object(ObjectLit { span, props });

  // Replace the options argument
  let mut new_args = call_expr.args.clone();
  new_args[1] = ExprOrSpread {
    spread: None,
    expr: Box::new(new_options),
  };

  CallExpr {
    args: new_args,
    ..call_expr.clone()
  }
}

pub fn get_callee_expr_function_name(call_expr: &CallExpr) -> Option<Atom> {
  if let Callee::Expr(callee_expr) = &call_expr.callee {
    if let Expr::Ident(ident) = callee_expr.as_ref() {
      return Some(ident.sym.clone());
    }
  }
  None
}

pub fn inject_new_args(call_expr: &CallExpr, content_array: ArrayLit) -> CallExpr {
  let mut new_args = call_expr.args.clone();
  new_args.push(ExprOrSpread {
    spread: None,
    expr: Box::new(Expr::Array(content_array)),
  });
  CallExpr {
    args: new_args,
    ..call_expr.clone()
  }
}

/// Check if a JSX expression is allowed as dynamic content in JSX translation components
/// Allowed: string literals, number literals, template strings without expressions, JSX elements with safe content
/// Not allowed: complex expressions, function calls, binary operations, JSX with dynamic content, etc.
pub fn is_allowed_dynamic_content(jsx_expr: &JSXExpr) -> bool {
  match jsx_expr {
    JSXExpr::JSXEmptyExpr(_) => true, // Empty expressions are allowed
    JSXExpr::Expr(expr) => is_allowed_expr_content(expr.as_ref()),
  }
}

/// Helper function to recursively check if an expression contains only allowed content
fn is_allowed_expr_content(expr: &Expr) -> bool {
  match expr {
    // String literals are allowed: {"hello"}
    Expr::Lit(Lit::Str(_)) => true,
    
    // Number literals are allowed: {42}
    Expr::Lit(Lit::Num(_)) => true,
    
    // Boolean literals are allowed: {true}
    Expr::Lit(Lit::Bool(_)) => true,
    
    // Null and undefined literals are allowed
    Expr::Lit(Lit::Null(_)) => true,
    
    // Template literals without expressions are allowed: {`hello`}
    Expr::Tpl(tpl) => tpl.exprs.is_empty(),
    
    // Allow specific safe identifiers: undefined
    Expr::Ident(ident) => {
      matches!(ident.sym.as_str(), "undefined")
    },
    
    // Unary expressions: allow only numeric literals with + or - operators
    // {+123}, {-123} are allowed, but not {!value}, {++counter}, etc.
    Expr::Unary(unary) => match unary.op {
      UnaryOp::Plus | UnaryOp::Minus => {
        // Only allow unary +/- on number literals
        matches!(unary.arg.as_ref(), Expr::Lit(Lit::Num(_)))
      }
      _ => false, // Other unary operators (!value, typeof, etc.) are not allowed
    },
    
    // JSX elements are allowed only if their content is safe
    Expr::JSXElement(element) => is_jsx_element_safe(element),
    
    // JSX fragments are allowed only if their content is safe
    Expr::JSXFragment(fragment) => is_jsx_fragment_safe(fragment),
    
    // Array literals are not allowed in general: [1, 2, 3] or [...items]
    Expr::Array(_) => false,
    
    // Object literals are not allowed in general: {key: value} or {...obj}  
    Expr::Object(_) => false,
    
    // Everything else is not allowed (variables, function calls, binary expressions, etc.)
    _ => false,
  }
}

/// Check if a JSX element contains only safe content
fn is_jsx_element_safe(element: &JSXElement) -> bool {
  // Check all children of the JSX element
  for child in &element.children {
    match child {
      JSXElementChild::JSXText(_) => continue, // Text is always safe
      JSXElementChild::JSXElement(child_element) => {
        if !is_jsx_element_safe(child_element) {
          return false;
        }
      }
      JSXElementChild::JSXFragment(child_fragment) => {
        if !is_jsx_fragment_safe(child_fragment) {
          return false;
        }
      }
      JSXElementChild::JSXExprContainer(expr_container) => {
        if !is_allowed_dynamic_content(&expr_container.expr) {
          return false;
        }
      }
      JSXElementChild::JSXSpreadChild(_) => return false, // Spread children are not allowed
    }
  }
  true
}

/// Check if a JSX fragment contains only safe content
fn is_jsx_fragment_safe(fragment: &JSXFragment) -> bool {
  // Check all children of the JSX fragment
  for child in &fragment.children {
    match child {
      JSXElementChild::JSXText(_) => continue, // Text is always safe
      JSXElementChild::JSXElement(child_element) => {
        if !is_jsx_element_safe(child_element) {
          return false;
        }
      }
      JSXElementChild::JSXFragment(child_fragment) => {
        if !is_jsx_fragment_safe(child_fragment) {
          return false;
        }
      }
      JSXElementChild::JSXExprContainer(expr_container) => {
        if !is_allowed_dynamic_content(&expr_container.expr) {
          return false;
        }
      }
      JSXElementChild::JSXSpreadChild(_) => return false, // Spread children are not allowed
    }
  }
  true
}

pub fn is_string_literal(arg: &ExprOrSpread) -> bool {
  match arg.expr.as_ref() {
    // Simple string literals: t("yoyoyo")
    Expr::Lit(Lit::Str(_)) => true,
    
    // Template literals: t(`Hello ${name}`)
    Expr::Tpl(tpl) => {
      if !tpl.exprs.is_empty() {
        return true;
      } else {
        return false;
      }
    }
    _ => false,
  }
}

#[cfg(test)]
#[path = "expr_utils_tests.rs"]
mod tests;
