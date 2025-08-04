use swc_core::ecma::{
    ast::*,
    atoms::Atom,
    visit::{Fold, FoldWith},
};
use swc_core::plugin::{plugin_transform, proxies::TransformPluginProgramMetadata};
use std::collections::HashSet;
use std::sync::atomic::{AtomicUsize, Ordering};

// Global counter to detect infinite loops
static CALL_COUNTER: AtomicUsize = AtomicUsize::new(0);

/// GT-Next SWC plugin that detects dynamic content in translation components 
/// that isn't wrapped in variable components.
/// 
/// The plugin tracks imports from GT-Next modules and maps component names to their types:
/// - Translation components: T
/// - Variable components: Var, DateTime, Num, Currency
/// 
/// When dynamic content (JSX expressions with {}) is found inside a translation 
/// component but not wrapped in a variable component, it logs a warning.
/// 
/// Supports imports from: 'gt-next', 'gt-next/client', 'gt-next/server'
pub struct TransformVisitor {
    /// True when currently visiting inside a translation component
    in_translation_component: bool,
    /// True when currently visiting inside a variable component
    in_variable_component: bool,
    /// Maps imported component names to their GT-Next component types
    /// Using Atom (interned strings) for better performance
    gt_next_translation_imports: HashSet<Atom>,
    gt_next_variable_imports: HashSet<Atom>,
    /// Debug counter to track JSX elements processed
    jsx_element_count: usize,
}

impl Default for TransformVisitor {
    fn default() -> Self {
        Self {
            in_translation_component: false,
            in_variable_component: false,
            gt_next_translation_imports: HashSet::new(),
            gt_next_variable_imports: HashSet::new(),
            jsx_element_count: 0,
        }
    }
}

impl Fold for TransformVisitor {
    /// Processes import declarations to track GT-Next component imports
    fn fold_import_decl(&mut self, import: ImportDecl) -> ImportDecl {
        if self.is_gt_next_module(&import.src.value) {
            // Process named imports from GT-Next modules
            for specifier in &import.specifiers {
                if let ImportSpecifier::Named(named_import) = specifier {
                    let imported_name = match &named_import.imported {
                        Some(ModuleExportName::Ident(ident)) => &ident.sym,
                        Some(ModuleExportName::Str(str_lit)) => &str_lit.value,
                        None => &named_import.local.sym,
                    };
                    let local_name = &named_import.local.sym;
                    
                    // Map to component type based on original imported name - no allocations
                    if self.is_translation_component_name(imported_name) {
                        self.gt_next_translation_imports.insert(local_name.clone());
                    } else if self.is_variable_component_name(imported_name) {
                        self.gt_next_variable_imports.insert(local_name.clone());
                    }
                }
            }
        }
        
        // Return the import unchanged
        import
    }
    
    // Step 2: Add JSX element detection back
    fn fold_jsx_element(&mut self, element: JSXElement) -> JSXElement {
        self.jsx_element_count += 1;
        
        // Save current state to restore after processing children
        let was_in_translation = self.in_translation_component;
        let was_in_variable = self.in_variable_component;
        
        // Check if this component is a tracked GT-Next import - no allocations
        if let JSXElementName::Ident(ident) = &element.opening.name {
            if self.gt_next_translation_imports.contains(&ident.sym) {
                self.in_translation_component = true;
            } else if self.gt_next_variable_imports.contains(&ident.sym) {
                self.in_variable_component = true;
            }
        }
        
        // Fold children with updated context
        let element = element.fold_children_with(self);
        
        // Restore previous state
        self.in_translation_component = was_in_translation;
        self.in_variable_component = was_in_variable;
        
        element
    }
    
    // Step 3: Add JSX expression container detection for unwrapped dynamic content
    fn fold_jsx_expr_container(&mut self, expr: JSXExprContainer) -> JSXExprContainer {
        // Only warn if we're inside a translation component but NOT inside a variable component
        if self.in_translation_component && !self.in_variable_component {
            eprintln!("GT-Next plugin: Found unwrapped dynamic content in translation component");
            eprintln!("    Tip: Wrap dynamic content in <Var>, <DateTime>, <Num>, or <Currency> components");
        }
        
        // Continue processing children
        expr.fold_children_with(self)
    }
}


impl TransformVisitor {
    /// Checks if a module path is a GT-Next module
    /// Supports: 'gt-next', 'gt-next/client', 'gt-next/server'
    fn is_gt_next_module(&self, module_path: &str) -> bool {
        matches!(module_path, "gt-next" | "gt-next/client" | "gt-next/server")
    }
    
    /// Checks if a component name is a translation component (no allocations)
    fn is_translation_component_name(&self, name: &Atom) -> bool {
        name == "T"
    }
    
    /// Checks if a component name is a variable component (no allocations)
    fn is_variable_component_name(&self, name: &Atom) -> bool {
        matches!(name.as_str(), "Var" | "DateTime" | "Num" | "Currency")
    }
}

/// Main entry point for the SWC plugin
/// 
/// This function is called by the SWC compiler with the parsed AST.
/// It applies the TransformVisitor to detect unwrapped dynamic content in <T> components.
#[plugin_transform]
pub fn process_transform(program: Program, _metadata: TransformPluginProgramMetadata) -> Program {
    let call_count = CALL_COUNTER.fetch_add(1, Ordering::SeqCst);
    
    // Emergency brake: if we've been called too many times, just return the program unchanged
    if call_count > 100 {
        return program;
    }
    
    let mut visitor = TransformVisitor::default();
    let program = program.fold_with(&mut visitor);
    
    program
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_visitor_initial_state() {
        let visitor = TransformVisitor::default();
        assert_eq!(visitor.in_translation_component, false);
        assert_eq!(visitor.in_variable_component, false);
        assert!(visitor.gt_next_translation_imports.is_empty());
        assert!(visitor.gt_next_variable_imports.is_empty());
    }

    #[test]
    fn test_gt_next_module_detection() {
        let visitor = TransformVisitor::default();
        
        // Test GT-Next module detection
        assert!(visitor.is_gt_next_module("gt-next"));
        assert!(visitor.is_gt_next_module("gt-next/client"));
        assert!(visitor.is_gt_next_module("gt-next/server"));
        
        // Should not match other modules
        assert!(!visitor.is_gt_next_module("react"));
        assert!(!visitor.is_gt_next_module("next"));
        assert!(!visitor.is_gt_next_module("gt-other"));
    }

    #[test]
    fn test_component_name_detection() {
        let visitor = TransformVisitor::default();
        
        // Test translation component detection
        let t_atom = Atom::from("T");
        assert!(visitor.is_translation_component_name(&t_atom));
        
        // Test variable component detection
        let var_atom = Atom::from("Var");
        let datetime_atom = Atom::from("DateTime");
        let num_atom = Atom::from("Num");
        let currency_atom = Atom::from("Currency");
        assert!(visitor.is_variable_component_name(&var_atom));
        assert!(visitor.is_variable_component_name(&datetime_atom));
        assert!(visitor.is_variable_component_name(&num_atom));
        assert!(visitor.is_variable_component_name(&currency_atom));
        
        // Should not match unknown components
        let unknown_atom = Atom::from("UnknownComponent");
        let div_atom = Atom::from("div");
        assert!(!visitor.is_translation_component_name(&unknown_atom));
        assert!(!visitor.is_variable_component_name(&div_atom));
    }

}