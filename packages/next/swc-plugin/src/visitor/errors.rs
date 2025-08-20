/// Generate warning message for dynamic content violations
pub fn create_dynamic_content_warning(filename: Option<&str>, component_name: &str) -> String {
  if let Some(ref filename) = filename {
    format!(
            "gt-next in {filename}: <{component_name}> component contains unwrapped dynamic content. Consider wrapping expressions in <Var>{{expression}}</Var> components for proper translation handling."
        )
  } else {
    format!(
            "gt-next: <{component_name}> component contains unwrapped dynamic content. Consider wrapping expressions in <Var>{{expression}}</Var> components for proper translation handling."
        )
  }
}

/// Generate warning message for dynamic function call violations
pub fn create_dynamic_function_warning(
  filename: Option<&str>,
  function_name: &str,
  violation_type: &str,
) -> String {
  if let Some(ref filename) = filename {
    format!(
            "gt-next in {filename}: {function_name}() function call uses {violation_type} which prevents proper translation key generation. Use string literals instead."
        )
  } else {
    format!(
            "gt-next: {function_name}() function call uses {violation_type} which prevents proper translation key generation. Use string literals instead."
        )
  }
}
