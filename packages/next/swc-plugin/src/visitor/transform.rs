use super::state::{Statistics, TraversalState, ImportTracker};
use super::jsx_utils::{extract_attribute_from_jsx_attr};
use crate::config::PluginSettings;
use crate::logging::{LogLevel, Logger};
use swc_core::{
  common::SyntaxContext,
  ecma::{
      ast::*,
      atoms::Atom,
  },
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
      Self::new(LogLevel::Warn, false, None)
  }
}

impl TransformVisitor {
  pub fn new(
      log_level: LogLevel,
      compile_time_hash: bool,
      filename: Option<String>,
  ) -> Self {
      Self {
          traversal_state: TraversalState::default(),
          statistics: Statistics::default(),
          import_tracker: ImportTracker::default(),
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

                          if is_translation_component_name(&original_name) {
                              // Store the mapping: local_name -> original_name
                              self.import_tracker.translation_import_aliases.insert(local_name, original_name);
                          } else if is_variable_component_name(&original_name) {
                              self.import_tracker.variable_import_aliases.insert(local_name, original_name);
                          } else if is_branch_name(&original_name) {
                              // no existing tracking for branches
                              self.import_tracker.branch_import_aliases.insert(local_name, original_name);
                          } else if is_translation_function_name(&original_name) {
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
  pub fn check_call_expr_for_violations (&mut self, call_expr: &CallExpr) {
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
                              self.logger.log_warning(&warning);
                          }
                          // String concatenation: t("Hello " + name)
                          Expr::Bin(BinExpr { op: BinaryOp::Add, left, right, .. }) => {
                              // Check if it's string concatenation (at least one side is a string)
                              let left_is_string = matches!(left.as_ref(), Expr::Lit(Lit::Str(_)));
                              let right_is_string = matches!(right.as_ref(), Expr::Lit(Lit::Str(_)));
                              
                              if left_is_string || right_is_string {
                                  self.statistics.dynamic_content_violations += 1;
                                  let warning = self.create_dynamic_function_warning(function_name.as_ref(), "string concatenation");
                                  self.logger.log_warning(&warning);
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

  pub fn track_variable_assignment (&mut self, var_declarator: &VarDeclarator) {
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
                  return ident.sym.as_ref() == "hash";
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
