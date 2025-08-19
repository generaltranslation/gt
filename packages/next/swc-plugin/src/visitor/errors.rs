
/// Generate warning message for dynamic content violations
pub fn create_dynamic_content_warning(filename: Option<&str>, component_name: &str) -> String {
    if let Some(ref filename) = filename {
        format!(
            "gt-next in {}: <{}> component contains unwrapped dynamic content. Consider wrapping expressions in <Var>{{expression}}</Var> components for proper translation handling.",
            filename, component_name
        )
    } else {
        format!(
            "gt-next: <{}> component contains unwrapped dynamic content. Consider wrapping expressions in <Var>{{expression}}</Var> components for proper translation handling.",
            component_name
        )
    }
}

/// Generate warning message for dynamic function call violations
pub fn create_dynamic_function_warning(filename: Option<&str>, function_name: &str, violation_type: &str) -> String {
    if let Some(ref filename) = filename {
        format!(
            "gt-next in {}: {}() function call uses {} which prevents proper translation key generation. Use string literals instead.",
            filename, function_name, violation_type
        )
    } else {
        format!(
            "gt-next: {}() function call uses {} which prevents proper translation key generation. Use string literals instead.",
            function_name, violation_type
        )
    }
}
