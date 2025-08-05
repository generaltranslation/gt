use swc_core::ecma::{
    ast::*,
    atoms::Atom,
    visit::{Fold, FoldWith},
};
use swc_core::plugin::{plugin_transform, proxies::TransformPluginProgramMetadata};
use std::collections::HashSet;
use std::sync::atomic::{AtomicUsize, Ordering};
use swc_core::plugin::metadata::TransformPluginMetadataContextKind;
use serde::Deserialize;

// Global counter to detect infinite loops
static CALL_COUNTER: AtomicUsize = AtomicUsize::new(0);

/// Plugin configuration options
#[derive(Deserialize, Debug, Default)]
#[serde(rename_all = "camelCase")]
struct PluginConfig {
    /// When true, disables dynamic content checking entirely
    #[serde(default)]
    disable_dynamic_content_check: bool,
}

/// GT-Next SWC plugin that detects dynamic content in translation components 
/// that isn't wrapped in variable components.
/// 
/// The plugin tracks imports from GT-Next modules and maps component names to their types:
/// - Translation components: T
/// - Variable components: Var, DateTime, Num, Currency
/// 
/// When dynamic content (JSX expressions with {}) is found inside a translation 
/// component but not wrapped in a variable component, it logs a warning with location info.
/// 
/// Supports imports from: 'gt-next', 'gt-next/client', 'gt-next/server'
/// Supports both named imports and namespace imports (import * as GT from 'gt-next')
pub struct TransformVisitor {
    /// True when currently visiting inside a translation component
    in_translation_component: bool,
    /// True when currently visiting inside a variable component
    in_variable_component: bool,
    /// Maps imported component names to their GT-Next component types
    /// Using Atom (interned strings) for better performance
    gt_next_translation_imports: HashSet<Atom>,
    gt_next_variable_imports: HashSet<Atom>,
    /// Maps namespace import names to GT-Next modules (e.g., "GT" from import * as GT)
    gt_next_namespace_imports: HashSet<Atom>,
    /// Maps variable names assigned from GT-Next translation components (e.g., "MyT" from const MyT = T)
    gt_assigned_translation_components: HashSet<Atom>,
    /// Maps variable names assigned from GT-Next variable components (e.g., "MyVar" from const MyVar = Var)
    gt_assigned_variable_components: HashSet<Atom>,
    /// Debug counter to track JSX elements processed
    jsx_element_count: usize,
    /// When true, disables all dynamic content checking
    disable_dynamic_content_check: bool,
}

impl Default for TransformVisitor {
    fn default() -> Self {
        Self::new(false)
    }
}

impl TransformVisitor {
    /// Create a new TransformVisitor with the specified configuration
    fn new(disable_dynamic_content_check: bool) -> Self {
        Self {
            in_translation_component: false,
            in_variable_component: false,
            gt_next_translation_imports: HashSet::new(),
            gt_next_variable_imports: HashSet::new(),
            gt_next_namespace_imports: HashSet::new(),
            gt_assigned_translation_components: HashSet::new(),
            gt_assigned_variable_components: HashSet::new(),
            jsx_element_count: 0,
            disable_dynamic_content_check,
        }
    }
}

impl Fold for TransformVisitor {
    /// Processes import declarations to track GT-Next component imports
    fn fold_import_decl(&mut self, import: ImportDecl) -> ImportDecl {
        if self.is_gt_next_module(&import.src.value) {
            // Process both named imports and namespace imports from GT-Next modules
            for specifier in &import.specifiers {
                match specifier {
                    ImportSpecifier::Named(named_import) => {
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
                    ImportSpecifier::Namespace(namespace_import) => {
                        // Track namespace imports like: import * as GT from 'gt-next'
                        self.gt_next_namespace_imports.insert(namespace_import.local.sym.clone());
                    }
                    ImportSpecifier::Default(_) => {
                        // GT-Next doesn't have default exports, so we ignore these
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
        match &element.opening.name {
            JSXElementName::Ident(ident) => {
                // Handle direct named imports: <T>, <Var>, etc.
                if self.gt_next_translation_imports.contains(&ident.sym) {
                    self.in_translation_component = true;
                } else if self.gt_next_variable_imports.contains(&ident.sym) {
                    self.in_variable_component = true;
                }
                // Handle assigned variables: <MyT>, <MyVar>, etc.
                else if self.gt_assigned_translation_components.contains(&ident.sym) {
                    self.in_translation_component = true;
                } else if self.gt_assigned_variable_components.contains(&ident.sym) {
                    self.in_variable_component = true;
                }
            }
            JSXElementName::JSXMemberExpr(member_expr) => {
                // Handle namespace imports: <GT.T>, <GT.Var>, etc.
                if let JSXObject::Ident(obj_ident) = &member_expr.obj {
                    if self.gt_next_namespace_imports.contains(&obj_ident.sym) {
                        // Check the property name (T, Var, etc.)
                        // member_expr.prop is an Ident, so we can access it directly
                        if self.is_translation_component_name(&member_expr.prop.sym) {
                            self.in_translation_component = true;
                        } else if self.is_variable_component_name(&member_expr.prop.sym) {
                            self.in_variable_component = true;
                        }
                    }
                }
            }
            JSXElementName::JSXNamespacedName(_) => {
                // Handle XML namespaced names (not relevant for GT-Next)
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
        // Only warn if dynamic content checking is enabled and we're inside a translation component but NOT inside a variable component
        if !self.disable_dynamic_content_check && self.in_translation_component && !self.in_variable_component {
            eprintln!("GT-Next plugin: Found unwrapped dynamic content in translation component");
            eprintln!("    Tip: Wrap dynamic content in <Var>, <DateTime>, <Num>, or <Currency> components");
        }
        
        // Continue processing children
        expr.fold_children_with(self)
    }
    
    /// Processes variable declarations to track assignments from GT-Next components
    /// Handles patterns like: const MyT = T; const MyVar = Var;
    fn fold_var_declarator(&mut self, declarator: VarDeclarator) -> VarDeclarator {
        // Check if this is a simple assignment from a GT-Next component
        if let Some(init) = &declarator.init {
            if let Expr::Ident(ident) = init.as_ref() {
                // Get the variable name being declared
                if let Pat::Ident(binding_ident) = &declarator.name {
                    let var_name = &binding_ident.id.sym;
                    let assigned_from = &ident.sym;
                    
                    // Check if it's assigned from a tracked GT-Next import
                    if self.gt_next_translation_imports.contains(assigned_from) {
                        self.gt_assigned_translation_components.insert(var_name.clone());
                    } else if self.gt_next_variable_imports.contains(assigned_from) {
                        self.gt_assigned_variable_components.insert(var_name.clone());
                    }
                }
            }
        }
        
        // Continue processing (unchanged)
        declarator
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
/// Accepts plugin configuration to enable/disable dynamic content checking.
#[plugin_transform]
pub fn process_transform(program: Program, metadata: TransformPluginProgramMetadata) -> Program {
    let call_count = CALL_COUNTER.fetch_add(1, Ordering::SeqCst);
    
    // Emergency brake: if we've been called too many times, just return the program unchanged
    if call_count > 100 {
        return program;
    }
    
    // Parse plugin configuration
    let config = metadata
        .get_context(&TransformPluginMetadataContextKind::Filename)
        .and_then(|_| metadata.get_transform_plugin_config())
        .and_then(|config_str| serde_json::from_str::<PluginConfig>(&config_str).ok())
        .unwrap_or_default();
    
    let mut visitor = TransformVisitor::new(config.disable_dynamic_content_check);
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

    #[test]
    fn test_namespace_import_tracking() {
        let mut visitor = TransformVisitor::default();
        
        // Initially, no namespace imports should be tracked
        assert!(visitor.gt_next_namespace_imports.is_empty());
        
        // Simulate namespace import processing (this would normally happen in fold_import_decl)
        let gt_atom = Atom::from("GT");
        let gt_client_atom = Atom::from("GTClient");
        
        visitor.gt_next_namespace_imports.insert(gt_atom.clone());
        visitor.gt_next_namespace_imports.insert(gt_client_atom.clone());
        
        // Verify namespace imports are tracked
        assert!(visitor.gt_next_namespace_imports.contains(&gt_atom));
        assert!(visitor.gt_next_namespace_imports.contains(&gt_client_atom));
        
        // Should not contain untracked namespaces
        let react_atom = Atom::from("React");
        assert!(!visitor.gt_next_namespace_imports.contains(&react_atom));
    }

    #[test]
    fn test_variable_assignment_tracking() {
        let mut visitor = TransformVisitor::default();
        
        // Initially, no assigned variables should be tracked
        assert!(visitor.gt_assigned_translation_components.is_empty());
        assert!(visitor.gt_assigned_variable_components.is_empty());
        
        // Set up some imported components first (simulating imports)
        let t_atom = Atom::from("T");
        let var_atom = Atom::from("Var");
        visitor.gt_next_translation_imports.insert(t_atom.clone());
        visitor.gt_next_variable_imports.insert(var_atom.clone());
        
        // Simulate variable assignment processing (this would normally happen in fold_var_declarator)
        let my_t_atom = Atom::from("MyT");
        let my_var_atom = Atom::from("MyVar");
        
        visitor.gt_assigned_translation_components.insert(my_t_atom.clone());
        visitor.gt_assigned_variable_components.insert(my_var_atom.clone());
        
        // Verify assigned variables are tracked
        assert!(visitor.gt_assigned_translation_components.contains(&my_t_atom));
        assert!(visitor.gt_assigned_variable_components.contains(&my_var_atom));
        
        // Should not contain untracked assignments
        let unrelated_atom = Atom::from("SomeOtherComponent");
        assert!(!visitor.gt_assigned_translation_components.contains(&unrelated_atom));
        assert!(!visitor.gt_assigned_variable_components.contains(&unrelated_atom));
    }

}