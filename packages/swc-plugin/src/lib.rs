use swc_core::ecma::{
    ast::*,
    visit::{Fold, FoldWith},
};
use swc_core::plugin::{plugin_transform, proxies::TransformPluginProgramMetadata};

/// GT-Next SWC plugin that detects dynamic content in translation components 
/// that isn't wrapped in variable components.
/// 
/// The plugin tracks when the visitor is inside:
/// - Translation components (identified by _gtt='translate-server'|'translate'|'translate-client')
/// - Variable components (identified by _gtt='variable-datetime'|'variable-number'|'variable-variable'|'variable-currency')
/// 
/// When dynamic content (JSX expressions with {}) is found inside a translation 
/// component but not wrapped in a variable component, it logs a warning.
/// 
/// Note: This plugin requires that GT-Next has processed the components and added
/// the _gtt attributes to the JSX elements during the build process.
pub struct TransformVisitor {
    /// True when currently visiting inside a translation component
    in_translation_component: bool,
    /// True when currently visiting inside a variable component
    in_variable_component: bool,
}

impl Default for TransformVisitor {
    fn default() -> Self {
        Self {
            in_translation_component: false,
            in_variable_component: false,
        }
    }
}

impl Fold for TransformVisitor {
    /// Visits JSX elements and tracks translation and variable component context
    /// using the internal _gtt attribute for reliable identification
    fn fold_jsx_element(&mut self, mut element: JSXElement) -> JSXElement {
        let gtt_value = self.get_gtt_attribute(&element.opening);
        
        // Save current state to restore after processing children
        let was_in_translation = self.in_translation_component;
        let was_in_variable = self.in_variable_component;
        
        // Update state based on the _gtt attribute value
        if let Some(gtt) = gtt_value {
            if self.is_translation_component(&gtt) {
                self.in_translation_component = true;
            } else if self.is_variable_component(&gtt) {
                self.in_variable_component = true;
            }
        }
        
        // Process children with updated context
        element.children = element.children.fold_with(self);
        
        // Restore previous state
        self.in_translation_component = was_in_translation;
        self.in_variable_component = was_in_variable;
        
        // Process element attributes and closing tag
        element.opening = element.opening.fold_with(self);
        if let Some(closing) = element.closing {
            element.closing = Some(closing.fold_with(self));
        }
        
        element
    }
    
    /// Detects JSX expression containers (dynamic content in {}) and logs warnings
    /// when found inside translation components without variable component wrappers
    fn fold_jsx_expr_container(&mut self, mut container: JSXExprContainer) -> JSXExprContainer {
        // Check if we have unwrapped dynamic content in a translation component
        if self.in_translation_component && !self.in_variable_component {
            let span = container.span;
            eprintln!(
                "WARNING: Dynamic content found in translation component without variable wrapper at line {}, column {}", 
                span.lo.0, span.hi.0
            );
        }
        
        // Continue processing the expression
        container.expr = container.expr.fold_with(self);
        container
    }
}


impl TransformVisitor {
    /// Extracts the _gtt attribute value from a JSX element
    /// The _gtt attribute is used internally to identify GT-Next components
    fn get_gtt_attribute(&self, opening: &JSXOpeningElement) -> Option<String> {
        for attr in &opening.attrs {
            if let JSXAttrOrSpread::JSXAttr(jsx_attr) = attr {
                if let JSXAttrName::Ident(ident_name) = &jsx_attr.name {
                    if ident_name.sym == "_gtt" {
                        if let Some(JSXAttrValue::Lit(Lit::Str(str_lit))) = &jsx_attr.value {
                            return Some(str_lit.value.to_string());
                        }
                    }
                }
            }
        }
        None
    }
    
    /// Checks if the _gtt value indicates a translation component
    /// Translation components: 'translate-server', 'translate', 'translate-client'
    /// (excludes 'translate-runtime')
    fn is_translation_component(&self, gtt_value: &str) -> bool {
        matches!(gtt_value, "translate-server" | "translate" | "translate-client")
    }
    
    /// Checks if the _gtt value indicates a variable component
    /// Variable components: 'variable-datetime', 'variable-number', 'variable-variable', 'variable-currency'
    fn is_variable_component(&self, gtt_value: &str) -> bool {
        matches!(gtt_value, "variable-datetime" | "variable-number" | "variable-variable" | "variable-currency")
    }
    
}

/// Main entry point for the SWC plugin
/// 
/// This function is called by the SWC compiler with the parsed AST.
/// It applies the TransformVisitor to detect unwrapped dynamic content in <T> components.
#[plugin_transform]
pub fn process_transform(program: Program, _metadata: TransformPluginProgramMetadata) -> Program {
    program.fold_with(&mut TransformVisitor::default())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_visitor_initial_state() {
        let visitor = TransformVisitor::default();
        assert_eq!(visitor.in_translation_component, false);
        assert_eq!(visitor.in_variable_component, false);
    }

    #[test] 
    fn test_translation_component_detection() {
        let visitor = TransformVisitor::default();
        
        // Test translation component detection
        assert!(visitor.is_translation_component("translate-server"));
        assert!(visitor.is_translation_component("translate"));
        assert!(visitor.is_translation_component("translate-client"));
        
        // Should exclude translate-runtime
        assert!(!visitor.is_translation_component("translate-runtime"));
        
        // Should not match variable components
        assert!(!visitor.is_translation_component("variable-datetime"));
    }

    #[test] 
    fn test_variable_component_detection() {
        let visitor = TransformVisitor::default();
        
        // Test variable component detection
        assert!(visitor.is_variable_component("variable-datetime"));
        assert!(visitor.is_variable_component("variable-number"));
        assert!(visitor.is_variable_component("variable-variable"));
        assert!(visitor.is_variable_component("variable-currency"));
        
        // Should not match translation components
        assert!(!visitor.is_variable_component("translate-server"));
        assert!(!visitor.is_variable_component("translate"));
    }


    #[test]
    fn test_gtt_attribute_extraction() {
        let visitor = TransformVisitor::default();
        
        // Create a JSX element with _gtt attribute (keeping this test for the _gtt methods)
        let gtt_attr = JSXAttr {
            span: Default::default(),
            name: JSXAttrName::Ident(IdentName::new("_gtt".into(), Default::default())),
            value: Some(JSXAttrValue::Lit(Lit::Str(Str {
                span: Default::default(),
                value: "translate-server".into(),
                raw: None,
            }))),
        };

        let jsx_opening = JSXOpeningElement {
            name: JSXElementName::Ident(Ident::new("Component".into(), Default::default(), Default::default())),
            span: Default::default(),
            type_args: None,
            attrs: vec![JSXAttrOrSpread::JSXAttr(gtt_attr)],
            self_closing: false,
        };
        
        let gtt_value = visitor.get_gtt_attribute(&jsx_opening);
        assert_eq!(gtt_value, Some("translate-server".to_string()));
    }

}