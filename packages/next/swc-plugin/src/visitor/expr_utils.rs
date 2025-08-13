use swc_core::ecma::ast::*;
use swc_core::common::{Span, SyntaxContext};


// Helper function to extract string values from expressions
pub fn extract_string_from_expr(expr: &Expr) -> Option<String> {
    match expr {
        Expr::Lit(Lit::Str(s)) => Some(s.value.to_string()),
        Expr::Lit(Lit::Num(n)) => Some(n.value.to_string()),
        Expr::Lit(Lit::Bool(b)) => Some(b.value.to_string()),
        Expr::Ident(ident) => Some(ident.sym.to_string()),
        // Add more cases as needed for other expression types
        _ => None,
    }
}

// Helper function to extract id and context from options
pub fn extract_id_and_context_from_options(
    options: Option<&ExprOrSpread>
) -> (Option<String>, Option<String>) {
    let (id, context) = match options {
        Some(options) => {
            match options.expr.as_ref() {
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
                _ => {
                    (None, None)
                }
            }
        }
        None => {
            (None, None)
        }
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
