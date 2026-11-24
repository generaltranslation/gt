use super::state::{ImportTracker, Statistics, TraversalState};
use crate::ast::{JsxTraversal, StringCollector};
use crate::config::PluginSettings;
use crate::logging::{LogLevel, Logger};
use swc_core::{
  common::SyntaxContext,
  ecma::{ast::*, atoms::Atom},
};

use crate::visitor::analysis::{
  is_branch_name, is_translation_component_name, is_variable_component_name,
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
  /// String collector for two-pass transformation
  pub string_collector: StringCollector,
}

impl Default for TransformVisitor {
  fn default() -> Self {
    Self::new(LogLevel::Warn, false, None, false, false, StringCollector::new())
  }
}

impl TransformVisitor {
  pub fn new(
    log_level: LogLevel,
    compile_time_hash: bool,
    filename: Option<String>,
    disable_build_checks: bool,
    autoderive_jsx: bool,
    mut string_collector: StringCollector,
  ) -> Self {
    // Reset the counter to 0
    string_collector.reset_counter();
    Self {
      traversal_state: TraversalState::default(),
      statistics: Statistics::default(),
      import_tracker: ImportTracker::new(),
      settings: PluginSettings::new(log_level.clone(), compile_time_hash, filename.clone(), disable_build_checks, autoderive_jsx),
      logger: Logger::new(log_level),
      string_collector,
    }
  }

  /// Single helper method - handles scope enter/exit only
  pub fn with_scope<T, F>(&mut self, operation: F) -> T
  where
    F: FnOnce(&mut Self) -> T,
  {
    self.import_tracker.scope_tracker.enter_scope();
    let result = operation(self);
    self.import_tracker.scope_tracker.exit_scope();
    result
  }

  /// Inject hash attributes on translation components
  pub fn inject_hash_attributes(&mut self, mut element: JSXElement) -> JSXElement {
    // Check if hash attribute already exists
    let has_hash_attr = TransformVisitor::determine_has_hash_attr(&element);

    if !has_hash_attr {
      // Get the hash from the aggregator
      let counter_id = self.string_collector.increment_counter();
      let translation_jsx = self.string_collector.get_translation_jsx(counter_id);

      // Inject hash
      if let Some(translation_jsx) = translation_jsx {
        let hash_value = translation_jsx.hash.clone();
        let hash_attr = TransformVisitor::create_attr(&element, &hash_value, "_hash");
        element.opening.attrs.push(hash_attr);
      }
    }

    element
  }

  pub fn track_hash_attributes(&mut self, element: &mut JSXElement) {
    // Traversal
    let mut traversal = JsxTraversal::new(self);

    // Check if hash attribute already exists
    let has_hash_attr = TransformVisitor::determine_has_hash_attr(element);

    if !has_hash_attr {
      // Calculate real hash using AST traversal
      let (hash_value, _) = traversal.calculate_element_hash(element);

      let counter_id = self.string_collector.increment_counter();
      self.string_collector.initialize_aggregator(counter_id);

      self.string_collector.set_translation_jsx(
        counter_id,
        StringCollector::create_translation_jsx(hash_value),
      );
    }
  }

  /// Check if we should track this component based on imports or known components
  pub fn should_track_component_as_translation(&self, name: &Atom) -> bool {
    // // Direct imports from gt-next - includes T components
    if let Some(translation_variable) = self
      .import_tracker
      .scope_tracker
      .get_translation_variable(name)
    {
      if is_translation_component_name(&translation_variable.original_name) {
        return true;
      }
    }
    false
  }

  /// Check if we should track this component as a variable component
  pub fn should_track_component_as_variable(&self, name: &Atom) -> bool {
    // Direct imports from gt-next
    if let Some(variable) = self.import_tracker.scope_tracker.get_variable(name) {
      if is_variable_component_name(&variable.original_name) {
        return true;
      }
    }
    false
  }

  /// Check if we should track this component as a branch component
  pub fn should_track_component_as_branch(&self, name: &Atom) -> bool {
    // Select and Plural components components
    if let Some(branch_variable) = self.import_tracker.scope_tracker.get_variable(name) {
      if is_branch_name(&branch_variable.original_name) {
        return true;
      }
    }
    false
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

  /// Imports are hoisted, so a `<T>` above its gt-next import still needs it tracked
  pub fn track_module_imports(&mut self, module: &Module) {
    for item in &module.body {
      if let ModuleItem::ModuleDecl(ModuleDecl::Import(import_decl)) = item {
        self.process_gt_import_declaration(import_decl);
      }
    }
  }

  /// Process GT-Next import declarations to track imports and aliases
  pub fn process_gt_import_declaration(&mut self, import_decl: &ImportDecl) {
    let src_value = import_decl.src.value.to_string_lossy().into_owned();
    match src_value.as_str() {
      "gt-next" | "gt-next/server" | "gt-i18n" => {
        // Process named imports: import { T, Var } from 'gt-next'
        for specifier in &import_decl.specifiers {
          match specifier {
            ImportSpecifier::Named(ImportNamedSpecifier {
              local, imported, ..
            }) => {
              let local_name = local.sym.clone();
              let original_name = match imported {
                Some(ModuleExportName::Ident(ident)) => ident.sym.clone(),
                Some(ModuleExportName::Str(str_lit)) => Atom::new(str_lit.value.to_string_lossy().into_owned()),
                None => local_name.clone(),
              };

              // Store the mapping: local_name -> original_name
              if is_translation_component_name(&original_name)
                || is_variable_component_name(&original_name)
                || is_branch_name(&original_name)
              {
                self
                  .import_tracker
                  .scope_tracker
                  .track_translation_variable(
                    local_name.clone(),
                    original_name.clone(),
                  );
              }
            }
            ImportSpecifier::Namespace(ImportStarAsSpecifier { local, .. }) => {
              // Handle namespace imports: import * as GT from 'gt-next'
              self
                .import_tracker
                .namespace_imports
                .insert(local.sym.clone());
            }
            _ => {}
          }
        }
      }
      _ => {}
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
            ObjectPatProp::KeyValue(KeyValuePatProp { value, .. }) => {
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

  fn track_overriding_variable(&mut self, variable_name: &Atom) {
    if self
      .import_tracker
      .scope_tracker
      .get_variable(variable_name)
      .is_some()
    {
      self
        .import_tracker
        .scope_tracker
        .track_regular_variable(variable_name.clone(), "other".into());
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

  /// A variable assigned from a call shadows a tracked import of the same
  /// name, unless the callee is itself a tracked import
  fn track_function_call_assignment(&mut self, callee_expr: &Expr, variable_name: &Atom) {
    if let Expr::Ident(Ident {
      sym: callee_name, ..
    }) = callee_expr
    {
      if self
        .import_tracker
        .scope_tracker
        .get_translation_variable(callee_name)
        .is_none()
      {
        self.track_overriding_variable(variable_name);
      }
    }
  }

  pub fn track_variable_assignment(&mut self, var_declarator: &VarDeclarator) {
    if let Some(init_expr) = &var_declarator.init {
      match &var_declarator.name {
        // Handle simple identifier assignment: const T = getComponent()
        Pat::Ident(BindingIdent { id, .. }) => {
          match init_expr.as_ref() {
            Expr::Call(CallExpr {
              callee: Callee::Expr(callee_expr),
              ..
            }) => {
              self.track_function_call_assignment(callee_expr, &id.sym);
            }
            Expr::Await(AwaitExpr { arg, .. }) => {
              if let Expr::Call(CallExpr {
                callee: Callee::Expr(callee_expr),
                ..
              }) = arg.as_ref()
              {
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
        // Handle ALL destructuring patterns: const { T } = anything
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

  pub fn determine_component_type(&mut self, element: &JSXElement) -> (bool, bool, bool) {
    match &element.opening.name {
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
    }
  }

  pub fn determine_has_hash_attr(element: &JSXElement) -> bool {
    element.opening.attrs.iter().any(|attr| {
      if let JSXAttrOrSpread::JSXAttr(jsx_attr) = attr {
        if let JSXAttrName::Ident(ident) = &jsx_attr.name {
          return ident.sym.as_ref() == "_hash";
        }
      }
      false
    })
  }

  pub fn create_attr(element: &JSXElement, value: &str, attribute_name: &str) -> JSXAttrOrSpread {
    JSXAttrOrSpread::JSXAttr(JSXAttr {
      span: element.opening.span,
      name: JSXAttrName::Ident(
        Ident::new(
          attribute_name.into(),
          element.opening.span,
          SyntaxContext::empty(),
        )
        .into(),
      ),
      value: Some(JSXAttrValue::Str(Str {
        span: element.opening.span,
        value: value.into(),
        raw: None,
      })),
    })
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use swc_core::common::{SyntaxContext, DUMMY_SP};
  use swc_core::ecma::atoms::Atom;

  // Helper to create a test visitor with specific imports
  fn create_visitor_with_imports() -> TransformVisitor {
    let mut visitor = TransformVisitor::new(LogLevel::Silent, false, None, false, false, StringCollector::new());

    // Add some test imports using the scope tracker
    visitor
      .import_tracker
      .scope_tracker
      .track_translation_variable(Atom::new("T"), Atom::new("T"));
    visitor.import_tracker.scope_tracker.track_variable(
      Atom::new("Var"),
      Atom::new("Var"),
      true,
    );
    visitor.import_tracker.scope_tracker.track_variable(
      Atom::new("Select"),
      Atom::new("Select"),
      true,
    );
    visitor
      .import_tracker
      .namespace_imports
      .insert(Atom::new("GT"));

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
        }),
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
        }),
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
          }),
          prop: Ident {
            span: DUMMY_SP,
            sym: Atom::new(prop),
            optional: false,
            ctxt: SyntaxContext::empty(),
          }
          .into(),
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
          }),
          prop: Ident {
            span: DUMMY_SP,
            sym: Atom::new(prop),
            optional: false,
            ctxt: SyntaxContext::empty(),
          }
          .into(),
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
        value: Atom::new(source).into(),
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
      },
      imported: imported_name.map(|name| {
        ModuleExportName::Ident(Ident {
          span: DUMMY_SP,
          sym: Atom::new(name),
          optional: false,
          ctxt: SyntaxContext::empty(),
        })
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
      },
    })
  }

  mod constructor_and_defaults {
    use super::*;

    #[test]
    fn creates_new_visitor_with_parameters() {
      let visitor = TransformVisitor::new(
        LogLevel::Debug,
        true,
        Some("test.tsx".to_string()),
        false,
        false,
        StringCollector::new(),
      );

      assert_eq!(
        visitor.settings.log_level.as_int(),
        LogLevel::Debug.as_int()
      );
      assert!(visitor.settings.compile_time_hash);
      assert_eq!(visitor.settings.filename, Some("test.tsx".to_string()));

      // Check defaults are set
      assert_eq!(visitor.statistics.jsx_element_count, 0);
      assert_eq!(visitor.statistics.dynamic_content_violations, 0);
      // Scope tracker should be empty initially
      assert!(visitor.import_tracker.namespace_imports.is_empty());
    }

    #[test]
    fn creates_default_visitor() {
      let visitor = TransformVisitor::default();

      assert_eq!(visitor.settings.log_level.as_int(), LogLevel::Warn.as_int());
      assert!(!visitor.settings.compile_time_hash);
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

      assert!(visitor.should_track_component_as_branch(&Atom::new("Select")));
      assert!(!visitor.should_track_component_as_branch(&Atom::new("T")));
      assert!(!visitor.should_track_component_as_branch(&Atom::new("div")));
    }

    #[test]
    fn tracks_namespace_components() {
      let visitor = create_visitor_with_imports();

      let (is_translation, is_variable, is_branch) =
        visitor.should_track_namespace_component(&Atom::new("GT"), &Atom::new("T"));
      assert!(is_translation);
      assert!(!is_variable);
      assert!(!is_branch);

      let (is_translation, is_variable, is_branch) =
        visitor.should_track_namespace_component(&Atom::new("GT"), &Atom::new("Var"));
      assert!(!is_translation);
      assert!(is_variable);
      assert!(!is_branch);

      let (is_translation, is_variable, is_branch) =
        visitor.should_track_namespace_component(&Atom::new("Unknown"), &Atom::new("T"));
      assert!(!is_translation);
      assert!(!is_variable);
      assert!(!is_branch);
    }
  }

  mod warning_message_generation {
    use super::*;
    use crate::visitor::errors::create_dynamic_content_warning;

    #[test]
    fn creates_dynamic_content_warning_without_filename() {
      TransformVisitor::new(LogLevel::Warn, false, None, false, false, StringCollector::new());
      let warning = create_dynamic_content_warning(None, "T");

      assert!(warning.contains("gt-next"));
      assert!(warning.contains("<T> component contains unwrapped dynamic content"));
      assert!(warning.contains("<Var>{expression}</Var>"));
      assert!(!warning.starts_with("gt-next in "));
    }

    #[test]
    fn creates_dynamic_content_warning_with_filename() {
      TransformVisitor::new(
        LogLevel::Warn,
        false,
        Some("components/Test.tsx".to_string()),
        false,
        false,
        StringCollector::new(),
      );
      let warning = create_dynamic_content_warning(Some("components/Test.tsx"), "T");

      assert!(warning.contains("gt-next in components/Test.tsx"));
      assert!(warning.contains("<T> component contains unwrapped dynamic content"));
    }

  }

  mod import_processing {
    use super::*;

    #[test]
    fn processes_gt_next_named_imports() {
      let mut visitor =
        TransformVisitor::new(LogLevel::Silent, false, None, false, false, StringCollector::new());
      let import_decl = create_import_decl(
        "gt-next",
        vec![
          create_named_import("T", None),
          create_named_import("MyVar", Some("Var")),
          create_named_import("useGT", None),
        ],
      );

      visitor.process_gt_import_declaration(&import_decl);

      // Check that imports are tracked in the scope tracker
      assert!(visitor
        .import_tracker
        .scope_tracker
        .get_translation_variable(&Atom::new("T"))
        .is_some());
      assert!(visitor
        .import_tracker
        .scope_tracker
        .get_variable(&Atom::new("MyVar"))
        .is_some());
      assert!(visitor
        .import_tracker
        .scope_tracker
        .get_variable(&Atom::new("useGT"))
        .is_none());
    }

    #[test]
    fn processes_namespace_imports() {
      let mut visitor =
        TransformVisitor::new(LogLevel::Silent, false, None, false, false, StringCollector::new());
      let import_decl = create_import_decl("gt-next", vec![create_namespace_import("GT")]);

      visitor.process_gt_import_declaration(&import_decl);

      assert!(visitor
        .import_tracker
        .namespace_imports
        .contains(&Atom::new("GT")));
    }

    #[test]
    fn processes_gt_next_imports() {
      let mut visitor =
        TransformVisitor::new(LogLevel::Silent, false, None, false, false, StringCollector::new());
      let import_decl = create_import_decl("gt-next", vec![create_named_import("T", None)]);

      visitor.process_gt_import_declaration(&import_decl);

      assert!(visitor
        .import_tracker
        .scope_tracker
        .get_translation_variable(&Atom::new("T"))
        .is_some());
    }

    #[test]
    fn ignores_non_gt_imports() {
      let mut visitor =
        TransformVisitor::new(LogLevel::Silent, false, None, false, false, StringCollector::new());
      let import_decl = create_import_decl("react", vec![create_named_import("React", None)]);

      visitor.process_gt_import_declaration(&import_decl);

      // Should not track non-gt imports
      assert!(visitor
        .import_tracker
        .scope_tracker
        .get_translation_variable(&Atom::new("React"))
        .is_none());
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
        name: JSXAttrName::Ident(
          Ident {
            span: DUMMY_SP,
            sym: Atom::new(name),
            optional: false,
            ctxt: SyntaxContext::empty(),
          }
          .into(),
        ),
        value: Some(JSXAttrValue::Str(Str {
          span: DUMMY_SP,
          value: Atom::new(value).into(),
          raw: None,
        })),
      })
    }

    #[test]
    fn detects_hash_attribute_present() {
      let element = create_jsx_element(
        "T",
        vec![
          create_string_attr("_hash", "abc123"),
          create_string_attr("className", "test"),
        ],
      );

      assert!(TransformVisitor::determine_has_hash_attr(&element));
    }

    #[test]
    fn detects_hash_attribute_absent() {
      let element = create_jsx_element(
        "T",
        vec![
          create_string_attr("className", "test"),
          create_string_attr("id", "myid"),
        ],
      );

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
        if let Some(JSXAttrValue::Str(str_lit)) = &jsx_attr.value {
          assert_eq!(str_lit.value.to_string_lossy().into_owned(), "test-value");
        }
      } else {
        panic!("Expected JSXAttr");
      }
    }
  }

  mod autoderive_jsx_violations {
    use super::*;
    use swc_core::ecma::visit::VisitMut;

    /// Creates a visitor with autoderive jsx enabled and standard imports tracked
    fn create_visitor_with_autoderive() -> TransformVisitor {
      let mut visitor =
        TransformVisitor::new(LogLevel::Silent, false, None, false, false, StringCollector::new());
      visitor.settings.autoderive_jsx = true;

      // Track standard gt-next imports
      visitor
        .import_tracker
        .scope_tracker
        .track_translation_variable(Atom::new("T"), Atom::new("T"));

      visitor
    }

    // ── Validation tests: visit_mut_jsx_expr_container ──

    #[test]
    fn autoderive_on_allows_bare_variable_in_jsx_expr_container() {
      let mut visitor = create_visitor_with_autoderive();
      visitor.traversal_state.in_translation_component = true;

      let mut expr_container = JSXExprContainer {
        span: DUMMY_SP,
        expr: JSXExpr::Expr(Box::new(Expr::Ident(Ident {
          span: DUMMY_SP,
          sym: Atom::new("name"),
          optional: false,
          ctxt: SyntaxContext::empty(),
        }))),
      };

      visitor.visit_mut_jsx_expr_container(&mut expr_container);

      assert_eq!(visitor.statistics.dynamic_content_violations, 0);
    }

    #[test]
    fn autoderive_off_rejects_bare_variable_in_jsx_expr_container() {
      let mut visitor = create_visitor_with_imports();
      visitor.traversal_state.in_translation_component = true;

      let mut expr_container = JSXExprContainer {
        span: DUMMY_SP,
        expr: JSXExpr::Expr(Box::new(Expr::Ident(Ident {
          span: DUMMY_SP,
          sym: Atom::new("name"),
          optional: false,
          ctxt: SyntaxContext::empty(),
        }))),
      };

      visitor.visit_mut_jsx_expr_container(&mut expr_container);

      assert_eq!(visitor.statistics.dynamic_content_violations, 1);
    }

    #[test]
    fn autoderive_on_allows_function_call_in_jsx_expr_container() {
      let mut visitor = create_visitor_with_autoderive();
      visitor.traversal_state.in_translation_component = true;

      let mut expr_container = JSXExprContainer {
        span: DUMMY_SP,
        expr: JSXExpr::Expr(Box::new(Expr::Call(CallExpr {
          span: DUMMY_SP,
          callee: Callee::Expr(Box::new(Expr::Ident(Ident {
            span: DUMMY_SP,
            sym: Atom::new("getName"),
            optional: false,
            ctxt: SyntaxContext::empty(),
          }))),
          args: vec![],
          type_args: None,
          ctxt: SyntaxContext::empty(),
        }))),
      };

      visitor.visit_mut_jsx_expr_container(&mut expr_container);

      assert_eq!(visitor.statistics.dynamic_content_violations, 0);
    }

    // ── Hash calculation tests: track_hash_attributes ──

    #[test]
    fn autoderive_on_dynamic_content_produces_empty_hash() {
      let mut visitor = TransformVisitor::new(
        LogLevel::Silent,
        true,  // compile_time_hash = true
        None,
        false, // disable_build_checks
        true,  // autoderive_jsx = true
        StringCollector::new(),
      );
      // Track T import
      visitor
        .import_tracker
        .scope_tracker
        .track_translation_variable(Atom::new("T"), Atom::new("T"));

      let mut element = JSXElement {
        span: DUMMY_SP,
        opening: JSXOpeningElement {
          span: DUMMY_SP,
          name: JSXElementName::Ident(Ident {
            span: DUMMY_SP,
            sym: Atom::new("T"),
            optional: false,
            ctxt: SyntaxContext::empty(),
          }),
          attrs: vec![],
          self_closing: false,
          type_args: None,
        },
        children: vec![JSXElementChild::JSXExprContainer(JSXExprContainer {
          span: DUMMY_SP,
          expr: JSXExpr::Expr(Box::new(Expr::Ident(Ident {
            span: DUMMY_SP,
            sym: Atom::new("name"),
            optional: false,
            ctxt: SyntaxContext::empty(),
          }))),
        })],
        closing: Some(JSXClosingElement {
          span: DUMMY_SP,
          name: JSXElementName::Ident(Ident {
            span: DUMMY_SP,
            sym: Atom::new("T"),
            optional: false,
            ctxt: SyntaxContext::empty(),
          }),
        }),
      };

      visitor.track_hash_attributes(&mut element);

      let counter_id = visitor.string_collector.get_counter();
      let translation_jsx = visitor.string_collector.get_translation_jsx(counter_id);
      assert!(translation_jsx.is_some(), "expected translation JSX to be stored");
      assert_eq!(translation_jsx.unwrap().hash, "");
    }

    #[test]
    fn autoderive_on_nested_dynamic_content_produces_empty_hash() {
      let mut visitor = TransformVisitor::new(
        LogLevel::Silent,
        true,  // compile_time_hash = true
        None,
        false, // disable_build_checks
        true,  // autoderive_jsx = true
        StringCollector::new(),
      );
      // Track T import
      visitor
        .import_tracker
        .scope_tracker
        .track_translation_variable(Atom::new("T"), Atom::new("T"));

      // Build <T><b>{name}</b></T>
      let mut element = JSXElement {
        span: DUMMY_SP,
        opening: JSXOpeningElement {
          span: DUMMY_SP,
          name: JSXElementName::Ident(Ident {
            span: DUMMY_SP,
            sym: Atom::new("T"),
            optional: false,
            ctxt: SyntaxContext::empty(),
          }),
          attrs: vec![],
          self_closing: false,
          type_args: None,
        },
        children: vec![JSXElementChild::JSXElement(Box::new(JSXElement {
          span: DUMMY_SP,
          opening: JSXOpeningElement {
            span: DUMMY_SP,
            name: JSXElementName::Ident(Ident {
              span: DUMMY_SP,
              sym: Atom::new("b"),
              optional: false,
              ctxt: SyntaxContext::empty(),
            }),
            attrs: vec![],
            self_closing: false,
            type_args: None,
          },
          children: vec![JSXElementChild::JSXExprContainer(JSXExprContainer {
            span: DUMMY_SP,
            expr: JSXExpr::Expr(Box::new(Expr::Ident(Ident {
              span: DUMMY_SP,
              sym: Atom::new("name"),
              optional: false,
              ctxt: SyntaxContext::empty(),
            }))),
          })],
          closing: Some(JSXClosingElement {
            span: DUMMY_SP,
            name: JSXElementName::Ident(Ident {
              span: DUMMY_SP,
              sym: Atom::new("b"),
              optional: false,
              ctxt: SyntaxContext::empty(),
            }),
          }),
        }))],
        closing: Some(JSXClosingElement {
          span: DUMMY_SP,
          name: JSXElementName::Ident(Ident {
            span: DUMMY_SP,
            sym: Atom::new("T"),
            optional: false,
            ctxt: SyntaxContext::empty(),
          }),
        }),
      };

      visitor.track_hash_attributes(&mut element);

      let counter_id = visitor.string_collector.get_counter();
      let translation_jsx = visitor.string_collector.get_translation_jsx(counter_id);
      assert!(translation_jsx.is_some(), "expected translation JSX to be stored");
      assert_eq!(translation_jsx.unwrap().hash, "");
    }

    #[test]
    fn autoderive_on_static_content_produces_nonempty_hash() {
      let mut visitor = TransformVisitor::new(
        LogLevel::Silent,
        true,  // compile_time_hash = true
        None,
        false, // disable_build_checks
        true,  // autoderive_jsx = true
        StringCollector::new(),
      );
      // Track T import
      visitor
        .import_tracker
        .scope_tracker
        .track_translation_variable(Atom::new("T"), Atom::new("T"));

      let mut element = JSXElement {
        span: DUMMY_SP,
        opening: JSXOpeningElement {
          span: DUMMY_SP,
          name: JSXElementName::Ident(Ident {
            span: DUMMY_SP,
            sym: Atom::new("T"),
            optional: false,
            ctxt: SyntaxContext::empty(),
          }),
          attrs: vec![],
          self_closing: false,
          type_args: None,
        },
        children: vec![JSXElementChild::JSXText(JSXText {
          span: DUMMY_SP,
          value: Atom::new("Hello world"),
          raw: Atom::new("Hello world"),
        })],
        closing: Some(JSXClosingElement {
          span: DUMMY_SP,
          name: JSXElementName::Ident(Ident {
            span: DUMMY_SP,
            sym: Atom::new("T"),
            optional: false,
            ctxt: SyntaxContext::empty(),
          }),
        }),
      };

      visitor.track_hash_attributes(&mut element);

      let counter_id = visitor.string_collector.get_counter();
      let translation_jsx = visitor.string_collector.get_translation_jsx(counter_id);
      assert!(translation_jsx.is_some(), "expected translation JSX to be stored");
      let hash = &translation_jsx.unwrap().hash;
      assert!(!hash.is_empty(), "expected non-empty hash for static content");
      assert_eq!(hash.len(), 16, "expected hash to be 16 hex characters");
      assert!(
        hash.chars().all(|c| c.is_ascii_hexdigit()),
        "expected hash to contain only hex characters, got: {hash}"
      );
    }

    // ── Edge case validation tests ──

    #[test]
    fn autoderive_on_allows_ternary_in_jsx_expr_container() {
      let mut visitor = create_visitor_with_autoderive();
      visitor.traversal_state.in_translation_component = true;

      let mut expr_container = JSXExprContainer {
        span: DUMMY_SP,
        expr: JSXExpr::Expr(Box::new(Expr::Cond(CondExpr {
          span: DUMMY_SP,
          test: Box::new(Expr::Ident(Ident {
            span: DUMMY_SP, sym: Atom::new("condition"), optional: false, ctxt: SyntaxContext::empty(),
          })),
          cons: Box::new(Expr::Lit(Lit::Str(Str {
            span: DUMMY_SP, value: Atom::new("yes").into(), raw: None,
          }))),
          alt: Box::new(Expr::Lit(Lit::Str(Str {
            span: DUMMY_SP, value: Atom::new("no").into(), raw: None,
          }))),
        }))),
      };
      visitor.visit_mut_jsx_expr_container(&mut expr_container);
      assert_eq!(visitor.statistics.dynamic_content_violations, 0);
    }

    #[test]
    fn autoderive_on_allows_member_expression_in_jsx_expr_container() {
      let mut visitor = create_visitor_with_autoderive();
      visitor.traversal_state.in_translation_component = true;

      let mut expr_container = JSXExprContainer {
        span: DUMMY_SP,
        expr: JSXExpr::Expr(Box::new(Expr::Member(MemberExpr {
          span: DUMMY_SP,
          obj: Box::new(Expr::Ident(Ident {
            span: DUMMY_SP, sym: Atom::new("user"), optional: false, ctxt: SyntaxContext::empty(),
          })),
          prop: MemberProp::Ident(IdentName { span: DUMMY_SP, sym: Atom::new("name") }),
        }))),
      };
      visitor.visit_mut_jsx_expr_container(&mut expr_container);
      assert_eq!(visitor.statistics.dynamic_content_violations, 0);
    }

    #[test]
    fn autoderive_off_string_literal_still_allowed() {
      let mut visitor = create_visitor_with_imports();
      visitor.traversal_state.in_translation_component = true;

      let mut expr_container = JSXExprContainer {
        span: DUMMY_SP,
        expr: JSXExpr::Expr(Box::new(Expr::Lit(Lit::Str(Str {
          span: DUMMY_SP, value: Atom::new("static").into(), raw: None,
        })))),
      };
      visitor.visit_mut_jsx_expr_container(&mut expr_container);
      assert_eq!(visitor.statistics.dynamic_content_violations, 0);
    }

    #[test]
    fn autoderive_off_number_literal_still_allowed() {
      let mut visitor = create_visitor_with_imports();
      visitor.traversal_state.in_translation_component = true;

      let mut expr_container = JSXExprContainer {
        span: DUMMY_SP,
        expr: JSXExpr::Expr(Box::new(Expr::Lit(Lit::Num(Number {
          span: DUMMY_SP, value: 42.0, raw: None,
        })))),
      };
      visitor.visit_mut_jsx_expr_container(&mut expr_container);
      assert_eq!(visitor.statistics.dynamic_content_violations, 0);
    }

    #[test]
    fn autoderive_off_counts_multiple_violations() {
      let mut visitor = create_visitor_with_imports();
      visitor.traversal_state.in_translation_component = true;

      let mut expr1 = JSXExprContainer {
        span: DUMMY_SP,
        expr: JSXExpr::Expr(Box::new(Expr::Ident(Ident {
          span: DUMMY_SP, sym: Atom::new("firstName"), optional: false, ctxt: SyntaxContext::empty(),
        }))),
      };
      let mut expr2 = JSXExprContainer {
        span: DUMMY_SP,
        expr: JSXExpr::Expr(Box::new(Expr::Ident(Ident {
          span: DUMMY_SP, sym: Atom::new("lastName"), optional: false, ctxt: SyntaxContext::empty(),
        }))),
      };
      visitor.visit_mut_jsx_expr_container(&mut expr1);
      visitor.visit_mut_jsx_expr_container(&mut expr2);
      assert_eq!(visitor.statistics.dynamic_content_violations, 2);
    }

    #[test]
    fn autoderive_on_multiple_expressions_zero_violations() {
      let mut visitor = create_visitor_with_autoderive();
      visitor.traversal_state.in_translation_component = true;

      let mut expr1 = JSXExprContainer {
        span: DUMMY_SP,
        expr: JSXExpr::Expr(Box::new(Expr::Ident(Ident {
          span: DUMMY_SP, sym: Atom::new("firstName"), optional: false, ctxt: SyntaxContext::empty(),
        }))),
      };
      let mut expr2 = JSXExprContainer {
        span: DUMMY_SP,
        expr: JSXExpr::Expr(Box::new(Expr::Ident(Ident {
          span: DUMMY_SP, sym: Atom::new("lastName"), optional: false, ctxt: SyntaxContext::empty(),
        }))),
      };
      visitor.visit_mut_jsx_expr_container(&mut expr1);
      visitor.visit_mut_jsx_expr_container(&mut expr2);
      assert_eq!(visitor.statistics.dynamic_content_violations, 0);
    }

    #[test]
    fn autoderive_on_not_in_translation_component_no_violation() {
      let mut visitor = create_visitor_with_autoderive();
      // in_translation_component is false by default

      let mut expr_container = JSXExprContainer {
        span: DUMMY_SP,
        expr: JSXExpr::Expr(Box::new(Expr::Ident(Ident {
          span: DUMMY_SP, sym: Atom::new("name"), optional: false, ctxt: SyntaxContext::empty(),
        }))),
      };
      visitor.visit_mut_jsx_expr_container(&mut expr_container);
      assert_eq!(visitor.statistics.dynamic_content_violations, 0);
    }

    #[test]
    fn autoderive_on_in_jsx_attribute_no_violation() {
      let mut visitor = create_visitor_with_autoderive();
      visitor.traversal_state.in_translation_component = true;
      visitor.traversal_state.in_jsx_attribute = true;

      let mut expr_container = JSXExprContainer {
        span: DUMMY_SP,
        expr: JSXExpr::Expr(Box::new(Expr::Ident(Ident {
          span: DUMMY_SP, sym: Atom::new("name"), optional: false, ctxt: SyntaxContext::empty(),
        }))),
      };
      visitor.visit_mut_jsx_expr_container(&mut expr_container);
      assert_eq!(visitor.statistics.dynamic_content_violations, 0);
    }

    // ── Edge case hash tests ──

    #[test]
    fn autoderive_on_mixed_static_and_dynamic_produces_empty_hash() {
      let mut visitor = TransformVisitor::new(
        LogLevel::Silent, true, None, false, true, StringCollector::new(),
      );
      visitor.import_tracker.scope_tracker
        .track_translation_variable(Atom::new("T"), Atom::new("T"));

      let mut element = JSXElement {
        span: DUMMY_SP,
        opening: JSXOpeningElement {
          span: DUMMY_SP,
          name: JSXElementName::Ident(Ident { span: DUMMY_SP, sym: Atom::new("T"), optional: false, ctxt: SyntaxContext::empty() }),
          attrs: vec![], self_closing: false, type_args: None,
        },
        children: vec![
          JSXElementChild::JSXText(JSXText { span: DUMMY_SP, value: Atom::new("Hello "), raw: Atom::new("Hello ") }),
          JSXElementChild::JSXExprContainer(JSXExprContainer {
            span: DUMMY_SP,
            expr: JSXExpr::Expr(Box::new(Expr::Ident(Ident { span: DUMMY_SP, sym: Atom::new("name"), optional: false, ctxt: SyntaxContext::empty() }))),
          }),
        ],
        closing: Some(JSXClosingElement {
          span: DUMMY_SP,
          name: JSXElementName::Ident(Ident { span: DUMMY_SP, sym: Atom::new("T"), optional: false, ctxt: SyntaxContext::empty() }),
        }),
      };

      visitor.track_hash_attributes(&mut element);
      let counter_id = visitor.string_collector.get_counter();
      let translation_jsx = visitor.string_collector.get_translation_jsx(counter_id);
      assert!(translation_jsx.is_some());
      assert_eq!(translation_jsx.unwrap().hash, "");
    }

    #[test]
    fn autoderive_on_number_literal_child_produces_nonempty_hash() {
      let mut visitor = TransformVisitor::new(
        LogLevel::Silent, true, None, false, true, StringCollector::new(),
      );
      visitor.import_tracker.scope_tracker
        .track_translation_variable(Atom::new("T"), Atom::new("T"));

      let mut element = JSXElement {
        span: DUMMY_SP,
        opening: JSXOpeningElement {
          span: DUMMY_SP,
          name: JSXElementName::Ident(Ident { span: DUMMY_SP, sym: Atom::new("T"), optional: false, ctxt: SyntaxContext::empty() }),
          attrs: vec![], self_closing: false, type_args: None,
        },
        children: vec![
          JSXElementChild::JSXExprContainer(JSXExprContainer {
            span: DUMMY_SP,
            expr: JSXExpr::Expr(Box::new(Expr::Lit(Lit::Num(Number { span: DUMMY_SP, value: 42.0, raw: None })))),
          }),
        ],
        closing: Some(JSXClosingElement {
          span: DUMMY_SP,
          name: JSXElementName::Ident(Ident { span: DUMMY_SP, sym: Atom::new("T"), optional: false, ctxt: SyntaxContext::empty() }),
        }),
      };

      visitor.track_hash_attributes(&mut element);
      let counter_id = visitor.string_collector.get_counter();
      let translation_jsx = visitor.string_collector.get_translation_jsx(counter_id);
      assert!(translation_jsx.is_some());
      let hash = &translation_jsx.unwrap().hash;
      assert!(!hash.is_empty(), "number literal is allowed content — should produce non-empty hash");
      assert_eq!(hash.len(), 16);
    }

    #[test]
    fn autoderive_on_3_level_deep_nesting_produces_empty_hash() {
      let mut visitor = TransformVisitor::new(
        LogLevel::Silent, true, None, false, true, StringCollector::new(),
      );
      visitor.import_tracker.scope_tracker
        .track_translation_variable(Atom::new("T"), Atom::new("T"));

      let mut element = JSXElement {
        span: DUMMY_SP,
        opening: JSXOpeningElement {
          span: DUMMY_SP,
          name: JSXElementName::Ident(Ident { span: DUMMY_SP, sym: Atom::new("T"), optional: false, ctxt: SyntaxContext::empty() }),
          attrs: vec![], self_closing: false, type_args: None,
        },
        children: vec![JSXElementChild::JSXElement(Box::new(JSXElement {
          span: DUMMY_SP,
          opening: JSXOpeningElement {
            span: DUMMY_SP,
            name: JSXElementName::Ident(Ident { span: DUMMY_SP, sym: Atom::new("div"), optional: false, ctxt: SyntaxContext::empty() }),
            attrs: vec![], self_closing: false, type_args: None,
          },
          children: vec![JSXElementChild::JSXElement(Box::new(JSXElement {
            span: DUMMY_SP,
            opening: JSXOpeningElement {
              span: DUMMY_SP,
              name: JSXElementName::Ident(Ident { span: DUMMY_SP, sym: Atom::new("span"), optional: false, ctxt: SyntaxContext::empty() }),
              attrs: vec![], self_closing: false, type_args: None,
            },
            children: vec![JSXElementChild::JSXExprContainer(JSXExprContainer {
              span: DUMMY_SP,
              expr: JSXExpr::Expr(Box::new(Expr::Ident(Ident { span: DUMMY_SP, sym: Atom::new("name"), optional: false, ctxt: SyntaxContext::empty() }))),
            })],
            closing: Some(JSXClosingElement {
              span: DUMMY_SP,
              name: JSXElementName::Ident(Ident { span: DUMMY_SP, sym: Atom::new("span"), optional: false, ctxt: SyntaxContext::empty() }),
            }),
          }))],
          closing: Some(JSXClosingElement {
            span: DUMMY_SP,
            name: JSXElementName::Ident(Ident { span: DUMMY_SP, sym: Atom::new("div"), optional: false, ctxt: SyntaxContext::empty() }),
          }),
        }))],
        closing: Some(JSXClosingElement {
          span: DUMMY_SP,
          name: JSXElementName::Ident(Ident { span: DUMMY_SP, sym: Atom::new("T"), optional: false, ctxt: SyntaxContext::empty() }),
        }),
      };

      visitor.track_hash_attributes(&mut element);
      let counter_id = visitor.string_collector.get_counter();
      let translation_jsx = visitor.string_collector.get_translation_jsx(counter_id);
      assert!(translation_jsx.is_some());
      assert_eq!(translation_jsx.unwrap().hash, "");
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
          },
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
        value: Atom::new("hello").into(),
        raw: None,
      }));
      let var_declarator = create_var_declarator("message", string_literal);

      visitor.track_variable_assignment(&var_declarator);

      // Should not track non-function assignments in scope tracker
      assert!(visitor
        .import_tracker
        .scope_tracker
        .get_translation_variable(&Atom::new("message"))
        .is_none());
    }

    #[test]
    fn ignores_non_tracked_function_assignments() {
      let mut visitor = create_visitor_with_imports();
      let var_declarator = create_var_declarator("result", create_function_call("useState"));

      visitor.track_variable_assignment(&var_declarator);

      // Should not track non-translation functions in scope tracker
      assert!(visitor
        .import_tracker
        .scope_tracker
        .get_translation_variable(&Atom::new("result"))
        .is_none());
    }
  }

  mod translation_function_calls {
    use super::*;
    use swc_core::ecma::visit::{FoldWith, VisitMutWith};

    fn ident(name: &str) -> Ident {
      Ident {
        span: DUMMY_SP,
        sym: Atom::new(name),
        optional: false,
        ctxt: SyntaxContext::empty(),
      }
    }

    fn call(callee: &str, args: Vec<ExprOrSpread>) -> Expr {
      Expr::Call(CallExpr {
        span: DUMMY_SP,
        callee: Callee::Expr(Box::new(Expr::Ident(ident(callee)))),
        args,
        type_args: None,
        ctxt: SyntaxContext::empty(),
      })
    }

    fn import(source: &str, name: &str) -> ModuleItem {
      ModuleItem::ModuleDecl(ModuleDecl::Import(create_import_decl(
        source,
        vec![create_named_import(name, None)],
      )))
    }

    fn const_decl(name: &str, init: Expr) -> ModuleItem {
      ModuleItem::Stmt(Stmt::Decl(Decl::Var(Box::new(VarDecl {
        span: DUMMY_SP,
        ctxt: SyntaxContext::empty(),
        kind: VarDeclKind::Const,
        declare: false,
        decls: vec![VarDeclarator {
          span: DUMMY_SP,
          name: Pat::Ident(BindingIdent {
            id: ident(name),
            type_ann: None,
          }),
          init: Some(Box::new(init)),
          definite: false,
        }],
      }))))
    }

    /// import { useGT } from 'gt-next';
    /// import { getGT } from 'gt-next/server';
    /// const t = useGT();
    /// const serverT = await getGT();
    /// t({ context: 'button' })`Save`;
    #[test]
    fn leaves_use_gt_and_get_gt_tags_untouched() {
      let options = Expr::Object(ObjectLit {
        span: DUMMY_SP,
        props: vec![PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
          key: PropName::Ident(IdentName {
            span: DUMMY_SP,
            sym: Atom::new("context"),
          }),
          value: Box::new(Expr::Lit(Lit::Str(Str {
            span: DUMMY_SP,
            value: Atom::new("button").into(),
            raw: None,
          }))),
        })))],
      });
      let tagged_template = Expr::TaggedTpl(TaggedTpl {
        span: DUMMY_SP,
        ctxt: SyntaxContext::empty(),
        tag: Box::new(call(
          "t",
          vec![ExprOrSpread {
            spread: None,
            expr: Box::new(options),
          }],
        )),
        type_params: None,
        tpl: Box::new(Tpl {
          span: DUMMY_SP,
          exprs: vec![],
          quasis: vec![TplElement {
            span: DUMMY_SP,
            tail: true,
            cooked: Some(Atom::new("Save").into()),
            raw: Atom::new("Save"),
          }],
        }),
      });
      let source = Module {
        span: DUMMY_SP,
        body: vec![
          import("gt-next", "useGT"),
          import("gt-next/server", "getGT"),
          const_decl("t", call("useGT", vec![])),
          const_decl(
            "serverT",
            Expr::Await(AwaitExpr {
              span: DUMMY_SP,
              arg: Box::new(call("getGT", vec![])),
            }),
          ),
          ModuleItem::Stmt(Stmt::Expr(ExprStmt {
            span: DUMMY_SP,
            expr: Box::new(tagged_template),
          })),
        ],
        shebang: None,
      };

      // The two passes of process_transform
      let mut module = source.clone();
      let mut observer =
        TransformVisitor::new(LogLevel::Silent, true, None, false, false, StringCollector::new());
      module.visit_mut_with(&mut observer);
      assert_eq!(observer.statistics.dynamic_content_violations, 0);

      let mut injector = TransformVisitor::new(
        LogLevel::Silent,
        true,
        None,
        false,
        false,
        observer.string_collector,
      );
      assert_eq!(module.fold_with(&mut injector), source);
    }
  }

  mod hash_calculation {
    use super::*;

    #[test]
    fn calculates_hash_for_empty_element() {
      let mut visitor =
        TransformVisitor::new(LogLevel::Silent, false, None, false, false, StringCollector::new());
      let element = create_jsx_element("T", vec![]);

      let mut traversal = crate::ast::JsxTraversal::new(&mut visitor);
      let (hash, json_string) = traversal.calculate_element_hash(&element);

      assert!(!hash.is_empty());
      assert!(!json_string.is_empty());
      assert!(json_string.contains("JSX"));
    }

    #[test]
    fn hash_changes_with_different_content() {
      let mut visitor =
        TransformVisitor::new(LogLevel::Silent, false, None, false, false, StringCollector::new());

      let element1 = create_jsx_element("T", vec![]);
      let mut element2 = create_jsx_element("T", vec![]);
      element2.children = vec![JSXElementChild::JSXText(JSXText {
        span: DUMMY_SP,
        value: Atom::new("Hello"),
        raw: Atom::new("Hello"),
      })];

      let mut traversal1 = crate::ast::JsxTraversal::new(&mut visitor);
      let (hash1, _) = traversal1.calculate_element_hash(&element1);

      let mut traversal2 = crate::ast::JsxTraversal::new(&mut visitor);
      let (hash2, _) = traversal2.calculate_element_hash(&element2);

      assert_ne!(hash1, hash2);
    }

  }

  mod imports_after_use {
    use super::*;
    use swc_core::ecma::visit::{FoldWith, VisitMutWith};

    /// function Greeting() { return <tag>Hello</tag>; }
    fn greeting(mut element: JSXElement) -> ModuleItem {
      element.children = vec![JSXElementChild::JSXText(JSXText {
        span: DUMMY_SP,
        value: Atom::new("Hello"),
        raw: Atom::new("Hello"),
      })];
      ModuleItem::Stmt(Stmt::Decl(Decl::Fn(FnDecl {
        ident: Ident::new("Greeting".into(), DUMMY_SP, SyntaxContext::empty()),
        declare: false,
        function: Box::new(Function {
          params: vec![],
          decorators: vec![],
          span: DUMMY_SP,
          ctxt: SyntaxContext::empty(),
          body: Some(BlockStmt {
            span: DUMMY_SP,
            ctxt: SyntaxContext::empty(),
            stmts: vec![Stmt::Return(ReturnStmt {
              span: DUMMY_SP,
              arg: Some(Box::new(Expr::JSXElement(Box::new(element)))),
            })],
          }),
          is_generator: false,
          is_async: false,
          type_params: None,
          return_type: None,
        }),
      })))
    }

    fn transform(body: Vec<ModuleItem>) -> Module {
      let mut module = Module {
        span: DUMMY_SP,
        body,
        shebang: None,
      };
      let mut observer = TransformVisitor::new(
        LogLevel::Silent,
        true,
        None,
        false,
        false,
        StringCollector::new(),
      );
      module.visit_mut_with(&mut observer);
      let mut injector = TransformVisitor::new(
        LogLevel::Silent,
        true,
        None,
        false,
        false,
        observer.string_collector,
      );
      module.fold_with(&mut injector)
    }

    fn hash_attr(item: &ModuleItem) -> Option<JSXAttrOrSpread> {
      let ModuleItem::Stmt(Stmt::Decl(Decl::Fn(fn_decl))) = item else {
        panic!("expected the Greeting function");
      };
      let stmts = &fn_decl.function.body.as_ref()?.stmts;
      let Some(Stmt::Return(ReturnStmt { arg: Some(arg), .. })) = stmts.first() else {
        panic!("expected a return statement");
      };
      let Expr::JSXElement(element) = arg.as_ref() else {
        panic!("expected a JSX element");
      };
      element
        .opening
        .attrs
        .iter()
        .find(|attr| {
          matches!(
            attr,
            JSXAttrOrSpread::JSXAttr(JSXAttr { name: JSXAttrName::Ident(name), .. })
              if name.sym == "_hash"
          )
        })
        .cloned()
    }

    /// An import below the component that renders <T> still gets the hash it
    /// gets above it, because import declarations are hoisted
    #[test]
    fn hashes_t_rendered_above_its_gt_next_import() {
      let cases = [
        (
          "named",
          create_jsx_element("T", vec![]),
          create_named_import("T", None),
        ),
        (
          "aliased",
          create_jsx_element("Translate", vec![]),
          create_named_import("Translate", Some("T")),
        ),
        (
          "namespace",
          create_jsx_member_element("GT", "T"),
          create_namespace_import("GT"),
        ),
      ];
      let mut missing = vec![];
      for (kind, element, specifier) in cases {
        let import = ModuleItem::ModuleDecl(ModuleDecl::Import(create_import_decl(
          "gt-next",
          vec![specifier],
        )));
        let import_first = transform(vec![import.clone(), greeting(element.clone())]);
        let import_last = transform(vec![greeting(element), import]);

        let expected = hash_attr(&import_first.body[1]);
        assert!(
          expected.is_some(),
          "expected a _hash with the {kind} import first"
        );
        if hash_attr(&import_last.body[0]) != expected {
          missing.push(kind);
        }
      }
      assert!(
        missing.is_empty(),
        "no _hash with the import last: {missing:?}"
      );
    }
  }

  mod integration_tests {
    use super::*;
    use crate::visitor::errors::create_dynamic_content_warning;

    #[test]
    fn full_workflow_with_imports_and_component_detection() {
      let mut visitor = TransformVisitor::new(
        LogLevel::Silent,
        false,
        Some("test.tsx".to_string()),
        false,
        false,
        StringCollector::new(),
      );

      // Process imports
      let import_decl = create_import_decl(
        "gt-next",
        vec![
          create_named_import("T", None),
          create_named_import("CustomVar", Some("Var")),
          create_namespace_import("GT"),
        ],
      );
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
      let warning = create_dynamic_content_warning(Some("test.tsx"), "T");
      assert!(warning.contains("in test.tsx"));
    }
  }
}
