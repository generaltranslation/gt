use super::state::{Statistics, TraversalState, ImportTracker};
use super::jsx_utils::{extract_attribute_from_jsx_attr};
use crate::ast::StringCollector;
use crate::config::PluginSettings;
use crate::logging::{LogLevel, Logger};
use swc_core::{
  common::SyntaxContext,
  ecma::{
      ast::*,
      atoms::Atom,
  },
};
use crate::visitor::expr_utils::{
    create_spread_options_call_expr, create_string_prop, extract_id_and_context_from_options, extract_string_from_expr, has_prop
};

use crate::visitor::analysis::{
    is_translation_component_name,
    is_variable_component_name,
    is_branch_name,
    is_translation_function_name,
};

/// Main transformation visitor for the SWC plugin
pub struct TransformVisitor {
  /// Statistics for the plugin
  pub statistics: Statistics,
  /// Track the current state during AST traversal
  pub traversal_state: TraversalState,
  /// Track gt-next imports and their aliases
  pub import_tracker: ImportTracker,
  /// Plugin settings
  pub settings: PluginSettings,
  /// Logger
  pub logger: Logger,
}

impl Default for TransformVisitor {
  fn default() -> Self {
      Self::new(LogLevel::Warn, false, None, StringCollector::new())
  }
}

impl TransformVisitor {
    pub fn new(
        log_level: LogLevel,
        compile_time_hash: bool,
        filename: Option<String>,
        mut string_collector: StringCollector,
    ) -> Self {
        // Reset the counter to 0
        string_collector.reset_counter();
        Self {
            traversal_state: TraversalState::default(),
            statistics: Statistics::default(),
            import_tracker: ImportTracker::new(string_collector),
            settings: PluginSettings::new(
                log_level.clone(),
                compile_time_hash,
                filename.clone(),
            ),
            logger: Logger::new(log_level),
        }
    }

    /// Check if we should track this component based on imports or known components
    pub fn should_track_component_as_translation(&self, name: &Atom) -> bool {
        // Direct imports from gt-next - includes T components
        self.import_tracker.translation_import_aliases.contains_key(name)
    }

    /// Check if we should track this component as a variable component
    pub fn should_track_component_as_variable(&self, name: &Atom) -> bool {
        // Direct imports from gt-next
        self.import_tracker.variable_import_aliases.contains_key(name)
    }

    /// Check if we should track this component as a branch component
    pub fn should_track_component_as_branch(&self, name: &Atom) -> bool {
        // Branch and Plural components components
        self.import_tracker.branch_import_aliases.contains_key(name)
    }

    /// Check if we should track a namespace component (GT.T, GT.Var, etc.)
    pub fn should_track_namespace_component(&self, obj: &Atom, prop: &Atom) -> (bool, bool, bool) {
        if self.import_tracker.namespace_imports.contains(obj) {
            let is_translation = is_translation_component_name(prop);
            let is_variable = is_variable_component_name(prop);
            let is_branch = is_branch_name(prop);
            (is_translation, is_variable, is_branch)
        } else {
            (false, false, false)
        }
    }

    /// Generate warning message for dynamic content violations
    pub fn create_dynamic_content_warning(&self, component_name: &str) -> String {
        if let Some(ref filename) = self.settings.filename {
            format!(
                "gt-next in {}: <{}> component contains unwrapped dynamic content. Consider wrapping expressions in <Var>{{expression}}</Var> components for proper translation handling.",
                filename, component_name
            )
        } else {
            format!(
                "gt-next: <{}> component contains unwrapped dynamic content. Consider wrapping expressions in <Var>{{expression}}</Var> components for proper translation handling.",
                component_name
            )
        }
    }

    /// Generate warning message for dynamic function call violations
    fn create_dynamic_function_warning(&self, function_name: &str, violation_type: &str) -> String {
        if let Some(ref filename) = self.settings.filename {
            format!(
                "gt-next in {}: {}() function call uses {} which prevents proper translation key generation. Use string literals instead.",
                filename, function_name, violation_type
            )
        } else {
            format!(
                "gt-next: {}() function call uses {} which prevents proper translation key generation. Use string literals instead.",
                function_name, violation_type
            )
        }
    }

    /// Process GT-Next import declarations to track imports and aliases
    pub fn process_gt_import_declaration(&mut self, import_decl: &ImportDecl) {
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

                            // Store the mapping: local_name -> original_name
                            if is_translation_component_name(&original_name) {
                                self.import_tracker.translation_import_aliases.insert(local_name, original_name);
                            } else if is_variable_component_name(&original_name) {
                                self.import_tracker.variable_import_aliases.insert(local_name, original_name);
                            } else if is_branch_name(&original_name) {
                                // no existing tracking for branches
                                self.import_tracker.branch_import_aliases.insert(local_name, original_name);
                            } else if is_translation_function_name(&original_name) {
                                // Track the translation function name
                                self.import_tracker.scope_tracker.track_translation_variable(
                                    local_name.clone(),
                                    original_name.clone(),
                                    0 // We don't care about the identifier for imports
                                );

                                // Deprecated behavior
                                self.import_tracker.translation_function_import_aliases.insert(local_name, original_name);
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

    /// Calculate hash for JSX element using AST traversal
    pub fn calculate_element_hash(&self, element: &JSXElement) -> (String, String) {
        use crate::ast::JsxTraversal;
        use crate::hash::JsxHasher;
        
        let mut traversal = JsxTraversal::new(self);
        
        // Build sanitized children directly from JSX children
        if let Some(sanitized_children) = traversal.build_sanitized_children(&element.children) {
            // Get the id from the element
            let id = extract_attribute_from_jsx_attr(element, "id");

            // Get the context from the element
            let context = extract_attribute_from_jsx_attr(element, "context");

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
    pub fn check_call_expr_for_violations(&mut self, arg: &ExprOrSpread, function_name: &str) {
        match arg.expr.as_ref() {
            // Template literals: t(`Hello ${name}`)
            Expr::Tpl(_) => {
                self.statistics.dynamic_content_violations += 1;
                let warning = self.create_dynamic_function_warning(function_name, "template literals");
                self.logger.log_warning(&warning);
            }
            // String concatenation: t("Hello " + name)
            Expr::Bin(BinExpr { op: BinaryOp::Add, left, right, .. }) => {
                // Check if it's string concatenation (at least one side is a string)
                let left_is_string = matches!(left.as_ref(), Expr::Lit(Lit::Str(_)));
                let right_is_string = matches!(right.as_ref(), Expr::Lit(Lit::Str(_)));
                
                if left_is_string || right_is_string {
                    self.statistics.dynamic_content_violations += 1;
                    let warning = self.create_dynamic_function_warning(function_name, "string concatenation");
                    self.logger.log_warning(&warning);
                }
            }
            _ => {
                // Valid usage (string literal, variable, etc.)
            }
        }
    }


    // Calculate hash for a call expression return the hash and the json string
    pub fn calculate_hash_for_call_expr(&mut self, string: &ExprOrSpread, options: Option<&ExprOrSpread>) -> (Option<String>, Option<String>) {
        // Extract the string content
        let string_content = extract_string_from_expr(&string.expr);
        if string_content.is_none() {
            return (None, None);
        }

        // Extract the options content
        let (id, context) = extract_id_and_context_from_options(options);

        // Construct the json object
        use crate::hash::{SanitizedData, SanitizedChildren, SanitizedChild};
        let sanitized_data = SanitizedData {
            source: Some(Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Text(string_content.unwrap()))))),
            id,
            context,
            data_format: Some("ICU".to_string()),
        };
        // Calculate hash using stable stringify (like TypeScript fast-json-stable-stringify)
        use crate::hash::JsxHasher;
        let json_string = JsxHasher::stable_stringify(&sanitized_data)
            .expect("Failed to serialize sanitized data");
        let hash = JsxHasher::hash_string(&json_string);

        (Some(hash), Some(json_string))
    }

    // Inject hash attribute into options
    pub fn inject_hash_attribute_on_call_expr(
        &mut self,
        call_expr: &CallExpr,
        options: Option<&ExprOrSpread>,
        hash: String,
        _: Option<String>
    ) -> CallExpr {
        // Inject $hash & $json attribute into options object
        if let Some(options) = options {
            match options.expr.as_ref() {
                Expr::Object(existing_obj) => {
                    // Build a new CallExpr with the new options
                    let mut new_props = existing_obj.props.clone();
                    if !has_prop(&existing_obj.props, "$hash") {
                        new_props.push(create_string_prop("$hash", &hash, call_expr.span));
                    }
                    // For debugging
                    // if !Self::has_prop(&existing_obj.props, "$json") {
                    //     new_props.push(Self::create_string_prop("$json", &json, call_expr.span));
                    // }
                    
                    // Construct a new options object
                    let modified_options = Expr::Object(ObjectLit {
                        span: existing_obj.span,
                        props: new_props,
                    });

                    // Replace options with modified version
                    let mut new_args = call_expr.args.clone();
                    new_args[1] = ExprOrSpread {
                        spread: None,
                        expr: Box::new(modified_options),
                    };
                    
                    CallExpr {
                        args: new_args,
                        ..call_expr.clone()
                    }
                }
                Expr::Ident(_) | Expr::Member(_) | Expr::Call(_) |
                Expr::Await(_) | Expr::Cond(_) | Expr::Paren(_) |
                Expr::Assign(_) => {
                    create_spread_options_call_expr(
                        call_expr,
                        options.expr.as_ref(),
                        &hash,
                        None,
                        call_expr.span
                    )
                }
                // Handle logical OR specially (common pattern: opts || {})
                Expr::Bin(BinExpr { op: BinaryOp::LogicalOr, .. }) => {
                    create_spread_options_call_expr(
                        call_expr,
                        options.expr.as_ref(),
                        &hash,
                        None,
                        call_expr.span
                    )
                }
                _ => {
                    call_expr.clone()
                }
            }
        } else {
            // Create a new options object
            let new_options = Expr::Object(ObjectLit {
                span: call_expr.span,
                props: vec![
                    create_string_prop("$hash", &hash, call_expr.span),
                    // For debugging
                    // create_string_prop("$json", &json, call_expr.span),
                ],
            });

            // Build a new CallExpr with the new options
            let mut new_args = call_expr.args.clone();
            new_args.push(ExprOrSpread {
                spread: None,
                expr: Box::new(new_options),
            });
            CallExpr {
                args: new_args,
                ..call_expr.clone()
            }
        }
    }

    fn extract_identifiers_from_pattern(&self, pattern: &Pat, identifiers: &mut Vec<Atom>) {
        match pattern {
            Pat::Ident(BindingIdent { id, .. }) => {
                identifiers.push(id.sym.clone());
            }
            Pat::Object(ObjectPat { props, .. }) => {
                for prop in props {
                    match prop {
                        ObjectPatProp::Assign(AssignPatProp { key, .. }) => {
                            // { key }
                            identifiers.push(key.sym.clone());
                        }
                        ObjectPatProp::KeyValue(KeyValuePatProp { value, ..}) => {
                            // { key: value }
                            self.extract_identifiers_from_pattern(value, identifiers);
                        }
                        ObjectPatProp::Rest(RestPat { arg, .. }) => {
                            // { ...key }
                            self.extract_identifiers_from_pattern(arg, identifiers);
                        }
                    }
                }
            }
            Pat::Array(ArrayPat { elems, .. }) => {
                for elem in elems {
                    if let Some(elem) = elem {
                        self.extract_identifiers_from_pattern(elem, identifiers);
                    }
                }
            }
            Pat::Assign(AssignPat { left, .. }) => {
                self.extract_identifiers_from_pattern(left, identifiers);
            }
            Pat::Rest(RestPat { arg, .. }) => {
                self.extract_identifiers_from_pattern(arg, identifiers);
            }
            _ => {}
        }
    }

    fn track_overriding_variable (&mut self, variable_name: &Atom) {
        if self.import_tracker.scope_tracker.get_variable(&variable_name).is_some() {
            self.import_tracker.scope_tracker.track_regular_variable(
                variable_name.clone(),
                "other".into(),
            );
        }
    }

    /// Track function parameters that could shadow existing variables
    pub fn track_parameter_overrides(&mut self, params: &[Param]) {
        for param in params {
            let mut identifiers = Vec::new();
            self.extract_identifiers_from_pattern(&param.pat, &mut identifiers);
            for identifier in identifiers {
                self.track_overriding_variable(&identifier);
            }
        }
    }

    /// Track arrow function parameters (arrow functions)  
    pub fn track_arrow_parameter_overrides(&mut self, params: &[Pat]) {
        for param in params {
            let mut identifiers = Vec::new();
            self.extract_identifiers_from_pattern(param, &mut identifiers);
            for identifier in identifiers {
                self.track_overriding_variable(&identifier);
            }
        }
    }

    // Track function call assignments
    fn track_function_call_assignment(&mut self, callee_expr: &Box<Expr>, variable_name: &Atom) {
        if let Expr::Ident(Ident { sym: callee_name, .. }) = callee_expr.as_ref() {
            // Check if the callee is a translation function
            if let Some(translation_variable) = self
                .import_tracker
                .scope_tracker
                .get_translation_variable(callee_name) {

                // This will be either useGT or getGT, not the alias
                let original_name = translation_variable.assigned_value.clone();

                // Check if its getGT or useGT
                if is_translation_function_name(&original_name) {
                    // Get counter_id
                    let counter_id = self.import_tracker.string_collector.increment_counter();
                    // Create a new entry in the string collector for this call
                    self.import_tracker.string_collector.initialize_call(counter_id);

                    // Track translation function using scope system (useGT_callback, getGT_callback)
                    self.import_tracker
                        .scope_tracker
                        .track_translation_variable(
                            variable_name.clone(),
                            format!("{}_callback", original_name.clone()).into(),
                            counter_id
                        );
                }
            } else {
                // TODO: do the check that this is not a translation_variable sooner?
                self.track_overriding_variable(variable_name);
            }
        }
    }

    pub fn track_variable_assignment (&mut self, var_declarator: &VarDeclarator) {
        if let Some(init_expr) = &var_declarator.init {
            match &var_declarator.name {
                // Handle simple identifier assignment: const t = useGT()
                Pat::Ident(BindingIdent { id, .. }) => {
                    match init_expr.as_ref() {
                        Expr::Call(CallExpr { callee: Callee::Expr(callee_expr), .. }) => {
                            // Only direct assignments can be translation functions
                            self.track_function_call_assignment(callee_expr, &id.sym);
                        }
                        Expr::Await(AwaitExpr { arg, .. }) => {
                            if let Expr::Call(CallExpr { callee: Callee::Expr(callee_expr), .. }) = arg.as_ref() {
                                // Only direct assignments can be translation functions
                                self.track_function_call_assignment(callee_expr, &id.sym);
                            } else {
                                // Not a function call, treat as overriding
                                self.track_overriding_variable(&id.sym);
                            }
                        }
                        _ => {
                            // Not a function call, treat as overriding
                            self.track_overriding_variable(&id.sym);
                        }
                    }
                }
                // Handle ALL destructuring patterns: const { t } = anything
                _ => {
                    let mut identifiers = Vec::new();
                    self.extract_identifiers_from_pattern(&var_declarator.name, &mut identifiers);
  
                    for identifier in identifiers {
                        self.track_overriding_variable(&identifier);
                    }
                }
            }
        }
    }


    pub fn determine_component_type (&mut self, element: &JSXElement) -> (bool, bool, bool) {
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


    pub fn determine_has_hash_attr (element: &JSXElement) -> bool {
        element.opening.attrs.iter().any(|attr| {
            if let JSXAttrOrSpread::JSXAttr(jsx_attr) = attr {
                if let JSXAttrName::Ident(ident) = &jsx_attr.name {
                    return ident.sym.as_ref() == "_hash";
                }
            }
            false
        })
    }

    pub fn create_attr (element: &JSXElement, value: &str, attribute_name: &str) -> JSXAttrOrSpread {
        JSXAttrOrSpread::JSXAttr(JSXAttr {
            span: element.opening.span,
            name: JSXAttrName::Ident(Ident::new(attribute_name.into(), element.opening.span, SyntaxContext::empty()).into()),
            value: Some(JSXAttrValue::Lit(Lit::Str(Str {
                span: element.opening.span,
                value: value.into(),
                raw: None,
            }))),
        })
    }

}

#[cfg(test)]
mod tests {
    use super::*;
    use swc_core::common::{DUMMY_SP, SyntaxContext};
    use swc_core::ecma::atoms::Atom;

    // Helper to create a test visitor with specific imports
    fn create_visitor_with_imports() -> TransformVisitor {
        let mut visitor = TransformVisitor::new(LogLevel::Silent, false, None, StringCollector::new());
        
        // Add some test imports
        visitor.import_tracker.translation_import_aliases.insert(
            Atom::new("T"), Atom::new("T")
        );
        visitor.import_tracker.variable_import_aliases.insert(
            Atom::new("Var"), Atom::new("Var")
        );
        visitor.import_tracker.branch_import_aliases.insert(
            Atom::new("Branch"), Atom::new("Branch")
        );
        visitor.import_tracker.translation_function_import_aliases.insert(
            Atom::new("useGT"), Atom::new("useGT")
        );
        visitor.import_tracker.namespace_imports.insert(
            Atom::new("GT")
        );
        
        visitor
    }

    // Helper to create JSX element
    fn create_jsx_element(tag_name: &str, attrs: Vec<JSXAttrOrSpread>) -> JSXElement {
        JSXElement {
            span: DUMMY_SP,
            opening: JSXOpeningElement {
                span: DUMMY_SP,
                name: JSXElementName::Ident(Ident {
                    span: DUMMY_SP,
                    sym: Atom::new(tag_name),
                    optional: false,
                    ctxt: SyntaxContext::empty(),
                }.into()),
                attrs,
                self_closing: false,
                type_args: None,
            },
            children: vec![],
            closing: Some(JSXClosingElement {
                span: DUMMY_SP,
                name: JSXElementName::Ident(Ident {
                    span: DUMMY_SP,
                    sym: Atom::new(tag_name),
                    optional: false,
                    ctxt: SyntaxContext::empty(),
                }.into()),
            }),
        }
    }

    // Helper to create JSX member element (GT.T)
    fn create_jsx_member_element(obj: &str, prop: &str) -> JSXElement {
        JSXElement {
            span: DUMMY_SP,
            opening: JSXOpeningElement {
                span: DUMMY_SP,
                name: JSXElementName::JSXMemberExpr(JSXMemberExpr {
                    span: DUMMY_SP,
                    obj: JSXObject::Ident(Ident {
                        span: DUMMY_SP,
                        sym: Atom::new(obj),
                        optional: false,
                        ctxt: SyntaxContext::empty(),
                    }.into()),
                    prop: Ident {
                        span: DUMMY_SP,
                        sym: Atom::new(prop),
                        optional: false,
                        ctxt: SyntaxContext::empty(),
                    }.into(),
                }),
                attrs: vec![],
                self_closing: false,
                type_args: None,
            },
            children: vec![],
            closing: Some(JSXClosingElement {
                span: DUMMY_SP,
                name: JSXElementName::JSXMemberExpr(JSXMemberExpr {
                    span: DUMMY_SP,
                    obj: JSXObject::Ident(Ident {
                        span: DUMMY_SP,
                        sym: Atom::new(obj),
                        optional: false,
                        ctxt: SyntaxContext::empty(),
                    }.into()),
                    prop: Ident {
                        span: DUMMY_SP,
                        sym: Atom::new(prop),
                        optional: false,
                        ctxt: SyntaxContext::empty(),
                    }.into(),
                }),
            }),
        }
    }

    // Helper to create import declaration
    fn create_import_decl(source: &str, specifiers: Vec<ImportSpecifier>) -> ImportDecl {
        ImportDecl {
            span: DUMMY_SP,
            specifiers,
            src: Box::new(Str {
                span: DUMMY_SP,
                value: Atom::new(source),
                raw: None,
            }),
            type_only: false,
            with: None,
            phase: Default::default(),
        }
    }

    // Helper to create named import specifier
    fn create_named_import(local_name: &str, imported_name: Option<&str>) -> ImportSpecifier {
        ImportSpecifier::Named(ImportNamedSpecifier {
            span: DUMMY_SP,
            local: Ident {
                span: DUMMY_SP,
                sym: Atom::new(local_name),
                optional: false,
                ctxt: SyntaxContext::empty(),
            }.into(),
            imported: imported_name.map(|name| {
                ModuleExportName::Ident(Ident {
                    span: DUMMY_SP,
                    sym: Atom::new(name),
                    optional: false,
                    ctxt: SyntaxContext::empty(),
                }.into())
            }),
            is_type_only: false,
        })
    }

    // Helper to create namespace import
    fn create_namespace_import(local_name: &str) -> ImportSpecifier {
        ImportSpecifier::Namespace(ImportStarAsSpecifier {
            span: DUMMY_SP,
            local: Ident {
                span: DUMMY_SP,
                sym: Atom::new(local_name),
                optional: false,
                ctxt: SyntaxContext::empty(),
            }.into(),
        })
    }

    mod constructor_and_defaults {
        use super::*;

        #[test]
        fn creates_new_visitor_with_parameters() {
            let visitor = TransformVisitor::new(LogLevel::Debug, true, Some("test.tsx".to_string()), StringCollector::new());
            
            assert_eq!(visitor.settings.log_level.as_int(), LogLevel::Debug.as_int());
            assert_eq!(visitor.settings.compile_time_hash, true);
            assert_eq!(visitor.settings.filename, Some("test.tsx".to_string()));
            
            // Check defaults are set
            assert_eq!(visitor.statistics.jsx_element_count, 0);
            assert_eq!(visitor.statistics.dynamic_content_violations, 0);
            assert!(visitor.import_tracker.translation_import_aliases.is_empty());
        }

        #[test]
        fn creates_default_visitor() {
            let visitor = TransformVisitor::default();
            
            assert_eq!(visitor.settings.log_level.as_int(), LogLevel::Warn.as_int());
            assert_eq!(visitor.settings.compile_time_hash, false);
            assert_eq!(visitor.settings.filename, None);
        }
    }

    mod component_tracking {
        use super::*;

        #[test]
        fn tracks_translation_components() {
            let visitor = create_visitor_with_imports();
            
            assert!(visitor.should_track_component_as_translation(&Atom::new("T")));
            assert!(!visitor.should_track_component_as_translation(&Atom::new("div")));
            assert!(!visitor.should_track_component_as_translation(&Atom::new("Var")));
        }

        #[test]
        fn tracks_variable_components() {
            let visitor = create_visitor_with_imports();
            
            assert!(visitor.should_track_component_as_variable(&Atom::new("Var")));
            assert!(!visitor.should_track_component_as_variable(&Atom::new("T")));
            assert!(!visitor.should_track_component_as_variable(&Atom::new("div")));
        }

        #[test]
        fn tracks_branch_components() {
            let visitor = create_visitor_with_imports();
            
            assert!(visitor.should_track_component_as_branch(&Atom::new("Branch")));
            assert!(!visitor.should_track_component_as_branch(&Atom::new("T")));
            assert!(!visitor.should_track_component_as_branch(&Atom::new("div")));
        }

        #[test]
        fn tracks_namespace_components() {
            let visitor = create_visitor_with_imports();
            
            let (is_translation, is_variable, is_branch) = visitor.should_track_namespace_component(
                &Atom::new("GT"), &Atom::new("T")
            );
            assert!(is_translation);
            assert!(!is_variable);
            assert!(!is_branch);

            let (is_translation, is_variable, is_branch) = visitor.should_track_namespace_component(
                &Atom::new("GT"), &Atom::new("Var")
            );
            assert!(!is_translation);
            assert!(is_variable);
            assert!(!is_branch);

            let (is_translation, is_variable, is_branch) = visitor.should_track_namespace_component(
                &Atom::new("Unknown"), &Atom::new("T")
            );
            assert!(!is_translation);
            assert!(!is_variable);
            assert!(!is_branch);
        }
    }

    mod warning_message_generation {
        use super::*;

        #[test]
        fn creates_dynamic_content_warning_without_filename() {
            let visitor = TransformVisitor::new(LogLevel::Warn, false, None, StringCollector::new());
            let warning = visitor.create_dynamic_content_warning("T");
            
            assert!(warning.contains("gt-next"));
            assert!(warning.contains("<T> component contains unwrapped dynamic content"));
            assert!(warning.contains("<Var>{expression}</Var>"));
            assert!(!warning.starts_with("gt-next in "));
        }

        #[test]
        fn creates_dynamic_content_warning_with_filename() {
            let visitor = TransformVisitor::new(LogLevel::Warn, false, Some("components/Test.tsx".to_string()), StringCollector::new());
            let warning = visitor.create_dynamic_content_warning("T");
            
            assert!(warning.contains("gt-next in components/Test.tsx"));
            assert!(warning.contains("<T> component contains unwrapped dynamic content"));
        }

        #[test]
        fn creates_dynamic_function_warning_without_filename() {
            let visitor = TransformVisitor::new(LogLevel::Warn, false, None, StringCollector::new());
            let warning = visitor.create_dynamic_function_warning("useGT", "template literals");
            
            assert!(warning.contains("gt-next"));
            assert!(warning.contains("useGT() function call uses template literals"));
            assert!(warning.contains("Use string literals instead"));
            assert!(!warning.starts_with("gt-next in "));
        }

        #[test]
        fn creates_dynamic_function_warning_with_filename() {
            let visitor = TransformVisitor::new(LogLevel::Warn, false, Some("hooks/useTranslation.ts".to_string()), StringCollector::new());
            let warning = visitor.create_dynamic_function_warning("t", "string concatenation");
            
            assert!(warning.contains("gt-next in hooks/useTranslation.ts"));
            assert!(warning.contains("t() function call uses string concatenation"));
        }
    }

    mod import_processing {
        use super::*;

        #[test]
        fn processes_gt_next_named_imports() {
            let mut visitor = TransformVisitor::new(LogLevel::Silent, false, None, StringCollector::new());
            let import_decl = create_import_decl("gt-next", vec![
                create_named_import("T", None),
                create_named_import("MyVar", Some("Var")),
                create_named_import("useGT", None),
            ]);

            visitor.process_gt_import_declaration(&import_decl);

            assert!(visitor.import_tracker.translation_import_aliases.contains_key(&Atom::new("T")));
            assert!(visitor.import_tracker.variable_import_aliases.contains_key(&Atom::new("MyVar")));
            assert!(visitor.import_tracker.translation_function_import_aliases.contains_key(&Atom::new("useGT")));
        }

        #[test]
        fn processes_namespace_imports() {
            let mut visitor = TransformVisitor::new(LogLevel::Silent, false, None, StringCollector::new());
            let import_decl = create_import_decl("gt-next", vec![
                create_namespace_import("GT"),
            ]);

            visitor.process_gt_import_declaration(&import_decl);

            assert!(visitor.import_tracker.namespace_imports.contains(&Atom::new("GT")));
        }

        #[test]
        fn processes_gt_next_client_imports() {
            let mut visitor = TransformVisitor::new(LogLevel::Silent, false, None, StringCollector::new());
            let import_decl = create_import_decl("gt-next/client", vec![
                create_named_import("T", None),
            ]);

            visitor.process_gt_import_declaration(&import_decl);

            assert!(visitor.import_tracker.translation_import_aliases.contains_key(&Atom::new("T")));
        }

        #[test]
        fn ignores_non_gt_imports() {
            let mut visitor = TransformVisitor::new(LogLevel::Silent, false, None, StringCollector::new());
            let import_decl = create_import_decl("react", vec![
                create_named_import("React", None),
            ]);

            visitor.process_gt_import_declaration(&import_decl);

            assert!(visitor.import_tracker.translation_import_aliases.is_empty());
            assert!(visitor.import_tracker.namespace_imports.is_empty());
        }
    }

    mod component_type_determination {
        use super::*;

        #[test]
        fn determines_translation_component_type() {
            let mut visitor = create_visitor_with_imports();
            let element = create_jsx_element("T", vec![]);

            let (is_translation, is_variable, is_branch) = visitor.determine_component_type(&element);
            
            assert!(is_translation);
            assert!(!is_variable);
            assert!(!is_branch);
        }

        #[test]
        fn determines_variable_component_type() {
            let mut visitor = create_visitor_with_imports();
            let element = create_jsx_element("Var", vec![]);

            let (is_translation, is_variable, is_branch) = visitor.determine_component_type(&element);
            
            assert!(!is_translation);
            assert!(is_variable);
            assert!(!is_branch);
        }

        #[test]
        fn determines_namespace_component_type() {
            let mut visitor = create_visitor_with_imports();
            let element = create_jsx_member_element("GT", "T");

            let (is_translation, is_variable, is_branch) = visitor.determine_component_type(&element);
            
            assert!(is_translation);
            assert!(!is_variable);
            assert!(!is_branch);
        }

        #[test]
        fn determines_unknown_component_type() {
            let mut visitor = create_visitor_with_imports();
            let element = create_jsx_element("div", vec![]);

            let (is_translation, is_variable, is_branch) = visitor.determine_component_type(&element);
            
            assert!(!is_translation);
            assert!(!is_variable);
            assert!(!is_branch);
        }
    }

    mod hash_attribute_detection {
        use super::*;

        fn create_string_attr(name: &str, value: &str) -> JSXAttrOrSpread {
            JSXAttrOrSpread::JSXAttr(JSXAttr {
                span: DUMMY_SP,
                name: JSXAttrName::Ident(Ident {
                    span: DUMMY_SP,
                    sym: Atom::new(name),
                    optional: false,
                    ctxt: SyntaxContext::empty(),
                }.into()),
                value: Some(JSXAttrValue::Lit(Lit::Str(Str {
                    span: DUMMY_SP,
                    value: Atom::new(value),
                    raw: None,
                }))),
            })
        }

        #[test]
        fn detects_hash_attribute_present() {
            let element = create_jsx_element("T", vec![
                create_string_attr("_hash", "abc123"),
                create_string_attr("className", "test"),
            ]);

            assert!(TransformVisitor::determine_has_hash_attr(&element));
        }

        #[test]
        fn detects_hash_attribute_absent() {
            let element = create_jsx_element("T", vec![
                create_string_attr("className", "test"),
                create_string_attr("id", "myid"),
            ]);

            assert!(!TransformVisitor::determine_has_hash_attr(&element));
        }

        #[test]
        fn handles_element_with_no_attributes() {
            let element = create_jsx_element("T", vec![]);
            assert!(!TransformVisitor::determine_has_hash_attr(&element));
        }
    }

    mod attribute_creation {
        use super::*;

        #[test]
        fn creates_string_attribute() {
            let element = create_jsx_element("T", vec![]);
            let attr = TransformVisitor::create_attr(&element, "test-value", "data-test");

            if let JSXAttrOrSpread::JSXAttr(jsx_attr) = attr {
                if let JSXAttrName::Ident(name_ident) = &jsx_attr.name {
                    assert_eq!(name_ident.sym.as_ref(), "data-test");
                }
                if let Some(JSXAttrValue::Lit(Lit::Str(str_lit))) = &jsx_attr.value {
                    assert_eq!(str_lit.value.as_ref(), "test-value");
                }
            } else {
                panic!("Expected JSXAttr");
            }
        }
    }

    mod call_expression_violations {
        use super::*;

        fn create_call_expr(function_name: &str, arg: Expr) -> CallExpr {
            CallExpr {
                span: DUMMY_SP,
                callee: Callee::Expr(Box::new(Expr::Ident(Ident {
                    span: DUMMY_SP,
                    sym: Atom::new(function_name),
                    optional: false,
                    ctxt: SyntaxContext::empty(),
                }))),
                args: vec![ExprOrSpread {
                    spread: None,
                    expr: Box::new(arg),
                }],
                type_args: None,
                ctxt: SyntaxContext::empty(),
            }
        }

        fn create_template_literal() -> Expr {
            Expr::Tpl(Tpl {
                span: DUMMY_SP,
                exprs: vec![Box::new(Expr::Ident(Ident {
                    span: DUMMY_SP,
                    sym: Atom::new("name"),
                    optional: false,
                    ctxt: SyntaxContext::empty(),
                }))],
                quasis: vec![
                    TplElement {
                        span: DUMMY_SP,
                        tail: false,
                        cooked: Some(Atom::new("Hello ")),
                        raw: Atom::new("Hello "),
                    },
                    TplElement {
                        span: DUMMY_SP,
                        tail: true,
                        cooked: Some(Atom::new("!")),
                        raw: Atom::new("!"),
                    }
                ],
            })
        }

        fn create_string_concatenation() -> Expr {
            Expr::Bin(BinExpr {
                span: DUMMY_SP,
                op: BinaryOp::Add,
                left: Box::new(Expr::Lit(Lit::Str(Str {
                    span: DUMMY_SP,
                    value: Atom::new("Hello "),
                    raw: None,
                }))),
                right: Box::new(Expr::Ident(Ident {
                    span: DUMMY_SP,
                    sym: Atom::new("name"),
                    optional: false,
                    ctxt: SyntaxContext::empty(),
                })),
            })
        }

        #[test]
        fn detects_template_literal_violations() {
            let mut visitor = create_visitor_with_imports();
            let call_expr = create_call_expr("useGT", create_template_literal());

            let initial_violations = visitor.statistics.dynamic_content_violations;
            if let Some(first_arg) = call_expr.args.first() {
                visitor.check_call_expr_for_violations(first_arg, "useGT");
            }

            assert_eq!(visitor.statistics.dynamic_content_violations, initial_violations + 1);
        }

        #[test]
        fn detects_string_concatenation_violations() {
            let mut visitor = create_visitor_with_imports();
            let call_expr = create_call_expr("useGT", create_string_concatenation());

            let initial_violations = visitor.statistics.dynamic_content_violations;
            if let Some(first_arg) = call_expr.args.first() {
                visitor.check_call_expr_for_violations(first_arg, "useGT");
            }

            assert_eq!(visitor.statistics.dynamic_content_violations, initial_violations + 1);
        }

        #[test]
        fn allows_valid_string_literal_calls() {
            let mut visitor = create_visitor_with_imports();
            let string_literal = Expr::Lit(Lit::Str(Str {
                span: DUMMY_SP,
                value: Atom::new("Hello world"),
                raw: None,
            }));
            let call_expr = create_call_expr("useGT", string_literal);

            let initial_violations = visitor.statistics.dynamic_content_violations;
            if let Some(first_arg) = call_expr.args.first() {
                visitor.check_call_expr_for_violations(first_arg, "useGT");
            }

            assert_eq!(visitor.statistics.dynamic_content_violations, initial_violations);
        }

        #[test]
        fn ignores_non_tracked_functions() {
            let mut visitor = create_visitor_with_imports();
            let call_expr = create_call_expr("console.log", create_template_literal());

            let initial_violations = visitor.statistics.dynamic_content_violations;
            
            // This test should simulate the real flow - only check violations for tracked functions
            if let Callee::Expr(callee_expr) = &call_expr.callee {
                if let Expr::Ident(ident) = callee_expr.as_ref() {
                    // Only check violations if it's a tracked function
                    let is_tracked_function = visitor.import_tracker.translation_function_import_aliases.contains_key(&ident.sym);
                    let is_tracked_callee = visitor.import_tracker.scope_tracker.get_translation_variable(&ident.sym).is_some();
                    
                    if is_tracked_function || is_tracked_callee {
                        if let Some(first_arg) = call_expr.args.first() {
                            visitor.check_call_expr_for_violations(first_arg, &ident.sym);
                        }
                    }
                }
            }

            assert_eq!(visitor.statistics.dynamic_content_violations, initial_violations);
        }
    }

    mod variable_assignment_tracking {
        use super::*;

        fn create_var_declarator(name: &str, init: Expr) -> VarDeclarator {
            VarDeclarator {
                span: DUMMY_SP,
                name: Pat::Ident(BindingIdent {
                    id: Ident {
                        span: DUMMY_SP,
                        sym: Atom::new(name),
                        optional: false,
                        ctxt: SyntaxContext::empty(),
                    }.into(),
                    type_ann: None,
                }),
                init: Some(Box::new(init)),
                definite: false,
            }
        }

        fn create_function_call(function_name: &str) -> Expr {
            Expr::Call(CallExpr {
                span: DUMMY_SP,
                callee: Callee::Expr(Box::new(Expr::Ident(Ident {
                    span: DUMMY_SP,
                    sym: Atom::new(function_name),
                    optional: false,
                    ctxt: SyntaxContext::empty(),
                }))),
                args: vec![],
                type_args: None,
                ctxt: SyntaxContext::empty(),
            })
        }


        #[test]
        fn ignores_non_function_assignments() {
            let mut visitor = create_visitor_with_imports();
            let string_literal = Expr::Lit(Lit::Str(Str {
                span: DUMMY_SP,
                value: Atom::new("hello"),
                raw: None,
            }));
            let var_declarator = create_var_declarator("message", string_literal);

            visitor.track_variable_assignment(&var_declarator);

            // Should not track non-function assignments in scope tracker
            assert!(visitor.import_tracker.scope_tracker.get_translation_variable(&Atom::new("message")).is_none());
        }

        #[test]
        fn ignores_non_tracked_function_assignments() {
            let mut visitor = create_visitor_with_imports();
            let var_declarator = create_var_declarator("result", create_function_call("useState"));

            visitor.track_variable_assignment(&var_declarator);

            // Should not track non-translation functions in scope tracker
            assert!(visitor.import_tracker.scope_tracker.get_translation_variable(&Atom::new("result")).is_none());
        }
    }

    mod hash_calculation {
        use super::*;

        #[test]
        fn calculates_hash_for_empty_element() {
            let visitor = TransformVisitor::new(LogLevel::Silent, false, None, StringCollector::new());
            let element = create_jsx_element("T", vec![]);

            let (hash, json_string) = visitor.calculate_element_hash(&element);

            assert!(!hash.is_empty());
            assert!(!json_string.is_empty());
            assert!(json_string.contains("JSX"));
        }

        #[test] 
        fn hash_changes_with_different_content() {
            let visitor = TransformVisitor::new(LogLevel::Silent, false, None, StringCollector::new());
            
            let element1 = create_jsx_element("T", vec![]);
            let mut element2 = create_jsx_element("T", vec![]);
            element2.children = vec![JSXElementChild::JSXText(JSXText {
                span: DUMMY_SP,
                value: Atom::new("Hello"),
                raw: Atom::new("Hello"),
            })];

            let (hash1, _) = visitor.calculate_element_hash(&element1);
            let (hash2, _) = visitor.calculate_element_hash(&element2);

            assert_ne!(hash1, hash2);
        }
    }

    mod integration_tests {
        use super::*;

        #[test]
        fn full_workflow_with_imports_and_component_detection() {
            let mut visitor = TransformVisitor::new(LogLevel::Silent, false, Some("test.tsx".to_string()), StringCollector::new());
            
            // Process imports
            let import_decl = create_import_decl("gt-next", vec![
                create_named_import("T", None),
                create_named_import("CustomVar", Some("Var")),
                create_namespace_import("GT"),
            ]);
            visitor.process_gt_import_declaration(&import_decl);

            // Test component detection
            let t_element = create_jsx_element("T", vec![]);
            let (is_translation, _, _) = visitor.determine_component_type(&t_element);
            assert!(is_translation);

            let var_element = create_jsx_element("CustomVar", vec![]);
            let (_, is_variable, _) = visitor.determine_component_type(&var_element);
            assert!(is_variable);

            let namespace_element = create_jsx_member_element("GT", "T");
            let (is_translation_ns, _, _) = visitor.determine_component_type(&namespace_element);
            assert!(is_translation_ns);

            // Test warning generation
            let warning = visitor.create_dynamic_content_warning("T");
            assert!(warning.contains("in test.tsx"));
        }
    }
}

