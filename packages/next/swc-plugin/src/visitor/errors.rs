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

/// Generate error message for a <Plural> whose ordinal prop is not a boolean literal
pub fn create_non_literal_ordinal_error(filename: Option<&str>) -> String {
  let location = filename.map(|filename| format!(" in {filename}")).unwrap_or_default();
  format!(
    "gt-next{location}: The ordinal prop of <Plural> must be a boolean literal. Write a bare ordinal attribute, ordinal={{true}} or ordinal={{false}}."
  )
}

/// Generate error message for a variable component whose name has the prefix of generated names
pub fn create_reserved_variable_name_error(
  filename: Option<&str>,
  name: &str,
  reserved_prefix: &str,
) -> String {
  let location = filename.map(|filename| format!(" in {filename}")).unwrap_or_default();
  format!(
    "gt-next{location}: The variable name \"{name}\" starts with the reserved \"{reserved_prefix}\" prefix. Pick another name."
  )
}
