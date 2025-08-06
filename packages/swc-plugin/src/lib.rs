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

/// Log level for dynamic content checking
#[derive(Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
enum LogLevel {
    Warn,
    Error,
    Off,
}

impl Default for LogLevel {
    fn default() -> Self {
        LogLevel::Warn
    }
}

/// Plugin configuration options
#[derive(Deserialize, Debug, Default)]
#[serde(rename_all = "camelCase")]
struct PluginConfig {
    /// Log level for dynamic content checking: 'warn' | 'error' | 'off'
    #[serde(default)]
    dynamic_content_check_log_level: LogLevel,
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
    /// Log level for dynamic content checking
    log_level: LogLevel,
    /// Counter to track if any warnings were issued
    dynamic_content_violations: usize,
    /// Current file name for warning context (relative to project root)
    current_filename: Option<String>,
}

impl Default for TransformVisitor {
    fn default() -> Self {
        Self::new(LogLevel::Warn, None)
    }
}

impl TransformVisitor {
    /// Create a new TransformVisitor with the specified configuration
    fn new(log_level: LogLevel, filename: Option<String>) -> Self {
        // Convert absolute path to relative path for cleaner output
        let relative_filename = filename.map(|path| Self::make_relative_path(&path));
        
        Self {
            in_translation_component: false,
            in_variable_component: false,
            gt_next_translation_imports: HashSet::new(),
            gt_next_variable_imports: HashSet::new(),
            gt_next_namespace_imports: HashSet::new(),
            gt_assigned_translation_components: HashSet::new(),
            gt_assigned_variable_components: HashSet::new(),
            jsx_element_count: 0,
            log_level,
            dynamic_content_violations: 0,
            current_filename: relative_filename,
        }
    }
    
    /// Convert absolute path to relative path for cleaner error messages
    /// Removes common prefixes like /Users/username/project/ to show just src/app/page.tsx
    fn make_relative_path(absolute_path: &str) -> String {
        // Look for common project structure markers to determine relative path
        let markers = [
            "/src/",
            "/app/", 
            "/pages/",
            "/components/",
            "/lib/",
        ];
        
        // Try to find a marker and return everything from that point
        for marker in &markers {
            if let Some(pos) = absolute_path.find(marker) {
                return absolute_path[pos + 1..].to_string(); // +1 to remove leading slash
            }
        }
        
        // If no markers found, try to extract just the filename and immediate parent
        if let Some(last_slash) = absolute_path.rfind('/') {
            if let Some(second_last_slash) = absolute_path[..last_slash].rfind('/') {
                return absolute_path[second_last_slash + 1..].to_string();
            }
            // Just return filename if only one directory level
            return absolute_path[last_slash + 1..].to_string();
        }
        
        // Fallback to original path if we can't parse it
        absolute_path.to_string()
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
        // Only process if log level is not 'off' and we're inside a translation component but NOT inside a variable component
        if self.log_level != LogLevel::Off && self.in_translation_component && !self.in_variable_component {
            self.dynamic_content_violations += 1;
            
            // Get location information
            let byte_pos = expr.span.lo.0 as usize;
            let location_info = if let Some(filename) = &self.current_filename {
                format!("{}:byte-{}", filename, byte_pos)
            } else {
                format!("byte offset {}", byte_pos)
            };
            
            // Output message based on log level
            match self.log_level {
                LogLevel::Warn => {
                    eprintln!("gt-next: Warning: found unwrapped dynamic content in translation component at {}. Wrap dynamic content in <Var>, <DateTime>, <Num>, or <Currency> components.", location_info);
                }
                LogLevel::Error => {
                    eprintln!("gt-next: Error: found unwrapped dynamic content in translation component at {}. Wrap dynamic content in <Var>, <DateTime>, <Num>, or <Currency> components.", location_info);
                }
                LogLevel::Off => {
                    // This case shouldn't be reached due to the check above, but handle it for completeness
                }
            }
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
    
    // Get filename for better error reporting
    let filename = metadata
        .get_context(&TransformPluginMetadataContextKind::Filename)
        .map(|f| f.to_string());
    
    let mut visitor = TransformVisitor::new(config.dynamic_content_check_log_level.clone(), filename);
    let program = program.fold_with(&mut visitor);
    
    // If warnings were issued, show deprecation notice (only for warn level)
    if visitor.dynamic_content_violations > 0 && visitor.log_level == LogLevel::Warn {
        eprintln!("gt-next: Warning: unwrapped dynamic content warnings will default to triggering a build error in the next major version. See https://generaltranslation.com/docs/next-lint to add GT Next Lint to your project.");
    }
    // Fail the build if errors were encountered at error log level
    if visitor.dynamic_content_violations > 0 && visitor.log_level == LogLevel::Error {
        eprintln!("gt-next: Build failed! Found {} unwrapped dynamic content error(s).", visitor.dynamic_content_violations);
        panic!("gt-next: Build failed due to unwrapped dynamic content errors. Fix the errors above to continue. See https://generaltranslation.com/docs/next-lint to add GT Next Lint to your project.");
    }
    
    program
}

#[cfg(test)]
mod tests {
    use super::*;
    /// Helper function to create a test JSX element
    fn create_jsx_element(element_name: &str, has_dynamic_content: bool) -> JSXElement {
        use swc_core::common::{DUMMY_SP, SyntaxContext};
        
        let opening = JSXOpeningElement {
            span: DUMMY_SP,
            name: JSXElementName::Ident(Ident::new(element_name.into(), DUMMY_SP, SyntaxContext::empty())),
            attrs: vec![],
            self_closing: false,
            type_args: None,
        };
        
        let closing = Some(JSXClosingElement {
            span: DUMMY_SP,
            name: JSXElementName::Ident(Ident::new(element_name.into(), DUMMY_SP, SyntaxContext::empty())),
        });
        
        let mut children = vec![
            JSXElementChild::JSXText(JSXText {
                span: DUMMY_SP,
                value: "Hello ".into(),
                raw: "Hello ".into(),
            })
        ];
        
        if has_dynamic_content {
            children.push(JSXElementChild::JSXExprContainer(JSXExprContainer {
                span: DUMMY_SP,
                expr: JSXExpr::Expr(Box::new(Expr::Ident(Ident::new("name".into(), DUMMY_SP, SyntaxContext::empty())))),
            }));
        }
        
        children.push(JSXElementChild::JSXText(JSXText {
            span: DUMMY_SP,
            value: "!".into(), 
            raw: "!".into(),
        }));
        
        JSXElement {
            span: DUMMY_SP,
            opening,
            children,
            closing,
        }
    }

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

    // Integration tests for JSX processing
    #[test]
    fn test_basic_t_component_with_dynamic_content() {
        let mut visitor = TransformVisitor::new(LogLevel::Warn, Some("test.tsx".to_string()));
        
        // Simulate import of T component 
        visitor.gt_next_translation_imports.insert(Atom::from("T"));
        
        // Create JSX element: <T>Hello {name}!</T>
        let jsx_element = create_jsx_element("T", true);
        
        // Process the element
        let _transformed = jsx_element.fold_with(&mut visitor);
        
        // Should detect one unwrapped dynamic content violation
        assert_eq!(visitor.dynamic_content_violations, 1, "Should detect one unwrapped dynamic content violation");
    }

    /// Helper function to create a JSX element with wrapped dynamic content: <T>Hello <Var>{name}</Var>!</T>
    fn create_jsx_element_with_wrapped_content() -> JSXElement {
        use swc_core::common::{DUMMY_SP, SyntaxContext};
        
        // Create the inner Var element: <Var>{name}</Var>
        let var_element = JSXElement {
            span: DUMMY_SP,
            opening: JSXOpeningElement {
                span: DUMMY_SP,
                name: JSXElementName::Ident(Ident::new("Var".into(), DUMMY_SP, SyntaxContext::empty())),
                attrs: vec![],
                self_closing: false,
                type_args: None,
            },
            children: vec![
                JSXElementChild::JSXExprContainer(JSXExprContainer {
                    span: DUMMY_SP,
                    expr: JSXExpr::Expr(Box::new(Expr::Ident(Ident::new("name".into(), DUMMY_SP, SyntaxContext::empty())))),
                })
            ],
            closing: Some(JSXClosingElement {
                span: DUMMY_SP,
                name: JSXElementName::Ident(Ident::new("Var".into(), DUMMY_SP, SyntaxContext::empty())),
            }),
        };
        
        // Create the outer T element: <T>Hello <Var>{name}</Var>!</T>
        JSXElement {
            span: DUMMY_SP,
            opening: JSXOpeningElement {
                span: DUMMY_SP,
                name: JSXElementName::Ident(Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty())),
                attrs: vec![],
                self_closing: false,
                type_args: None,
            },
            children: vec![
                JSXElementChild::JSXText(JSXText {
                    span: DUMMY_SP,
                    value: "Hello ".into(),
                    raw: "Hello ".into(),
                }),
                JSXElementChild::JSXElement(Box::new(var_element)),
                JSXElementChild::JSXText(JSXText {
                    span: DUMMY_SP,
                    value: "!".into(),
                    raw: "!".into(),
                }),
            ],
            closing: Some(JSXClosingElement {
                span: DUMMY_SP,
                name: JSXElementName::Ident(Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty())),
            }),
        }
    }

    #[test]
    fn test_t_component_with_wrapped_dynamic_content() {
        let mut visitor = TransformVisitor::new(LogLevel::Warn, Some("test.tsx".to_string()));
        
        // Simulate imports of T and Var components 
        visitor.gt_next_translation_imports.insert(Atom::from("T"));
        visitor.gt_next_variable_imports.insert(Atom::from("Var"));
        
        // Create JSX element: <T>Hello <Var>{name}</Var>!</T>
        let jsx_element = create_jsx_element_with_wrapped_content();
        
        // Process the element
        let _transformed = jsx_element.fold_with(&mut visitor);
        
        // Should NOT detect any violations since dynamic content is wrapped
        assert_eq!(visitor.dynamic_content_violations, 0, "Should not detect violations when dynamic content is wrapped in Var");
    }

    /// Helper function to create a namespace JSX element: <GT.T>Hello {name}!</GT.T>
    fn create_namespace_jsx_element() -> JSXElement {
        use swc_core::common::{DUMMY_SP, SyntaxContext};
        
        // Create member expression for GT.T
        let member_expr = JSXMemberExpr {
            span: DUMMY_SP,
            obj: JSXObject::Ident(Ident::new("GT".into(), DUMMY_SP, SyntaxContext::empty())),
            prop: Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty()).into(),
        };
        
        JSXElement {
            span: DUMMY_SP,
            opening: JSXOpeningElement {
                span: DUMMY_SP,
                name: JSXElementName::JSXMemberExpr(member_expr.clone()),
                attrs: vec![],
                self_closing: false,
                type_args: None,
            },
            children: vec![
                JSXElementChild::JSXText(JSXText {
                    span: DUMMY_SP,
                    value: "Hello ".into(),
                    raw: "Hello ".into(),
                }),
                JSXElementChild::JSXExprContainer(JSXExprContainer {
                    span: DUMMY_SP,
                    expr: JSXExpr::Expr(Box::new(Expr::Ident(Ident::new("name".into(), DUMMY_SP, SyntaxContext::empty())))),
                }),
                JSXElementChild::JSXText(JSXText {
                    span: DUMMY_SP,
                    value: "!".into(),
                    raw: "!".into(),
                }),
            ],
            closing: Some(JSXClosingElement {
                span: DUMMY_SP,
                name: JSXElementName::JSXMemberExpr(member_expr),
            }),
        }
    }

    #[test]
    fn test_namespace_import_t_component() {
        let mut visitor = TransformVisitor::new(LogLevel::Warn, Some("test.tsx".to_string()));
        
        // Simulate namespace import: import * as GT from 'gt-next'
        visitor.gt_next_namespace_imports.insert(Atom::from("GT"));
        
        // Create JSX element: <GT.T>Hello {name}!</GT.T>
        let jsx_element = create_namespace_jsx_element();
        
        // Process the element
        let _transformed = jsx_element.fold_with(&mut visitor);
        
        // Should detect one unwrapped dynamic content violation
        assert_eq!(visitor.dynamic_content_violations, 1, "Should detect unwrapped dynamic content in namespace GT.T component");
    }

    #[test] 
    fn test_assigned_t_component() {
        let mut visitor = TransformVisitor::new(LogLevel::Warn, Some("test.tsx".to_string()));
        
        // Simulate import and assignment: import { T } from 'gt-next'; const MyT = T;
        visitor.gt_next_translation_imports.insert(Atom::from("T"));
        visitor.gt_assigned_translation_components.insert(Atom::from("MyT"));
        
        // Create JSX element: <MyT>Hello {name}!</MyT>
        let jsx_element = create_jsx_element("MyT", true);
        
        // Process the element
        let _transformed = jsx_element.fold_with(&mut visitor);
        
        // Should detect one unwrapped dynamic content violation
        assert_eq!(visitor.dynamic_content_violations, 1, "Should detect unwrapped dynamic content in assigned component MyT");
    }

    /// Helper function to create nested T components: <T>Outer {value} <T>Inner {name}</T></T>
    fn create_nested_t_elements() -> JSXElement {
        use swc_core::common::{DUMMY_SP, SyntaxContext};
        
        // Create inner T element: <T>Inner {name}</T>
        let inner_t = JSXElement {
            span: DUMMY_SP,
            opening: JSXOpeningElement {
                span: DUMMY_SP,
                name: JSXElementName::Ident(Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty())),
                attrs: vec![],
                self_closing: false,
                type_args: None,
            },
            children: vec![
                JSXElementChild::JSXText(JSXText {
                    span: DUMMY_SP,
                    value: "Inner ".into(),
                    raw: "Inner ".into(),
                }),
                JSXElementChild::JSXExprContainer(JSXExprContainer {
                    span: DUMMY_SP,
                    expr: JSXExpr::Expr(Box::new(Expr::Ident(Ident::new("name".into(), DUMMY_SP, SyntaxContext::empty())))),
                }),
            ],
            closing: Some(JSXClosingElement {
                span: DUMMY_SP,
                name: JSXElementName::Ident(Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty())),
            }),
        };
        
        // Create outer T element: <T>Outer {value} <inner_t></T>
        JSXElement {
            span: DUMMY_SP,
            opening: JSXOpeningElement {
                span: DUMMY_SP,
                name: JSXElementName::Ident(Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty())),
                attrs: vec![],
                self_closing: false,
                type_args: None,
            },
            children: vec![
                JSXElementChild::JSXText(JSXText {
                    span: DUMMY_SP,
                    value: "Outer ".into(),
                    raw: "Outer ".into(),
                }),
                JSXElementChild::JSXExprContainer(JSXExprContainer {
                    span: DUMMY_SP,
                    expr: JSXExpr::Expr(Box::new(Expr::Ident(Ident::new("value".into(), DUMMY_SP, SyntaxContext::empty())))),
                }),
                JSXElementChild::JSXText(JSXText {
                    span: DUMMY_SP,
                    value: " ".into(),
                    raw: " ".into(),
                }),
                JSXElementChild::JSXElement(Box::new(inner_t)),
            ],
            closing: Some(JSXClosingElement {
                span: DUMMY_SP,
                name: JSXElementName::Ident(Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty())),
            }),
        }
    }

    #[test]
    fn test_nested_t_components() {
        let mut visitor = TransformVisitor::new(LogLevel::Warn, Some("test.tsx".to_string()));
        
        // Simulate import of T component 
        visitor.gt_next_translation_imports.insert(Atom::from("T"));
        
        // Create nested JSX elements: <T>Outer {value} <T>Inner {name}</T></T>
        let jsx_element = create_nested_t_elements();
        
        // Process the element
        let _transformed = jsx_element.fold_with(&mut visitor);
        
        // Should detect TWO unwrapped dynamic content violations (one in outer T, one in inner T)
        assert_eq!(visitor.dynamic_content_violations, 2, "Should detect two unwrapped dynamic content violations in nested T components");
    }

}