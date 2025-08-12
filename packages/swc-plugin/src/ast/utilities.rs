use swc_core::ecma::ast::*;
use crate::hash::{
    VariableType, HtmlContentProps
};

/// Custom number to string function to match JS behavior
pub fn js_number_to_string(value: f64) -> String {
    if value == 0.0 {
        return if value.is_sign_negative() { "-0".to_string() } else { "0".to_string() };
    }

    let abs_value = value.abs();
    if abs_value < 1e-6 || abs_value >= 1e21 {
        // // Use exponential notation, matching JS format
        let formatted = format!("{:e}", value);
        if formatted.contains("e") && !formatted.contains("e-") && !formatted.contains("e+") {
            formatted.replace("e", "e+")
        } else {
            formatted
        }
        .replace("e+0", "e+")
        .replace("e-0", "e-")
    } else {
        value.to_string()
    }
}


/// Get tag name from JSX element name
pub fn get_tag_name(name: &JSXElementName) -> Option<String> {
    match name {
        JSXElementName::Ident(ident) => Some(ident.sym.to_string()),
        JSXElementName::JSXMemberExpr(member_expr) => {
            if let JSXObject::Ident(obj_ident) = &member_expr.obj {
                Some(format!("{}.{}", obj_ident.sym, member_expr.prop.sym))
            } else {
                None
            }
        }
        _ => None,
    }
}


/// Get variable type from component name
pub fn get_variable_type(component_name: &str) -> VariableType {
    match component_name {
        "Num" => VariableType::Number,
        "Currency" => VariableType::Currency,
        "DateTime" => VariableType::Date,
        _ => VariableType::Variable,
    }
}

/// Extract HTML content properties from attributes
pub fn extract_html_content_props(attrs: &[JSXAttrOrSpread]) -> HtmlContentProps {
    let mut props = HtmlContentProps::default();

    for attr in attrs {
        if let JSXAttrOrSpread::JSXAttr(jsx_attr) = attr {
            if let JSXAttrName::Ident(name_ident) = &jsx_attr.name {
                let prop_name = name_ident.sym.as_ref();
                
                if let Some(JSXAttrValue::Lit(Lit::Str(str_lit))) = &jsx_attr.value {
                    let value = str_lit.value.to_string();
                    
                    match prop_name {
                        "placeholder" => props.pl = Some(value),
                        "title" => props.ti = Some(value),
                        "alt" => props.alt = Some(value),
                        "aria-label" => props.arl = Some(value),
                        "aria-labelledby" => props.arb = Some(value),
                        "aria-describedby" => props.ard = Some(value),
                        _ => {}
                    }
                }
            }
        }
    }

    props
}