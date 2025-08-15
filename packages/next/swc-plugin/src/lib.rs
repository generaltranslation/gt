use swc_core::{
    ecma::{
        ast::*,
        visit::{Fold, FoldWith, VisitMut, VisitMutWith},
    },
    plugin::{plugin_transform, proxies::TransformPluginProgramMetadata},
};
use crate::{ast::StringCollector, config::PluginConfig, visitor::{analysis::{is_translation_function_callback, is_translation_function_name}, expr_utils::{extract_id_and_context_from_options, extract_string_from_expr}}};
use crate::visitor::TransformVisitor;


impl VisitMut for TransformVisitor {
    /// Process import declarations to track gt-next imports
    fn visit_mut_import_decl(&mut self, import_decl: &mut ImportDecl) {
        // No scope enter/exit needed for import declarations
        self.process_gt_import_declaration(import_decl);
        import_decl.visit_mut_children_with(self);
    }

    /// Process variable declarations to track assignments like: const t = useGT()
    fn visit_mut_var_declarator(&mut self, var_declarator: &mut VarDeclarator) {
        self.track_variable_assignment(var_declarator);
        var_declarator.visit_mut_children_with(self);
    }

    /// Process function declarations to ensure their bodies are traversed
    fn visit_mut_function(&mut self, function: &mut Function) {
        self.import_tracker.scope_tracker.enter_scope();

        // Track parameters before processing body
        self.track_parameter_overrides(&function.params);

        // Process function body
        function.visit_mut_children_with(self);

        // Exit scope
        self.import_tracker.scope_tracker.exit_scope();
    }
    
    /// Process arrow functions to ensure their bodies are traversed
    fn visit_mut_arrow_expr(&mut self, arrow: &mut ArrowExpr) {
        self.import_tracker.scope_tracker.enter_scope();

        // Track arrow function parameters  
        self.track_arrow_parameter_overrides(&arrow.params);

        // Process arrow function body
        arrow.visit_mut_children_with(self);

        // Exit scope
        self.import_tracker.scope_tracker.exit_scope();
    }
    
    /// Process function expressions to ensure their bodies are traversed
    fn visit_mut_fn_expr(&mut self, fn_expr: &mut FnExpr) {
        self.import_tracker.scope_tracker.enter_scope();

        // Process function body
        fn_expr.visit_mut_children_with(self);

        // Exit scope
        self.import_tracker.scope_tracker.exit_scope();
    }

    /// Block statements: { ... } - create scope for let/const
    fn visit_mut_block_stmt(&mut self, block: &mut BlockStmt) {
        self.import_tracker.scope_tracker.enter_scope();
        block.visit_mut_children_with(self);
        self.import_tracker.scope_tracker.exit_scope();
    }

    /// Class declarations: class Foo { ... }
    fn visit_mut_class(&mut self, class: &mut Class) {
        self.import_tracker.scope_tracker.enter_scope();
        class.visit_mut_children_with(self);
        self.import_tracker.scope_tracker.exit_scope();
    }

    /// Method definitions: { method() {} }
    fn visit_mut_method_prop(&mut self, method: &mut MethodProp) {
        self.import_tracker.scope_tracker.enter_scope();
        method.visit_mut_children_with(self);
        self.import_tracker.scope_tracker.exit_scope();
    }

    /// For statements: for(let i = 0; ...) {}
    fn visit_mut_for_stmt(&mut self, for_stmt: &mut ForStmt) {
        self.import_tracker.scope_tracker.enter_scope();
        for_stmt.visit_mut_children_with(self);
        self.import_tracker.scope_tracker.exit_scope();
    }

    /// For-in statements: for(let key in obj) {}
    fn visit_mut_for_in_stmt(&mut self, for_in: &mut ForInStmt) {
        self.import_tracker.scope_tracker.enter_scope();
        for_in.visit_mut_children_with(self);
        self.import_tracker.scope_tracker.exit_scope();
    }

    /// For-of statements: for(let item of items) {}
    fn visit_mut_for_of_stmt(&mut self, for_of: &mut ForOfStmt) {
        self.import_tracker.scope_tracker.enter_scope();
        for_of.visit_mut_children_with(self);
        self.import_tracker.scope_tracker.exit_scope();
    }

    /// Catch clauses: catch(e) {} - creates scope for the error variable
    fn visit_mut_catch_clause(&mut self, catch: &mut CatchClause) {
        self.import_tracker.scope_tracker.enter_scope();
        catch.visit_mut_children_with(self);
        self.import_tracker.scope_tracker.exit_scope();
    }

    /// While loops: while(condition) { let x = 1; }
    fn visit_mut_while_stmt(&mut self, while_stmt: &mut WhileStmt) {
        self.import_tracker.scope_tracker.enter_scope();
        while_stmt.visit_mut_children_with(self);
        self.import_tracker.scope_tracker.exit_scope();
    }

    /// Switch statements: switch(val) { case 1: { let x = 1; } }
    fn visit_mut_switch_stmt(&mut self, switch: &mut SwitchStmt) {
        self.import_tracker.scope_tracker.enter_scope();
        switch.visit_mut_children_with(self);
        self.import_tracker.scope_tracker.exit_scope();
    }

    /// Call expressions: t()
    fn visit_mut_call_expr(&mut self, call_expr: &mut CallExpr) {
        if let Callee::Expr(callee_expr) = &call_expr.callee {
            if let Expr::Ident(Ident { sym: function_name, .. }) = callee_expr.as_ref() {


                // useGT() is failing the check here
                // if function_name.as_str() == "useGT" {
                //     eprintln!("visit_mut_call_expr() function_name: {:?}", function_name);
                // }
                if let Some(translation_variable) = self
                    .import_tracker
                    .scope_tracker
                    .get_translation_variable(function_name) {

                    // Register the useGT/getGT as aggregators on the string collector
                    let original_name = translation_variable.assigned_value.clone();
                    let identifier = translation_variable.identifier;
                    eprintln!("Found translation function: {:?}, identifier: {}", original_name, identifier);

                    // Detect useGT/getGT calls
                    if is_translation_function_name(&original_name) {
                        // Handled in track_variable_assignment()
                        // // Get counter_id
                        // let counter_id = self.import_tracker.string_collector.increment_counter();
                        // // Create a new entry in the string collector for this call
                        // self.import_tracker.string_collector.initialize_call(counter_id);
                    } else if is_translation_function_callback(&original_name) {
                        // Detect const t = useGT()
                        if let Some(string) = call_expr.args.first() {
                            // TODO: check for violations

                            // Get the options
                            let options = call_expr.args.get(1);

                            // Get context and id
                            let (context, id) = extract_id_and_context_from_options(options);

                            // Calculate hash for the call expression
                            let (hash, _) = self.calculate_hash_for_call_expr(
                                string,
                                options
                            );

                            // Construct the translation content object
                            if let Some(message) = extract_string_from_expr(string.expr.as_ref()) {
                                if let Some(hash) = hash {
                                    let translation_content = StringCollector::create_translation_content(
                                            message,
                                            hash,
                                            id,
                                            context
                                        );

                                    // Add the translation content to the string collector
                                    self.import_tracker.string_collector.add_translation_content(identifier, translation_content);
                                }
                            }

                        }

                    }

                }
            }
        }
        call_expr.visit_mut_children_with(self);
    }
}

// // TODO: remove VisitMut
// impl VisitMut for TransformVisitor {
//     /// Process import declarations to track gt-next imports
//     fn visit_mut_import_decl(&mut self, import_decl: &mut ImportDecl) {
//         self.process_gt_import_declaration(import_decl);
//         import_decl.visit_mut_children_with(self);
//     }

//     /// Process variable declarations to track assignments like: const t = useGT()
//     fn visit_mut_var_declarator(&mut self, var_declarator: &mut VarDeclarator) {
//         self.track_variable_assignment(var_declarator);
//         var_declarator.visit_mut_children_with(self);
//     }

//     /// Process function calls to detect invalid usage of translation functions
//     fn visit_mut_call_expr(&mut self, call_expr: &mut CallExpr) {
//         if let Callee::Expr(callee_expr) = &call_expr.callee {
//             if let Expr::Ident(Ident { sym: function_name, .. }) = callee_expr.as_ref() {
//                 if self.import_tracker.translation_callee_names.contains_key(function_name) {
//                     // Check the first argument for dynamic content
//                     if let Some(arg) = call_expr.args.first() {
//                         self.check_call_expr_for_violations(arg, function_name);
//                     }
//                 }
//             }
//         }
//         call_expr.visit_mut_children_with(self);
//     }

//     /// Process JSX attributes to track context and avoid flagging attribute expressions
//     fn visit_mut_jsx_attr(&mut self, attr: &mut JSXAttr) {
//         let was_in_jsx_attribute = self.traversal_state.in_jsx_attribute;
//         self.traversal_state.in_jsx_attribute = true;
//         attr.visit_mut_children_with(self);
//         self.traversal_state.in_jsx_attribute = was_in_jsx_attribute;
//     }

//     /// Process JSX expression containers to detect unwrapped dynamic content
//     fn visit_mut_jsx_expr_container(&mut self, expr_container: &mut JSXExprContainer) {
//         // Only check for violations if we're in a translation component and NOT in a JSX attribute
//         if self.traversal_state.in_translation_component && !self.traversal_state.in_jsx_attribute {
//             self.statistics.dynamic_content_violations += 1;
//             let warning = self.create_dynamic_content_warning("T");
//             self.logger.log_warning(&warning);
//         }
        
//         expr_container.visit_mut_children_with(self);
//     }
// }

impl Fold for TransformVisitor {
    /// Process import declarations to track GT-Next imports
    fn fold_import_decl(&mut self, import_decl: ImportDecl) -> ImportDecl {
        self.process_gt_import_declaration(&import_decl);
        import_decl
    }

    /// Process variable declarations to track assignments like: const t = useGT()
    fn fold_var_declarator(&mut self, var_declarator: VarDeclarator) -> VarDeclarator {
        self.track_variable_assignment(&var_declarator);
        let var_declarator = var_declarator.fold_children_with(self);
        var_declarator
    }

    /// Process function declarations to ensure their bodies are traversed
    fn fold_function(&mut self, function: Function) -> Function {
        self.import_tracker.scope_tracker.enter_scope();

        // Track parameters before processing body
        self.track_parameter_overrides(&function.params);

        // Process function body
        let function = function.fold_children_with(self);

        // Exit scope
        self.import_tracker.scope_tracker.exit_scope();
        function
    }
    
    /// Process arrow functions to ensure their bodies are traversed
    fn fold_arrow_expr(&mut self, arrow: ArrowExpr) -> ArrowExpr {
        self.import_tracker.scope_tracker.enter_scope();

        // Track arrow function parameters  
        self.track_arrow_parameter_overrides(&arrow.params);

        // Process arrow function body
        let arrow = arrow.fold_children_with(self);
        self.import_tracker.scope_tracker.exit_scope();
        arrow
    }
    
    /// Process function expressions to ensure their bodies are traversed
    fn fold_fn_expr(&mut self, fn_expr: FnExpr) -> FnExpr {
        self.import_tracker.scope_tracker.enter_scope();
        let fn_expr = fn_expr.fold_children_with(self);
        self.import_tracker.scope_tracker.exit_scope();
        fn_expr
    }

    /// Block statements: { ... } - create scope for let/const
    fn fold_block_stmt(&mut self, block: BlockStmt) -> BlockStmt {
        let _scope_id = self.import_tracker.scope_tracker.enter_scope();
        let result = block.fold_children_with(self);
        self.import_tracker.scope_tracker.exit_scope();
        result
    }

    /// Class declarations: class Foo { ... }
    fn fold_class(&mut self, class: Class) -> Class {
        let _scope_id = self.import_tracker.scope_tracker.enter_scope();
        let result = class.fold_children_with(self);
        self.import_tracker.scope_tracker.exit_scope();
        result
    }

    /// Method definitions: { method() {} }
    fn fold_method_prop(&mut self, method: MethodProp) -> MethodProp {
        let _scope_id = self.import_tracker.scope_tracker.enter_scope();
        let result = method.fold_children_with(self);
        self.import_tracker.scope_tracker.exit_scope();
        result
    }

    /// For statements: for(let i = 0; ...) {}
    fn fold_for_stmt(&mut self, for_stmt: ForStmt) -> ForStmt {
        let _scope_id = self.import_tracker.scope_tracker.enter_scope();
        let result = for_stmt.fold_children_with(self);
        self.import_tracker.scope_tracker.exit_scope();
        result
    }

    /// For-in statements: for(let key in obj) {}
    fn fold_for_in_stmt(&mut self, for_in: ForInStmt) -> ForInStmt {
        let _scope_id = self.import_tracker.scope_tracker.enter_scope();
        let result = for_in.fold_children_with(self);
        self.import_tracker.scope_tracker.exit_scope();
        result
    }

    /// For-of statements: for(let item of items) {}
    fn fold_for_of_stmt(&mut self, for_of: ForOfStmt) -> ForOfStmt {
        let _scope_id = self.import_tracker.scope_tracker.enter_scope();
        let result = for_of.fold_children_with(self);
        self.import_tracker.scope_tracker.exit_scope();
        result
    }


    /// Catch clauses: catch(e) {} - creates scope for the error variable
    fn fold_catch_clause(&mut self, catch: CatchClause) -> CatchClause {
        let _scope_id = self.import_tracker.scope_tracker.enter_scope();
        let result = catch.fold_children_with(self);
        self.import_tracker.scope_tracker.exit_scope();
        result
    }

    /// While loops: while(condition) { let x = 1; }
    fn fold_while_stmt(&mut self, while_stmt: WhileStmt) -> WhileStmt {
        let _scope_id = self.import_tracker.scope_tracker.enter_scope();
        let result = while_stmt.fold_children_with(self);
        self.import_tracker.scope_tracker.exit_scope();
        result
    }

    /// Switch statements: switch(val) { case 1: { let x = 1; } }
    fn fold_switch_stmt(&mut self, switch: SwitchStmt) -> SwitchStmt {
        let _scope_id = self.import_tracker.scope_tracker.enter_scope();
        let result = switch.fold_children_with(self);
        self.import_tracker.scope_tracker.exit_scope();
        result
    }

    /// Process function calls to detect invalid usage of translation functions
    /// Inject hash attributes on translation components
    fn fold_call_expr(&mut self, call_expr: CallExpr) -> CallExpr {
        if let Callee::Expr(callee_expr) = &call_expr.callee {
            if let Expr::Ident(Ident { sym: function_name, .. }) = callee_expr.as_ref() {
                if self.settings.compile_time_hash {
                    if let Some(_translation_variable) = self.import_tracker.scope_tracker.get_translation_variable(function_name) {
                        // TODO: check original function, because we might have different functions in the future
                        // Check the first argument for dynamic content
                        if let Some(string) = call_expr.args.first() {
                            // Check for violations
                            self.check_call_expr_for_violations(string, function_name);

                            // Get the options
                            let options = call_expr.args.get(1);

                            // Calculate hash for the call expression
                            let (hash, json) = self.calculate_hash_for_call_expr(
                                string,
                                options
                            );

                            // Inject hash attribute on the call expression
                            let modified_call_expr = self.inject_hash_attribute_on_call_expr(
                                &call_expr,
                                options,
                                hash,
                                json
                            );

                            return modified_call_expr.fold_children_with(self);
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
        if self.traversal_state.in_translation_component && !self.traversal_state.in_jsx_attribute {
            self.statistics.dynamic_content_violations += 1;
            let warning = self.create_dynamic_content_warning("T");
            self.logger.log_warning(&warning);
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
        if self.settings.compile_time_hash && self.traversal_state.in_translation_component && !was_in_translation {
            // Check if hash attribute already exists
            let has_hash_attr = TransformVisitor::determine_has_hash_attr(&element);
            
            if !has_hash_attr {
                // Calculate real hash using AST traversal
                let (hash_value, _) = self.calculate_element_hash(&element);

                
                // Create and add hash attribute with calculated value
                let hash_attr = TransformVisitor::create_attr(&element, &hash_value, "_hash");
                element.opening.attrs.push(hash_attr);

                
                // For debugging purposes
                // // Create and add json attribute with the stringified data
                // let json_attr = TransformVisitor::create_attr(&element, &json_string, "json");
                // element.opening.attrs.push(json_attr);
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
        .unwrap_or("{}".to_string());
    
    let config: PluginConfig = serde_json::from_str(&config_str)
        .unwrap_or_default();
    
    let filename = None;
    
    // Create StringCollector for the two-pass system
    let string_collector = crate::ast::StringCollector::new();
    
    let mut visitor = TransformVisitor::new(
        config.log_level,
        config.compile_time_hash,
        filename,
        string_collector,
    );
    
    // program.fold_with(&mut visitor)
    let mut program = program;
    program.visit_mut_with(&mut visitor);


    // ✅ YES - You can still access the StringCollector after the visitor returns!
    let collected_data = visitor.import_tracker.string_collector;

    if collected_data.total_calls() > 0 {
        // 🔍 Print debug stats:
        println!("🔍 PASS 1 COMPLETE:");
        println!("  📊 Total calls initialized: {}", collected_data.total_calls());
        println!("  📝 Total content items collected: {}", collected_data.total_content_items());
        println!("  🔢 Final counter value: {}", collected_data.get_counter());
        // Print detailed call info:
        for counter_id in collected_data.get_call_ids() {
            if let Some(content) = collected_data.get_content_for_injection(counter_id) {
                println!("  📋 Call {}: {} items", counter_id, content.len());
                for (i, item) in content.iter().enumerate() {
                    println!("    {}. \"{}\" (hash: {})", i+1, item.message, item.hash);
                }
            }
        }
    }
    // Return the program
    program

}

pub mod hash;
pub mod ast;
pub mod whitespace;
pub mod config;
pub mod visitor;
pub mod logging;
