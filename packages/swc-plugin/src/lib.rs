use serde::Deserialize;
use swc_core::{
    common::SyntaxContext,
    ecma::{
        ast::*,
        atoms::Atom,
        visit::{Fold, FoldWith, VisitMut, VisitMutWith},
    },
    plugin::{plugin_transform, proxies::TransformPluginProgramMetadata},
};

/// Log levels for controlling warning outputs
#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "lowercase")]
pub enum LogLevel {
    Silent,
    Error,
    Warn,
    Info,
}

impl Default for LogLevel {
    fn default() -> Self {
        LogLevel::Warn
    }
}


// For tracking statistics for the plugin
#[derive(Default)]
struct Statistics {
    jsx_element_count: u32,
    dynamic_content_violations: u32,
}

// For tracking the current state during AST traversal
#[derive(Default)]
struct TraversalState {
    /// Track whether we're inside a translation component (T, Plural, etc.)
    in_translation_component: bool,
    /// Track whether we're inside a variable component (Var, Num, Currency, etc.)
    in_variable_component: bool,
    /// Track whether we're inside a JSX attribute expression (to ignore them)
    in_jsx_attribute: bool,
}


// For tracking gt-next imports and their aliases
#[derive(Default)]
struct ImportTracker {
    /// Aliases for gt-next imports
    translation_import_aliases: std::collections::HashMap<Atom, Atom>, // T
    variable_import_aliases: std::collections::HashMap<Atom, Atom>,    // Var, Num, Currency, DateTime
    branch_import_aliases: std::collections::HashMap<Atom, Atom>,      // Branch, Plural
    // TODO: getGT, useGT

    /// Other import tracking
    namespace_imports: std::collections::HashSet<Atom>,
    translation_functions: std::collections::HashSet<Atom>, // getGT, useGT
}

// For plugin configuration and settings
#[derive(Debug)]
struct PluginSettings {
    /// Log levels for different warning types
    dynamic_jsx_check_log_level: LogLevel,
    dynamic_string_check_log_level: LogLevel,
    /// Experimental feature: inject compile-time hash attributes
    experimental_compile_time_hash: bool,
    /// Optional filename for better error messages
    filename: Option<String>,
}

impl PluginSettings {
fn new(
    dynamic_jsx_check_log_level: LogLevel,
    dynamic_string_check_log_level: LogLevel,
    experimental_compile_time_hash: bool,
    filename: Option<String>,
) -> Self {
    Self {
        dynamic_jsx_check_log_level,
        dynamic_string_check_log_level,
        experimental_compile_time_hash,
        filename,
    }
}
}

/// Plugin configuration options
#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct PluginConfig {
    #[serde(default)]
    dynamic_jsx_check_log_level: LogLevel,
    #[serde(default)]
    dynamic_string_check_log_level: LogLevel,
    #[serde(default)]
    experimental_compile_time_hash: bool,
}

impl Default for PluginConfig {
    fn default() -> Self {
        Self {
            dynamic_jsx_check_log_level: LogLevel::Warn,
            dynamic_string_check_log_level: LogLevel::Warn,
            experimental_compile_time_hash: false,
        }
    }
}

/// Main transformation visitor for the SWC plugin
pub struct TransformVisitor {
    /// Statistics for the plugin
    statistics: Statistics,
    /// Track the current state during AST traversal
    traversal_state: TraversalState,
    /// Track gt-next imports and their aliases
    import_tracker: ImportTracker,
    /// Plugin settings
    settings: PluginSettings,
    
}

impl Default for TransformVisitor {
    fn default() -> Self {
        Self::new(LogLevel::Warn, LogLevel::Warn, false, None)
    }
}

impl TransformVisitor {
    pub fn new(
        dynamic_jsx_check_log_level: LogLevel,
        dynamic_string_check_log_level: LogLevel,
        experimental_compile_time_hash: bool,
        filename: Option<String>,
    ) -> Self {
        Self {
            traversal_state: TraversalState::default(),
            statistics: Statistics::default(),
            import_tracker: ImportTracker::default(),
            settings: PluginSettings::new(dynamic_jsx_check_log_level, dynamic_string_check_log_level, experimental_compile_time_hash, filename),
        }
    }

    /// Check if a component name matches known gt-next translation components
    fn is_translation_component_name(&self, name: &Atom) -> bool {
        matches!(name.as_ref(), "T")
    }

    /// Check if a component name matches known gt-next variable components
    fn is_variable_component_name(&self, name: &Atom) -> bool {
        matches!(name.as_ref(), "Var" | "Num" | "Currency" | "DateTime")
    }

    /// Check if a name is a GT branch
    fn is_branch_name(&self, name: &Atom) -> bool {
        matches!(name.as_ref(), "Branch" | "Plural")
    }

    /// Check if a name is a GT translation function
    fn is_translation_function_name(&self, name: &Atom) -> bool {
        matches!(name.as_ref(), "useGT" | "getGT")
    }


    /// Check if we should track this component based on imports or known components
    fn should_track_component_as_translation(&self, name: &Atom) -> bool {
        // Direct imports from gt-next - includes T components
        self.import_tracker.translation_import_aliases.contains_key(name)
    }

    /// Check if we should track this component as a variable component
    fn should_track_component_as_variable(&self, name: &Atom) -> bool {
        // Direct imports from gt-next
        self.import_tracker.variable_import_aliases.contains_key(name)
    }

    /// Check if we should track this component as a branch component
    fn should_track_component_as_branch(&self, name: &Atom) -> bool {
        // Branch and Plural components components
        self.import_tracker.branch_import_aliases.contains_key(name)
    }

    /// Check if we should track a namespace component (GT.T, GT.Var, etc.)
    fn should_track_namespace_component(&self, obj: &Atom, prop: &Atom) -> (bool, bool, bool) {
        if self.import_tracker.namespace_imports.contains(obj) {
            let is_translation = self.is_translation_component_name(prop);
            let is_variable = self.is_variable_component_name(prop);
            let is_branch = self.is_branch_name(prop);
            (is_translation, is_variable, is_branch)
        } else {
            (false, false, false)
        }
    }

    /// Log a warning with appropriate level
    fn log_warning(&self, level: &LogLevel, message: &str) {
        match level {
            LogLevel::Silent => {},
            LogLevel::Error | LogLevel::Warn | LogLevel::Info => {
                eprintln!("{}", message);
            }
        }
    }

    /// Generate warning message for dynamic content violations
    fn create_dynamic_content_warning(&self, component_name: &str) -> String {
        let file_info = if let Some(ref filename) = self.settings.filename {
            format!(" in {}", filename)
        } else {
            String::new()
        };
        
        format!(
            "gt-next {}: <{}> component contains unwrapped dynamic content. Consider wrapping expressions in <Var>{{expression}}</Var> components for proper translation handling.",
            file_info, component_name
        )
    }

    /// Generate warning message for dynamic function call violations
    fn create_dynamic_function_warning(&self, function_name: &str, violation_type: &str) -> String {
        let file_info = if let Some(ref filename) = self.settings.filename {
            format!(" in {}", filename)
        } else {
            String::new()
        };
        
        format!(
            "gt-next {}: {}() function call uses {} which prevents proper translation key generation. Use string literals instead.",
            file_info, function_name, violation_type
        )
    }

    /// Process GT-Next import declarations to track imports and aliases
    fn process_gt_import_declaration(&mut self, import_decl: &ImportDecl) {
        let src_value = import_decl.src.value.as_ref();
        match src_value {
            "gt-next" | "gt-next/client" | "gt-next/server" => {
                // Process named imports: import { T, Var, useGT } from 'gt-next'
                for specifier in &import_decl.specifiers {
                    match specifier {
                        ImportSpecifier::Named(ImportNamedSpecifier { local, imported, .. }) => {
                            let local_name = local.sym.clone();
                            let original_name = match imported {
                                Some(ModuleExportName::Ident(ident)) => ident.sym.clone(),
                                Some(ModuleExportName::Str(str_lit)) => str_lit.value.clone(),
                                None => local_name.clone(),
                            };

                            if self.is_translation_component_name(&original_name) {
                                // Store the mapping: local_name -> original_name
                                self.import_tracker.translation_import_aliases.insert(local_name, original_name);
                            } else if self.is_variable_component_name(&original_name) {
                                self.import_tracker.variable_import_aliases.insert(local_name, original_name);
                            } else if self.is_branch_name(&original_name) {
                                // no existing tracking for branches
                                self.import_tracker.branch_import_aliases.insert(local_name, original_name);
                            } else if self.is_translation_function_name(&original_name) {
                                self.import_tracker.translation_functions.insert(local_name.clone());
                            }
                        }
                        ImportSpecifier::Namespace(ImportStarAsSpecifier { local, .. }) => {
                            // Handle namespace imports: import * as GT from 'gt-next'
                            self.import_tracker.namespace_imports.insert(local.sym.clone());
                        }
                        _ => {}
                    }
                }
            }
            _ => {}
        }
    }


    fn extract_string_from_jsx_attr(jsx_attr: &JSXAttr) -> Option<String> {
        match &jsx_attr.value {
            Some(JSXAttrValue::Lit(Lit::Str(str_lit))) => Some(str_lit.value.to_string()),
            Some(JSXAttrValue::JSXExprContainer(expr_container)) => {
                match &expr_container.expr {
                    JSXExpr::Expr(expr) => {
                        match expr.as_ref() {
                            Expr::Lit(Lit::Str(str_lit)) => Some(str_lit.value.to_string()),
                            Expr::Tpl(tpl) => {
                                if tpl.exprs.is_empty() && tpl.quasis.len() == 1 {
                                    if let Some(quasi) = tpl.quasis.first() {
                                        if let Some(cooked) = &quasi.cooked {
                                            Some(cooked.to_string())
                                        } else {
                                            Some(quasi.raw.to_string())
                                        }
                                    } else {
                                        None
                                    }
                                } else {
                                    None
                                }
                            }
                            _ => None
                        }
                    }
                    _ => None
                }
            }
            _ => None
        }
    }

    /// Calculate hash for JSX element using AST traversal
    fn calculate_element_hash(&self, element: &JSXElement) -> (String, String) {
        use crate::traversal::JsxTraversal;
        use crate::hash::JsxHasher;
        
        let mut traversal = JsxTraversal::new(self);
        
        // Build sanitized children directly from JSX children
        if let Some(sanitized_children) = traversal.build_sanitized_children(&element.children) {
            // Get the id from the element
            let id = element.opening.attrs.iter().find_map(|attr| {
                if let JSXAttrOrSpread::JSXAttr(jsx_attr) = attr {
                    if let JSXAttrName::Ident(ident) = &jsx_attr.name {
                        if ident.sym.as_ref() == "id" {
                            Self::extract_string_from_jsx_attr(&jsx_attr)
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                } else {
                    None
                }
            });

            // Get the context from the element
            let context = element.opening.attrs.iter().find_map(|attr| {
                if let JSXAttrOrSpread::JSXAttr(jsx_attr) = attr {
                    if let JSXAttrName::Ident(ident) = &jsx_attr.name {
                        if ident.sym.as_ref() == "context" {
                            Self::extract_string_from_jsx_attr(&jsx_attr)
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                } else {
                    None
                }
            });

            // Get the id from the element
            // Create the full SanitizedData structure to match TypeScript implementation
            use crate::hash::SanitizedData;
            let sanitized_data = SanitizedData {
                source: Some(Box::new(sanitized_children)),
                id,
                context,
                data_format: Some("JSX".to_string()),
            };
            // Calculate hash using stable stringify (like TypeScript fast-json-stable-stringify)
            let json_string = JsxHasher::stable_stringify(&sanitized_data)
                .expect("Failed to serialize sanitized data");
            
            
            let hash = JsxHasher::hash_string(&json_string);
            (hash, json_string)
        } else {
            // Fallback to empty content hash with proper wrapper structure
            use crate::hash::{SanitizedData, SanitizedElement, SanitizedChild, SanitizedChildren};
            let empty_element = SanitizedElement {
                b: None,
                c: None,
                t: None,
                d: None,
            };
          
            let empty_children = SanitizedChildren::Single(Box::new(SanitizedChild::Element(Box::new(empty_element))));
            let sanitized_data = SanitizedData {
                source: Some(Box::new(empty_children)),
                id: None,
                context: None,
                data_format: Some("JSX".to_string()),
            };
            
            let json_string = JsxHasher::stable_stringify(&sanitized_data)
                .expect("Failed to serialize empty data");
            
            let hash = JsxHasher::hash_string(&json_string);
            (hash, json_string)
        }
    }

    /// Check for violations in a call expression
    fn check_call_expr_for_violations (&mut self, call_expr: &CallExpr) {
        if let Callee::Expr(callee_expr) = &call_expr.callee {
            if let Expr::Ident(Ident { sym: function_name, .. }) = callee_expr.as_ref() {
                if self.import_tracker.translation_functions.contains(function_name) {
                    // Check the first argument for dynamic content
                    if let Some(arg) = call_expr.args.first() {
                        match arg.expr.as_ref() {
                            // Template literals: t(`Hello ${name}`)
                            Expr::Tpl(_) => {
                                self.statistics.dynamic_content_violations += 1;
                                let warning = self.create_dynamic_function_warning(function_name.as_ref(), "template literals");
                                self.log_warning(&self.settings.dynamic_string_check_log_level, &warning);
                            }
                            // String concatenation: t("Hello " + name)
                            Expr::Bin(BinExpr { op: BinaryOp::Add, left, right, .. }) => {
                                // Check if it's string concatenation (at least one side is a string)
                                let left_is_string = matches!(left.as_ref(), Expr::Lit(Lit::Str(_)));
                                let right_is_string = matches!(right.as_ref(), Expr::Lit(Lit::Str(_)));
                                
                                if left_is_string || right_is_string {
                                    self.statistics.dynamic_content_violations += 1;
                                    let warning = self.create_dynamic_function_warning(function_name.as_ref(), "string concatenation");
                                    self.log_warning(&self.settings.dynamic_string_check_log_level, &warning);
                                }
                            }
                            _ => {
                                // Valid usage (string literal, variable, etc.)
                            }
                        }
                    }
                }
            }
        }
    }

    fn track_variable_assignment (&mut self, var_declarator: &VarDeclarator) {
        // Check for assignments like: const t = useGT() or const MyT = T
        if let (Pat::Ident(BindingIdent { id, .. }), Some(init_expr)) = (&var_declarator.name, &var_declarator.init) {
            match init_expr.as_ref() {
                // Handle function calls: const t = useGT()
                Expr::Call(CallExpr { callee: Callee::Expr(callee_expr), .. }) => {
                    if let Expr::Ident(Ident { sym: callee_name, .. }) = callee_expr.as_ref() {
                        if self.import_tracker.translation_functions.contains(callee_name) {
                            // Track the assigned variable as a translation function
                            self.import_tracker.translation_functions.insert(id.sym.clone());
                        }
                    }
                }
                _ => {}
            }
        }
    }


    fn determine_component_type (&mut self, element: &JSXElement) -> (bool, bool, bool) {
        return match &element.opening.name {
            JSXElementName::Ident(ident) => {
                let name = &ident.sym;
                let is_translation = self.should_track_component_as_translation(name);
                let is_variable = self.should_track_component_as_variable(name);
                let is_branch = self.should_track_component_as_branch(name);
                (is_translation, is_variable, is_branch)
            }
            JSXElementName::JSXMemberExpr(member_expr) => {
                if let JSXObject::Ident(obj_ident) = &member_expr.obj {
                    let obj_name = &obj_ident.sym;
                    let prop_name = &member_expr.prop.sym;
                    self.should_track_namespace_component(obj_name, prop_name)
                } else {
                    (false, false, false)
                }
            }
            _ => (false, false, false),
        };
    }


    fn determine_has_hash_attr (&self, element: &JSXElement) -> bool {
        element.opening.attrs.iter().any(|attr| {
            if let JSXAttrOrSpread::JSXAttr(jsx_attr) = attr {
                if let JSXAttrName::Ident(ident) = &jsx_attr.name {
                    return ident.sym.as_ref() == "hash";
                }
            }
            false
        })
    }

    fn create_hash_attr (&self, element: &JSXElement, hash_value: &str) -> JSXAttrOrSpread {
        JSXAttrOrSpread::JSXAttr(JSXAttr {
            span: element.opening.span,
            name: JSXAttrName::Ident(Ident::new("hash".into(), element.opening.span, SyntaxContext::empty()).into()),
            value: Some(JSXAttrValue::Lit(Lit::Str(Str {
                span: element.opening.span,
                value: hash_value.into(),
                raw: None,
            }))),
        })
    }


    fn create_json_attr (&self, element: &JSXElement, json_string: &str) -> JSXAttrOrSpread {
        JSXAttrOrSpread::JSXAttr(JSXAttr {
            span: element.opening.span,
            name: JSXAttrName::Ident(Ident::new("json".into(), element.opening.span, SyntaxContext::empty()).into()),
            value: Some(JSXAttrValue::Lit(Lit::Str(Str {
                span: element.opening.span,
                value: json_string.into(),
                raw: None,
            }))),
        })
    }

}

impl VisitMut for TransformVisitor {
    /// Process import declarations to track GT-Next imports
    fn visit_mut_import_decl(&mut self, import_decl: &mut ImportDecl) {
        self.process_gt_import_declaration(import_decl);
        import_decl.visit_mut_children_with(self);
    }

    /// Process variable declarations to track assignments like: const t = useGT()
    fn visit_mut_var_declarator(&mut self, var_declarator: &mut VarDeclarator) {
        self.track_variable_assignment(var_declarator);
        var_declarator.visit_mut_children_with(self);
    }

    /// Process function calls to detect invalid usage of translation functions
    fn visit_mut_call_expr(&mut self, call_expr: &mut CallExpr) {
        self.check_call_expr_for_violations(call_expr);
        call_expr.visit_mut_children_with(self);
    }

    /// Process JSX attributes to track context and avoid flagging attribute expressions
    fn visit_mut_jsx_attr(&mut self, attr: &mut JSXAttr) {
        let was_in_jsx_attribute = self.traversal_state.in_jsx_attribute;
        self.traversal_state.in_jsx_attribute = true;
        attr.visit_mut_children_with(self);
        self.traversal_state.in_jsx_attribute = was_in_jsx_attribute;
    }

    /// Process JSX expression containers to detect unwrapped dynamic content
    fn visit_mut_jsx_expr_container(&mut self, expr_container: &mut JSXExprContainer) {
        // Only check for violations if we're in a translation component and NOT in a JSX attribute
        if self.traversal_state.in_translation_component && !self.traversal_state.in_jsx_attribute {
            self.statistics.dynamic_content_violations += 1;
            let warning = self.create_dynamic_content_warning("T");
            self.log_warning(&self.settings.dynamic_jsx_check_log_level, &warning);
        }
        
        expr_container.visit_mut_children_with(self);
    }
    
}

impl Fold for TransformVisitor {
    /// Process import declarations to track GT-Next imports
    fn fold_import_decl(&mut self, import_decl: ImportDecl) -> ImportDecl {
        self.process_gt_import_declaration(&import_decl);
        import_decl
    }

    /// Process variable declarations to track assignments like: const t = useGT()
    fn fold_var_declarator(&mut self, var_declarator: VarDeclarator) -> VarDeclarator {
        self.track_variable_assignment(&var_declarator);
        var_declarator
    }

    /// Process function calls to detect invalid usage of translation functions
    fn fold_call_expr(&mut self, call_expr: CallExpr) -> CallExpr {
        self.check_call_expr_for_violations(&call_expr);
        call_expr.fold_children_with(self)
    }

    /// Process JSX expression containers to detect unwrapped dynamic content
    fn fold_jsx_expr_container(&mut self, expr_container: JSXExprContainer) -> JSXExprContainer {
        // Only check for violations if we're in a translation component and NOT in a JSX attribute
        if self.traversal_state.in_translation_component && !self.traversal_state.in_jsx_attribute {
            self.statistics.dynamic_content_violations += 1;
            let warning = self.create_dynamic_content_warning("T");
            self.log_warning(&self.settings.dynamic_jsx_check_log_level, &warning);
        }
        expr_container.fold_children_with(self)
    }

    /// Process JSX attributes to track context and avoid flagging attribute expressions
    fn fold_jsx_attr(&mut self, attr: JSXAttr) -> JSXAttr {
        let was_in_jsx_attribute = self.traversal_state.in_jsx_attribute;
        self.traversal_state.in_jsx_attribute = true;
        let attr = attr.fold_children_with(self);
        self.traversal_state.in_jsx_attribute = was_in_jsx_attribute;
        attr
    }

    /// Process JSX elements to track component context and inject experimental features
    fn fold_jsx_element(&mut self, mut element: JSXElement) -> JSXElement {
        self.statistics.jsx_element_count += 1;
        
        // Save previous state
        let was_in_translation = self.traversal_state.in_translation_component;
        let was_in_variable = self.traversal_state.in_variable_component;

        // Update component tracking state
        let (is_translation_component, is_variable_component, _) = self.determine_component_type(&element);
        self.traversal_state.in_translation_component = is_translation_component;
        self.traversal_state.in_variable_component = is_variable_component;
        
        // Inject hash attributes on translation components
        if self.settings.experimental_compile_time_hash && self.traversal_state.in_translation_component && !was_in_translation {
            // Check if hash attribute already exists
            let has_hash_attr = self.determine_has_hash_attr(&element);
            
            if !has_hash_attr {
                // Calculate real hash using AST traversal
                let (hash_value, json_string) = self.calculate_element_hash(&element);

                
                // Create and add hash attribute with calculated value
                let hash_attr = self.create_hash_attr(&element, &hash_value);
                element.opening.attrs.push(hash_attr);

                
                // Create and add json attribute with the stringified data
                let json_attr = self.create_json_attr(&element, &json_string);
                element.opening.attrs.push(json_attr);
            }
        }
        
        // Process children
        element = element.fold_children_with(self);
        
        // Restore previous state
        self.traversal_state.in_translation_component = was_in_translation;
        self.traversal_state.in_variable_component = was_in_variable;
        
        element
    }
}

#[plugin_transform]
pub fn process_transform(program: Program, metadata: TransformPluginProgramMetadata) -> Program {
    let config_str = metadata
        .get_transform_plugin_config()
        .unwrap_or_else(|| "{}".to_string());
    
    let config: PluginConfig = serde_json::from_str(&config_str)
        .unwrap_or_default();
    
    let filename = None;
    
    let mut visitor = TransformVisitor::new(
        config.dynamic_jsx_check_log_level,
        config.dynamic_string_check_log_level,
        config.experimental_compile_time_hash,
        filename,
    );
    
    program.fold_with(&mut visitor)
}

mod hash;
mod traversal;
mod whitespace;

#[cfg(test)]
mod tests;