use swc_core::ecma::ast::*;

/// Checks if an expression is a derive() call by name
fn is_derive_call_expr(expr: &Expr) -> bool {
  if let Expr::Call(call_expr) = expr {
    if let Callee::Expr(callee_expr) = &call_expr.callee {
      if let Expr::Ident(ident) = callee_expr.as_ref() {
        return ident.sym.as_str() == "derive";
      }
    }
  }
  false
}

/// Recursively checks if an expression contains a derive() call.
/// Handles: bare call, binary concat ("a" + derive(fn())), template literal (`a${derive(fn())}`)
pub fn contains_derive_call(expr: &Expr) -> bool {
  match expr {
    Expr::Call(_) => is_derive_call_expr(expr),
    Expr::Bin(bin_expr) => {
      contains_derive_call(&bin_expr.left) || contains_derive_call(&bin_expr.right)
    }
    Expr::Tpl(tpl) => tpl.exprs.iter().any(|e| contains_derive_call(e)),
    Expr::Paren(paren) => contains_derive_call(&paren.expr),
    Expr::Cond(cond) => {
      contains_derive_call(&cond.cons) || contains_derive_call(&cond.alt)
    }
    _ => false,
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

#[cfg(test)]
#[path = "expr_utils_tests.rs"]
mod tests;
