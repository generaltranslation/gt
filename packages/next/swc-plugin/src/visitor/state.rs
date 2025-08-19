use swc_core::ecma::atoms::Atom;
use crate::ast::{ScopeTracker, StringCollector};

// For tracking statistics for the plugin
#[derive(Default)]
pub struct Statistics {
    pub jsx_element_count: u32,
    pub dynamic_content_violations: u32,
}

// For tracking the current state during AST traversal
#[derive(Default)]
pub struct TraversalState {
    /// Track whether we're inside a translation component (T, Plural, etc.)
    pub in_translation_component: bool,
    /// Track whether we're inside a variable component (Var, Num, Currency, etc.)
    pub in_variable_component: bool,
    /// Track whether we're inside a JSX attribute expression (to ignore them)
    pub in_jsx_attribute: bool,
}


// For tracking gt-next imports and their aliases
#[derive(Default)]
pub struct ImportTracker {
    /// Scope tracker for tracking variables
    pub scope_tracker: ScopeTracker,

    /// Other import tracking
    pub namespace_imports: std::collections::HashSet<Atom>,
}

impl ImportTracker {
    pub fn new() -> Self {
        Self {
            scope_tracker: ScopeTracker::default(),
            namespace_imports: std::collections::HashSet::new(),
        }
    }
}