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

#[cfg(test)]
mod tests {
    use super::*;
    use swc_core::ecma::atoms::Atom;

    mod is_translation_component_name {
        use super::*;

        #[test]
        fn recognizes_t_component() {
            let name = Atom::new("T");
            assert!(is_translation_component_name(&name));
        }

        #[test]
        fn rejects_non_translation_components() {
            let components = ["Div", "Span", "T2", "t", "Translation", "Var", "Branch"];
            for component in &components {
                let name = Atom::new(*component);
                assert!(!is_translation_component_name(&name), 
                    "Should not recognize '{}' as translation component", component);
            }
        }

        #[test]
        fn handles_empty_string() {
            let name = Atom::new("");
            assert!(!is_translation_component_name(&name));
        }
    }

    mod is_variable_component_name {
        use super::*;

        #[test]
        fn recognizes_all_variable_components() {
            let valid_components = ["Var", "Num", "Currency", "DateTime"];
            for component in &valid_components {
                let name = Atom::new(*component);
                assert!(is_variable_component_name(&name),
                    "Should recognize '{}' as variable component", component);
            }
        }

        #[test]
        fn rejects_non_variable_components() {
            let components = ["T", "Branch", "Plural", "div", "var", "num", "Variable"];
            for component in &components {
                let name = Atom::new(*component);
                assert!(!is_variable_component_name(&name),
                    "Should not recognize '{}' as variable component", component);
            }
        }

        #[test]
        fn handles_empty_string() {
            let name = Atom::new("");
            assert!(!is_variable_component_name(&name));
        }
    }

    mod is_branch_name {
        use super::*;

        #[test]
        fn recognizes_branch_components() {
            let branch_components = ["Branch", "Plural"];
            for component in &branch_components {
                let name = Atom::new(*component);
                assert!(is_branch_name(&name),
                    "Should recognize '{}' as branch component", component);
            }
        }

        #[test]
        fn rejects_non_branch_components() {
            let components = ["T", "Var", "div", "branch", "plural", "Branches", "PluralForm"];
            for component in &components {
                let name = Atom::new(*component);
                assert!(!is_branch_name(&name),
                    "Should not recognize '{}' as branch component", component);
            }
        }

        #[test]
        fn handles_empty_string() {
            let name = Atom::new("");
            assert!(!is_branch_name(&name));
        }
    }

    mod is_translation_function_name {
        use super::*;

        #[test]
        fn recognizes_translation_functions() {
            let functions = ["useGT", "getGT"];
            for function in &functions {
                let name = Atom::new(*function);
                assert!(is_translation_function_name(&name),
                    "Should recognize '{}' as translation function", function);
            }
        }

        #[test]
        fn rejects_non_translation_functions() {
            let functions = ["useT", "getT", "useTranslation", "t", "translate", "USEGT", "usegt"];
            for function in &functions {
                let name = Atom::new(*function);
                assert!(!is_translation_function_name(&name),
                    "Should not recognize '{}' as translation function", function);
            }
        }

        #[test]
        fn handles_empty_string() {
            let name = Atom::new("");
            assert!(!is_translation_function_name(&name));
        }
    }

    mod comprehensive_validation {
        use super::*;

        #[test]
        fn no_overlap_between_categories() {
            let all_names = [
                "T", "Var", "Num", "Currency", "DateTime", 
                "Branch", "Plural", "useGT", "getGT"
            ];

            for name_str in &all_names {
                let name = Atom::new(*name_str);
                let is_translation = is_translation_component_name(&name);
                let is_variable = is_variable_component_name(&name);
                let is_branch = is_branch_name(&name);
                let is_function = is_translation_function_name(&name);

                // Each name should only match one category
                let matches = [is_translation, is_variable, is_branch, is_function];
                let match_count = matches.iter().filter(|&&x| x).count();
                
                assert_eq!(match_count, 1, 
                    "Name '{}' should match exactly one category, but matched {} categories", 
                    name_str, match_count);
            }
        }
    }
}