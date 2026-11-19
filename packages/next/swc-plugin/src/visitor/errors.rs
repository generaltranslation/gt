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
