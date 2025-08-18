use std::collections::{BTreeMap};
use swc_core::ecma::{
    ast::*,
    atoms::Atom,
};
use crate::hash::{
    SanitizedChildren, SanitizedChild, SanitizedElement, SanitizedGtProp, 
    SanitizedVariable, VariableType, HtmlContentProps
};
use crate::TransformVisitor;
use crate::ast::utilities::{
    get_tag_name,
    get_variable_type,
    js_number_to_string,
    extract_html_content_props,
    filter_jsx_children,
    build_sanitized_text_content,
};
use crate::ast::constants::PLURAL_FORMS;

/// Information about a GT component extracted during analysis
#[derive(Default)]
struct ComponentInfo {
    is_gt_component: bool,
    transformation: Option<String>,
    variable_type: Option<VariableType>,
    branches: Option<BTreeMap<String, Box<SanitizedChild>>>,
}


/// AST traversal for converting JSX to sanitized GT objects
pub struct JsxTraversal<'a> {
    visitor: &'a TransformVisitor,
    id_counter: u32,
}


impl<'a> JsxTraversal<'a> {
    pub fn new(visitor: &'a TransformVisitor) -> Self {
        Self { visitor, id_counter: 0 }
    }
    

    /// Build sanitized children objects directly from JSX children
    pub fn build_sanitized_children(&mut self, children: &[JSXElementChild]) -> Option<SanitizedChildren> {
        let filtered_children = filter_jsx_children(children);

        // If there are no children, return None
        if filtered_children.is_empty() {
            return None;
        }

        if filtered_children.len() == 1 {
            let child = filtered_children.first().unwrap();
            return self.build_sanitized_child(child, true, true)
                .map(|child| SanitizedChildren::Single(Box::new(child)));
        }

        let sanitized_children: Vec<SanitizedChild> = filtered_children
            .iter()
            .enumerate()
            .filter_map(|(index, child)| {
                self.build_sanitized_child(child, index == 0, index == filtered_children.len() - 1)
            })
            .collect();

        Some(SanitizedChildren::Multiple(sanitized_children))
    }

    /// Build a sanitized child with a specific counter context (for branches)
    fn build_sanitized_child_with_counter(&mut self, child: &JSXElementChild, counter: u32, is_first_sibling: bool, is_last_sibling: bool) -> Option<SanitizedChild> {
        let saved_counter = self.id_counter;
        self.id_counter = counter;
        let result = self.build_sanitized_child(child, is_first_sibling, is_last_sibling);
        self.id_counter = saved_counter;
        result
    }

    /// Build sanitized children with a specific counter context (for branches)
    fn build_sanitized_children_with_counter(&mut self, children: &[JSXElementChild], counter: u32) -> Option<SanitizedChildren> {
        let saved_counter = self.id_counter;
        self.id_counter = counter;
        let result = self.build_sanitized_children(children);
        self.id_counter = saved_counter;
        result
    }

    fn build_sanitized_text(&mut self, text: &JSXText) -> Option<SanitizedChild> {
        // Normalize whitespace like JS
        let normalized = build_sanitized_text_content(text);

        // Return the normalized text
        if let Some(text) = normalized {
            Some(text)
        } else {
            None
        }
    }

    /// Build a sanitized child directly from JSX child
    pub fn build_sanitized_child(&mut self, child: &JSXElementChild, is_first_sibling: bool, is_last_sibling: bool) -> Option<SanitizedChild> {
        match child {
            JSXElementChild::JSXText(text) => self.build_sanitized_text(text),
            JSXElementChild::JSXFragment(fragment) => {
                // Increment counter for each JSX element we encounter
                self.id_counter += 1;
                
                // Check if children are present
                if let Some(children) = self.build_sanitized_children(&fragment.children) {
                    let wrapped_children = SanitizedChildren::Wrapped { c: Box::new(children) };
                    Some(SanitizedChild::Fragment(Box::new(wrapped_children)))
                } else {
                    let empty_element = SanitizedElement {
                        b: None,
                        c: None,
                        t: None,
                        d: None,
                    };
                    Some(SanitizedChild::Element(Box::new(empty_element)))
                }
            }
            JSXElementChild::JSXElement(element) => {
                // Increment counter for each JSX element we encounter
                self.id_counter += 1;
                
                // Check if this is a variable component first (Var, Num, Currency, DateTime)
                if let Some(variable) = self.build_sanitized_variable(element) {
                    Some(SanitizedChild::Variable(variable))
                } else {
                    // Build as element (includes Branch/Plural components with branches)
                    self.build_sanitized_element(element).map(|el| SanitizedChild::Element(Box::new(el)))
                }
            }
            JSXElementChild::JSXExprContainer(expr_container) => self.build_sanitized_child_from_jsx_expr(&expr_container.expr, !(is_first_sibling && is_last_sibling), false),
            _ => None, // Skip fragments and other types for now
        }
    }


    /// Check if a Plural component is valid
    fn is_valid_plural_component(&self, element: &JSXElement, component_info: &ComponentInfo) -> bool {
    // Check if component has required 'n' attribute
      let has_n_attr = element.opening.attrs.iter().any(|attr| {
        if let JSXAttrOrSpread::JSXAttr(jsx_attr) = attr {
            if let JSXAttrName::Ident(name_ident) = &jsx_attr.name {
                return name_ident.sym.as_ref() == "n";
            }
        }
        false
    });

    if !has_n_attr {
        return false;
    }

    // Check if has valid branches OR children
    if component_info.branches.is_none() && element.children.is_empty() {
        // eprintln!("DEBUG: Excluding Plural component - no valid plural forms and no children");
        return false;
    }

    return true;
    }

    /// Check if a Branch component is valid
    fn is_valid_branch_component(&self, element: &JSXElement, component_info: &ComponentInfo) -> bool {
        // Check if component has required 'branch' attribute
      let has_branch_attr = element.opening.attrs.iter().any(|attr| {
        if let JSXAttrOrSpread::JSXAttr(jsx_attr) = attr {
            if let JSXAttrName::Ident(name_ident) = &jsx_attr.name {
                return name_ident.sym.as_ref() == "branch";
            }
        }
        false
    });

    if !has_branch_attr {
        // eprintln!("DEBUG: Excluding Branch component - missing 'branch' attribute");
        return false;
    }

    // Check if has valid branches OR children  
    if component_info.branches.is_none() && element.children.is_empty() {
        // eprintln!("DEBUG: Excluding Branch component - no valid branch options and no children");
        return false;
    }

    return true;
    }

    /// Build a sanitized element directly from JSX element
    pub fn build_sanitized_element(&mut self, element: &JSXElement) -> Option<SanitizedElement> {
        let tag_name = get_tag_name(&element.opening.name)?;
        
        // Check if this is a GT component
        let component_info = self.analyze_gt_component(&tag_name, &element.opening.attrs);
        
        // Variable components should be handled as SanitizedVariable, not SanitizedElement
        if component_info.variable_type.is_some() {
            return None; // This will be handled by build_sanitized_variable
        }
        
        // Branch and Plural components are handled as SanitizedElements with branches

        let mut sanitized_element = SanitizedElement {
            b: None, // Will be set for Branch/Plural components
            c: None,
            t: None, // Will be set based on component type
            d: None,
        };

        // Build children directly as sanitized
        if !element.children.is_empty() {
            sanitized_element.c = self.build_sanitized_children(&element.children).map(Box::new);
        }

        // Handle different component types
        if component_info.is_gt_component {

            if self.is_plural_component(&tag_name) {
                if !self.is_valid_plural_component(&element, &component_info) {
                    return None;
                }
                if let Some(branches) = component_info.branches {
                    sanitized_element.b = Some(branches);
                }
                sanitized_element.t = component_info.transformation;
            } else if self.is_branch_component(&tag_name) {
                if !self.is_valid_branch_component(&element, &component_info) {
                    return None;
                }
                if let Some(branches) = component_info.branches {
                    sanitized_element.b = Some(branches);
                }
                sanitized_element.t = component_info.transformation;
            }
             else {
                // Handle other GT components (T, etc.) with GT data
                let gt_prop = SanitizedGtProp {
                    b: component_info.branches,
                    t: component_info.transformation,
                    html_props: extract_html_content_props(&element.opening.attrs),
                };
                sanitized_element.d = Some(gt_prop);
                sanitized_element.t = Some(tag_name.clone());
            }
        } else {
            // For non-GT elements, create empty placeholder to match runtime {}
            sanitized_element.t = None;
        }

        Some(sanitized_element)
    }

    /// Build a sanitized variable directly from JSX element
    fn build_sanitized_variable(&mut self, element: &JSXElement) -> Option<SanitizedVariable> {
        let tag_name = get_tag_name(&element.opening.name)?;
        let component_info = self.analyze_gt_component(&tag_name, &element.opening.attrs);
        
        if let Some(var_type) = component_info.variable_type {
            // Extract variable name from children or attributes with proper prefix
            let variable_key = self.extract_variable_key(element, &var_type);
            
            Some(SanitizedVariable {
                k: Some(variable_key),
                v: Some(var_type),
                t: None,
            })
        } else {
            None
        }
    }

    /// Extract variable key from JSX element (from children or name attribute)
    fn extract_variable_key(&mut self, element: &JSXElement, var_type: &VariableType) -> String {
        // First, check for a 'name' attribute
        for attr in &element.opening.attrs {
            if let JSXAttrOrSpread::JSXAttr(jsx_attr) = attr {
                if let JSXAttrName::Ident(name_ident) = &jsx_attr.name {
                    if name_ident.sym.as_ref() == "name" {
                        if let Some(JSXAttrValue::Lit(Lit::Str(str_lit))) = &jsx_attr.value {
                            if !str_lit.value.is_empty() {
                                return str_lit.value.to_string();
                            }
                        }
                    }
                }
            }
        }

        // Fallback: generate proper key based on variable type with current counter
        match var_type {
            VariableType::Number => format!("_gt_n_{}", self.id_counter),
            VariableType::Currency => format!("_gt_cost_{}", self.id_counter),
            VariableType::Date => format!("_gt_date_{}", self.id_counter),
            VariableType::Variable => format!("_gt_value_{}", self.id_counter),
        }
    }

    /// Check if this is a Branch component
    pub fn is_branch_component(&self, tag_name: &str) -> bool {

        // Named import
        if let Some(original_name) = self.visitor.import_tracker.branch_import_aliases.get(&Atom::from(tag_name)) {
            if original_name == "Branch" {
                return true;
            }
        }

        // Namespace import
        if tag_name.ends_with(".Branch") {
            let namespace = tag_name.split('.').next().unwrap_or("");
            if self.visitor.import_tracker.namespace_imports.contains(&Atom::from(namespace)) {
                return true;
            }
        }

        return false;
    }

    pub fn is_plural_component(&self, tag_name: &str) -> bool {
        // Named import
        if let Some(original_name) = self.visitor.import_tracker.branch_import_aliases.get(&Atom::from(tag_name)) {
            if original_name == "Plural" {
                return true;
            }
        }

        // Namespace import
        if tag_name.ends_with(".Plural"){
            let namespace = tag_name.split('.').next().unwrap_or("");
            if self.visitor.import_tracker.namespace_imports.contains(&Atom::from(namespace)) {
                return true;
            }
        }

        return false;
    }

    /// Analyze if this is a GT component and extract relevant info
    fn analyze_gt_component(&mut self, tag_name: &str, attrs: &[JSXAttrOrSpread]) -> ComponentInfo {
        let mut info = ComponentInfo::default();

        // Check if it's a known GT component
        if self.visitor.should_track_component_as_translation(&Atom::from(tag_name)) {
            info.is_gt_component = true;
        } else if self.visitor.should_track_component_as_branch(&Atom::from(tag_name)) {
            // Branch and Plural components
            info.is_gt_component = true;

            // Determine transformation type
            if self.is_branch_component(tag_name) {
                info.transformation = Some(String::from("b"));
                info.branches = self.extract_branch_props(attrs);
            } else if self.is_plural_component(tag_name) {
                info.transformation = Some(String::from("p"));
                info.branches = self.extract_plural_props(attrs);
            }
        } else if self.visitor.should_track_component_as_variable(&Atom::from(tag_name)) {
            info.is_gt_component = true;
            info.transformation = Some("v".to_string());
            info.variable_type = Some(get_variable_type(tag_name));
        }

        // Handle namespace components (GT.T, GT.Var, etc.)
        // TODO: rework a better way of checking, more modular
        if tag_name.contains('.') {
            let parts: Vec<&str> = tag_name.split('.').collect();
            if parts.len() == 2 {
                let (namespace, component) = (parts[0], parts[1]);
                let namespace_atom = Atom::from(namespace);
                let component_atom = Atom::from(component);
                
                let (is_translation, is_variable, is_branch) = self.visitor.should_track_namespace_component(&namespace_atom, &component_atom);
                
                if is_translation {
                    info.is_gt_component = true;
                } else if is_branch {
                    info.is_gt_component = true;
                    match component {
                        "Branch" => {
                            info.transformation = Some("b".to_string());
                            info.branches = self.extract_branch_props(attrs);
                        }
                        "Plural" => {
                            info.transformation = Some("p".to_string());
                            info.branches = self.extract_plural_props(attrs);
                        }
                        _ => {
                            info.transformation = Some("fragment".to_string());
                        }
                    }
                } else if is_variable {
                    info.is_gt_component = true;
                    info.transformation = Some("v".to_string());
                    info.variable_type = Some(get_variable_type(component));
                }
            }
        }

        info
    }

    /// Extract branch props from Branch component attributes
    fn extract_branch_props(&mut self, attrs: &[JSXAttrOrSpread]) -> Option<BTreeMap<String, Box<SanitizedChild>>> {
        let mut branches = BTreeMap::new();

        for attr in attrs {
            if let JSXAttrOrSpread::JSXAttr(jsx_attr) = attr {
                if let JSXAttrName::Ident(name_ident) = &jsx_attr.name {
                    let prop_name = name_ident.sym.as_ref();
                    
                    // Skip special props
                    if matches!(prop_name, "branch") {
                        continue;
                    }

                    // Build sanitized branch content directly
                    if let Some(value) = &jsx_attr.value {
                        if let Some(sanitized_children) = self.build_sanitized_child_from_attr_value(value) {
                            branches.insert(prop_name.to_string(), Box::new(sanitized_children));
                        }
                    }
                }
            }
        }

        if branches.is_empty() {
            None
        } else {
            Some(branches)
        }
    }

    /// Extract plural props from Plural component attributes
    fn extract_plural_props(&mut self, attrs: &[JSXAttrOrSpread]) -> Option<BTreeMap<String, Box<SanitizedChild>>> {
        let mut branches = BTreeMap::new();

        for attr in attrs {
            if let JSXAttrOrSpread::JSXAttr(jsx_attr) = attr {
                if let JSXAttrName::Ident(name_ident) = &jsx_attr.name {
                    let prop_name = name_ident.sym.as_ref();
                    
                    // Only include valid plural forms
                    if PLURAL_FORMS.contains(prop_name) {
                        if let Some(value) = &jsx_attr.value {
                            if let Some(sanitized_children) = self.build_sanitized_child_from_attr_value(value) {
                                branches.insert(prop_name.to_string(), Box::new(sanitized_children));
                            }
                        }
                    }
                }
            }
        }

        if branches.is_empty() {
            None
        } else {
            Some(branches)
        }
    }

    /// Build sanitized children directly from JSX attribute value
    fn build_sanitized_child_from_attr_value(&mut self, value: &JSXAttrValue) -> Option<SanitizedChild> {
        match value {
            JSXAttrValue::Lit(Lit::Str(str_lit)) => {
                let content = str_lit.value.to_string();
                Some(SanitizedChild::Text(content))
            }
            JSXAttrValue::JSXExprContainer(expr_container) => self.build_sanitized_child_from_jsx_expr(&expr_container.expr, false, true),
            _ => None, // Skip fragments and other types for now
        }
    }

    /// Build sanitized JSXchild from JSX container
    fn build_sanitized_child_from_jsx_expr(&mut self, jsx_expr: &JSXExpr, has_siblings: bool, is_attribute: bool) -> Option<SanitizedChild> {
        match jsx_expr {
            JSXExpr::Expr(expr) => {
                match expr.as_ref() {
                    Expr::Lit(Lit::Bool(bool_lit)) => {
                        if is_attribute {
                            Some(SanitizedChild::Boolean(bool_lit.value))
                        } else {
                            if bool_lit.value && !has_siblings {
                                // Yeah i know this is dumb, but it's what runtime does
                                Some(SanitizedChild::Boolean(true))
                            } else {
                                None
                            }
                        }
                    },
                    Expr::Lit(Lit::Null(_)) => {
                        if is_attribute {
                            Some(SanitizedChild::Null(None))
                        } else {
                            None
                        }
                    },
                    Expr::JSXFragment(fragment) => {
                        // Fragment becomes one SanitizedChild::Fragment containing its children
                        let children_option = if is_attribute {
                            self.build_sanitized_children_with_counter(&fragment.children, self.id_counter + 1)
                        } else {
                            self.build_sanitized_children(&fragment.children)
                        };

                        match children_option {
                            Some(children) => Some(SanitizedChild::Fragment(Box::new(
                                SanitizedChildren::Wrapped { c: Box::new(children) }
                            ))),
                            None => {
                                // Empty fragment should return empty object structure, not None
                                let empty_element = SanitizedElement {
                                    b: None,
                                    c: None,
                                    t: None,
                                    d: None,
                                };
                                Some(SanitizedChild::Element(Box::new(empty_element)))
                            }
                        }
                    }
                    Expr::JSXElement(element) => {
                        if is_attribute {
                            self.build_sanitized_child_with_counter(
                                &JSXElementChild::JSXElement(element.clone()),
                                self.id_counter,
                                true,
                                true,
                            )
                        } else {
                            self.build_sanitized_child(
                                &JSXElementChild::JSXElement(element.clone()),
                                true,
                                true
                            )
                        }
                    }
                    Expr::Lit(Lit::Str(str_lit)) => Some(SanitizedChild::Text(str_lit.value.to_string())),
                    Expr::Lit(Lit::Num(num_lit)) => Some(SanitizedChild::Text(js_number_to_string(num_lit.value))),
                    Expr::Unary(UnaryExpr { op, arg, .. }) => {
                        if let Expr::Lit(Lit::Num(num_lit)) = arg.as_ref() {
                            match op {
                                UnaryOp::Minus => {
                                    let negative_num = -num_lit.value;
                                    if negative_num == 0.0 {
                                        Some(SanitizedChild::Text(js_number_to_string(num_lit.value)))
                                    } else {
                                        Some(SanitizedChild::Text(js_number_to_string(negative_num)))
                                    }
                                }
                                UnaryOp::Plus => {
                                    Some(SanitizedChild::Text(js_number_to_string(num_lit.value)))
                                }
                                _ => None,
                            }
                        } else {
                            None
                        }
                    }
                    Expr::Tpl(tpl) => {
                        if tpl.exprs.is_empty() && tpl.quasis.len() == 1 {
                            if let Some(quasi) = tpl.quasis.first() {
                                if let Some(cooked) = &quasi.cooked {
                                    let content = cooked.to_string();
                                    Some(SanitizedChild::Text(content))
                                } else {
                                    let content = quasi.raw.to_string();
                                    Some(SanitizedChild::Text(content))
                                }
                            } else {
                                None
                            }
                        } else {
                            None
                        }
                    }
                    Expr::Ident(ident) => {
                        match ident.sym.as_ref() {
                            "NaN" => Some(SanitizedChild::Text("NaN".to_string())),
                            "Infinity" => Some(SanitizedChild::Text("Infinity".to_string())),
                            "undefined" => None,
                            _ => None,
                        }
                    }
                    _ => {
                        None
                    }
                }
            }
            JSXExpr::JSXEmptyExpr(_) => {
                // Handle {} empty expressions - should return empty object
                None
            }
        }
    }

}

impl Default for HtmlContentProps {
    fn default() -> Self {
        Self {
            pl: None,
            ti: None,
            alt: None,
            arl: None,
            arb: None,
            ard: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use swc_core::common::{DUMMY_SP, SyntaxContext};
    use swc_core::ecma::atoms::Atom;
    use crate::visitor::state::{Statistics, TraversalState, ImportTracker};
    use crate::config::PluginSettings;
    use crate::logging::{LogLevel, Logger};
    
    // Helper to create test visitor
    fn create_test_visitor() -> TransformVisitor {
        TransformVisitor {
            statistics: Statistics::default(),
            traversal_state: TraversalState::default(),
            import_tracker: ImportTracker::default(),
            settings: PluginSettings::new(LogLevel::Silent, false, None),
            logger: Logger::new(LogLevel::Silent),
        }
    }

    // Helper to create JSX text
    fn create_jsx_text(content: &str) -> JSXText {
        JSXText {
            span: DUMMY_SP,
            value: Atom::new(content),
            raw: Atom::new(content),
        }
    }

    // Helper to create JSX element child from text
    fn create_jsx_text_child(content: &str) -> JSXElementChild {
        JSXElementChild::JSXText(create_jsx_text(content))
    }

    // Helper to create empty JSX element
    fn create_jsx_element(tag_name: &str) -> JSXElement {
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
                attrs: vec![],
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

    mod jsx_traversal_creation {
        use super::*;

        #[test]
        fn creates_new_traversal() {
            let visitor = create_test_visitor();
            let traversal = JsxTraversal::new(&visitor);
            assert_eq!(traversal.id_counter, 0);
        }
    }

    mod build_sanitized_children {
        use super::*;

        #[test]
        fn handles_empty_children() {
            let visitor = create_test_visitor();
            let mut traversal = JsxTraversal::new(&visitor);
            let children = vec![];
            let result = traversal.build_sanitized_children(&children);
            assert!(result.is_none());
        }

        #[test]
        fn handles_single_text_child() {
            let visitor = create_test_visitor();
            let mut traversal = JsxTraversal::new(&visitor);
            let children = vec![create_jsx_text_child("hello")];
            let result = traversal.build_sanitized_children(&children);
            assert!(result.is_some());
            if let Some(SanitizedChildren::Single(child)) = result {
                if let SanitizedChild::Text(text) = child.as_ref() {
                    assert_eq!(text, "hello");
                } else {
                    panic!("Expected text child");
                }
            } else {
                panic!("Expected single child");
            }
        }

        #[test]
        fn handles_multiple_text_children() {
            let visitor = create_test_visitor();
            let mut traversal = JsxTraversal::new(&visitor);
            let children = vec![
                create_jsx_text_child("hello "),
                create_jsx_text_child("world"),
            ];
            let result = traversal.build_sanitized_children(&children);
            assert!(result.is_some());
            if let Some(SanitizedChildren::Multiple(children)) = result {
                assert_eq!(children.len(), 2);
            } else {
                panic!("Expected multiple children");
            }
        }
    }

    mod build_sanitized_text {
        use super::*;

        #[test]
        fn handles_simple_text() {
            let visitor = create_test_visitor();
            let mut traversal = JsxTraversal::new(&visitor);
            let text = create_jsx_text("hello world");
            let result = traversal.build_sanitized_text(&text);
            assert!(result.is_some());
            if let Some(SanitizedChild::Text(content)) = result {
                assert_eq!(content, "hello world");
            } else {
                panic!("Expected text content");
            }
        }

        #[test]
        fn handles_empty_text() {
            let visitor = create_test_visitor();
            let mut traversal = JsxTraversal::new(&visitor);
            let text = create_jsx_text("");
            let result = traversal.build_sanitized_text(&text);
            assert!(result.is_some()); // Empty text returns Some("")
        }
    }

    mod build_sanitized_element {
        use super::*;

        #[test]
        fn handles_simple_element() {
            let visitor = create_test_visitor();
            let mut traversal = JsxTraversal::new(&visitor);
            let element = create_jsx_element("div");
            let result = traversal.build_sanitized_element(&element);
            assert!(result.is_some());
            let sanitized = result.unwrap();
            assert!(sanitized.t.is_none()); // Non-GT elements have no type
            assert!(sanitized.c.is_none()); // No children
            assert!(sanitized.b.is_none()); // No branches
            assert!(sanitized.d.is_none()); // No GT data
        }

        #[test]
        fn handles_element_with_children() {
            let visitor = create_test_visitor();
            let mut traversal = JsxTraversal::new(&visitor);
            let mut element = create_jsx_element("div");
            element.children = vec![create_jsx_text_child("content")];
            let result = traversal.build_sanitized_element(&element);
            assert!(result.is_some());
            let sanitized = result.unwrap();
            assert!(sanitized.c.is_some()); // Has children
        }
    }

    mod component_type_detection {
        use super::*;

        #[test]
        fn detects_branch_component_basic() {
            let visitor = create_test_visitor();
            let traversal = JsxTraversal::new(&visitor);
            
            // Without any imports, should return false
            assert!(!traversal.is_branch_component("Branch"));
            assert!(!traversal.is_branch_component("CustomBranch"));
        }

        #[test]
        fn detects_plural_component_basic() {
            let visitor = create_test_visitor();
            let traversal = JsxTraversal::new(&visitor);
            
            // Without any imports, should return false
            assert!(!traversal.is_plural_component("Plural"));
            assert!(!traversal.is_plural_component("CustomPlural"));
        }

        #[test]
        fn detects_namespace_components() {
            let visitor = create_test_visitor();
            let traversal = JsxTraversal::new(&visitor);
            
            // Namespace components without imports should return false
            assert!(!traversal.is_branch_component("GT.Branch"));
            assert!(!traversal.is_plural_component("GT.Plural"));
        }
    }

    mod extract_variable_key {
        use super::*;

        #[test]
        fn generates_fallback_keys() {
            let visitor = create_test_visitor();
            let mut traversal = JsxTraversal::new(&visitor);
            let element = create_jsx_element("Var");
            
            // Test different variable types generate different keys
            let number_key = traversal.extract_variable_key(&element, &VariableType::Number);
            assert!(number_key.starts_with("_gt_n_"));
            
            let currency_key = traversal.extract_variable_key(&element, &VariableType::Currency);
            assert!(currency_key.starts_with("_gt_cost_"));
            
            let date_key = traversal.extract_variable_key(&element, &VariableType::Date);
            assert!(date_key.starts_with("_gt_date_"));
            
            let var_key = traversal.extract_variable_key(&element, &VariableType::Variable);
            assert!(var_key.starts_with("_gt_value_"));
        }
    }

    mod build_sanitized_child_from_jsx_expr {
        use super::*;

        fn create_string_expr(value: &str) -> JSXExpr {
            JSXExpr::Expr(Box::new(Expr::Lit(Lit::Str(Str {
                span: DUMMY_SP,
                value: Atom::new(value),
                raw: None,
            }))))
        }

        fn create_number_expr(value: f64) -> JSXExpr {
            JSXExpr::Expr(Box::new(Expr::Lit(Lit::Num(Number {
                span: DUMMY_SP,
                value,
                raw: None,
            }))))
        }

        fn create_boolean_expr(value: bool) -> JSXExpr {
            JSXExpr::Expr(Box::new(Expr::Lit(Lit::Bool(Bool {
                span: DUMMY_SP,
                value,
            }))))
        }

        fn create_null_expr() -> JSXExpr {
            JSXExpr::Expr(Box::new(Expr::Lit(Lit::Null(Null {
                span: DUMMY_SP,
            }))))
        }

        #[test]
        fn handles_string_literal() {
            let visitor = create_test_visitor();
            let mut traversal = JsxTraversal::new(&visitor);
            let expr = create_string_expr("hello");
            let result = traversal.build_sanitized_child_from_jsx_expr(&expr, false, false);
            assert!(result.is_some());
            if let Some(SanitizedChild::Text(text)) = result {
                assert_eq!(text, "hello");
            } else {
                panic!("Expected text content");
            }
        }

        #[test]
        fn handles_number_literal() {
            let visitor = create_test_visitor();
            let mut traversal = JsxTraversal::new(&visitor);
            let expr = create_number_expr(42.0);
            let result = traversal.build_sanitized_child_from_jsx_expr(&expr, false, false);
            assert!(result.is_some());
            if let Some(SanitizedChild::Text(text)) = result {
                assert_eq!(text, "42");
            } else {
                panic!("Expected text content");
            }
        }

        #[test]
        fn handles_boolean_in_attribute() {
            let visitor = create_test_visitor();
            let mut traversal = JsxTraversal::new(&visitor);
            let expr = create_boolean_expr(true);
            let result = traversal.build_sanitized_child_from_jsx_expr(&expr, false, true);
            assert!(result.is_some());
            if let Some(SanitizedChild::Boolean(value)) = result {
                assert_eq!(value, true);
            } else {
                panic!("Expected boolean content");
            }
        }

        #[test]
        fn handles_boolean_as_child() {
            let visitor = create_test_visitor();
            let mut traversal = JsxTraversal::new(&visitor);
            let expr = create_boolean_expr(true);
            let result = traversal.build_sanitized_child_from_jsx_expr(&expr, false, false);
            assert!(result.is_some()); // Single true child returns Some
            
            let expr_false = create_boolean_expr(false);
            let result_false = traversal.build_sanitized_child_from_jsx_expr(&expr_false, false, false);
            assert!(result_false.is_none()); // False child returns None
        }

        #[test]
        fn handles_null_in_attribute() {
            let visitor = create_test_visitor();
            let mut traversal = JsxTraversal::new(&visitor);
            let expr = create_null_expr();
            let result = traversal.build_sanitized_child_from_jsx_expr(&expr, false, true);
            assert!(result.is_some());
            if let Some(SanitizedChild::Null(_)) = result {
                // Expected null content
            } else {
                panic!("Expected null content");
            }
        }

        #[test]
        fn handles_null_as_child() {
            let visitor = create_test_visitor();
            let mut traversal = JsxTraversal::new(&visitor);
            let expr = create_null_expr();
            let result = traversal.build_sanitized_child_from_jsx_expr(&expr, false, false);
            assert!(result.is_none()); // Null children return None
        }

        #[test]
        fn handles_empty_expression() {
            let visitor = create_test_visitor();
            let mut traversal = JsxTraversal::new(&visitor);
            let expr = JSXExpr::JSXEmptyExpr(JSXEmptyExpr { span: DUMMY_SP });
            let result = traversal.build_sanitized_child_from_jsx_expr(&expr, false, false);
            assert!(result.is_none()); // Empty expressions return None
        }
    }

    mod counter_management {
        use super::*;

        #[test]
        fn counter_saves_and_restores() {
            let visitor = create_test_visitor();
            let mut traversal = JsxTraversal::new(&visitor);
            
            // Set initial counter
            traversal.id_counter = 5;
            let initial_counter = traversal.id_counter;
            
            // Call method that uses with_counter pattern
            let text_child = create_jsx_text_child("test");
            let _ = traversal.build_sanitized_child_with_counter(&text_child, 10, true, true);
            
            // Counter should be restored
            assert_eq!(traversal.id_counter, initial_counter);
        }
    }

    mod component_info_analysis {
        use super::*;

        #[test]
        fn analyzes_unknown_component() {
            let visitor = create_test_visitor();
            let mut traversal = JsxTraversal::new(&visitor);
            let attrs = vec![];
            let info = traversal.analyze_gt_component("div", &attrs);
            
            assert!(!info.is_gt_component);
            assert!(info.transformation.is_none());
            assert!(info.variable_type.is_none());
            assert!(info.branches.is_none());
        }

        #[test]
        fn analyzes_namespace_component() {
            let visitor = create_test_visitor();
            let mut traversal = JsxTraversal::new(&visitor);
            let attrs = vec![];
            let info = traversal.analyze_gt_component("GT.T", &attrs);
            
            // Without proper imports set up, should not detect as GT component
            assert!(!info.is_gt_component);
        }
    }
}
