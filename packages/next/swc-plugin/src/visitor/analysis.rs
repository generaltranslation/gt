use swc_core::ecma::atoms::Atom;

/// Check if a component name matches known gt-next translation components
pub fn is_translation_component_name(name: &Atom) -> bool {
  matches!(name.as_ref(), "T")
}

/// Check if a component name matches known gt-next variable components
pub fn is_variable_component_name(name: &Atom) -> bool {
  matches!(
    name.as_ref(),
    "Var" | "Num" | "N" | "Currency" | "DateTime" | "RelativeTime" | "Derive"
  )
}

/// Check if a name is a GT branch
pub fn is_branch_name(name: &Atom) -> bool {
  matches!(name.as_ref(), "Select" | "Plural" | "Ordinal")
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
      let components = ["Div", "Span", "T2", "t", "Translation", "Var", "Select"];
      for component in &components {
        let name = Atom::new(*component);
        assert!(
          !is_translation_component_name(&name),
          "Should not recognize '{component}' as translation component"
        );
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
      let valid_components = ["Var", "Num", "N", "Currency", "DateTime", "RelativeTime", "Derive"];
      for component in &valid_components {
        let name = Atom::new(*component);
        assert!(
          is_variable_component_name(&name),
          "Should recognize '{component}' as variable component"
        );
      }
    }

    #[test]
    fn rejects_non_variable_components() {
      let components = ["T", "Select", "Plural", "div", "var", "num", "Variable"];
      for component in &components {
        let name = Atom::new(*component);
        assert!(
          !is_variable_component_name(&name),
          "Should not recognize '{component}' as variable component"
        );
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
      let branch_components = ["Select", "Plural", "Ordinal"];
      for component in &branch_components {
        let name = Atom::new(*component);
        assert!(
          is_branch_name(&name),
          "Should recognize '{component}' as branch component"
        );
      }
    }

    #[test]
    fn rejects_non_branch_components() {
      let components = [
        "T",
        "Var",
        "div",
        "select",
        "plural",
        "Branches",
        "PluralForm",
      ];
      for component in &components {
        let name = Atom::new(*component);
        assert!(
          !is_branch_name(&name),
          "Should not recognize '{component}' as branch component"
        );
      }
    }

    #[test]
    fn handles_empty_string() {
      let name = Atom::new("");
      assert!(!is_branch_name(&name));
    }
  }

  mod comprehensive_validation {
    use super::*;

    #[test]
    fn no_overlap_between_categories() {
      let all_names = [
        "T", "Var", "Num", "N", "Currency", "Derive", "DateTime", "RelativeTime", "Select", "Plural", "Ordinal",
      ];

      for name_str in &all_names {
        let name = Atom::new(*name_str);
        let is_translation = is_translation_component_name(&name);
        let is_variable = is_variable_component_name(&name);
        let is_branch = is_branch_name(&name);

        // Each name should only match one category
        let matches = [is_translation, is_variable, is_branch];
        let match_count = matches.iter().filter(|&&x| x).count();

        assert_eq!(
                    match_count, 1,
                    "Name '{name_str}' should match exactly one category, but matched {match_count} categories"
                );
      }
    }
  }
}
