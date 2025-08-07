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

/// Plugin configuration options
#[derive(Deserialize, Debug, Default)]
#[serde(rename_all = "camelCase")]
struct PluginConfig {
    dynamic_jsx_check_log_level: LogLevel,
    dynamic_string_check_log_level: LogLevel,
    experimental_compile_time_hash: bool,
}

/// Main transformation visitor for the SWC plugin
pub struct TransformVisitor {
    /// Track whether we're inside a translation component (T, Plural, etc.)
    in_translation_component: bool,
    /// Track whether we're inside a variable component (Var, Num, Currency, etc.)
    in_variable_component: bool,
    /// Track whether we're inside a JSX attribute expression (to ignore them)
    in_jsx_attribute: bool,
    /// Track imported GT-Next translation components
    gt_next_translation_imports: std::collections::HashSet<Atom>,
    /// Track imported GT-Next variable components
    gt_next_variable_imports: std::collections::HashSet<Atom>,
    /// Track imported GT-Next namespace imports (import * as GT from 'gt-next')
    gt_next_namespace_imports: std::collections::HashSet<Atom>,
    /// Track assigned GT-Next translation components (const MyT = T)
    gt_assigned_translation_components: std::collections::HashSet<Atom>,
    /// Track assigned GT-Next variable components (const MyVar = Var)
    gt_assigned_variable_components: std::collections::HashSet<Atom>,
    /// Track translation functions from useGT/getGT
    gt_translation_functions: std::collections::HashSet<Atom>,
    /// Log levels for different warning types
    dynamic_jsx_check_log_level: LogLevel,
    dynamic_string_check_log_level: LogLevel,
    /// Experimental feature: inject compile-time hash attributes
    experimental_compile_time_hash: bool,
    /// Counters for statistics 
    jsx_element_count: u32,
    dynamic_content_violations: u32,
    /// Optional filename for better error messages
    filename: Option<String>,
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
            in_translation_component: false,
            in_variable_component: false,
            in_jsx_attribute: false,
            gt_next_translation_imports: std::collections::HashSet::new(),
            gt_next_variable_imports: std::collections::HashSet::new(),
            gt_next_namespace_imports: std::collections::HashSet::new(),
            gt_assigned_translation_components: std::collections::HashSet::new(),
            gt_assigned_variable_components: std::collections::HashSet::new(),
            gt_translation_functions: std::collections::HashSet::new(),
            dynamic_jsx_check_log_level,
            dynamic_string_check_log_level,
            experimental_compile_time_hash,
            jsx_element_count: 0,
            dynamic_content_violations: 0,
            filename,
        }
    }

    /// Check if a component name matches known GT-Next translation components
    fn is_translation_component_name(&self, name: &Atom) -> bool {
        matches!(name.as_ref(), "T" | "Plural" | "DateTime" | "Toggle" | "Branch" | "Marker")
    }

    /// Check if a component name matches known GT-Next variable components
    fn is_variable_component_name(&self, name: &Atom) -> bool {
        matches!(name.as_ref(), "Var" | "Num" | "Currency")
    }

    /// Check if we should track this component based on imports or known components
    fn should_track_component_as_translation(&self, name: &Atom) -> bool {
        // Direct imports from gt-next
        self.gt_next_translation_imports.contains(name) ||
        // Assigned variables (const MyT = T)
        self.gt_assigned_translation_components.contains(name) ||
        // Known built-in components
        self.is_translation_component_name(name)
    }

    /// Check if we should track this component as a variable component
    fn should_track_component_as_variable(&self, name: &Atom) -> bool {
        // Direct imports from gt-next
        self.gt_next_variable_imports.contains(name) ||
        // Assigned variables (const MyVar = Var)
        self.gt_assigned_variable_components.contains(name) ||
        // Known built-in components
        self.is_variable_component_name(name)
    }

    /// Check if we should track a namespace component (GT.T, GT.Var, etc.)
    fn should_track_namespace_component(&self, obj: &Atom, prop: &Atom) -> (bool, bool) {
        if self.gt_next_namespace_imports.contains(obj) {
            let is_translation = self.is_translation_component_name(prop);
            let is_variable = self.is_variable_component_name(prop);
            (is_translation, is_variable)
        } else {
            (false, false)
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
        let file_info = if let Some(ref filename) = self.filename {
            format!(" in {}", filename)
        } else {
            String::new()
        };
        
        format!(
            "GT-Next SWC Plugin{}: <{}> component contains unwrapped dynamic content. Consider wrapping expressions in <Var>{{expression}}</Var> components for proper translation handling.",
            file_info, component_name
        )
    }

    /// Generate warning message for dynamic function call violations
    fn create_dynamic_function_warning(&self, function_name: &str, violation_type: &str) -> String {
        let file_info = if let Some(ref filename) = self.filename {
            format!(" in {}", filename)
        } else {
            String::new()
        };
        
        format!(
            "GT-Next SWC Plugin{}: {}() function call uses {} which prevents proper translation key generation. Use string literals instead.",
            file_info, function_name, violation_type
        )
    }
}

impl VisitMut for TransformVisitor {
    /// Process import declarations to track GT-Next imports
    fn visit_mut_import_decl(&mut self, import_decl: &mut ImportDecl) {
        let src_value = import_decl.src.value.as_ref();
        match src_value {
            "gt-next" | "gt-next/client" => {
                // Process named imports: import { T, Var, useGT } from 'gt-next'
                for specifier in &import_decl.specifiers {
                    match specifier {
                        ImportSpecifier::Named(ImportNamedSpecifier { local, .. }) => {
                            let name = local.sym.clone();
                            
                            if self.is_translation_component_name(&name) {
                                self.gt_next_translation_imports.insert(name);
                            } else if self.is_variable_component_name(&name) {
                                self.gt_next_variable_imports.insert(name);
                            } else if matches!(name.as_ref(), "useGT" | "getGT") {
                                self.gt_translation_functions.insert(name);
                            }
                        }
                        ImportSpecifier::Namespace(ImportStarAsSpecifier { local, .. }) => {
                            // Handle namespace imports: import * as GT from 'gt-next'
                            self.gt_next_namespace_imports.insert(local.sym.clone());
                        }
                        _ => {}
                    }
                }
            }
            "gt-next/server" => {
                // Process server-side imports: import { getGT } from 'gt-next/server'
                for specifier in &import_decl.specifiers {
                    if let ImportSpecifier::Named(ImportNamedSpecifier { local, .. }) = specifier {
                        let name = local.sym.clone();
                        if matches!(name.as_ref(), "getGT") {
                            self.gt_translation_functions.insert(name);
                        }
                    }
                }
            }
            _ => {}
        }
        
        import_decl.visit_mut_children_with(self);
    }

    /// Process variable declarations to track assignments like: const t = useGT()
    fn visit_mut_var_declarator(&mut self, var_declarator: &mut VarDeclarator) {
        // Check for assignments like: const t = useGT() or const MyT = T
        if let (Pat::Ident(BindingIdent { id, .. }), Some(init_expr)) = (&var_declarator.name, &var_declarator.init) {
            match init_expr.as_ref() {
                // Handle function calls: const t = useGT()
                Expr::Call(CallExpr { callee: Callee::Expr(callee_expr), .. }) => {
                    if let Expr::Ident(Ident { sym: callee_name, .. }) = callee_expr.as_ref() {
                        if self.gt_translation_functions.contains(callee_name) {
                            // Track the assigned variable as a translation function
                            self.gt_translation_functions.insert(id.sym.clone());
                        }
                    }
                }
                // Handle direct assignments: const MyT = T
                Expr::Ident(Ident { sym: source_name, .. }) => {
                    if self.gt_next_translation_imports.contains(source_name) || self.is_translation_component_name(source_name) {
                        self.gt_assigned_translation_components.insert(id.sym.clone());
                    } else if self.gt_next_variable_imports.contains(source_name) || self.is_variable_component_name(source_name) {
                        self.gt_assigned_variable_components.insert(id.sym.clone());
                    }
                }
                _ => {}
            }
        }
        
        var_declarator.visit_mut_children_with(self);
    }

    /// Process function calls to detect invalid usage of translation functions
    fn visit_mut_call_expr(&mut self, call_expr: &mut CallExpr) {
        if let Callee::Expr(callee_expr) = &call_expr.callee {
            if let Expr::Ident(Ident { sym: function_name, .. }) = callee_expr.as_ref() {
                // Exclude tx() functions from dynamic content checks
                if self.gt_translation_functions.contains(function_name) && function_name.as_ref() != "tx" {
                    // Check the first argument for dynamic content
                    if let Some(arg) = call_expr.args.first() {
                        match arg.expr.as_ref() {
                            // Template literals: t(`Hello ${name}`)
                            Expr::Tpl(_) => {
                                self.dynamic_content_violations += 1;
                                let warning = self.create_dynamic_function_warning(function_name.as_ref(), "template literals");
                                self.log_warning(&self.dynamic_string_check_log_level, &warning);
                            }
                            // String concatenation: t("Hello " + name)
                            Expr::Bin(BinExpr { op: BinaryOp::Add, left, right, .. }) => {
                                // Check if it's string concatenation (at least one side is a string)
                                let left_is_string = matches!(left.as_ref(), Expr::Lit(Lit::Str(_)));
                                let right_is_string = matches!(right.as_ref(), Expr::Lit(Lit::Str(_)));
                                
                                if left_is_string || right_is_string {
                                    self.dynamic_content_violations += 1;
                                    let warning = self.create_dynamic_function_warning(function_name.as_ref(), "string concatenation");
                                    self.log_warning(&self.dynamic_string_check_log_level, &warning);
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
        
        call_expr.visit_mut_children_with(self);
    }

    /// Process JSX attributes to track context and avoid flagging attribute expressions
    fn visit_mut_jsx_attr(&mut self, attr: &mut JSXAttr) {
        let was_in_jsx_attribute = self.in_jsx_attribute;
        self.in_jsx_attribute = true;
        attr.visit_mut_children_with(self);
        self.in_jsx_attribute = was_in_jsx_attribute;
    }

    /// Process JSX expression containers to detect unwrapped dynamic content
    fn visit_mut_jsx_expr_container(&mut self, expr_container: &mut JSXExprContainer) {
        // Only check for violations if we're in a translation component and NOT in a JSX attribute
        if self.in_translation_component && !self.in_jsx_attribute {
            self.dynamic_content_violations += 1;
            let warning = self.create_dynamic_content_warning("T");
            self.log_warning(&self.dynamic_jsx_check_log_level, &warning);
        }
        
        expr_container.visit_mut_children_with(self);
    }
}

impl Fold for TransformVisitor {
    /// Process import declarations to track GT-Next imports
    fn fold_import_decl(&mut self, import_decl: ImportDecl) -> ImportDecl {
        let src_value = import_decl.src.value.as_ref();
        match src_value {
            "gt-next" | "gt-next/client" => {
                // Process named imports: import { T, Var, useGT } from 'gt-next'
                for specifier in &import_decl.specifiers {
                    match specifier {
                        ImportSpecifier::Named(ImportNamedSpecifier { local, .. }) => {
                            let name = local.sym.clone();
                            
                            if self.is_translation_component_name(&name) {
                                self.gt_next_translation_imports.insert(name);
                            } else if self.is_variable_component_name(&name) {
                                self.gt_next_variable_imports.insert(name);
                            } else if matches!(name.as_ref(), "useGT" | "getGT") {
                                self.gt_translation_functions.insert(name);
                            }
                        }
                        ImportSpecifier::Namespace(ImportStarAsSpecifier { local, .. }) => {
                            // Handle namespace imports: import * as GT from 'gt-next'
                            self.gt_next_namespace_imports.insert(local.sym.clone());
                        }
                        _ => {}
                    }
                }
            }
            "gt-next/server" => {
                // Process server-side imports: import { getGT } from 'gt-next/server'
                for specifier in &import_decl.specifiers {
                    if let ImportSpecifier::Named(ImportNamedSpecifier { local, .. }) = specifier {
                        let name = local.sym.clone();
                        if matches!(name.as_ref(), "getGT") {
                            self.gt_translation_functions.insert(name);
                        }
                    }
                }
            }
            _ => {}
        }
        
        import_decl
    }

    /// Process variable declarations to track assignments like: const t = useGT()
    fn fold_var_declarator(&mut self, var_declarator: VarDeclarator) -> VarDeclarator {
        // Check for assignments like: const t = useGT() or const MyT = T
        if let (Pat::Ident(BindingIdent { id, .. }), Some(init_expr)) = (&var_declarator.name, &var_declarator.init) {
            match init_expr.as_ref() {
                // Handle function calls: const t = useGT()
                Expr::Call(CallExpr { callee: Callee::Expr(callee_expr), .. }) => {
                    if let Expr::Ident(Ident { sym: callee_name, .. }) = callee_expr.as_ref() {
                        if self.gt_translation_functions.contains(callee_name) {
                            // Track the assigned variable as a translation function
                            self.gt_translation_functions.insert(id.sym.clone());
                        }
                    }
                }
                // Handle direct assignments: const MyT = T
                Expr::Ident(Ident { sym: source_name, .. }) => {
                    if self.gt_next_translation_imports.contains(source_name) || self.is_translation_component_name(source_name) {
                        self.gt_assigned_translation_components.insert(id.sym.clone());
                    } else if self.gt_next_variable_imports.contains(source_name) || self.is_variable_component_name(source_name) {
                        self.gt_assigned_variable_components.insert(id.sym.clone());
                    }
                }
                _ => {}
            }
        }
        
        var_declarator
    }

    /// Process function calls to detect invalid usage of translation functions
    fn fold_call_expr(&mut self, call_expr: CallExpr) -> CallExpr {
        if let Callee::Expr(callee_expr) = &call_expr.callee {
            if let Expr::Ident(Ident { sym: function_name, .. }) = callee_expr.as_ref() {
                // Exclude tx() functions from dynamic content checks
                if self.gt_translation_functions.contains(function_name) && function_name.as_ref() != "tx" {
                    // Check the first argument for dynamic content
                    if let Some(arg) = call_expr.args.first() {
                        match arg.expr.as_ref() {
                            // Template literals: t(`Hello ${name}`)
                            Expr::Tpl(_) => {
                                self.dynamic_content_violations += 1;
                                let warning = self.create_dynamic_function_warning(function_name.as_ref(), "template literals");
                                self.log_warning(&self.dynamic_string_check_log_level, &warning);
                            }
                            // String concatenation: t("Hello " + name)
                            Expr::Bin(BinExpr { op: BinaryOp::Add, left, right, .. }) => {
                                // Check if it's string concatenation (at least one side is a string)
                                let left_is_string = matches!(left.as_ref(), Expr::Lit(Lit::Str(_)));
                                let right_is_string = matches!(right.as_ref(), Expr::Lit(Lit::Str(_)));
                                
                                if left_is_string || right_is_string {
                                    self.dynamic_content_violations += 1;
                                    let warning = self.create_dynamic_function_warning(function_name.as_ref(), "string concatenation");
                                    self.log_warning(&self.dynamic_string_check_log_level, &warning);
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
        
        call_expr.fold_children_with(self)
    }

    /// Process JSX expression containers to detect unwrapped dynamic content
    fn fold_jsx_expr_container(&mut self, expr_container: JSXExprContainer) -> JSXExprContainer {
        // Only check for violations if we're in a translation component and NOT in a JSX attribute
        if self.in_translation_component && !self.in_jsx_attribute {
            self.dynamic_content_violations += 1;
            let warning = self.create_dynamic_content_warning("T");
            self.log_warning(&self.dynamic_jsx_check_log_level, &warning);
        }
        
        expr_container.fold_children_with(self)
    }

    /// Process JSX attributes to track context and avoid flagging attribute expressions
    fn fold_jsx_attr(&mut self, attr: JSXAttr) -> JSXAttr {
        let was_in_jsx_attribute = self.in_jsx_attribute;
        self.in_jsx_attribute = true;
        let attr = attr.fold_children_with(self);
        self.in_jsx_attribute = was_in_jsx_attribute;
        attr
    }

    /// Process JSX elements to track component context and inject experimental features
    fn fold_jsx_element(&mut self, mut element: JSXElement) -> JSXElement {
        self.jsx_element_count += 1;
        
        // Save previous state
        let was_in_translation = self.in_translation_component;
        let was_in_variable = self.in_variable_component;
        
        // Determine component type and update state
        let (is_translation_component, is_variable_component) = match &element.opening.name {
            JSXElementName::Ident(ident) => {
                let name = &ident.sym;
                let is_translation = self.should_track_component_as_translation(name);
                let is_variable = self.should_track_component_as_variable(name);
                (is_translation, is_variable)
            }
            JSXElementName::JSXMemberExpr(member_expr) => {
                if let JSXObject::Ident(obj_ident) = &member_expr.obj {
                    let obj_name = &obj_ident.sym;
                    let prop_name = &member_expr.prop.sym;
                    self.should_track_namespace_component(obj_name, prop_name)
                } else {
                    (false, false)
                }
            }
            _ => (false, false),
        };
        
        // Update component tracking state
        self.in_translation_component = is_translation_component;
        self.in_variable_component = is_variable_component;
        
        // Experimental feature: inject hash attributes on translation components
        if self.experimental_compile_time_hash && self.in_translation_component && !was_in_translation {
            // Check if hash attribute already exists
            let has_hash_attr = element.opening.attrs.iter().any(|attr| {
                if let JSXAttrOrSpread::JSXAttr(jsx_attr) = attr {
                    if let JSXAttrName::Ident(ident) = &jsx_attr.name {
                        return ident.sym.as_ref() == "hash";
                    }
                }
                false
            });
            
            if !has_hash_attr {
                // Create and add hash="test" attribute
                let hash_attr = JSXAttrOrSpread::JSXAttr(JSXAttr {
                    span: element.opening.span,
                    name: JSXAttrName::Ident(Ident::new("hash".into(), element.opening.span, SyntaxContext::empty()).into()),
                    value: Some(JSXAttrValue::Lit(Lit::Str(Str {
                        span: element.opening.span,
                        value: "test".into(),
                        raw: None,
                    }))),
                });
                element.opening.attrs.push(hash_attr);
                
                eprintln!("GT-Next SWC Plugin: Added hash=\"test\" to translation component");
            }
        }
        
        // Process children
        element = element.fold_children_with(self);
        
        // Restore previous state
        self.in_translation_component = was_in_translation;
        self.in_variable_component = was_in_variable;
        
        element
    }
}

#[plugin_transform]
pub fn process_transform(program: Program, metadata: TransformPluginProgramMetadata) -> Program {
    let config: PluginConfig = serde_json::from_str(
        &metadata
            .get_transform_plugin_config()
            .unwrap_or_else(|| "{}".to_string()),
    )
    .unwrap_or_default();
    
    let filename = None; // TODO: Get filename from metadata if needed
    
    let mut visitor = TransformVisitor::new(
        config.dynamic_jsx_check_log_level,
        config.dynamic_string_check_log_level,
        config.experimental_compile_time_hash,
        filename,
    );
    
    program.fold_with(&mut visitor)
}

#[cfg(test)]
mod tests;