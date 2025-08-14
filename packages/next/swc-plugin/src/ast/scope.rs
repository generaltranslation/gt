use std::collections::HashMap;
use swc_core::ecma::atoms::Atom;

/// Information about a scope
#[derive(Debug, Clone)]
pub struct ScopeInfo {
    pub id: u32,
    pub parent_id: Option<u32>,
    pub depth: u32,
}

/// Information about a scoped variable assignment
#[derive(Debug, Clone)]
pub struct ScopedVariable {
    pub scope_id: u32,
    pub assigned_value: Atom,    // useGT, getGT, "literal", "ref:otherVar", etc.
    pub variable_name: Atom,     // t, translationFunction, etc.
    pub is_translation_function: bool, // true if assigned_value is a known translation function
}

/// Tracks scope hierarchy and variable assignments within scopes
#[derive(Debug)]
pub struct ScopeTracker {
    /// Next scope ID to assign
    next_scope_id: u32,
    /// Current scope being processed
    current_scope: Option<u32>,
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
            current_scope: None,
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
            depth: if self.current_scope.is_some() { 
                self.scope_stack.len() as u32 + 1
            } else { 
                0 
            },
        };

        self.scope_info.insert(new_scope_id, scope_info);
        
        // Push current scope to stack
        if let Some(current) = self.current_scope {
            self.scope_stack.push(current);
        }
        
        self.current_scope = Some(new_scope_id);
        new_scope_id
    }

    /// Exit the current scope and return to parent (with aggressive cleanup)
    pub fn exit_scope(&mut self) {
        if let Some(current_scope_id) = self.current_scope {
            // Remove all variables from the exiting scope immediately
            self.scoped_variables.retain(|_, variables| {
                variables.retain(|var| var.scope_id != current_scope_id);
                !variables.is_empty()  // Remove empty variable name entries
            });
            
            // Get parent scope from the scope info before removing it
            let parent_id = self.scope_info.get(&current_scope_id)
                .and_then(|info| info.parent_id);
            
            // Remove scope info for the exiting scope
            self.scope_info.remove(&current_scope_id);
            
            // Update current scope to parent
            self.current_scope = parent_id;
            
            // Pop from stack if there are items
            if !self.scope_stack.is_empty() {
                self.scope_stack.pop();
            }
        }
    }

    /// Track a variable assignment in the current scope
    pub fn track_variable(&mut self, variable_name: Atom, assigned_value: Atom, is_translation_function: bool) {
        if let Some(scope_id) = self.current_scope {
            let scoped_var = ScopedVariable {
                scope_id,
                assigned_value,
                variable_name: variable_name.clone(),
                is_translation_function,
            };

            self.scoped_variables
                .entry(variable_name)
                .or_insert_with(Vec::new)
                .push(scoped_var);
        }
    }

    /// Track a translation function variable (convenience method)
    pub fn track_translation_variable(&mut self, variable_name: Atom, function_name: Atom) {
        self.track_variable(variable_name, function_name, true);
    }

    /// Track a non-translation variable (convenience method)  
    pub fn track_regular_variable(&mut self, variable_name: Atom, assigned_value: Atom) {
        self.track_variable(variable_name, assigned_value, false);
    }

    /// Check if a scope is accessible from the current scope (for debugging purposes)
    #[allow(dead_code)]
    fn is_scope_accessible(&self, target_scope: u32) -> bool {
        if Some(target_scope) == self.current_scope {
            return true;
        }

        // Walk up the parent chain from current scope
        let mut check_scope = self.current_scope;
        while let Some(scope_id) = check_scope {
            if scope_id == target_scope {
                return true;
            }
            check_scope = self.scope_info.get(&scope_id)
                .and_then(|info| info.parent_id);
        }
        
        false
    }

    /// Find if a variable is accessible in the current scope
    pub fn is_variable_accessible(&self, variable_name: &Atom) -> Option<&ScopedVariable> {
        if let Some(variables) = self.scoped_variables.get(variable_name) {
            // With aggressive cleanup, all remaining variables are accessible by definition
            // Return the most recent one (proper shadowing behavior)
            return variables.last();
        }
        None
    }

    /// Get the assigned value for a variable if it exists in current scope
    pub fn get_variable_value(&self, variable_name: &Atom) -> Option<&Atom> {
        self.is_variable_accessible(variable_name)
            .map(|var| &var.assigned_value)
    }

    /// Get the original function name for a translation variable if it exists in current scope
    pub fn get_translation_function(&self, variable_name: &Atom) -> Option<&Atom> {
        self.is_variable_accessible(variable_name)
            .filter(|var| var.is_translation_function)
            .map(|var| &var.assigned_value)
    }

    /// Get current scope ID
    pub fn current_scope_id(&self) -> Option<u32> {
        self.current_scope
    }

    /// Get scope info for debugging
    pub fn get_scope_info(&self, scope_id: u32) -> Option<&ScopeInfo> {
        self.scope_info.get(&scope_id)
    }

}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_scope_creation() {
        let mut tracker = ScopeTracker::default();
        
        // Initially no current scope
        assert_eq!(tracker.current_scope_id(), None);
        
        // Enter first scope
        let scope1 = tracker.enter_scope();
        assert_eq!(scope1, 1);
        assert_eq!(tracker.current_scope_id(), Some(1));
        
        // Enter nested scope
        let scope2 = tracker.enter_scope();
        assert_eq!(scope2, 2);
        assert_eq!(tracker.current_scope_id(), Some(2));
        
        // Check scope info
        let info1 = tracker.get_scope_info(1).unwrap();
        assert_eq!(info1.id, 1);
        assert_eq!(info1.parent_id, None);
        assert_eq!(info1.depth, 0);
        
        let info2 = tracker.get_scope_info(2).unwrap();
        assert_eq!(info2.id, 2);
        assert_eq!(info2.parent_id, Some(1));
        assert_eq!(info2.depth, 1);
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
        assert_eq!(tracker.current_scope_id(), Some(2));
        
        // Exit nested scope - should return to parent
        tracker.exit_scope();
        assert_eq!(tracker.current_scope_id(), Some(1));
        
        // Exit first scope - should return to no scope
        tracker.exit_scope();
        assert_eq!(tracker.current_scope_id(), None);
    }

    #[test]
    fn test_variable_scoping() {
        let mut tracker = ScopeTracker::default();
        
        // Enter first scope and track a variable
        let scope1 = tracker.enter_scope();
        tracker.track_translation_variable("t".into(), "useGT".into());
        
        // Variable should be accessible in same scope
        let var = tracker.is_variable_accessible(&"t".into());
        assert!(var.is_some());
        assert_eq!(var.unwrap().scope_id, scope1);
        assert_eq!(var.unwrap().assigned_value.as_str(), "useGT");
        assert_eq!(var.unwrap().is_translation_function, true);
        
        // Enter nested scope
        let _scope2 = tracker.enter_scope();
        
        // Variable should still be accessible in nested scope (inheritance)
        assert!(tracker.is_variable_accessible(&"t".into()).is_some());
        
        // Exit nested scope
        tracker.exit_scope();
        
        // Variable should still be accessible in original scope
        assert!(tracker.is_variable_accessible(&"t".into()).is_some());
        
        // Exit first scope
        tracker.exit_scope();
        
        // Variable should no longer be accessible (out of scope)
        assert!(tracker.is_variable_accessible(&"t".into()).is_none());
    }

    #[test]
    fn test_variable_shadowing() {
        let mut tracker = ScopeTracker::default();
        
        // Enter outer scope
        let _scope1 = tracker.enter_scope();
        tracker.track_translation_variable("t".into(), "useGT".into());
        
        // Verify outer variable
        let outer_var = tracker.is_variable_accessible(&"t".into()).unwrap();
        assert_eq!(outer_var.assigned_value.as_str(), "useGT");
        
        // Enter inner scope and shadow the variable
        let scope2 = tracker.enter_scope();
        tracker.track_translation_variable("t".into(), "getGT".into());
        
        // Should get the shadowed (inner) variable
        let inner_var = tracker.is_variable_accessible(&"t".into()).unwrap();
        assert_eq!(inner_var.assigned_value.as_str(), "getGT");
        assert_eq!(inner_var.scope_id, scope2);
        
        // Exit inner scope (this should remove the inner variable)
        tracker.exit_scope();
        
        // Should get the outer variable again
        let restored_var = tracker.is_variable_accessible(&"t".into()).unwrap();
        assert_eq!(restored_var.assigned_value.as_str(), "useGT");
    }

    #[test]
    fn test_sibling_scope_isolation() {
        let mut tracker = ScopeTracker::default();
        
        // Enter parent scope
        let _parent_scope = tracker.enter_scope();
        
        // Enter first child scope and track variable
        let _child1_scope = tracker.enter_scope();
        tracker.track_translation_variable("t1".into(), "useGT".into());
        tracker.exit_scope(); // Exit first child - t1 should be removed
        
        // Enter second child scope
        let _child2_scope = tracker.enter_scope();
        tracker.track_translation_variable("t2".into(), "getGT".into());
        
        // Should not be able to access sibling's variable (was cleaned up on exit)
        assert!(tracker.is_variable_accessible(&"t1".into()).is_none());
        // Should be able to access own variable
        assert!(tracker.is_variable_accessible(&"t2".into()).is_some());
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
        tracker.track_translation_variable("myTranslator".into(), "useGT".into());
        tracker.track_regular_variable("regularVar".into(), "someValue".into());
        
        // Test translation function helper
        let translation_func = tracker.get_translation_function(&"myTranslator".into());
        assert!(translation_func.is_some());
        assert_eq!(translation_func.unwrap().as_str(), "useGT");
        
        // Test general variable value helper
        let var_value = tracker.get_variable_value(&"regularVar".into());
        assert!(var_value.is_some());
        assert_eq!(var_value.unwrap().as_str(), "someValue");
        
        // Test that regular variable doesn't return from translation helper
        let not_translation = tracker.get_translation_function(&"regularVar".into());
        assert!(not_translation.is_none());
        
        // Test non-existent variable
        let missing = tracker.get_variable_value(&"nonexistent".into());
        assert!(missing.is_none());
    }

    #[test]
    fn test_all_variable_types_tracking() {
        let mut tracker = ScopeTracker::default();
        
        let scope1 = tracker.enter_scope();
        
        // Track different types of variables
        tracker.track_translation_variable("t1".into(), "useGT".into());
        tracker.track_regular_variable("literal".into(), "string_literal".into());
        tracker.track_regular_variable("reference".into(), "ref:t1".into());
        tracker.track_regular_variable("undefined_var".into(), "undefined".into());
        
        // All should be accessible in same scope
        assert!(tracker.is_variable_accessible(&"t1".into()).is_some());
        assert!(tracker.is_variable_accessible(&"literal".into()).is_some());
        assert!(tracker.is_variable_accessible(&"reference".into()).is_some());
        assert!(tracker.is_variable_accessible(&"undefined_var".into()).is_some());
        
        // Check types are preserved
        let t1_var = tracker.is_variable_accessible(&"t1".into()).unwrap();
        assert_eq!(t1_var.is_translation_function, true);
        assert_eq!(t1_var.assigned_value.as_str(), "useGT");
        
        let literal_var = tracker.is_variable_accessible(&"literal".into()).unwrap();
        assert_eq!(literal_var.is_translation_function, false);
        assert_eq!(literal_var.assigned_value.as_str(), "string_literal");
        
        // Enter nested scope
        let _scope2 = tracker.enter_scope();
        
        // All parent variables should be accessible
        assert!(tracker.is_variable_accessible(&"t1".into()).is_some());
        assert!(tracker.is_variable_accessible(&"literal".into()).is_some());
        
        // Shadow a variable
        tracker.track_regular_variable("t1".into(), "not_a_function".into());
        
        // Should get shadowed version
        let shadowed = tracker.is_variable_accessible(&"t1".into()).unwrap();
        assert_eq!(shadowed.is_translation_function, false);
        assert_eq!(shadowed.assigned_value.as_str(), "not_a_function");
        
        // Exit nested scope - shadow should be removed
        tracker.exit_scope();
        
        // Should get original back
        let restored = tracker.is_variable_accessible(&"t1".into()).unwrap();
        assert_eq!(restored.is_translation_function, true);
        assert_eq!(restored.assigned_value.as_str(), "useGT");
        assert_eq!(restored.scope_id, scope1);
    }

    #[test]
    fn test_aggressive_cleanup_on_exit() {
        let mut tracker = ScopeTracker::default();
        
        // Enter scope and track variables
        let scope1 = tracker.enter_scope();
        tracker.track_translation_variable("t1".into(), "useGT".into());
        
        // Enter nested scope
        let scope2 = tracker.enter_scope();
        tracker.track_translation_variable("t2".into(), "getGT".into());
        
        // Both variables should exist
        assert!(tracker.is_variable_accessible(&"t1".into()).is_some());
        assert!(tracker.is_variable_accessible(&"t2".into()).is_some());
        
        // Variables should be in the data structure
        assert_eq!(tracker.scoped_variables.len(), 2);
        
        // Exit nested scope - should remove t2 immediately
        tracker.exit_scope();
        
        // t1 should still be accessible, t2 should not
        assert!(tracker.is_variable_accessible(&"t1".into()).is_some());
        assert!(tracker.is_variable_accessible(&"t2".into()).is_none());
        
        // t2 should be physically removed from data structure
        assert!(tracker.scoped_variables.get(&"t2".into()).is_none());
        assert_eq!(tracker.scoped_variables.len(), 1);
        
        // Scope info should also be cleaned up
        assert!(tracker.get_scope_info(scope2).is_none());
        assert!(tracker.get_scope_info(scope1).is_some());
    }
}