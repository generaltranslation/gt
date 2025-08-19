use crate::visitor::TransformVisitor;
use crate::{
  config::PluginConfig,
  visitor::{
    analysis::{is_translation_function_callback, is_translation_function_name},
    errors::create_dynamic_content_warning,
    expr_utils::get_callee_expr_function_name,
  },
};
use swc_core::{
  ecma::{
    ast::*,
    visit::{Fold, FoldWith, VisitMut, VisitMutWith},
  },
  plugin::{plugin_transform, proxies::TransformPluginProgramMetadata},
};

impl VisitMut for TransformVisitor {
  /// Process import declarations to track gt-next imports
  fn visit_mut_import_decl(&mut self, import_decl: &mut ImportDecl) {
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
    self.with_scope(|visitor| {
      visitor.track_parameter_overrides(&function.params);
      function.visit_mut_children_with(visitor);
    })
  }

  /// Process arrow functions to ensure their bodies are traversed
  fn visit_mut_arrow_expr(&mut self, arrow: &mut ArrowExpr) {
    self.with_scope(|visitor| {
      visitor.track_arrow_parameter_overrides(&arrow.params);
      arrow.visit_mut_children_with(visitor);
    })
  }

  /// Process function expressions to ensure their bodies are traversed
  fn visit_mut_fn_expr(&mut self, fn_expr: &mut FnExpr) {
    self.with_scope(|visitor| {
      fn_expr.visit_mut_children_with(visitor);
    })
  }

  /// Block statements: { ... } - create scope for let/const
  fn visit_mut_block_stmt(&mut self, block: &mut BlockStmt) {
    self.with_scope(|visitor| {
      block.visit_mut_children_with(visitor);
    })
  }

  /// Class declarations: class Foo { ... }
  fn visit_mut_class(&mut self, class: &mut Class) {
    self.with_scope(|visitor| {
      class.visit_mut_children_with(visitor);
    })
  }

  /// Method definitions: { method() {} }
  fn visit_mut_method_prop(&mut self, method: &mut MethodProp) {
    self.with_scope(|visitor| {
      method.visit_mut_children_with(visitor);
    })
  }

  /// For statements: for(let i = 0; ...) {}
  fn visit_mut_for_stmt(&mut self, for_stmt: &mut ForStmt) {
    self.with_scope(|visitor| {
      for_stmt.visit_mut_children_with(visitor);
    })
  }

  /// For-in statements: for(let key in obj) {}
  fn visit_mut_for_in_stmt(&mut self, for_in: &mut ForInStmt) {
    self.with_scope(|visitor| {
      for_in.visit_mut_children_with(visitor);
    })
  }

  /// For-of statements: for(let item of items) {}
  fn visit_mut_for_of_stmt(&mut self, for_of: &mut ForOfStmt) {
    self.with_scope(|visitor| {
      for_of.visit_mut_children_with(visitor);
    })
  }

  /// Catch clauses: catch(e) {} - creates scope for the error variable
  fn visit_mut_catch_clause(&mut self, catch: &mut CatchClause) {
    self.with_scope(|visitor| {
      catch.visit_mut_children_with(visitor);
    })
  }

  /// While loops: while(condition) { let x = 1; }
  fn visit_mut_while_stmt(&mut self, while_stmt: &mut WhileStmt) {
    self.with_scope(|visitor| {
      while_stmt.visit_mut_children_with(visitor);
    })
  }

  /// Switch statements: switch(val) { case 1: { let x = 1; } }
  fn visit_mut_switch_stmt(&mut self, switch: &mut SwitchStmt) {
    self.with_scope(|visitor| {
      switch.visit_mut_children_with(visitor);
    })
  }

  /// Call expressions: t()
  fn visit_mut_call_expr(&mut self, call_expr: &mut CallExpr) {
    if let Some(function_name) = get_callee_expr_function_name(call_expr) {
      if let Some(translation_variable) = self
        .import_tracker
        .scope_tracker
        .get_translation_variable(&function_name)
      {
        // Register the useGT/getGT as aggregators on the string collector
        let original_name = translation_variable.original_name.clone();
        let identifier = translation_variable.identifier;

        // Detect t() calls
        if is_translation_function_callback(&original_name) {
          if let Some(string) = call_expr.args.first() {
            // Check for violations
            self.check_call_expr_for_violations(string, &function_name);

            // Track the t() function call
            self.track_translation_callback(call_expr, string, identifier);
          }
        }
      }
    }
    call_expr.visit_mut_children_with(self);
  }

  /// Process JSX expression containers to detect unwrapped dynamic content
  fn visit_mut_jsx_expr_container(&mut self, expr_container: &mut JSXExprContainer) {
    // Only check for violations if we're in a translation component and NOT in a JSX attribute
    if self.traversal_state.in_translation_component && !self.traversal_state.in_jsx_attribute {
      self.statistics.dynamic_content_violations += 1;
      let warning = create_dynamic_content_warning(self.settings.filename.as_deref(), "T");
      self.logger.log_error(&warning);
    }
    expr_container.visit_mut_children_with(self);
  }

  /// Process JSX attributes to track context and avoid flagging attribute expressions
  fn visit_mut_jsx_attr(&mut self, attr: &mut JSXAttr) {
    let was_in_jsx_attribute = self.traversal_state.in_jsx_attribute;
    self.traversal_state.in_jsx_attribute = true;
    attr.visit_mut_children_with(self);
    self.traversal_state.in_jsx_attribute = was_in_jsx_attribute;
  }

  /// Process JSX elements to track component context and inject experimental features
  fn visit_mut_jsx_element(&mut self, element: &mut JSXElement) {
    self.statistics.jsx_element_count += 1;

    // Save previous state
    let was_in_translation = self.traversal_state.in_translation_component;
    let was_in_variable = self.traversal_state.in_variable_component;

    // Update component tracking state
    let (is_translation_component, is_variable_component, _) =
      self.determine_component_type(element);
    self.traversal_state.in_translation_component = is_translation_component;
    self.traversal_state.in_variable_component = is_variable_component;

    // Calculate and record hash for translation components
    if self.settings.compile_time_hash
      && self.traversal_state.in_translation_component
      && !was_in_translation
    {
      self.track_hash_attributes(element);
    }

    // Process children
    element.visit_mut_children_with(self);

    // Restore previous state
    self.traversal_state.in_translation_component = was_in_translation;
    self.traversal_state.in_variable_component = was_in_variable;
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
    // Track variable assignments before children are visited (process = useGT() first)
    self.track_variable_assignment(&var_declarator);

    var_declarator.fold_children_with(self)
  }

  /// Process function declarations to ensure their bodies are traversed
  fn fold_function(&mut self, function: Function) -> Function {
    self.with_scope(|visitor| {
      visitor.track_parameter_overrides(&function.params);
      function.fold_children_with(visitor)
    })
  }

  /// Process arrow functions to ensure their bodies are traversed
  fn fold_arrow_expr(&mut self, arrow: ArrowExpr) -> ArrowExpr {
    self.with_scope(|visitor| {
      visitor.track_arrow_parameter_overrides(&arrow.params);
      arrow.fold_children_with(visitor)
    })
  }

  /// Process function expressions to ensure their bodies are traversed
  fn fold_fn_expr(&mut self, fn_expr: FnExpr) -> FnExpr {
    self.with_scope(|visitor| fn_expr.fold_children_with(visitor))
  }

  /// Block statements: { ... } - create scope for let/const
  fn fold_block_stmt(&mut self, block: BlockStmt) -> BlockStmt {
    self.with_scope(|visitor| block.fold_children_with(visitor))
  }

  /// Class declarations: class Foo { ... }
  fn fold_class(&mut self, class: Class) -> Class {
    self.with_scope(|visitor| class.fold_children_with(visitor))
  }

  /// Method definitions: { method() {} }
  fn fold_method_prop(&mut self, method: MethodProp) -> MethodProp {
    self.with_scope(|visitor| method.fold_children_with(visitor))
  }

  /// For statements: for(let i = 0; ...) {}
  fn fold_for_stmt(&mut self, for_stmt: ForStmt) -> ForStmt {
    self.with_scope(|visitor| for_stmt.fold_children_with(visitor))
  }

  /// For-in statements: for(let key in obj) {}
  fn fold_for_in_stmt(&mut self, for_in: ForInStmt) -> ForInStmt {
    self.with_scope(|visitor| for_in.fold_children_with(visitor))
  }

  /// For-of statements: for(let item of items) {}
  fn fold_for_of_stmt(&mut self, for_of: ForOfStmt) -> ForOfStmt {
    self.with_scope(|visitor| for_of.fold_children_with(visitor))
  }

  /// Catch clauses: catch(e) {} - creates scope for the error variable
  fn fold_catch_clause(&mut self, catch: CatchClause) -> CatchClause {
    self.with_scope(|visitor| catch.fold_children_with(visitor))
  }

  /// While loops: while(condition) { let x = 1; }
  fn fold_while_stmt(&mut self, while_stmt: WhileStmt) -> WhileStmt {
    self.with_scope(|visitor| while_stmt.fold_children_with(visitor))
  }

  /// Switch statements: switch(val) { case 1: { let x = 1; } }
  fn fold_switch_stmt(&mut self, switch: SwitchStmt) -> SwitchStmt {
    self.with_scope(|visitor| switch.fold_children_with(visitor))
  }

  /// Process function calls to detect invalid usage of translation functions
  /// Inject hash attributes on translation components
  fn fold_call_expr(&mut self, call_expr: CallExpr) -> CallExpr {
    if let Some(function_name) = get_callee_expr_function_name(&call_expr) {
      if let Some(translation_variable) = self
        .import_tracker
        .scope_tracker
        .get_translation_variable(&function_name)
      {
        // Register the useGT/getGT as aggregators on the string collector
        let original_name = translation_variable.original_name.clone();

        // Detect useGT/getGT calls
        if is_translation_function_name(&original_name) {
          if let Some(modified_call_expr) =
            self.inject_content_array_on_translation_function_call(&call_expr)
          {
            return modified_call_expr.fold_children_with(self);
          }
        }
        // Detect t() calls
        else if is_translation_function_callback(&original_name) {
          if let Some(modified_call_expr) =
            self.inject_hash_attributes_on_translation_function_call(&call_expr)
          {
            return modified_call_expr.fold_children_with(self);
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
      let warning = create_dynamic_content_warning(self.settings.filename.as_deref(), "T");
      self.logger.log_error(&warning);
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
  fn fold_jsx_element(&mut self, element: JSXElement) -> JSXElement {
    self.statistics.jsx_element_count += 1;

    // Save state
    let was_in_translation = self.traversal_state.in_translation_component;
    let was_in_variable = self.traversal_state.in_variable_component;

    // Determine context
    let (is_translation, is_variable, _) = self.determine_component_type(&element);
    self.traversal_state.in_translation_component = is_translation;
    self.traversal_state.in_variable_component = is_variable;

    // Inject hash attributes on translation components
    let element = if self.settings.compile_time_hash
      && self.traversal_state.in_translation_component
      && !was_in_translation
    {
      self.inject_hash_attributes(element)
    } else {
      element
    };

    // Traverse children
    let result = element.fold_children_with(self);

    // Restore state
    self.traversal_state.in_translation_component = was_in_translation;
    self.traversal_state.in_variable_component = was_in_variable;

    result
  }
}

#[plugin_transform]
pub fn process_transform(program: Program, metadata: TransformPluginProgramMetadata) -> Program {
  let config_str = metadata
    .get_transform_plugin_config()
    .unwrap_or("{}".to_string());

  let config: PluginConfig = serde_json::from_str(&config_str).unwrap_or_default();

  let filename = None;

  // Create StringCollector for the two-pass system
  let string_collector = crate::ast::StringCollector::new();

  let mut program = program;

  if !config.compile_time_hash {
    panic!("gt-next: Error: compile_time_hash is not enabled");
  }

  let mut visitor = TransformVisitor::new(
    config.log_level.clone(),
    config.compile_time_hash,
    filename.clone(),
    string_collector,
  );
  program.visit_mut_with(&mut visitor);

  if visitor.statistics.dynamic_content_violations > 0 {
    panic!(
      "gt-next: Error: {} dynamic content violations found",
      visitor.statistics.dynamic_content_violations
    );
  }

  let collected_data = visitor.string_collector;
  let mut visitor = TransformVisitor::new(
    config.log_level,
    config.compile_time_hash,
    filename,
    collected_data,
  );
  program.fold_with(&mut visitor)
}

pub mod ast;
pub mod config;
pub mod hash;
pub mod logging;
pub mod visitor;
pub mod whitespace;
