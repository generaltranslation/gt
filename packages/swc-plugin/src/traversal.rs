use std::collections::BTreeMap;
use swc_core::ecma::{
    ast::*,
    atoms::Atom,
};
use crate::hash::{
    SanitizedChildren, SanitizedChild, SanitizedElement, SanitizedGtProp, 
    SanitizedVariable, VariableType, HtmlContentProps
};
use crate::TransformVisitor;
use crate::whitespace::{has_significant_whitespace, trim_normal_whitespace, is_normal_whitespace};

use std::collections::HashSet;
use std::sync::LazyLock;

static PLURAL_FORMS: LazyLock<HashSet<&'static str>> = LazyLock::new(|| {
    ["singular", "plural", "dual", "zero", "one", "two", "few", "many", "other"]
        .into_iter().collect()
});

/// AST traversal for converting JSX to sanitized GT objects
pub struct JsxTraversal<'a> {
    visitor: &'a TransformVisitor,
    id_counter: u32,
}

/// Custom number to string function to match JS behavior
fn js_number_to_string(value: f64) -> String {
    if value == 0.0 {
        return if value.is_sign_negative() { "-0".to_string() } else { "0".to_string() };
    }

    let abs_value = value.abs();
    if abs_value < 1e-6 || abs_value >= 1e21 {
        // // Use exponential notation, matching JS format
        let formatted = format!("{:e}", value);
        if formatted.contains("e") && !formatted.contains("e-") && !formatted.contains("e+") {
            formatted.replace("e", "e+")
        } else {
            formatted
        }
        .replace("e+0", "e+")
        .replace("e-0", "e-")
    } else {
        value.to_string()
    }
}

impl<'a> JsxTraversal<'a> {
    pub fn new(visitor: &'a TransformVisitor) -> Self {
        Self { visitor, id_counter: 0 }
    }

    /// Build sanitized children objects directly from JSX children
    pub fn build_sanitized_children(&mut self, children: &[JSXElementChild]) -> Option<SanitizedChildren> {
        // sometimes there is whitespace before/after a single child, and that makes three children, ie:
        // <T> {true} </T>
        // these whitespaces need to be removed before we can continue
        let mut remove_first_child = false;
        let mut remove_last_child = false;
        if children.len() >= 2 {
            // Check beginning
            let first_child = children.first().unwrap();
            if let JSXElementChild::JSXText(text) = first_child {
                if trim_normal_whitespace(&text.value).is_empty() && text.value.contains('\n') {
                    remove_first_child = true;
                }
            }

            // Check end
            let last_child = children.last().unwrap();
            if let JSXElementChild::JSXText(text) = last_child {
                if trim_normal_whitespace(&text.value).is_empty() && text.value.contains('\n') {
                    remove_last_child = true;
                }
            }
        }

        let filtered_children: Vec<JSXElementChild> = children
            .iter()
            .enumerate()
            .filter_map(|(i, child)| {
                let should_skip_first = remove_first_child && i == 0;
                let should_skip_last = remove_last_child && i == children.len() - 1;
                if should_skip_first || should_skip_last {
                    None
                } else {
                    Some(child.clone())
                }
            })
            .collect();

        // Filter out all empty {} expressions
        let filtered_children: Vec<JSXElementChild> = filtered_children.into_iter().filter(|child| {
            if let JSXElementChild::JSXExprContainer(expr_container) = child {
                if let JSXExpr::JSXEmptyExpr(_) = &expr_container.expr {
                    return false;
                }
            } else if let JSXElementChild::JSXText(text) = child {
                let trimmed = trim_normal_whitespace(&text.value);
                if trimmed.is_empty() {
                    // Check if it contains HTML entities (like &nbsp;, &amp;, etc.)
                    if has_significant_whitespace(&text.value) {
                        return true;
                    }

                    // Remove plain whitespace with newlines
                    if text.value.contains('\n') {
                        return false;
                    }
                }
            }
            true
        }).collect();

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
        // Normalize whitespace like browsers do: collapse multiple whitespace chars into single spaces
        let content = text.value.to_string();

        // Only normalize internal whitespace, preserve leading/trailing spaces
        // This matches how browsers handle JSX text content
        let normalized = if trim_normal_whitespace(&content).is_empty() {
            if content.contains('\n') {
                None
            } else {
                Some(content)
            }
        } else {
            // Handle leading/trailing whitespace
            let trimmed_content = trim_normal_whitespace(&content);
            let parts: Vec<&str> = content.split(trimmed_content).collect();
            let standardized_content = if parts.len() > 1 {
                let first_part = parts.first().unwrap();
                let last_part = parts.last().unwrap();
                let mut leading_space = first_part.to_string();
                let mut trailing_space = last_part.to_string();
                // Collapse newlines to empty
                if first_part.contains('\n') {
                    leading_space = "".to_string();
                }
                if last_part.contains('\n') {
                    trailing_space = "".to_string();
                }
                format!("{}{}{}", leading_space, trimmed_content, trailing_space)
            } else {
                content
            };

            // Collapse multiple newlines to single spaces while preserving content
            // Normalizes newlines in text content to match React JSX behavior:
            // - Multiple consecutive newlines become single spaces
            // - Newlines at the start are removed (result is cleared)
            // - Whitespace with newlines is skipped until non-whitespace content
            let mut result = String::new();
            let mut whitespace_sequence = String::new();
            let mut in_newline_sequence = false;

            for ch in standardized_content.chars() {
                if ch == '\n' && !in_newline_sequence {
                    whitespace_sequence.clear();
                    whitespace_sequence.push(' ');
                    in_newline_sequence = true;
                    continue
                }


                // Add character (and any whitespace we've accumulated)
                if !is_normal_whitespace(ch) {
                    if !whitespace_sequence.is_empty() {
                        result.push_str(&whitespace_sequence);
                        whitespace_sequence.clear();
                    }
                    result.push(ch);

                    // Escape newline sequence
                    if in_newline_sequence {
                        in_newline_sequence = false;
                    }
                    continue;
                }

                // Skip adding whitespace if we're in a newline sequence
                if in_newline_sequence {
                    continue;
                }

                // Accumulate whitespace
                whitespace_sequence.push(' ');
            }

            // Catch any stragglers
            if !in_newline_sequence && !whitespace_sequence.is_empty()  && !trim_normal_whitespace(&result).is_empty() {
                result.push_str(&whitespace_sequence);
            }

            Some(result)
        };


        if let Some(text) = normalized {
            if !text.is_empty() {
                Some(SanitizedChild::Text(text))
            } else {
                None
            }
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
        let tag_name = self.get_tag_name(&element.opening.name)?;
        
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
                    html_props: self.extract_html_content_props(&element.opening.attrs),
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
        let tag_name = self.get_tag_name(&element.opening.name)?;
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

    /// Get tag name from JSX element name
    pub fn get_tag_name(&self, name: &JSXElementName) -> Option<String> {
        match name {
            JSXElementName::Ident(ident) => Some(ident.sym.to_string()),
            JSXElementName::JSXMemberExpr(member_expr) => {
                if let JSXObject::Ident(obj_ident) = &member_expr.obj {
                    Some(format!("{}.{}", obj_ident.sym, member_expr.prop.sym))
                } else {
                    None
                }
            }
            _ => None,
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
            info.variable_type = Some(self.get_variable_type(tag_name));
        }

        // Handle namespace components (GT.T, GT.Var, etc.)
        // TODO: use a better way of checking
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
                    info.variable_type = Some(self.get_variable_type(component));
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


    /// Get variable type from component name
    fn get_variable_type(&self, component_name: &str) -> VariableType {
        match component_name {
            "Num" => VariableType::Number,
            "Currency" => VariableType::Currency,
            "DateTime" => VariableType::Date,
            _ => VariableType::Variable,
        }
    }

    /// Extract HTML content properties from attributes
    fn extract_html_content_props(&self, attrs: &[JSXAttrOrSpread]) -> HtmlContentProps {
        let mut props = HtmlContentProps::default();

        for attr in attrs {
            if let JSXAttrOrSpread::JSXAttr(jsx_attr) = attr {
                if let JSXAttrName::Ident(name_ident) = &jsx_attr.name {
                    let prop_name = name_ident.sym.as_ref();
                    
                    if let Some(JSXAttrValue::Lit(Lit::Str(str_lit))) = &jsx_attr.value {
                        let value = str_lit.value.to_string();
                        
                        match prop_name {
                            "placeholder" => props.pl = Some(value),
                            "title" => props.ti = Some(value),
                            "alt" => props.alt = Some(value),
                            "aria-label" => props.arl = Some(value),
                            "aria-labelledby" => props.arb = Some(value),
                            "aria-describedby" => props.ard = Some(value),
                            _ => {}
                        }
                    }
                }
            }
        }

        props
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

/// Information about a GT component extracted during analysis
#[derive(Default)]
struct ComponentInfo {
    is_gt_component: bool,
    transformation: Option<String>,
    variable_type: Option<VariableType>,
    branches: Option<BTreeMap<String, Box<SanitizedChild>>>,
}
