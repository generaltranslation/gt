use std::collections::HashMap;
use swc_core::ecma::atoms::Atom;

/// Information about a scope
#[derive(Debug, Clone)]
pub struct ScopeInfo {
  /// The scope ID
  pub id: u32,
  /// The parent scope ID
  pub parent_id: u32,
  /// The depth of the scope
  pub depth: u32,
}

/// Information about a scoped variable assignment
#[derive(Debug, Clone)]
pub struct ScopedVariable {
  /// The scope ID
  pub scope_id: u32,
  /// The original name of the variable
  pub original_name: Atom, // useGT, getGT, T, useGT1, (Name or aliased name)
  /// The variable name
  pub variable_name: Atom, // t, translationFunction, etc.
  /// Whether the variable is a translation function
  pub is_translation_function: bool, // true if assigned_value is a known translation function
  /// The identifier for the variable
  pub identifier: u32, // identifier for the variable
}

/// Tracks scope hierarchy and variable assignments within scopes
#[derive(Debug)]
pub struct ScopeTracker {
  /// Next scope ID to assign
  next_scope_id: u32,
  /// Current scope being processed
  current_scope: u32,
  /// Stack to track scope nesting for proper exit handling
  scope_stack: Vec<u32>,
  /// Information about each scope
  scope_info: HashMap<u32, ScopeInfo>,
  /// Variables tracked per scope
  scoped_variables: HashMap<Atom, Vec<ScopedVariable>>,
}

impl Default for ScopeTracker {
  fn default() -> Self {
    Self {
      next_scope_id: 1, // Start at 1, reserve 0 for "no scope"
      current_scope: 0,
      scope_stack: Vec::new(),
      scope_info: HashMap::new(),
      scoped_variables: HashMap::new(),
    }
  }
}

impl ScopeTracker {
  /// Enter a new scope and return the new scope ID
  pub fn enter_scope(&mut self) -> u32 {
    let new_scope_id = self.next_scope_id;
    self.next_scope_id += 1;

    let scope_info = ScopeInfo {
      id: new_scope_id,
      parent_id: self.current_scope,
      depth: if self.current_scope != 0 {
        self.scope_stack.len() as u32 + 1
      } else {
        0
      },
    };

    self.scope_info.insert(new_scope_id, scope_info);

    // Push current scope to stack
    self.scope_stack.push(self.current_scope);

    self.current_scope = new_scope_id;
    new_scope_id
  }

  /// Exit the current scope and return to parent (with aggressive cleanup)
  pub fn exit_scope(&mut self) {
    if self.current_scope != 0 {
      // Remove all variables from the exiting scope immediately
      self.scoped_variables.retain(|_, variables| {
        variables.retain(|var| var.scope_id != self.current_scope);
        !variables.is_empty() // Remove empty variable name entries
      });

      // Get parent scope from the scope info before removing it
      let parent_id = self
        .scope_info
        .get(&self.current_scope)
        .map(|info| info.parent_id)
        .unwrap_or(0);

      // Remove scope info for the exiting scope
      self.scope_info.remove(&self.current_scope);

      // Update current scope to parent
      self.current_scope = parent_id;

      // Pop from stack if there are items
      if !self.scope_stack.is_empty() {
        // eprintln!("exit_scope() poping from stack: {:?}", self.scope_stack.last());
        self.scope_stack.pop();
      }
    }
  }

  /// Track a variable assignment in the current scope
  pub fn track_variable(
    &mut self,
    variable_name: Atom,
    assigned_value: Atom,
    is_translation_function: bool,
    identifier: u32,
  ) {
    let scoped_var = ScopedVariable {
      scope_id: self.current_scope,
      original_name: assigned_value,
      variable_name: variable_name.clone(),
      is_translation_function,
      identifier,
    };

    self
      .scoped_variables
      .entry(variable_name)
      .or_default()
      .push(scoped_var);
  }

  /// Track a translation function variable (convenience method)
  pub fn track_translation_variable(
    &mut self,
    variable_name: Atom,
    function_name: Atom,
    identifier: u32,
  ) {
    self.track_variable(variable_name, function_name, true, identifier);
  }

  /// Track a non-translation variable (convenience method)  
  pub fn track_regular_variable(&mut self, variable_name: Atom, assigned_value: Atom) {
    self.track_variable(variable_name, assigned_value, false, 0); // 0 because we dont care about the identifier
  }

  /// Find if a variable is accessible in the current scope
  pub fn get_variable(&self, variable_name: &Atom) -> Option<&ScopedVariable> {
    if let Some(variables) = self.scoped_variables.get(variable_name) {
      let result = variables.last();
      return result;
    }
    None
  }

  /// Get the translation variable info if it exists in current scope
  pub fn get_translation_variable(&self, variable_name: &Atom) -> Option<&ScopedVariable> {
    self
      .get_variable(variable_name)
      .filter(|var| var.is_translation_function)
  }

  /// Get scope info for debugging
  pub fn get_scope_info(&self, scope_id: u32) -> Option<&ScopeInfo> {
    self.scope_info.get(&scope_id)
  }

  /// Log scoped variables for debugging
  pub fn log_scoped_variable(&self, variable_name: &Atom) {
    if let Some(variables) = self.scoped_variables.get(variable_name) {
      for var in variables {
        eprintln!("Scoped variable: {var:?}");
      }
    }
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_basic_scope_creation() {
    let mut tracker = ScopeTracker::default();

    // Enter first scope
    let scope1 = tracker.enter_scope();
    assert_eq!(scope1, 1);

    // Enter nested scope
    let scope2 = tracker.enter_scope();
    assert_eq!(scope2, 2);

    // Check scope info
    let info1 = tracker.get_scope_info(1).unwrap();
    assert_eq!(info1.id, 1);
    assert_eq!(info1.parent_id, 0); // 0 means no parent
    assert_eq!(info1.depth, 0);

    let info2 = tracker.get_scope_info(2).unwrap();
    assert_eq!(info2.id, 2);
    assert_eq!(info2.parent_id, 1); // parent is scope 1
    assert_eq!(info2.depth, 2); // depth calculation includes stack length + 1
  }

  #[test]
  fn test_scope_exit_behavior() {
    let mut tracker = ScopeTracker::default();

    // Enter first scope
    let scope1 = tracker.enter_scope();
    assert_eq!(scope1, 1);

    // Enter nested scope
    let scope2 = tracker.enter_scope();
    assert_eq!(scope2, 2);

    // Exit nested scope - scope info should be removed
    tracker.exit_scope();
    assert!(tracker.get_scope_info(scope2).is_none()); // scope2 should be cleaned up
    assert!(tracker.get_scope_info(scope1).is_some()); // scope1 should still exist

    // Exit first scope - should be cleaned up too
    tracker.exit_scope();
    assert!(tracker.get_scope_info(scope1).is_none()); // scope1 should be cleaned up
  }

  #[test]
  fn test_variable_scoping() {
    let mut tracker = ScopeTracker::default();

    // Enter first scope and track a variable
    let scope1 = tracker.enter_scope();
    tracker.track_translation_variable("t".into(), "useGT".into(), 0);

    // Variable should be accessible in same scope
    let var = tracker.get_variable(&"t".into());
    assert!(var.is_some());
    assert_eq!(var.unwrap().scope_id, scope1);
    assert_eq!(var.unwrap().original_name.as_str(), "useGT");
    assert!(var.unwrap().is_translation_function);

    // Enter nested scope
    let _scope2 = tracker.enter_scope();

    // Variable should still be accessible in nested scope (inheritance)
    assert!(tracker.get_variable(&"t".into()).is_some());

    // Exit nested scope
    tracker.exit_scope();

    // Variable should still be accessible in original scope
    assert!(tracker.get_variable(&"t".into()).is_some());

    // Exit first scope
    tracker.exit_scope();

    // Variable should no longer be accessible (out of scope)
    assert!(tracker.get_variable(&"t".into()).is_none());
  }

  #[test]
  fn test_variable_shadowing() {
    let mut tracker = ScopeTracker::default();

    // Enter outer scope
    let _scope1 = tracker.enter_scope();
    tracker.track_translation_variable("t".into(), "useGT".into(), 0);

    // Verify outer variable
    let outer_var = tracker.get_variable(&"t".into()).unwrap();
    assert_eq!(outer_var.original_name.as_str(), "useGT");

    // Enter inner scope and shadow the variable
    let scope2 = tracker.enter_scope();
    tracker.track_translation_variable("t".into(), "getGT".into(), 1);

    // Should get the shadowed (inner) variable
    let inner_var = tracker.get_variable(&"t".into()).unwrap();
    assert_eq!(inner_var.original_name.as_str(), "getGT");
    assert_eq!(inner_var.scope_id, scope2);

    // Exit inner scope (this should remove the inner variable)
    tracker.exit_scope();

    // Should get the outer variable again
    let restored_var = tracker.get_variable(&"t".into()).unwrap();
    assert_eq!(restored_var.original_name.as_str(), "useGT");
  }

  #[test]
  fn test_sibling_scope_isolation() {
    let mut tracker = ScopeTracker::default();

    // Enter parent scope
    let _parent_scope = tracker.enter_scope();

    // Enter first child scope and track variable
    let _child1_scope = tracker.enter_scope();
    tracker.track_translation_variable("t1".into(), "useGT".into(), 0);
    tracker.exit_scope(); // Exit first child - t1 should be removed

    // Enter second child scope
    let _child2_scope = tracker.enter_scope();
    tracker.track_translation_variable("t2".into(), "getGT".into(), 1);

    // Should not be able to access sibling's variable (was cleaned up on exit)
    assert!(tracker.get_variable(&"t1".into()).is_none());
    // Should be able to access own variable
    assert!(tracker.get_variable(&"t2".into()).is_some());
  }

  #[test]
  fn test_deterministic_scope_ids() {
    let mut tracker1 = ScopeTracker::default();
    let mut tracker2 = ScopeTracker::default();

    // Same sequence of operations should produce same scope IDs
    let scope1_a = tracker1.enter_scope();
    let scope1_b = tracker2.enter_scope();
    assert_eq!(scope1_a, scope1_b);

    let scope2_a = tracker1.enter_scope();
    let scope2_b = tracker2.enter_scope();
    assert_eq!(scope2_a, scope2_b);

    tracker1.exit_scope();
    tracker2.exit_scope();

    let scope3_a = tracker1.enter_scope();
    let scope3_b = tracker2.enter_scope();
    assert_eq!(scope3_a, scope3_b);
  }

  #[test]
  fn test_helper_methods() {
    let mut tracker = ScopeTracker::default();

    let _scope = tracker.enter_scope();
    tracker.track_translation_variable("myTranslator".into(), "useGT".into(), 0);
    tracker.track_regular_variable("regularVar".into(), "someValue".into());

    // Test translation function helper
    let translation_func = tracker.get_translation_variable(&"myTranslator".into());
    assert!(translation_func.is_some());
    assert_eq!(translation_func.unwrap().original_name.as_str(), "useGT");

    // Test general variable value helper
    let var_value = tracker.get_variable(&"regularVar".into());
    assert!(var_value.is_some());
    assert_eq!(var_value.unwrap().original_name.as_str(), "someValue");

    // Test that regular variable doesn't return from translation helper
    let not_translation = tracker.get_translation_variable(&"regularVar".into());
    assert!(not_translation.is_none());

    // Test non-existent variable
    let missing = tracker.get_variable(&"nonexistent".into());
    assert!(missing.is_none());
  }

  #[test]
  fn test_all_variable_types_tracking() {
    let mut tracker = ScopeTracker::default();

    let scope1 = tracker.enter_scope();

    // Track different types of variables
    tracker.track_translation_variable("t1".into(), "useGT".into(), 0);
    tracker.track_regular_variable("literal".into(), "string_literal".into());
    tracker.track_regular_variable("reference".into(), "ref:t1".into());
    tracker.track_regular_variable("undefined_var".into(), "undefined".into());

    // All should be accessible in same scope
    assert!(tracker.get_variable(&"t1".into()).is_some());
    assert!(tracker.get_variable(&"literal".into()).is_some());
    assert!(tracker.get_variable(&"reference".into()).is_some());
    assert!(tracker.get_variable(&"undefined_var".into()).is_some());

    // Check types are preserved
    let t1_var = tracker.get_variable(&"t1".into()).unwrap();
    assert!(t1_var.is_translation_function);
    assert_eq!(t1_var.original_name.as_str(), "useGT");

    let literal_var = tracker.get_variable(&"literal".into()).unwrap();
    assert!(!literal_var.is_translation_function);
    assert_eq!(literal_var.original_name.as_str(), "string_literal");

    // Enter nested scope
    let _scope2 = tracker.enter_scope();

    // All parent variables should be accessible
    assert!(tracker.get_variable(&"t1".into()).is_some());
    assert!(tracker.get_variable(&"literal".into()).is_some());

    // Shadow a variable
    tracker.track_regular_variable("t1".into(), "not_a_function".into());

    // Should get shadowed version
    let shadowed = tracker.get_variable(&"t1".into()).unwrap();
    assert!(!shadowed.is_translation_function);
    assert_eq!(shadowed.original_name.as_str(), "not_a_function");

    // Exit nested scope - shadow should be removed
    tracker.exit_scope();

    // Should get original back
    let restored = tracker.get_variable(&"t1".into()).unwrap();
    assert!(restored.is_translation_function);
    assert_eq!(restored.original_name.as_str(), "useGT");
    assert_eq!(restored.scope_id, scope1);
  }

  #[test]
  fn test_aggressive_cleanup_on_exit() {
    let mut tracker = ScopeTracker::default();

    // Enter scope and track variables
    let scope1 = tracker.enter_scope();
    tracker.track_translation_variable("t1".into(), "useGT".into(), 0);

    // Enter nested scope
    let scope2 = tracker.enter_scope();
    tracker.track_translation_variable("t2".into(), "getGT".into(), 1);

    // Both variables should exist
    assert!(tracker.get_variable(&"t1".into()).is_some());
    assert!(tracker.get_variable(&"t2".into()).is_some());

    // Variables should be in the data structure
    assert_eq!(tracker.scoped_variables.len(), 2);

    // Exit nested scope - should remove t2 immediately
    tracker.exit_scope();

    // t1 should still be accessible, t2 should not
    assert!(tracker.get_variable(&"t1".into()).is_some());
    assert!(tracker.get_variable(&"t2".into()).is_none());

    // t2 should be physically removed from data structure
    assert!(tracker.scoped_variables.get(&"t2".into()).is_none());
    assert_eq!(tracker.scoped_variables.len(), 1);

    // Scope info should also be cleaned up
    assert!(tracker.get_scope_info(scope2).is_none());
    assert!(tracker.get_scope_info(scope1).is_some());
  }
}
