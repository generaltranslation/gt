use swc_core::ecma::atoms::Atom;

/// Check if a component name matches known gt-next translation components
pub fn is_translation_component_name(name: &Atom) -> bool {
  matches!(name.as_ref(), "T")
}

/// Check if a component name matches known gt-next variable components
pub fn is_variable_component_name(name: &Atom) -> bool {
  matches!(name.as_ref(), "Var" | "Num" | "Currency" | "DateTime")
}

/// Check if a name is a GT branch
pub fn is_branch_name(name: &Atom) -> bool {
  matches!(name.as_ref(), "Branch" | "Plural")
}

/// Check if a name is a GT translation function
pub fn is_translation_function_name(name: &Atom) -> bool {
  matches!(name.as_ref(), "useGT" | "getGT")
}