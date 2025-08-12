use swc_core::ecma::ast::*;
use crate::hash::{
    VariableType,
    HtmlContentProps,
    SanitizedChild
};

use crate::whitespace::{
    has_significant_whitespace,
    trim_normal_whitespace,
    is_normal_whitespace
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

/// Filter out JSX children that are whitespace or empty
pub fn filter_jsx_children(children: &[JSXElementChild]) -> Vec<JSXElementChild> {
    // sometimes there is whitespace before/after a single child, and that makes three children, ie:
    // <T> {true} </T>
    // these whitespaces need to be removed before we can continue
    let mut remove_first_child = false;
    let mut remove_last_child = false;
    if children.len() >= 2 {
        // Check beginning
        let first_child = children.first().unwrap();
        if let JSXElementChild::JSXText(text) = first_child {
            if trim_normal_whitespace(&text.value).is_empty() && text.value.contains('\n') {
                remove_first_child = true;
            }
        }

        // Check end
        let last_child = children.last().unwrap();
        if let JSXElementChild::JSXText(text) = last_child {
            if trim_normal_whitespace(&text.value).is_empty() && text.value.contains('\n') {
                remove_last_child = true;
            }
        }
    }

    let filtered_children: Vec<JSXElementChild> = children
        .iter()
        .enumerate()
        .filter_map(|(i, child)| {
            let should_skip_first = remove_first_child && i == 0;
            let should_skip_last = remove_last_child && i == children.len() - 1;
            if should_skip_first || should_skip_last {
                None
            } else {
                Some(child.clone())
            }
        })
        .collect();

    // Filter out all empty {} expressions
    let filtered_children: Vec<JSXElementChild> = filtered_children.into_iter().filter(|child| {
        if let JSXElementChild::JSXExprContainer(expr_container) = child {
            if let JSXExpr::JSXEmptyExpr(_) = &expr_container.expr {
                return false;
            }
        } else if let JSXElementChild::JSXText(text) = child {
            let trimmed = trim_normal_whitespace(&text.value);
            if trimmed.is_empty() {
                // Check if it contains HTML entities (like &nbsp;, &amp;, etc.)
                if has_significant_whitespace(&text.value) {
                    return true;
                }

                // Remove plain whitespace with newlines
                if text.value.contains('\n') {
                    return false;
                }
            }
        }
        true
    }).collect();

    filtered_children
}


/// Build sanitized text content
pub fn build_sanitized_text_content(text: &JSXText) -> Option<SanitizedChild> {
    let content = text.value.to_string();
    // Only normalize internal whitespace, preserve leading/trailing spaces
    // This matches how browsers handle JSX text content
    if trim_normal_whitespace(&content).is_empty() {
        if content.contains('\n') {
            None
        } else {
            Some(SanitizedChild::Text(content))
        }
    } else {
        // Handle leading/trailing whitespace
        let trimmed_content = trim_normal_whitespace(&content);
        let parts: Vec<&str> = content.split(trimmed_content).collect();
        let standardized_content = if parts.len() > 1 {
            let first_part = parts.first().unwrap();
            let last_part = parts.last().unwrap();
            let mut leading_space = first_part.to_string();
            let mut trailing_space = last_part.to_string();
            // Collapse newlines to empty
            if first_part.contains('\n') {
                leading_space = "".to_string();
            }
            if last_part.contains('\n') {
                trailing_space = "".to_string();
            }
            format!("{}{}{}", leading_space, trimmed_content, trailing_space)
        } else {
            content
        };

        // Collapse multiple newlines to single spaces while preserving content
        // Normalizes newlines in text content to match React JSX behavior:
        // - Multiple consecutive newlines become single spaces
        // - Newlines at the start are removed (result is cleared)
        // - Whitespace with newlines is skipped until non-whitespace content
        let mut result = String::new();
        let mut whitespace_sequence = String::new();
        let mut in_newline_sequence = false;

        for ch in standardized_content.chars() {
            if ch == '\n' && !in_newline_sequence {
                whitespace_sequence.clear();
                whitespace_sequence.push(' ');
                in_newline_sequence = true;
                continue
            }


            // Add character (and any whitespace we've accumulated)
            if !is_normal_whitespace(ch) {
                if !whitespace_sequence.is_empty() {
                    result.push_str(&whitespace_sequence);
                    whitespace_sequence.clear();
                }
                result.push(ch);

                // Escape newline sequence
                if in_newline_sequence {
                    in_newline_sequence = false;
                }
                continue;
            }

            // Skip adding whitespace if we're in a newline sequence
            if in_newline_sequence {
                continue;
            }

            // Accumulate whitespace
            whitespace_sequence.push(' ');
        }

        // Catch any stragglers
        if !in_newline_sequence && !whitespace_sequence.is_empty()  && !trim_normal_whitespace(&result).is_empty() {
            result.push_str(&whitespace_sequence);
        }

        if result.is_empty() {
            None
        } else {
            Some(SanitizedChild::Text(result))
        }
    }
}