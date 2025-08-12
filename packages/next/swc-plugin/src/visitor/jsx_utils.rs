use swc_core::ecma::ast::*;

pub fn extract_template_string(tpl: &Tpl) -> Option<String> {
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


pub fn extract_string_from_jsx_attr(jsx_attr: &JSXAttr) -> Option<String> {
    match &jsx_attr.value {
        Some(JSXAttrValue::Lit(Lit::Str(str_lit))) => Some(str_lit.value.to_string()),
        Some(JSXAttrValue::JSXExprContainer(expr_container)) => {
            match &expr_container.expr {
                JSXExpr::Expr(expr) => {
                    match expr.as_ref() {
                        Expr::Lit(Lit::Str(str_lit)) => Some(str_lit.value.to_string()),
                        Expr::Tpl(tpl) => extract_template_string(tpl),
                        _ => None
                    }
                }
                _ => None
            }
        }
        _ => None
    }
}

pub fn extract_attribute_from_jsx_attr(element: &JSXElement, attribute_name: &str) -> Option<String> {
    element.opening.attrs.iter().find_map(|attr| {
        if let JSXAttrOrSpread::JSXAttr(jsx_attr) = attr {
            if let JSXAttrName::Ident(ident) = &jsx_attr.name {
                if ident.sym.as_ref() == attribute_name {
                    extract_string_from_jsx_attr(jsx_attr)
                } else {
                    None
                }
            } else {
                None
            }
        } else {
            None
        }
    })
}