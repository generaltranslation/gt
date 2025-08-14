use swc_core::ecma::atoms::Atom;


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
    /// Aliases for gt-next imports
    pub translation_import_aliases: std::collections::HashMap<Atom, Atom>, // T
    pub variable_import_aliases: std::collections::HashMap<Atom, Atom>,    // Var, Num, Currency, DateTime
    pub branch_import_aliases: std::collections::HashMap<Atom, Atom>,      // Branch, Plural
    pub translation_function_import_aliases: std::collections::HashMap<Atom, Atom>, // getGT, useGT
    // TODO: getGT, useGT

    /// Other import tracking
    pub namespace_imports: std::collections::HashSet<Atom>,
    // pub translation_functions: std::collections::HashSet<Atom>, // getGT, useGT (Deprecated)
    pub translation_callee_names: std::collections::HashMap<Atom, Atom>, // const t = getGT, const t2 = useGT
}