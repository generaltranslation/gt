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
        if children.is_empty() {
            return None;
        }

      

        let sanitized_children: Vec<SanitizedChild> = if children.len() == 1 {
            let child = children.first().unwrap();
            self.build_sanitized_child(child, true, true).map(|child| vec![child]).unwrap_or_default()
        } else {
            children
                .iter()
                .enumerate()
                .filter_map(|(index, child)| {
                    self.build_sanitized_child(child, index == 0, index == children.len() - 1)
                })
                .collect()
        };

        // if sanitized_children.is_empty() {
        //     return None;
        // }

        if sanitized_children.len() == 1 {
            Some(SanitizedChildren::Single(Box::new(sanitized_children.into_iter().next().unwrap())))
        } else {
            Some(SanitizedChildren::Multiple(sanitized_children))
        }
    }

    /// Build a sanitized child with a specific counter context (for branches)
    fn build_sanitized_child_with_counter(&mut self, child: &JSXElementChild, counter: u32, is_first_sibling: bool, is_last_sibling: bool) -> Option<SanitizedChild> {
        let saved_counter = self.id_counter;
        self.id_counter = counter;
        let result = self.build_sanitized_child(child, is_first_sibling, is_last_sibling);
        // eprintln!("DEBUG: build_sanitized_child_with_counter() counter: {} -> {}", self.id_counter, saved_counter);
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

    /// Build a sanitized child directly from JSX child
    pub fn build_sanitized_child(&mut self, child: &JSXElementChild, is_first_sibling: bool, is_last_sibling: bool) -> Option<SanitizedChild> {
        match child {
            JSXElementChild::JSXText(text) => {
                // Normalize whitespace like browsers do: collapse multiple whitespace chars into single spaces
                let content = text.value.to_string();

                // Only normalize internal whitespace, preserve leading/trailing spaces
                // This matches how browsers handle JSX text content
                // eprintln!("DEBUG: ------------------------------");
                // eprintln!("DEBUG: Processing text: '{}'", content);
                let normalized = if content.trim().is_empty() {
                    if (!is_first_sibling && !is_last_sibling) || (is_first_sibling && is_last_sibling) {
                        if content.contains('\n') {
                            None
                        } else {
                            Some(content)
                        }
                    } else {
                        // Whitespace at beginning or end, collapse to empty
                        None
                    }
                } else {
                    // Handle leading/trailing whitespace
                    let trimmed_content = content.trim();
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
                    // - Whitespace after newlines is skipped until non-whitespace content
                    let mut result = String::new();
                    let mut in_newline_sequence = false;

                    for ch in standardized_content.chars() {
                        if ch == '\n' {
                            if !result.trim().is_empty() {
                                result.push(' ');
                            } else {
                                result.clear();
                            }
                            in_newline_sequence = true;
                            continue;
                        }

                        if !in_newline_sequence {
                            result.push(ch);
                            continue;
                        }

                        // We're in a newline sequence - skip whitespace until we hit content
                        if ch.is_whitespace() {
                            continue;
                        }

                        // Found non-whitespace content, exit newline sequence
                        result.push(ch);
                        in_newline_sequence = false;
                    }

                    Some(result)
                };
                // eprintln!("DEBUG: Normalized text: '{:?}'", normalized);
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
            JSXElementChild::JSXExprContainer(expr_container) => self.build_sanitized_jsx_child_from_jsx_expr_container(&expr_container.expr),
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
        // eprintln!("DEBUG: Excluding Plural component - missing 'n' attribute");
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
                b: None,
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
                            return str_lit.value.to_string();
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
        if let Some(original_name) = self.visitor.gt_next_branch_import_aliases.get(&Atom::from(tag_name)) {
            if original_name == "Branch" {
                return true;
            }
        }

        // Namespace import
        if tag_name.ends_with(".Branch") {
            let namespace = tag_name.split('.').next().unwrap_or("");
            if self.visitor.gt_next_namespace_imports.contains(&Atom::from(namespace)) {
                return true;
            }
        }

        return false;
    }

    pub fn is_plural_component(&self, tag_name: &str) -> bool {
        // Named import
        if let Some(original_name) = self.visitor.gt_next_branch_import_aliases.get(&Atom::from(tag_name)) {
            if original_name == "Plural" {
                return true;
            }
        }

        // Namespace import
        if tag_name.ends_with(".Plural"){
            let namespace = tag_name.split('.').next().unwrap_or("");
            if self.visitor.gt_next_namespace_imports.contains(&Atom::from(namespace)) {
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
                
                let (is_translation, is_variable) = self.visitor.should_track_namespace_component(&namespace_atom, &component_atom);
                
                if is_translation {
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
        let plural_forms: std::collections::HashSet<&str> = ["singular", "plural", "dual", "zero", "one", "two", "few", "many", "other"].into_iter().collect();

        for attr in attrs {
            if let JSXAttrOrSpread::JSXAttr(jsx_attr) = attr {
                if let JSXAttrName::Ident(name_ident) = &jsx_attr.name {
                    let prop_name = name_ident.sym.as_ref();
                    
                    // Only include valid plural forms
                    if plural_forms.contains(prop_name) {
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
            JSXAttrValue::JSXExprContainer(expr_container) => self.build_sanitized_jsx_child_from_jsx_attr_expr_container(&expr_container.expr),
            _ => None, // Skip fragments and other types for now
        }
    }


    /// Build sanitized JSXchild from JSX container
    fn build_sanitized_jsx_child_from_jsx_attr_expr_container(&mut self, jsx_expr: &JSXExpr) -> Option<SanitizedChild> {
        // Will only be called by branch or plural, or when inspecting attributes like alt, etc.
        match jsx_expr {
            JSXExpr::Expr(expr) => {
                match expr.as_ref() {
                    Expr::Lit(Lit::Str(str_lit)) => Some(SanitizedChild::Text(str_lit.value.to_string())),
                    Expr::Lit(Lit::Num(num_lit)) => Some(SanitizedChild::Text(js_number_to_string(num_lit.value))),
                    Expr::Lit(Lit::Bool(bool_lit)) => Some(SanitizedChild::Boolean(bool_lit.value)),
                    Expr::Lit(Lit::Null(_)) => Some(SanitizedChild::Null(None)),
                    Expr::JSXFragment(fragment) => {
                        // Fragment becomes one SanitizedChild::Fragment containing its children
                        // Increment counter here because we are hopping over one level of nesting
                        if let Some(children) = self.build_sanitized_children_with_counter(&fragment.children, self.id_counter + 1) {
                            Some(SanitizedChild::Fragment(Box::new(SanitizedChildren::Wrapped { c: Box::new(children) })))
                        } else {
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
                    Expr::JSXElement(element) => {
                        self.build_sanitized_child_with_counter(&JSXElementChild::JSXElement(element.clone()), self.id_counter, true, true)
                    }
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


    /// Build sanitized JSXchild from JSX container
    fn build_sanitized_jsx_child_from_jsx_expr_container(&mut self, jsx_expr: &JSXExpr) -> Option<SanitizedChild> {
        match jsx_expr {
            JSXExpr::Expr(expr) => {
                match expr.as_ref() {
                    Expr::Lit(Lit::Str(str_lit)) => Some(SanitizedChild::Text(str_lit.value.to_string())),
                    Expr::Lit(Lit::Num(num_lit)) => Some(SanitizedChild::Text(js_number_to_string(num_lit.value))),
                    Expr::Lit(Lit::Bool(_)) => None,
                    Expr::Lit(Lit::Null(_)) => None,
                    Expr::JSXFragment(fragment) => {
                        // Fragment becomes one SanitizedChild::Fragment containing its children
                        if let Some(children) = self.build_sanitized_children(&fragment.children) {
                            Some(SanitizedChild::Fragment(Box::new(SanitizedChildren::Wrapped { c: Box::new(children) })))
                        } else {
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
                    Expr::JSXElement(element) => {
                        self.build_sanitized_child(&JSXElementChild::JSXElement(element.clone()), true, true)
                    }
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


    

    // /// Build sanitized children from expressions (for attribute JSX content)
    // fn build_sanitized_children_from_expr(&mut self, expr: &Expr) -> Option<SanitizedChildren> {
    //     // Save current counter for branch processing - all variables in parallel branches should share the same index
    //     let branch_counter = self.id_counter;
        
    //     match expr {
    //         // Handle JSX fragments: <>content</>
    //         Expr::JSXFragment(fragment) => {
    //             // Increment counter for fragments just like elements
    //             // self.id_counter += 1; // TODO: increment branch_counter?

    //             // eprintln!("DEBUG: build_sanitized_children_from_expr() fragment counter: <> {}", branch_counter);
          
    //             // Use branch counter for consistent variable key generation in branches
    //             if let Some(child) = self.build_sanitized_child_with_counter(&JSXElementChild::JSXFragment(fragment.clone()), branch_counter, true, true) {
    //                 Some(SanitizedChildren::Single(Box::new(child)))
    //             } else {// Empty fragment should return empty object structure, not None
    //                 let empty_element = SanitizedElement {
    //                     b: None,
    //                     c: None,
    //                     t: None,
    //                     d: None,
    //                 };
    //                 Some(SanitizedChildren::Single(Box::new(SanitizedChild::Element(Box::new(empty_element)))))
    //             }
    //         }
    //         // Handle JSX elements: <SomeComponent>content</SomeComponent>
    //         Expr::JSXElement(element) => {
    //             // eprintln!("DEBUG: build_sanitized_children_from_expr() element counter: <{:?}> {}", self.get_tag_name(&element.opening.name).unwrap_or_default(), branch_counter);
    //             // Use branch counter for consistent variable key generation in branches
    //             if let Some(child) = self.build_sanitized_child_with_counter(&JSXElementChild::JSXElement(element.clone()), branch_counter, true, true) {
    //                 // Check if this is a Branch/Plural component - if so, return it directly
    //                 if let Some(tag_name) = self.get_tag_name(&element.opening.name) {
    //                     if self.is_branch_component(&tag_name) || self.is_plural_component(&tag_name) {
    //                         // Return Branch/Plural components directly without wrapping
    //                         return Some(SanitizedChildren::Single(Box::new(child)));
    //                     }
                        
    //                     // Check if this is a variable component (Var, Num, Currency, DateTime) - return directly too
    //                     if self.visitor.should_track_component_as_variable(&Atom::from(tag_name.as_str())) {
    //                         // Return variable components directly without wrapping
    //                         return Some(SanitizedChildren::Single(Box::new(child)));
    //                     }
    //                 }
                    
    //                 // // DO NOT wrap other elements like runtime does: {"c": element}
    //                 // let single_child = SanitizedChildren::Single(Box::new(child));
    //                 // Some(SanitizedChildren::Wrapped { c: Box::new(single_child) })
    //                 Some(SanitizedChildren::Single(Box::new(child)))
    //             } else {
    //                 None
    //             }
    //         }
    //         // Handle string literals inside expressions: {"Files"}
    //         Expr::Lit(Lit::Str(str_lit)) => {
    //             let content = str_lit.value.to_string();
    //             Some(SanitizedChildren::Single(Box::new(SanitizedChild::Text(content))))
    //         }
    //         // Handle other literal types: {42}, {true}, {null}
    //         Expr::Lit(Lit::Num(num_lit)) => {
    //             // eprintln!("DEBUG: Processing number: {:?} -> {}", num_lit.value, num_lit.value.to_string());
    //             Some(SanitizedChildren::Single(Box::new(SanitizedChild::Text(num_lit.value.to_string()))))
    //         }
    //         Expr::Lit(Lit::Bool(bool_lit)) => {
    //             Some(SanitizedChildren::Single(Box::new(SanitizedChild::Boolean(bool_lit.value))))
    //         }
    //         Expr::Lit(Lit::Null(_)) => {
    //             Some(SanitizedChildren::Single(Box::new(SanitizedChild::Null(None))))
    //         }
    //         Expr::Unary(UnaryExpr { op: UnaryOp::Minus, arg, .. }) => {
    //             // Handle negative numbers
    //             if let Expr::Lit(Lit::Num(num_lit)) = arg.as_ref() {
    //                 let negative_num = -num_lit.value;
    //                 // eprintln!("DEBUG: Processing negative number: -{} -> {}", num_lit.value, negative_num);
    //                 Some(SanitizedChildren::Single(Box::new(SanitizedChild::Text(negative_num.to_string()))))
    //             } else {
    //                 None
    //             }
    //         }
            
    //         // Handle simple template literals: {`files`}
    //         Expr::Tpl(tpl) => {
    //             // Only handle template literals with no expressions (simple string templates)
    //             if tpl.exprs.is_empty() && tpl.quasis.len() == 1 {
    //                 if let Some(quasi) = tpl.quasis.first() {
    //                     // Use cooked instead of raw to match runtime behavior
    //                     // let content = quasi.raw.to_string();
    //                     // Some(SanitizedChildren::Single(Box::new(SanitizedChild::Text(content))))
    //                     if let Some(cooked) = &quasi.cooked {
    //                         let content = cooked.to_string();
    //                         Some(SanitizedChildren::Single(Box::new(SanitizedChild::Text(content))))
    //                     } else {
    //                         // Fall back to raw if cooked is None (unusual case)
    //                         let content = quasi.raw.to_string();
    //                         Some(SanitizedChildren::Single(Box::new(SanitizedChild::Text(content))))
    //                     }
    //                 } else {
    //                     None
    //                 }
    //             } else {
    //                 // Complex template literals with interpolation can't be evaluated at build-time
    //                 // Skip these to avoid hash mismatches
    //                 None
    //             }
    //         }
    //         // Handle conditional expressions: {condition ? "files" : "file"}
    //         Expr::Cond(cond_expr) => {
    //             // For stable hashing, we need both branches to be deterministic
    //             // Try to extract both consequent and alternate if they're simple expressions
    //             let cons_result = self.build_sanitized_children_from_expr(&cond_expr.cons);
    //             let alt_result = self.build_sanitized_children_from_expr(&cond_expr.alt);
                
    //             // If both branches produce the same result, use it
    //             // Otherwise, skip for build-time stability
    //             match (cons_result, alt_result) {
    //                 (Some(cons), Some(alt)) => {
    //                     // For now, skip conditional expressions to avoid complexity
    //                     // In the future, we could try to serialize the condition structure
    //                     None
    //                 }
    //                 _ => None,
    //             }
    //         }
    //         _ => None,
    //     }
    // }

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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::LogLevel;

    #[test]
    fn test_get_variable_type() {
        let visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, false, None);
        let mut traversal = JsxTraversal::new(&visitor);
        
        assert_eq!(traversal.get_variable_type("Var"), VariableType::Variable);
        assert_eq!(traversal.get_variable_type("Num"), VariableType::Number);
        assert_eq!(traversal.get_variable_type("Currency"), VariableType::Currency);
        assert_eq!(traversal.get_variable_type("DateTime"), VariableType::Date);
    }

    #[test]
    fn test_html_content_props_default() {
        let props = HtmlContentProps::default();
        assert_eq!(props.pl, None);
        assert_eq!(props.ti, None);
        assert_eq!(props.alt, None);
        assert_eq!(props.arl, None);
        assert_eq!(props.arb, None);
        assert_eq!(props.ard, None);
    }

    #[test]
    fn test_whitespace_normalization() {
        use swc_core::ecma::ast::*;
        use swc_core::common::{Span, BytePos};
        use swc_core::ecma::atoms::Atom;
        
        let visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, false, None);
        let mut traversal = JsxTraversal::new(&visitor);
        
        // Create JSX text with extra whitespace and newlines
        let jsx_text = JSXText {
            span: Span::new(BytePos(0), BytePos(1)),
            value: "This is a comprehensive guide\n                with extra whitespace".into(),
            raw: Atom::new("This is a comprehensive guide\n                with extra whitespace"),
        };
        let jsx_child = JSXElementChild::JSXText(jsx_text);
        
        let result = traversal.build_sanitized_child(&jsx_child, true, true);
        
        match result {
            Some(SanitizedChild::Text(text)) => {
                assert_eq!(text, "This is a comprehensive guide with extra whitespace");
                // Ensure no extra whitespace remains
                assert!(!text.contains("  ")); // no double spaces
                assert!(!text.contains("\n")); // no newlines
                assert!(!text.starts_with(' ')); // no leading spaces
                assert!(!text.ends_with(' ')); // no trailing spaces
            },
            _ => panic!("Expected SanitizedChild::Text, got {:?}", result),
        }
    }

    #[test]
    fn test_is_branch_component_direct_import() {
        use swc_core::ecma::atoms::Atom;
        use std::collections::{HashMap, HashSet};
        
        let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, false, None);
        
        // Simulate direct import: import { Branch } from 'gt-next'
        visitor.gt_next_branch_import_aliases.insert(Atom::from("Branch"), Atom::from("Branch"));
        
        let mut traversal = JsxTraversal::new(&visitor);
        
        // Should recognize direct Branch component
        assert!(traversal.is_branch_component("Branch"));
        
        // Should not recognize other components
        assert!(!traversal.is_branch_component("Plural"));
        assert!(!traversal.is_branch_component("T"));
        assert!(!traversal.is_branch_component("SomeOtherComponent"));
    }

    #[test]
    fn test_is_branch_component_aliased_import() {
        use swc_core::ecma::atoms::Atom;
        use std::collections::{HashMap, HashSet};
        
        let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, false, None);
        
        // Simulate aliased import: import { Branch as B } from 'gt-next'
        visitor.gt_next_branch_import_aliases.insert(Atom::from("B"), Atom::from("Branch"));
        
        let mut traversal = JsxTraversal::new(&visitor);
        
        // Should recognize aliased Branch component
        assert!(traversal.is_branch_component("B"));
        
        // Should not recognize the original name since it wasn't directly imported
        assert!(!traversal.is_branch_component("Branch"));
        assert!(!traversal.is_branch_component("Plural"));
    }

    #[test]
    fn test_is_branch_component_namespace_import() {
        use swc_core::ecma::atoms::Atom;
        use std::collections::{HashMap, HashSet};
        
        let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, false, None);
        
        // Simulate namespace import: import * as GT from 'gt-next'
        visitor.gt_next_namespace_imports.insert(Atom::from("GT"));
        
        let mut traversal = JsxTraversal::new(&visitor);
        
        // Should recognize namespace Branch component
        assert!(traversal.is_branch_component("GT.Branch"));
        
        // Should not recognize other namespace components
        assert!(!traversal.is_branch_component("GT.Plural"));
        assert!(!traversal.is_branch_component("GT.T"));
        
        // Should not recognize components from unknown namespaces
        assert!(!traversal.is_branch_component("Unknown.Branch"));
        
        // Should not recognize direct names
        assert!(!traversal.is_branch_component("Branch"));
    }

    #[test]
    fn test_is_plural_component_direct_import() {
        use swc_core::ecma::atoms::Atom;
        use std::collections::{HashMap, HashSet};
        
        let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, false, None);
        
        // Simulate direct import: import { Plural } from 'gt-next'
        visitor.gt_next_branch_import_aliases.insert(Atom::from("Plural"), Atom::from("Plural"));
        
        let mut traversal = JsxTraversal::new(&visitor);
        
        // Should recognize direct Plural component
        assert!(traversal.is_plural_component("Plural"));
        
        // Should not recognize other components
        assert!(!traversal.is_plural_component("Branch"));
        assert!(!traversal.is_plural_component("T"));
        assert!(!traversal.is_plural_component("SomeOtherComponent"));
    }

    #[test]
    fn test_is_plural_component_aliased_import() {
        use swc_core::ecma::atoms::Atom;
        use std::collections::{HashMap, HashSet};
        
        let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, false, None);
        
        // Simulate aliased import: import { Plural as P } from 'gt-next'
        visitor.gt_next_branch_import_aliases.insert(Atom::from("P"), Atom::from("Plural"));
        
        let mut traversal = JsxTraversal::new(&visitor);
        
        // Should recognize aliased Plural component
        assert!(traversal.is_plural_component("P"));
        
        // Should not recognize the original name since it wasn't directly imported
        assert!(!traversal.is_plural_component("Plural"));
        assert!(!traversal.is_plural_component("Branch"));
    }

    #[test]
    fn test_is_plural_component_namespace_import() {
        use swc_core::ecma::atoms::Atom;
        use std::collections::{HashMap, HashSet};
        
        let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, false, None);
        
        // Simulate namespace import: import * as GT from 'gt-next'
        visitor.gt_next_namespace_imports.insert(Atom::from("GT"));
        
        let mut traversal = JsxTraversal::new(&visitor);
        
        // Should recognize namespace Plural component
        assert!(traversal.is_plural_component("GT.Plural"));
        
        // Should not recognize other namespace components
        assert!(!traversal.is_plural_component("GT.Branch"));
        assert!(!traversal.is_plural_component("GT.T"));
        
        // Should not recognize components from unknown namespaces
        assert!(!traversal.is_plural_component("Unknown.Plural"));
        
        // Should not recognize direct names
        assert!(!traversal.is_plural_component("Plural"));
    }

    #[test]
    fn test_component_detection_mixed_imports() {
        use swc_core::ecma::atoms::Atom;
        use std::collections::{HashMap, HashSet};
        
        let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, false, None);
        
        // Mixed scenario: direct Branch, aliased Plural, namespace import
        visitor.gt_next_branch_import_aliases.insert(Atom::from("Branch"), Atom::from("Branch"));
        visitor.gt_next_branch_import_aliases.insert(Atom::from("P"), Atom::from("Plural"));
        visitor.gt_next_namespace_imports.insert(Atom::from("GT"));
        
        let mut traversal = JsxTraversal::new(&visitor);
        
        // Should recognize all correctly
        assert!(traversal.is_branch_component("Branch")); // direct
        assert!(traversal.is_plural_component("P")); // aliased
        assert!(traversal.is_branch_component("GT.Branch")); // namespace
        assert!(traversal.is_plural_component("GT.Plural")); // namespace
        
        // Should not cross-recognize
        assert!(!traversal.is_plural_component("Branch"));
        assert!(!traversal.is_branch_component("P"));
        assert!(!traversal.is_plural_component("Plural")); // not directly imported
    }

    #[test]
    fn test_component_detection_edge_cases() {
        use swc_core::ecma::atoms::Atom;
        use std::collections::{HashMap, HashSet};
        
        let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, false, None);
        
        // Edge case: import { Branch as Plural, Plural as Branch }
        visitor.gt_next_branch_import_aliases.insert(Atom::from("Plural"), Atom::from("Branch"));
        visitor.gt_next_branch_import_aliases.insert(Atom::from("Branch"), Atom::from("Plural"));
        
        let mut traversal = JsxTraversal::new(&visitor);
        
        // Should follow the alias mappings correctly
        assert!(traversal.is_branch_component("Plural")); // "Plural" maps to original "Branch"
        assert!(traversal.is_plural_component("Branch")); // "Branch" maps to original "Plural"
        
        // Verify no false positives
        assert!(!traversal.is_plural_component("Plural"));
        assert!(!traversal.is_branch_component("Branch"));
    }
}