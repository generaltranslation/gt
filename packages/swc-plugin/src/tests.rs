use super::*;
use swc_core::common::{DUMMY_SP, SyntaxContext};
use swc_core::ecma::{atoms::Atom, visit::FoldWith};

/// Helper function to create a JSX element for testing
/// Examples: create_jsx_element("T", true) creates <T>Hello {name}!</T> with dynamic content
fn create_jsx_element(component_name: &str, with_dynamic_content: bool) -> JSXElement {
    let children = if with_dynamic_content {
        vec![
            JSXElementChild::JSXText(JSXText {
                span: DUMMY_SP,
                value: "Hello ".into(),
                raw: "Hello ".into(),
            }),
            JSXElementChild::JSXExprContainer(JSXExprContainer {
                span: DUMMY_SP,
                expr: JSXExpr::Expr(Box::new(Expr::Ident(Ident::new("name".into(), DUMMY_SP, SyntaxContext::empty())))),
            }),
            JSXElementChild::JSXText(JSXText {
                span: DUMMY_SP,
                value: "!".into(),
                raw: "!".into(),
            }),
        ]
    } else {
        vec![
            JSXElementChild::JSXText(JSXText {
                span: DUMMY_SP,
                value: "Hello world".into(),
                raw: "Hello world".into(),
            }),
        ]
    };

    JSXElement {
        span: DUMMY_SP,
        opening: JSXOpeningElement {
            name: JSXElementName::Ident(Ident::new(component_name.into(), DUMMY_SP, SyntaxContext::empty()).into()),
            span: DUMMY_SP,
            attrs: vec![],
            self_closing: false,
            type_args: None,
        },
        closing: Some(JSXClosingElement {
            span: DUMMY_SP,
            name: JSXElementName::Ident(Ident::new(component_name.into(), DUMMY_SP, SyntaxContext::empty()).into()),
        }),
        children,
    }
}

/// Helper function to create a JSX element with wrapped dynamic content: <T>Hello <Var>{name}</Var>!</T>
fn create_jsx_element_with_wrapped_content() -> JSXElement {
    // Create <Var>{name}</Var>
    let var_element = JSXElement {
        span: DUMMY_SP,
        opening: JSXOpeningElement {
            name: JSXElementName::Ident(Ident::new("Var".into(), DUMMY_SP, SyntaxContext::empty()).into()),
            span: DUMMY_SP,
            attrs: vec![],
            self_closing: false,
            type_args: None,
        },
        closing: Some(JSXClosingElement {
            span: DUMMY_SP,
            name: JSXElementName::Ident(Ident::new("Var".into(), DUMMY_SP, SyntaxContext::empty()).into()),
        }),
        children: vec![
            JSXElementChild::JSXExprContainer(JSXExprContainer {
                span: DUMMY_SP,
                expr: JSXExpr::Expr(Box::new(Expr::Ident(Ident::new("name".into(), DUMMY_SP, SyntaxContext::empty())))),
            })
        ],
    };

    // Create <T>Hello <Var>{name}</Var>!</T>
    JSXElement {
        span: DUMMY_SP,
        opening: JSXOpeningElement {
            name: JSXElementName::Ident(Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty()).into()),
            span: DUMMY_SP,
            attrs: vec![],
            self_closing: false,
            type_args: None,
        },
        closing: Some(JSXClosingElement {
            span: DUMMY_SP,
            name: JSXElementName::Ident(Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty()).into()),
        }),
        children: vec![
            JSXElementChild::JSXText(JSXText {
                span: DUMMY_SP,
                value: "Hello ".into(),
                raw: "Hello ".into(),
            }),
            JSXElementChild::JSXElement(Box::new(var_element)),
            JSXElementChild::JSXText(JSXText {
                span: DUMMY_SP,
                value: "!".into(),
                raw: "!".into(),
            }),
        ],
    }
}

/// Helper function to create a function call expression
fn create_call_expr(function_name: &str, arg: Expr) -> CallExpr {
    use swc_core::common::{DUMMY_SP, SyntaxContext};
    
    CallExpr {
        span: DUMMY_SP,
        ctxt: SyntaxContext::empty(),
        callee: Callee::Expr(Box::new(Expr::Ident(Ident::new(function_name.into(), DUMMY_SP, SyntaxContext::empty())))),
        args: vec![ExprOrSpread {
            spread: None,
            expr: Box::new(arg),
        }],
        type_args: None,
    }
}

/// Helper function to create a string literal expression
fn create_string_literal(value: &str) -> Expr {
    use swc_core::common::DUMMY_SP;
    
    Expr::Lit(Lit::Str(Str {
        span: DUMMY_SP,
        value: value.into(),
        raw: None,
    }))
}

/// Helper function to create a template literal expression: `Hello ${name}`
fn create_template_literal() -> Expr {
    use swc_core::common::{DUMMY_SP, SyntaxContext};
    
    Expr::Tpl(Tpl {
        span: DUMMY_SP,
        exprs: vec![Box::new(Expr::Ident(Ident::new("name".into(), DUMMY_SP, SyntaxContext::empty())))],
        quasis: vec![
            TplElement {
                span: DUMMY_SP,
                tail: false,
                cooked: Some("Hello ".into()),
                raw: "Hello ".into(),
            },
            TplElement {
                span: DUMMY_SP,
                tail: true,
                cooked: Some("!".into()),
                raw: "!".into(),
            },
        ],
    })
}

/// Helper function to create binary expression for string concatenation: "Hello " + name
fn create_string_concatenation() -> Expr {
    use swc_core::common::{DUMMY_SP, SyntaxContext};
    
    Expr::Bin(BinExpr {
        span: DUMMY_SP,
        op: BinaryOp::Add,
        left: Box::new(Expr::Lit(Lit::Str(Str {
            span: DUMMY_SP,
            value: "Hello ".into(),
            raw: None,
        }))),
        right: Box::new(Expr::Ident(Ident::new("name".into(), DUMMY_SP, SyntaxContext::empty()))),
    })
}

/// Helper function to create a variable declarator: const t = useGT();
fn create_var_declarator_with_call() -> VarDeclarator {
    use swc_core::common::{DUMMY_SP, SyntaxContext};
    
    VarDeclarator {
        span: DUMMY_SP,
        name: Pat::Ident(BindingIdent {
            id: Ident::new("t".into(), DUMMY_SP, SyntaxContext::empty()),
            type_ann: None,
        }),
        init: Some(Box::new(Expr::Call(CallExpr {
            span: DUMMY_SP,
            ctxt: SyntaxContext::empty(),
            callee: Callee::Expr(Box::new(Expr::Ident(Ident::new("useGT".into(), DUMMY_SP, SyntaxContext::empty())))),
            args: vec![],
            type_args: None,
        }))),
        definite: false,
    }
}

/// Helper function to create nested T components: <T>Outer {value} <T>Inner {name}</T></T>
fn create_nested_t_elements() -> JSXElement {
    use swc_core::common::{DUMMY_SP, SyntaxContext};
    
    // Create inner T element: <T>Inner {name}</T>
    let inner_t = JSXElement {
        span: DUMMY_SP,
        opening: JSXOpeningElement {
            span: DUMMY_SP,
            name: JSXElementName::Ident(Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty()).into()),
            attrs: vec![],
            self_closing: false,
            type_args: None,
        },
        children: vec![
            JSXElementChild::JSXText(JSXText {
                span: DUMMY_SP,
                value: "Inner ".into(),
                raw: "Inner ".into(),
            }),
            JSXElementChild::JSXExprContainer(JSXExprContainer {
                span: DUMMY_SP,
                expr: JSXExpr::Expr(Box::new(Expr::Ident(Ident::new("name".into(), DUMMY_SP, SyntaxContext::empty())))),
            }),
        ],
        closing: Some(JSXClosingElement {
            span: DUMMY_SP,
            name: JSXElementName::Ident(Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty()).into()),
        }),
    };
    
    // Create outer T element: <T>Outer {value} <inner_t></T>
    JSXElement {
        span: DUMMY_SP,
        opening: JSXOpeningElement {
            span: DUMMY_SP,
            name: JSXElementName::Ident(Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty()).into()),
            attrs: vec![],
            self_closing: false,
            type_args: None,
        },
        children: vec![
            JSXElementChild::JSXText(JSXText {
                span: DUMMY_SP,
                value: "Outer ".into(),
                raw: "Outer ".into(),
            }),
            JSXElementChild::JSXExprContainer(JSXExprContainer {
                span: DUMMY_SP,
                expr: JSXExpr::Expr(Box::new(Expr::Ident(Ident::new("value".into(), DUMMY_SP, SyntaxContext::empty())))),
            }),
            JSXElementChild::JSXText(JSXText {
                span: DUMMY_SP,
                value: " ".into(),
                raw: " ".into(),
            }),
            JSXElementChild::JSXElement(Box::new(inner_t)),
        ],
        closing: Some(JSXClosingElement {
            span: DUMMY_SP,
            name: JSXElementName::Ident(Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty()).into()),
        }),
    }
}

/// Helper function to create a namespace JSX element: <GT.T>Hello {name}!</GT.T>
fn create_namespace_jsx_element() -> JSXElement {
    use swc_core::common::{DUMMY_SP, SyntaxContext};
    
    // Create member expression for GT.T
    let member_expr = JSXMemberExpr {
        span: DUMMY_SP,
        obj: JSXObject::Ident(Ident::new("GT".into(), DUMMY_SP, SyntaxContext::empty()).into()),
        prop: Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty()).into(),
    };
    
    JSXElement {
        span: DUMMY_SP,
        opening: JSXOpeningElement {
            span: DUMMY_SP,
            name: JSXElementName::JSXMemberExpr(member_expr.clone()),
            attrs: vec![],
            self_closing: false,
            type_args: None,
        },
        children: vec![
            JSXElementChild::JSXText(JSXText {
                span: DUMMY_SP,
                value: "Hello ".into(),
                raw: "Hello ".into(),
            }),
            JSXElementChild::JSXExprContainer(JSXExprContainer {
                span: DUMMY_SP,
                expr: JSXExpr::Expr(Box::new(Expr::Ident(Ident::new("name".into(), DUMMY_SP, SyntaxContext::empty())))),
            }),
            JSXElementChild::JSXText(JSXText {
                span: DUMMY_SP,
                value: "!".into(),
                raw: "!".into(),
            }),
        ],
        closing: Some(JSXClosingElement {
            span: DUMMY_SP,
            name: JSXElementName::JSXMemberExpr(member_expr),
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_visitor_initial_state() {
        let visitor = TransformVisitor::default();
        
        assert!(!visitor.in_translation_component);
        assert!(!visitor.in_variable_component);
        assert!(!visitor.in_jsx_attribute);
        assert!(visitor.gt_next_translation_imports.is_empty());
        assert!(visitor.gt_next_variable_imports.is_empty());
        assert!(visitor.gt_next_namespace_imports.is_empty());
        assert!(visitor.gt_assigned_translation_components.is_empty());
        assert!(visitor.gt_assigned_variable_components.is_empty());
        assert!(visitor.gt_translation_functions.is_empty());
        assert_eq!(visitor.jsx_element_count, 0);
        assert_eq!(visitor.dynamic_content_violations, 0);
    }

    #[test]
    fn test_is_translation_component_name() {
        let visitor = TransformVisitor::default();
        
        // Should match known translation components
        let t_atom = Atom::from("T");
        assert!(visitor.is_translation_component_name(&t_atom));
        
        // Should not match unknown components
        let unknown_atom = Atom::from("UnknownComponent");
        assert!(!visitor.is_translation_component_name(&unknown_atom));
    }

    #[test]
    fn test_is_variable_component_name() {
        let visitor = TransformVisitor::default();
        
        // Should match known variable components
        let var_atom = Atom::from("Var");
        let num_atom = Atom::from("Num");
        let currency_atom = Atom::from("Currency");
        assert!(visitor.is_variable_component_name(&var_atom));
        assert!(visitor.is_variable_component_name(&num_atom));
        assert!(visitor.is_variable_component_name(&currency_atom));
        
        // Should not match unknown components
        let unknown_atom = Atom::from("UnknownComponent");
        let div_atom = Atom::from("div");
        assert!(!visitor.is_translation_component_name(&unknown_atom));
        assert!(!visitor.is_variable_component_name(&div_atom));
    }

    #[test]
    fn test_namespace_import_tracking() {
        let mut visitor = TransformVisitor::default();
        
        // Initially, no namespace imports should be tracked
        assert!(visitor.gt_next_namespace_imports.is_empty());
        
        // Simulate namespace import processing (this would normally happen in fold_import_decl)
        let gt_atom = Atom::from("GT");
        let gt_client_atom = Atom::from("GTClient");
        
        visitor.gt_next_namespace_imports.insert(gt_atom.clone());
        visitor.gt_next_namespace_imports.insert(gt_client_atom.clone());
        
        // Verify namespace imports are tracked
        assert!(visitor.gt_next_namespace_imports.contains(&gt_atom));
        assert!(visitor.gt_next_namespace_imports.contains(&gt_client_atom));
        
        // Should not contain untracked namespaces
        let react_atom = Atom::from("React");
        assert!(!visitor.gt_next_namespace_imports.contains(&react_atom));
    }

    #[test]
    fn test_variable_assignment_tracking() {
        let mut visitor = TransformVisitor::default();
        
        // Initially, no assigned variables should be tracked
        assert!(visitor.gt_assigned_translation_components.is_empty());
        assert!(visitor.gt_assigned_variable_components.is_empty());
        
        // Set up some imported components first (simulating imports)
        let t_atom = Atom::from("T");
        let var_atom = Atom::from("Var");
        visitor.gt_next_translation_imports.insert(t_atom.clone());
        visitor.gt_next_variable_imports.insert(var_atom.clone());
        
        // Simulate variable assignment processing (this would normally happen in fold_var_declarator)
        let my_t_atom = Atom::from("MyT");
        let my_var_atom = Atom::from("MyVar");
        
        visitor.gt_assigned_translation_components.insert(my_t_atom.clone());
        visitor.gt_assigned_variable_components.insert(my_var_atom.clone());
        
        // Verify assigned variables are tracked
        assert!(visitor.gt_assigned_translation_components.contains(&my_t_atom));
        assert!(visitor.gt_assigned_variable_components.contains(&my_var_atom));
        
        // Should not contain untracked assignments
        let unrelated_atom = Atom::from("SomeOtherComponent");
        assert!(!visitor.gt_assigned_translation_components.contains(&unrelated_atom));
        assert!(!visitor.gt_assigned_variable_components.contains(&unrelated_atom));
    }

    #[test]
    fn test_basic_t_component_with_dynamic_content() {
        let mut visitor = TransformVisitor::new(LogLevel::Warn, LogLevel::Warn, false, Some("test.tsx".to_string()));
        
        // Simulate import of T component 
        visitor.gt_next_translation_imports.insert(Atom::from("T"));
        
        // Create JSX element: <T>Hello {name}!</T>
        let jsx_element = create_jsx_element("T", true);
        
        // Process the element
        let _transformed = jsx_element.fold_with(&mut visitor);
        
        // Should detect one unwrapped dynamic content violation
        assert_eq!(visitor.dynamic_content_violations, 1, "Should detect one unwrapped dynamic content violation");
    }

    #[test]
    fn test_t_component_with_wrapped_dynamic_content() {
        let mut visitor = TransformVisitor::new(LogLevel::Warn, LogLevel::Warn, false, Some("test.tsx".to_string()));
        
        // Simulate imports of T and Var components 
        visitor.gt_next_translation_imports.insert(Atom::from("T"));
        visitor.gt_next_variable_imports.insert(Atom::from("Var"));
        
        // Create JSX element: <T>Hello <Var>{name}</Var>!</T>
        let jsx_element = create_jsx_element_with_wrapped_content();
        
        // Process the element
        let _transformed = jsx_element.fold_with(&mut visitor);
        
        // Should NOT detect any violations since dynamic content is wrapped
        assert_eq!(visitor.dynamic_content_violations, 0, "Should not detect violations when dynamic content is wrapped in Var");
    }

    #[test]
    fn test_namespace_import_t_component() {
        let mut visitor = TransformVisitor::new(LogLevel::Warn, LogLevel::Warn, false, Some("test.tsx".to_string()));
        
        // Simulate namespace import: import * as GT from 'gt-next'
        visitor.gt_next_namespace_imports.insert(Atom::from("GT"));
        
        // Create JSX element: <GT.T>Hello {name}!</GT.T>
        let jsx_element = create_namespace_jsx_element();
        
        // Process the element
        let _transformed = jsx_element.fold_with(&mut visitor);
        
        // Should detect one unwrapped dynamic content violation
        assert_eq!(visitor.dynamic_content_violations, 1, "Should detect unwrapped dynamic content in namespace GT.T component");
    }

    #[test] 
    fn test_assigned_t_component() {
        let mut visitor = TransformVisitor::new(LogLevel::Warn, LogLevel::Warn, false, Some("test.tsx".to_string()));
        
        // Simulate import and assignment: import { T } from 'gt-next'; const MyT = T;
        visitor.gt_next_translation_imports.insert(Atom::from("T"));
        visitor.gt_assigned_translation_components.insert(Atom::from("MyT"));
        
        // Create JSX element: <MyT>Hello {name}!</MyT>
        let jsx_element = create_jsx_element("MyT", true);
        
        // Process the element
        let _transformed = jsx_element.fold_with(&mut visitor);
        
        // Should detect one unwrapped dynamic content violation
        assert_eq!(visitor.dynamic_content_violations, 1, "Should detect unwrapped dynamic content in assigned component MyT");
    }

    #[test]
    fn test_nested_t_components() {
        let mut visitor = TransformVisitor::new(LogLevel::Warn, LogLevel::Warn, false, Some("test.tsx".to_string()));
        
        // Simulate import of T component 
        visitor.gt_next_translation_imports.insert(Atom::from("T"));
        
        // Create nested JSX elements: <T>Outer {value} <T>Inner {name}</T></T>
        let jsx_element = create_nested_t_elements();
        
        // Process the element
        let _transformed = jsx_element.fold_with(&mut visitor);
        
        // Should detect TWO unwrapped dynamic content violations (one in outer T, one in inner T)
        assert_eq!(visitor.dynamic_content_violations, 2, "Should detect two unwrapped dynamic content violations in nested T components");
    }

    #[test]
    fn test_valid_t_function_call() {
        let mut visitor = TransformVisitor::new(LogLevel::Warn, LogLevel::Warn, false, Some("test.tsx".to_string()));
        
        // Simulate t function from useGT: const t = useGT();
        visitor.gt_translation_functions.insert(Atom::from("t"));
        
        // Create valid t() call: t("Hello, world!")
        let call_expr = create_call_expr("t", create_string_literal("Hello, world!"));
        
        // Process the call
        let _transformed = call_expr.fold_with(&mut visitor);
        
        // Should NOT detect any violations for valid string literal
        assert_eq!(visitor.dynamic_content_violations, 0, "Should not detect violations for valid t() call with string literal");
    }

    #[test]
    fn test_invalid_t_function_call_template_literal() {
        let mut visitor = TransformVisitor::new(LogLevel::Warn, LogLevel::Warn, false, Some("test.tsx".to_string()));
        
        // Simulate t function from useGT: const t = useGT();
        visitor.gt_translation_functions.insert(Atom::from("t"));
        
        // Create invalid t() call: t(`Hello ${name}!`)
        let call_expr = create_call_expr("t", create_template_literal());
        
        // Process the call
        let _transformed = call_expr.fold_with(&mut visitor);
        
        // Should detect one violation for template literal
        assert_eq!(visitor.dynamic_content_violations, 1, "Should detect violation for t() call with template literal");
    }

    #[test]
    fn test_invalid_t_function_call_string_concatenation() {
        let mut visitor = TransformVisitor::new(LogLevel::Warn, LogLevel::Warn, false, Some("test.tsx".to_string()));
        
        // Simulate t function from useGT: const t = useGT();
        visitor.gt_translation_functions.insert(Atom::from("t"));
        
        // Create invalid t() call: t("Hello " + name)
        let call_expr = create_call_expr("t", create_string_concatenation());
        
        // Process the call
        let _transformed = call_expr.fold_with(&mut visitor);
        
        // Should detect one violation for string concatenation
        assert_eq!(visitor.dynamic_content_violations, 1, "Should detect violation for t() call with string concatenation");
    }

    #[test]
    fn test_tx_function_call_ignored() {
        let mut visitor = TransformVisitor::new(LogLevel::Warn, LogLevel::Warn, false, Some("test.tsx".to_string()));
        
        // tx() functions should NOT be tracked for dynamic content violations
        // Even if manually added to translation functions, they should not trigger violations
        visitor.gt_translation_functions.insert(Atom::from("tx"));
        
        // Create tx() call with template literal: tx(`Hello ${name}!`)
        let call_expr = create_call_expr("tx", create_template_literal());
        
        // Process the call
        let _transformed = call_expr.fold_with(&mut visitor);
        
        // Should NOT detect any violations for tx() calls (excluded from dynamic content checks)
        assert_eq!(visitor.dynamic_content_violations, 0, "Should NOT detect violations for tx() calls - they are excluded");
    }

    #[test]
    fn test_experimental_hash_injection() {
        let mut visitor = TransformVisitor::new(LogLevel::Warn, LogLevel::Warn, true, Some("test.tsx".to_string()));
        
        // Simulate import of T component 
        visitor.gt_next_translation_imports.insert(Atom::from("T"));
        
        // Create JSX element: <T>Hello world</T>
        let jsx_element = create_jsx_element("T", false);
        
        // Process the element
        let transformed = jsx_element.fold_with(&mut visitor);
        
        // Check that hash attribute was added with a calculated value
        let has_hash_attr = transformed.opening.attrs.iter().any(|attr| {
            if let JSXAttrOrSpread::JSXAttr(jsx_attr) = attr {
                if let JSXAttrName::Ident(ident) = &jsx_attr.name {
                    if ident.sym.as_ref() == "hash" {
                        // Verify the value is a hex hash (16 characters)
                        if let Some(JSXAttrValue::Lit(Lit::Str(str_lit))) = &jsx_attr.value {
                            let hash_value = str_lit.value.as_ref();
                            return hash_value.len() == 16 && hash_value.chars().all(|c| c.is_ascii_hexdigit());
                        }
                    }
                }
            }
            false
        });
        
        assert!(has_hash_attr, "Should add calculated hash attribute to T component when experimental flag is enabled");
    }

    #[test]
    fn test_experimental_hash_injection_disabled() {
        let mut visitor = TransformVisitor::new(LogLevel::Warn, LogLevel::Warn, false, Some("test.tsx".to_string()));
        
        // Simulate import of T component 
        visitor.gt_next_translation_imports.insert(Atom::from("T"));
        
        // Create JSX element: <T>Hello world</T>
        let jsx_element = create_jsx_element("T", false);
        
        // Process the element
        let transformed = jsx_element.fold_with(&mut visitor);
        
        // Check that NO hash attribute was added
        let has_hash_attr = transformed.opening.attrs.iter().any(|attr| {
            if let JSXAttrOrSpread::JSXAttr(jsx_attr) = attr {
                if let JSXAttrName::Ident(ident) = &jsx_attr.name {
                    return ident.sym.as_ref() == "hash";
                }
            }
            false
        });
        
        assert!(!has_hash_attr, "Should NOT add hash attribute when experimental flag is disabled");
    }

    #[test]
    fn test_jsx_attributes_ignored() {
        let mut visitor = TransformVisitor::new(LogLevel::Warn, LogLevel::Warn, false, Some("test.tsx".to_string()));
        
        // Simulate import of T component 
        visitor.gt_next_translation_imports.insert(Atom::from("T"));
        
        // Create JSX element with attributes: <T><Image width={16} height={name} />Text</T>
        let jsx_element = JSXElement {
            span: DUMMY_SP,
            opening: JSXOpeningElement {
                name: JSXElementName::Ident(Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty()).into()),
                span: DUMMY_SP,
                attrs: vec![],
                self_closing: false,
                type_args: None,
            },
            closing: Some(JSXClosingElement {
                span: DUMMY_SP,
                name: JSXElementName::Ident(Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty()).into()),
            }),
            children: vec![
                // <Image width={16} height={name} />
                JSXElementChild::JSXElement(Box::new(JSXElement {
                    span: DUMMY_SP,
                    opening: JSXOpeningElement {
                        name: JSXElementName::Ident(Ident::new("Image".into(), DUMMY_SP, SyntaxContext::empty()).into()),
                        span: DUMMY_SP,
                        attrs: vec![
                            // width={16}
                            JSXAttrOrSpread::JSXAttr(JSXAttr {
                                span: DUMMY_SP,
                                name: JSXAttrName::Ident(Ident::new("width".into(), DUMMY_SP, SyntaxContext::empty()).into()),
                                value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
                                    span: DUMMY_SP,
                                    expr: JSXExpr::Expr(Box::new(Expr::Lit(Lit::Num(Number {
                                        span: DUMMY_SP,
                                        value: 16.0,
                                        raw: None,
                                    }))))
                                })),
                            }),
                            // height={name}
                            JSXAttrOrSpread::JSXAttr(JSXAttr {
                                span: DUMMY_SP,
                                name: JSXAttrName::Ident(Ident::new("height".into(), DUMMY_SP, SyntaxContext::empty()).into()),
                                value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
                                    span: DUMMY_SP,
                                    expr: JSXExpr::Expr(Box::new(Expr::Ident(Ident::new("name".into(), DUMMY_SP, SyntaxContext::empty()))))
                                })),
                            }),
                        ],
                        self_closing: true,
                        type_args: None,
                    },
                    closing: None,
                    children: vec![],
                })),
                // Text content
                JSXElementChild::JSXText(JSXText {
                    span: DUMMY_SP,
                    value: "Text".into(),
                    raw: "Text".into(),
                }),
            ],
        };
        
        // Process the element
        let _transformed = jsx_element.fold_with(&mut visitor);
        
        // Should NOT detect any violations since the expressions are in attributes, not content
        assert_eq!(visitor.dynamic_content_violations, 0, "Should not detect violations for JSX attribute expressions like width={{16}} and height={{name}}");
    }

    #[test]
    fn test_t_function_assignment_from_use_gt() {
        let mut visitor = TransformVisitor::new(LogLevel::Warn, LogLevel::Warn, false, Some("test.tsx".to_string()));
        
        // Simulate useGT import: import { useGT } from 'gt-next';
        visitor.gt_translation_functions.insert(Atom::from("useGT"));
        
        // Process assignment: const t = useGT();
        let var_declarator = create_var_declarator_with_call();
        let _transformed = var_declarator.fold_with(&mut visitor);
        
        // Verify that 't' is now tracked as a translation function
        assert!(visitor.gt_translation_functions.contains(&Atom::from("t")), "Should track 't' as translation function after useGT() assignment");
        
        // Now test invalid usage of the assigned 't' function
        let call_expr = create_call_expr("t", create_template_literal());
        let _transformed_call = call_expr.fold_with(&mut visitor);
        
        // Should detect one violation for the assigned t() function
        assert_eq!(visitor.dynamic_content_violations, 1, "Should detect violation for assigned t() function with template literal");
    }

    // Configuration parsing tests
    
    #[test]
    fn test_plugin_config_default() {
        let config = PluginConfig::default();
        
        assert_eq!(config.experimental_compile_time_hash, false);
        assert!(matches!(config.dynamic_jsx_check_log_level, LogLevel::Warn));
        assert!(matches!(config.dynamic_string_check_log_level, LogLevel::Warn));
    }

    #[test]
    fn test_plugin_config_parse_experimental_hash_true() {
        let json = r#"{"experimentalCompileTimeHash": true}"#;
        let config: PluginConfig = serde_json::from_str(json).unwrap();
        
        assert_eq!(config.experimental_compile_time_hash, true);
        // Other fields should use defaults
        assert!(matches!(config.dynamic_jsx_check_log_level, LogLevel::Warn));
        assert!(matches!(config.dynamic_string_check_log_level, LogLevel::Warn));
    }

    #[test]
    fn test_plugin_config_parse_experimental_hash_false() {
        let json = r#"{"experimentalCompileTimeHash": false}"#;
        let config: PluginConfig = serde_json::from_str(json).unwrap();
        
        assert_eq!(config.experimental_compile_time_hash, false);
    }

    #[test]
    fn test_plugin_config_parse_full_config() {
        let json = r#"{
            "dynamicJsxCheckLogLevel": "error",
            "dynamicStringCheckLogLevel": "info",
            "experimentalCompileTimeHash": true
        }"#;
        let config: PluginConfig = serde_json::from_str(json).unwrap();
        
        assert_eq!(config.experimental_compile_time_hash, true);
        assert!(matches!(config.dynamic_jsx_check_log_level, LogLevel::Error));
        assert!(matches!(config.dynamic_string_check_log_level, LogLevel::Info));
    }

    #[test]
    fn test_plugin_config_parse_empty_json() {
        let json = r#"{}"#;
        let config: PluginConfig = serde_json::from_str(json).unwrap();
        
        // All fields should use their defaults
        assert_eq!(config.experimental_compile_time_hash, false);
        assert!(matches!(config.dynamic_jsx_check_log_level, LogLevel::Warn));
        assert!(matches!(config.dynamic_string_check_log_level, LogLevel::Warn));
    }

    #[test]
    fn test_plugin_config_parse_partial_config() {
        let json = r#"{"dynamicJsxCheckLogLevel": "silent"}"#;
        let config: PluginConfig = serde_json::from_str(json).unwrap();
        
        // Specified field should be set
        assert!(matches!(config.dynamic_jsx_check_log_level, LogLevel::Silent));
        // Others should use defaults
        assert_eq!(config.experimental_compile_time_hash, false);
        assert!(matches!(config.dynamic_string_check_log_level, LogLevel::Warn));
    }

    #[test]
    fn test_plugin_config_camel_case_conversion() {
        // Test that camelCase JSON keys are properly converted to snake_case Rust fields
        let json = r#"{
            "dynamicJsxCheckLogLevel": "error",
            "dynamicStringCheckLogLevel": "info", 
            "experimentalCompileTimeHash": true
        }"#;
        let config: PluginConfig = serde_json::from_str(json).unwrap();
        
        // All fields should be parsed correctly
        assert!(matches!(config.dynamic_jsx_check_log_level, LogLevel::Error));
        assert!(matches!(config.dynamic_string_check_log_level, LogLevel::Info));
        assert_eq!(config.experimental_compile_time_hash, true);
    }

    #[test]
    fn test_plugin_config_invalid_json_fallback() {
        let invalid_json = r#"{"invalid": syntax}"#;
        let config: PluginConfig = serde_json::from_str(invalid_json).unwrap_or_default();
        
        // Should fallback to defaults when JSON is invalid
        assert_eq!(config.experimental_compile_time_hash, false);
        assert!(matches!(config.dynamic_jsx_check_log_level, LogLevel::Warn));
        assert!(matches!(config.dynamic_string_check_log_level, LogLevel::Warn));
    }

    #[test]
    fn test_complex_jsx_structure_whitespace_normalization() {
        use swc_core::ecma::ast::*;
        use swc_core::common::{Span, BytePos};
        use crate::hash::{JsxHasher, SanitizedData, SanitizedChildren, SanitizedChild};
        use crate::traversal::JsxTraversal;
        
        // Test case similar to the complex JSX structure provided by user
        let visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, true, None);
        
        // Create a JSX text element with multiline content and extra whitespace
        let jsx_text_with_whitespace = JSXText {
            span: Span::new(BytePos(0), BytePos(1)),
            value: "This is a comprehensive guide to help you get started with our\n                amazing platform. We provide everything you need to succeed in\n                your journey.".into(),
            raw: "This is a comprehensive guide to help you get started with our\n                amazing platform. We provide everything you need to succeed in\n                your journey.".into(),
        };
        
        let jsx_child = JSXElementChild::JSXText(jsx_text_with_whitespace);
        
        // Build sanitized child and verify whitespace normalization
        let traversal = JsxTraversal::new(&visitor);
        let result = traversal.build_sanitized_child(&jsx_child);
        
        match result {
            Some(SanitizedChild::Text(text)) => {
                // Should be normalized to single spaces
                let expected = "This is a comprehensive guide to help you get started with our amazing platform. We provide everything you need to succeed in your journey.";
                assert_eq!(text, expected);
                
                // Verify no extra whitespace remains
                assert!(!text.contains("\n"), "Should not contain newlines");
                assert!(!text.contains("  "), "Should not contain double spaces");
                
                // Test that the normalized text produces consistent hashes
                let children = SanitizedChildren::Single(Box::new(SanitizedChild::Text(text.clone())));
                let data = SanitizedData {
                    source: Some(Box::new(children)),
                    id: None,
                    context: None,
                    data_format: Some("JSX".to_string()),
                };
                
                let hash1 = JsxHasher::hash_string(&JsxHasher::stable_stringify(&data).unwrap());
                let hash2 = JsxHasher::hash_string(&JsxHasher::stable_stringify(&data).unwrap());
                
                assert_eq!(hash1, hash2, "Normalized text should produce consistent hashes");
                assert_eq!(hash1.len(), 16, "Hash should be 16 characters");
            },
            _ => panic!("Expected SanitizedChild::Text, got {:?}", result),
        }
    }

    #[test]
    fn test_branch_component_hash_injection() {
        // Test Branch component with experimental hash feature
        let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, true, None);
        
        // Simulate import of Branch component 
        visitor.gt_next_translation_imports.insert(Atom::from("Branch"));
        
        // Create a Branch component: <Branch n="file" file="file.svg" directory="public" />
        let branch_element = JSXElement {
            span: DUMMY_SP,
            opening: JSXOpeningElement {
                name: JSXElementName::Ident(Ident::new("Branch".into(), DUMMY_SP, SyntaxContext::empty()).into()),
                span: DUMMY_SP,
                attrs: vec![
                    JSXAttrOrSpread::JSXAttr(JSXAttr {
                        span: DUMMY_SP,
                        name: JSXAttrName::Ident(Ident::new("n".into(), DUMMY_SP, SyntaxContext::empty()).into()),
                        value: Some(JSXAttrValue::Lit(Lit::Str(Str {
                            span: DUMMY_SP,
                            value: "file".into(),
                            raw: None,
                        }))),
                    }),
                    JSXAttrOrSpread::JSXAttr(JSXAttr {
                        span: DUMMY_SP,
                        name: JSXAttrName::Ident(Ident::new("file".into(), DUMMY_SP, SyntaxContext::empty()).into()),
                        value: Some(JSXAttrValue::Lit(Lit::Str(Str {
                            span: DUMMY_SP,
                            value: "file.svg".into(),
                            raw: None,
                        }))),
                    }),
                    JSXAttrOrSpread::JSXAttr(JSXAttr {
                        span: DUMMY_SP,
                        name: JSXAttrName::Ident(Ident::new("directory".into(), DUMMY_SP, SyntaxContext::empty()).into()),
                        value: Some(JSXAttrValue::Lit(Lit::Str(Str {
                            span: DUMMY_SP,
                            value: "public".into(),
                            raw: None,
                        }))),
                    }),
                ],
                self_closing: true,
                type_args: None,
            },
            closing: None,
            children: vec![],
        };
        
        // Process the element
        let transformed = branch_element.fold_with(&mut visitor);
        
        // Check that hash attribute was added with a calculated value
        let hash_attr = transformed.opening.attrs.iter().find_map(|attr| {
            if let JSXAttrOrSpread::JSXAttr(jsx_attr) = attr {
                if let JSXAttrName::Ident(ident) = &jsx_attr.name {
                    if ident.sym.as_ref() == "hash" {
                        if let Some(JSXAttrValue::Lit(Lit::Str(str_lit))) = &jsx_attr.value {
                            return Some(str_lit.value.as_ref());
                        }
                    }
                }
            }
            None
        });
        
        assert!(hash_attr.is_some(), "Should add hash attribute to Branch component");
        let hash_value = hash_attr.unwrap();
        assert_eq!(hash_value.len(), 16, "Hash should be 16 characters long");
        assert!(hash_value.chars().all(|c| c.is_ascii_hexdigit()), "Hash should be hexadecimal");
    }

    #[test]
    fn test_branch_component_structure_serialization() {
        // Test that Branch components are serialized as variables with correct structure
        use crate::hash::{SanitizedChildren, SanitizedChild};
        use crate::traversal::JsxTraversal;
        use swc_core::ecma::atoms::Atom;
        
        let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, true, None);
        // Set up import tracking for Branch component
        visitor.gt_next_branch_import_aliases.insert(Atom::from("Branch"), Atom::from("Branch"));
        let traversal = JsxTraversal::new(&visitor);
        
        // Create a Branch element with attributes
        let branch_element = JSXElement {
            span: DUMMY_SP,
            opening: JSXOpeningElement {
                name: JSXElementName::Ident(Ident::new("Branch".into(), DUMMY_SP, SyntaxContext::empty()).into()),
                span: DUMMY_SP,
                attrs: vec![
                    JSXAttrOrSpread::JSXAttr(JSXAttr {
                        span: DUMMY_SP,
                        name: JSXAttrName::Ident(Ident::new("n".into(), DUMMY_SP, SyntaxContext::empty()).into()),
                        value: Some(JSXAttrValue::Lit(Lit::Str(Str {
                            span: DUMMY_SP,
                            value: "file".into(),
                            raw: None,
                        }))),
                    }),
                    JSXAttrOrSpread::JSXAttr(JSXAttr {
                        span: DUMMY_SP,
                        name: JSXAttrName::Ident(Ident::new("file".into(), DUMMY_SP, SyntaxContext::empty()).into()),
                        value: Some(JSXAttrValue::Lit(Lit::Str(Str {
                            span: DUMMY_SP,
                            value: "file.svg".into(),
                            raw: None,
                        }))),
                    }),
                ],
                self_closing: true,
                type_args: None,
            },
            closing: None,
            children: vec![],
        };
        
        let jsx_child = JSXElementChild::JSXElement(Box::new(branch_element));
        let result = traversal.build_sanitized_child(&jsx_child);
        
        match result {
            Some(SanitizedChild::Variable(var)) => {
                // Should be serialized as a variable with branch structure
                assert!(var.k.is_none(), "Branch should not have a key");
                assert!(var.v.is_none(), "Branch should not have a variable type");
                assert!(var.b.is_some(), "Branch should have branch data");
                assert_eq!(var.t, Some("b".to_string()), "Branch should have transformation type 'b'");
                
                // Check branch data contains expected attributes
                let branches = var.b.as_ref().unwrap();
                assert!(branches.contains_key("n"), "Should contain 'n' branch");
                assert!(branches.contains_key("file"), "Should contain 'file' branch");
                // Hash is no longer injected into Branch/Plural components
                
                // Verify serialization structure matches expected runtime format
                let json = serde_json::to_string(&var).unwrap();
                assert!(json.contains(r#""b":"#), "Should serialize with 'b' field");
                assert!(json.contains(r#""t":"b""#), "Should serialize with transformation type 'b'");
                assert!(!json.contains(r#""k":"#), "Should not serialize with 'k' field");
                assert!(!json.contains(r#""v":"#), "Should not serialize with 'v' field");
            },
            _ => panic!("Branch component should be serialized as SanitizedChild::Variable, got {:?}", result),
        }
    }

    #[test]
    fn test_complex_real_world_jsx_with_branch() {
        // Test case based on the actual user-provided complex JSX structure
        use crate::hash::{JsxHasher, SanitizedData, SanitizedChildren, SanitizedChild, SanitizedVariable};
        use crate::traversal::JsxTraversal;
        use swc_core::ecma::atoms::Atom;
        
        let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, true, None);
        // Set up import tracking for Branch component
        visitor.gt_next_branch_import_aliases.insert(Atom::from("Branch"), Atom::from("Branch"));
        let traversal = JsxTraversal::new(&visitor);
        
        // Create structure similar to: "Welcome to Our Platform change"
        let _welcome_text = JSXText {
            span: DUMMY_SP,
            value: "Welcome to Our Platform change".into(),
            raw: "Welcome to Our Platform change".into(),
        };
        
        // Create structure with whitespace normalization: multiline text
        let guide_text = JSXText {
            span: DUMMY_SP,
            value: "This is a comprehensive guide to help you get started with our\n                amazing platform. We provide everything you need to succeed in\n                your journey.".into(),
            raw: "This is a comprehensive guide to help you get started with our\n                amazing platform. We provide everything you need to succeed in\n                your journey.".into(),
        };
        
        // Test whitespace normalization
        let guide_child = JSXElementChild::JSXText(guide_text);
        let normalized_result = traversal.build_sanitized_child(&guide_child);
        
        match normalized_result {
            Some(SanitizedChild::Text(text)) => {
                let expected = "This is a comprehensive guide to help you get started with our amazing platform. We provide everything you need to succeed in your journey.";
                assert_eq!(text, expected, "Should normalize whitespace in multiline text");
            },
            _ => panic!("Expected normalized text"),
        }
        
        // Create a Branch component within the complex structure
        let branch_element = JSXElement {
            span: DUMMY_SP,
            opening: JSXOpeningElement {
                name: JSXElementName::Ident(Ident::new("Branch".into(), DUMMY_SP, SyntaxContext::empty()).into()),
                span: DUMMY_SP,
                attrs: vec![
                    JSXAttrOrSpread::JSXAttr(JSXAttr {
                        span: DUMMY_SP,
                        name: JSXAttrName::Ident(Ident::new("n".into(), DUMMY_SP, SyntaxContext::empty()).into()),
                        value: Some(JSXAttrValue::Lit(Lit::Str(Str {
                            span: DUMMY_SP,
                            value: "file".into(),
                            raw: None,
                        }))),
                    }),
                    JSXAttrOrSpread::JSXAttr(JSXAttr {
                        span: DUMMY_SP,
                        name: JSXAttrName::Ident(Ident::new("file".into(), DUMMY_SP, SyntaxContext::empty()).into()),
                        value: Some(JSXAttrValue::Lit(Lit::Str(Str {
                            span: DUMMY_SP,
                            value: "file.svg".into(),
                            raw: None,
                        }))),
                    }),
                    JSXAttrOrSpread::JSXAttr(JSXAttr {
                        span: DUMMY_SP,
                        name: JSXAttrName::Ident(Ident::new("directory".into(), DUMMY_SP, SyntaxContext::empty()).into()),
                        value: Some(JSXAttrValue::Lit(Lit::Str(Str {
                            span: DUMMY_SP,
                            value: "public".into(),
                            raw: None,
                        }))),
                    }),
                ],
                self_closing: true,
                type_args: None,
            },
            closing: None,
            children: vec![],
        };
        
        let branch_child = JSXElementChild::JSXElement(Box::new(branch_element));
        let branch_result = traversal.build_sanitized_child(&branch_child);
        
        // Verify Branch serializes correctly with hash
        match branch_result {
            Some(SanitizedChild::Variable(branch_var)) => {
                assert_eq!(branch_var.t, Some("b".to_string()));
                assert!(branch_var.b.is_some());
                
                let branches = branch_var.b.unwrap();
                // Hash is no longer injected into Branch/Plural components
                
                // Create a complex structure with the Branch component
                let complex_children = SanitizedChildren::Multiple(vec![
                    SanitizedChild::Text("Welcome to Our Platform change".to_string()),
                    SanitizedChild::Text("Key Features".to_string()),
                    SanitizedChild::Variable(SanitizedVariable {
                        k: None,
                        v: None,
                        b: Some(branches),
                        t: Some("b".to_string()),
                    }),
                    SanitizedChild::Text("Advanced file management".to_string()),
                ]);
                
                let data = SanitizedData {
                    source: Some(Box::new(complex_children)),
                    id: None,
                    context: None,
                    data_format: Some("JSX".to_string()),
                };
                
                // Verify stable stringify produces consistent results
                let json1 = JsxHasher::stable_stringify(&data).unwrap();
                let json2 = JsxHasher::stable_stringify(&data).unwrap();
                assert_eq!(json1, json2, "Stable stringify should be consistent");
                
                let hash1 = JsxHasher::hash_string(&json1);
                let hash2 = JsxHasher::hash_string(&json2);
                assert_eq!(hash1, hash2, "Complex structure with Branch should produce consistent hashes");
                
                // Verify the JSON structure contains the Branch in the expected format
                assert!(json1.contains(r#""b":{"#), "JSON should contain branch structure");
                assert!(json1.contains(r#""t":"b""#), "JSON should contain transformation type");
                // Hash is no longer injected into Branch/Plural components
            },
            _ => panic!("Branch should be serialized as Variable"),
        }
    }

    #[test]
    fn test_end_to_end_hash_consistency() {
        // Test that simulates the full end-to-end hash calculation flow
        // This should match the exact scenario from the user's real-world case
        use crate::hash::{JsxHasher, SanitizedData, SanitizedChildren, SanitizedChild, SanitizedVariable};
        
        // Create the exact structure that caused the hash mismatch
        let branch_with_hash = {
            let mut branches = std::collections::BTreeMap::new();
            branches.insert("directory".to_string(), Box::new(
                SanitizedChildren::Single(Box::new(SanitizedChild::Text("public".to_string())))
            ));
            branches.insert("file".to_string(), Box::new(
                SanitizedChildren::Single(Box::new(SanitizedChild::Text("file.svg".to_string())))
            ));
            branches.insert("n".to_string(), Box::new(
                SanitizedChildren::Single(Box::new(SanitizedChild::Text("file".to_string())))
            ));
            // Add the expected runtime hash
            branches.insert("hash".to_string(), Box::new(
                SanitizedChildren::Single(Box::new(SanitizedChild::Text("bdb7cc7686d0e468".to_string())))
            ));
            
            SanitizedVariable {
                k: None,
                v: None,
                b: Some(branches),
                t: Some("b".to_string()),
            }
        };
        
        // Create complex nested structure similar to user's real case
        let complex_structure = SanitizedChildren::Multiple(vec![
            SanitizedChild::Text("Welcome to Our Platform change".to_string()),
            // Nested structure with Branch component
            SanitizedChild::Text("Key Features".to_string()),
            SanitizedChild::Variable(branch_with_hash.clone()),
            SanitizedChild::Text("Advanced file management".to_string()),
        ]);
        
        let data = SanitizedData {
            source: Some(Box::new(complex_structure)),
            id: None,
            context: None,
            data_format: Some("JSX".to_string()),
        };
        
        // Calculate hash using our stable stringify
        let json_string = JsxHasher::stable_stringify(&data).unwrap();
        let build_time_hash = JsxHasher::hash_string(&json_string);
        
        println!("End-to-end test - Build-time hash: {}", build_time_hash);
        println!("End-to-end test - JSON structure: {}", json_string);
        
        // Verify the JSON contains expected structures
        assert!(json_string.contains(r#"dataFormat":"JSX""#), "Should contain dataFormat");
        assert!(json_string.contains(r#""b":{"directory":"public""#), "Should contain branch directory");
        assert!(json_string.contains(r#""file":"file.svg""#), "Should contain branch file");
        assert!(json_string.contains(r#""hash":"bdb7cc7686d0e468""#), "Should contain branch hash");
        assert!(json_string.contains(r#""n":"file""#), "Should contain branch n property");
        assert!(json_string.contains(r#""t":"b""#), "Should contain branch transformation type");
        
        // Verify alphabetical key ordering in Branch structure
        let branch_start = json_string.find(r#""b":{"#).unwrap();
        let branch_section = &json_string[branch_start..];
        
        // Keys should appear in alphabetical order: directory, file, hash, n
        let dir_pos = branch_section.find("directory").unwrap();
        let file_pos = branch_section.find("file").unwrap(); 
        let hash_pos = branch_section.find("hash").unwrap();
        let n_pos = branch_section.find("\"n\":").unwrap(); // Use exact match to avoid matching "n" in other words
        
        assert!(dir_pos < file_pos, "directory should come before file");
        assert!(file_pos < hash_pos, "file should come before hash"); 
        assert!(hash_pos < n_pos, "hash should come before n");
        
        // Hash should be consistent and valid
        assert_eq!(build_time_hash.len(), 16, "Hash should be 16 characters");
        assert!(build_time_hash.chars().all(|c| c.is_ascii_hexdigit()), "Hash should be hexadecimal");
        
        // Test that the same structure produces the same hash (consistency check)
        let json_string2 = JsxHasher::stable_stringify(&data).unwrap();
        let build_time_hash2 = JsxHasher::hash_string(&json_string2);
        assert_eq!(build_time_hash, build_time_hash2, "Hash calculation should be deterministic");
        assert_eq!(json_string, json_string2, "JSON serialization should be deterministic");
    }

    #[test]
    fn test_plural_component_structure_serialization() {
        // Test that Plural components are serialized as variables with correct structure
        use crate::hash::{SanitizedChildren, SanitizedChild};
        use crate::traversal::JsxTraversal;
        use swc_core::ecma::atoms::Atom;
        
        let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, true, None);
        // Set up import tracking for Plural component
        visitor.gt_next_branch_import_aliases.insert(Atom::from("Plural"), Atom::from("Plural"));
        let traversal = JsxTraversal::new(&visitor);
        
        // Create a Plural element with attributes
        let plural_element = JSXElement {
            span: DUMMY_SP,
            opening: JSXOpeningElement {
                name: JSXElementName::Ident(Ident::new("Plural".into(), DUMMY_SP, SyntaxContext::empty()).into()),
                span: DUMMY_SP,
                attrs: vec![
                    JSXAttrOrSpread::JSXAttr(JSXAttr {
                        span: DUMMY_SP,
                        name: JSXAttrName::Ident(Ident::new("singular".into(), DUMMY_SP, SyntaxContext::empty()).into()),
                        value: Some(JSXAttrValue::Lit(Lit::Str(Str {
                            span: DUMMY_SP,
                            value: "File".into(),
                            raw: None,
                        }))),
                    }),
                    JSXAttrOrSpread::JSXAttr(JSXAttr {
                        span: DUMMY_SP,
                        name: JSXAttrName::Ident(Ident::new("plural".into(), DUMMY_SP, SyntaxContext::empty()).into()),
                        value: Some(JSXAttrValue::Lit(Lit::Str(Str {
                            span: DUMMY_SP,
                            value: "Files".into(),
                            raw: None,
                        }))),
                    }),
                ],
                self_closing: true,
                type_args: None,
            },
            closing: None,
            children: vec![],
        };
        
        let jsx_child = JSXElementChild::JSXElement(Box::new(plural_element));
        let result = traversal.build_sanitized_child(&jsx_child);
        
        match result {
            Some(SanitizedChild::Variable(var)) => {
                // Should be serialized as a variable with plural structure
                assert!(var.k.is_none(), "Plural should not have a key");
                assert!(var.v.is_none(), "Plural should not have a variable type");
                assert!(var.b.is_some(), "Plural should have branch data");
                assert_eq!(var.t, Some("p".to_string()), "Plural should have transformation type 'p'");
                
                // Check plural data contains expected attributes
                let branches = var.b.as_ref().unwrap();
                assert!(branches.contains_key("singular"), "Should contain 'singular' branch");
                assert!(branches.contains_key("plural"), "Should contain 'plural' branch");
                // Hash is no longer injected into Branch/Plural components
                
                // Verify serialization structure matches expected runtime format (should be like Branch)
                let json = serde_json::to_string(&var).unwrap();
                assert!(json.contains(r#""b":"#), "Should serialize with 'b' field");
                assert!(json.contains(r#""t":"p""#), "Should serialize with transformation type 'p'");
                assert!(!json.contains(r#""k":"#), "Should not serialize with 'k' field");
                assert!(!json.contains(r#""v":"#), "Should not serialize with 'v' field");
                
                println!("Plural component serialized as: {}", json);
            },
            _ => panic!("Plural component should be serialized as SanitizedChild::Variable, got {:?}", result),
        }
    }

    #[test]
    fn test_jsx_content_in_attributes() {
        // Test Branch/Plural components with JSX content in attributes
        use crate::hash::{SanitizedChildren, SanitizedChild, JsxHasher, SanitizedData};
        use crate::traversal::JsxTraversal;
        use swc_core::ecma::atoms::Atom;
        
        let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, true, None);
        // Set up import tracking for Branch component
        visitor.gt_next_branch_import_aliases.insert(Atom::from("Branch"), Atom::from("Branch"));
        let traversal = JsxTraversal::new(&visitor);
        
        // Create a Branch component with JSX fragment in file attribute: file={<>Here is some translatable static content</>}
        let jsx_fragment = JSXFragment {
            span: DUMMY_SP,
            opening: JSXOpeningFragment { span: DUMMY_SP },
            children: vec![
                JSXElementChild::JSXText(JSXText {
                    span: DUMMY_SP,
                    value: "Here is some translatable static content".into(),
                    raw: "Here is some translatable static content".into(),
                }),
            ],
            closing: JSXClosingFragment { span: DUMMY_SP },
        };
        
        let branch_element = JSXElement {
            span: DUMMY_SP,
            opening: JSXOpeningElement {
                name: JSXElementName::Ident(Ident::new("Branch".into(), DUMMY_SP, SyntaxContext::empty()).into()),
                span: DUMMY_SP,
                attrs: vec![
                    JSXAttrOrSpread::JSXAttr(JSXAttr {
                        span: DUMMY_SP,
                        name: JSXAttrName::Ident(Ident::new("branch".into(), DUMMY_SP, SyntaxContext::empty()).into()),
                        value: Some(JSXAttrValue::Lit(Lit::Str(Str {
                            span: DUMMY_SP,
                            value: "file".into(),
                            raw: None,
                        }))),
                    }),
                    JSXAttrOrSpread::JSXAttr(JSXAttr {
                        span: DUMMY_SP,
                        name: JSXAttrName::Ident(Ident::new("file".into(), DUMMY_SP, SyntaxContext::empty()).into()),
                        value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
                            span: DUMMY_SP,
                            expr: JSXExpr::Expr(Box::new(Expr::JSXFragment(jsx_fragment))),
                        })),
                    }),
                    JSXAttrOrSpread::JSXAttr(JSXAttr {
                        span: DUMMY_SP,
                        name: JSXAttrName::Ident(Ident::new("directory".into(), DUMMY_SP, SyntaxContext::empty()).into()),
                        value: Some(JSXAttrValue::Lit(Lit::Str(Str {
                            span: DUMMY_SP,
                            value: "public".into(),
                            raw: None,
                        }))),
                    }),
                ],
                self_closing: true,
                type_args: None,
            },
            closing: None,
            children: vec![],
        };
        
        let jsx_child = JSXElementChild::JSXElement(Box::new(branch_element));
        let result = traversal.build_sanitized_child(&jsx_child);
        
        match result {
            Some(SanitizedChild::Variable(var)) => {
                assert_eq!(var.t, Some("b".to_string()), "Should be Branch component");
                assert!(var.b.is_some(), "Should have branch data");
                
                let branches = var.b.as_ref().unwrap();
                
                // Should contain the JSX fragment content
                assert!(branches.contains_key("file"), "Should contain 'file' branch");
                
                if let Some(file_children) = branches.get("file") {
                    // The JSX fragment should be wrapped in a container structure
                    match file_children.as_ref() {
                        SanitizedChildren::Wrapped { c } => {
                            // Check the wrapped content (for JSX content)
                            match c.as_ref() {
                                SanitizedChildren::Single(child) => {
                                    if let SanitizedChild::Text(text) = child.as_ref() {
                                        assert_eq!(text, "Here is some translatable static content", "Should contain the JSX fragment text");
                                    } else {
                                        panic!("Expected text child in wrapped file attribute, got {:?}", child);
                                    }
                                },
                                _ => {
                                    panic!("Expected single wrapped child for simple text fragment, got {:?}", c);
                                }
                            }
                        },
                        SanitizedChildren::Single(child) => {
                            if let SanitizedChild::Text(text) = child.as_ref() {
                                assert_eq!(text, "Here is some translatable static content", "Should contain the JSX fragment text");
                            } else {
                                panic!("Expected text child in file attribute, got {:?}", child);
                            }
                        },
                        SanitizedChildren::Multiple(_) => {
                            panic!("Expected single child for simple text fragment");
                        }
                    }
                }
                
                // Verify the full serialization includes the JSX content correctly
                let json = serde_json::to_string(&var).unwrap();
                println!("Branch with JSX attribute serialized as: {}", json);
                
                // Should contain the nested structure for file attribute with wrapped format
                assert!(json.contains(r#""file":{"c":"Here is some translatable static content"}"#), 
                       "Should serialize JSX fragment content with wrapped format like runtime");
                
                // Test full structure with this component
                let complex_children = SanitizedChildren::Single(Box::new(SanitizedChild::Variable(var.clone())));
                let data = SanitizedData {
                    source: Some(Box::new(complex_children)),
                    id: None,
                    context: None,
                    data_format: Some("JSX".to_string()),
                };
                
                let json_string = JsxHasher::stable_stringify(&data).unwrap();
                println!("Full structure with JSX attribute: {}", json_string);
                
                // Should contain the expected JSX content structure that matches runtime  
                assert!(json_string.contains(r#""file":{"c":"Here is some translatable static content"}"#), 
                       "Full structure should include JSX attribute content with wrapped format");
            },
            _ => panic!("Branch with JSX attribute should be serialized as Variable, got {:?}", result),
        }
    }

    #[test]
    fn test_comprehensive_hash_cases_simple_text() {
        // Test case: Normal text
        use crate::hash::{JsxHasher, SanitizedData, SanitizedChildren, SanitizedChild};
        
        let children = SanitizedChildren::Single(Box::new(SanitizedChild::Text("Normal text".to_string())));
        let data = SanitizedData {
            source: Some(Box::new(children)),
            id: None,
            context: None,
            data_format: Some("JSX".to_string()),
        };
        
        let json_string = JsxHasher::stable_stringify(&data).unwrap();
        let hash = JsxHasher::hash_string(&json_string);
        
        // Expected: a9e7bf1adac1e8ec
        assert_eq!(hash, "a9e7bf1adac1e8ec", "Simple text hash should match expected value");
        assert_eq!(json_string, r#"{"dataFormat":"JSX","source":"Normal text"}"#, "JSON should match expected stringification");
    }

    #[test] 
    fn test_comprehensive_hash_cases_nested_elements() {
        // Test case: Normal text with nested div element
        use crate::hash::{JsxHasher, SanitizedData, SanitizedChildren, SanitizedChild, SanitizedElement};
        
        let nested_element = SanitizedElement {
            t: None, // Non-GT elements have no tag name to match runtime behavior
            d: None,
            c: Some(Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Text("and some nesting".to_string())))))
        };
        
        let children = SanitizedChildren::Multiple(vec![
            SanitizedChild::Text("Normal text ".to_string()),
            SanitizedChild::Element(Box::new(nested_element))
        ]);
        
        let data = SanitizedData {
            source: Some(Box::new(children)),
            id: None,
            context: None,
            data_format: Some("JSX".to_string()),
        };
        
        let json_string = JsxHasher::stable_stringify(&data).unwrap();
        let hash = JsxHasher::hash_string(&json_string);
        
        // Expected: 272f94a21847be08
        assert_eq!(hash, "272f94a21847be08", "Nested elements hash should match expected value");
        assert_eq!(json_string, r#"{"dataFormat":"JSX","source":["Normal text ",{"c":"and some nesting"}]}"#, "JSON should match expected stringification for nested elements");
    }

    #[test]
    fn test_comprehensive_hash_cases_fragment_nesting() {
        // Test case: Normal text with fragment nesting (C1 component)
        use crate::hash::{JsxHasher, SanitizedData, SanitizedChildren, SanitizedChild, SanitizedElement};
        
        let fragment_element = SanitizedElement {
            t: None, // Fragment components (C1, C2, etc.) have no tag name 
            d: None,
            c: Some(Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Text("and some nesting in a fragment".to_string())))))
        };
        
        let children = SanitizedChildren::Multiple(vec![
            SanitizedChild::Text("Normal text ".to_string()),
            SanitizedChild::Element(Box::new(fragment_element))
        ]);
        
        let data = SanitizedData {
            source: Some(Box::new(children)),
            id: None,
            context: None,
            data_format: Some("JSX".to_string()),
        };
        
        let json_string = JsxHasher::stable_stringify(&data).unwrap();
        let hash = JsxHasher::hash_string(&json_string);
        
        // Expected: a5644d2bc5b8d763
        assert_eq!(hash, "a5644d2bc5b8d763", "Fragment nesting hash should match expected value");
        assert_eq!(json_string, r#"{"dataFormat":"JSX","source":["Normal text ",{"c":"and some nesting in a fragment"}]}"#, "JSON should match expected stringification for fragment");
    }

    #[test]
    fn test_comprehensive_hash_cases_deep_nesting() {
        // Test case: Deep nested structure
        use crate::hash::{JsxHasher, SanitizedData, SanitizedChildren, SanitizedChild, SanitizedElement};
        
        // Build the deeply nested structure: deep <div>nesting</div>
        let deepest_element = SanitizedElement {
            t: None,
            d: None,
            c: Some(Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Text("nesting".to_string())))))
        };
        
        let deep_element = SanitizedElement {
            t: None,
            d: None,
            c: Some(Box::new(SanitizedChildren::Multiple(vec![
                SanitizedChild::Text("deep ".to_string()),
                SanitizedChild::Element(Box::new(deepest_element))
            ])))
        };
        
        let some_element = SanitizedElement {
            t: None,
            d: None,
            c: Some(Box::new(SanitizedChildren::Multiple(vec![
                SanitizedChild::Text("some".to_string()),
                SanitizedChild::Text(" ".to_string()),
                SanitizedChild::Element(Box::new(deep_element))
            ])))
        };
        
        let and_element = SanitizedElement {
            t: None,
            d: None,
            c: Some(Box::new(SanitizedChildren::Multiple(vec![
                SanitizedChild::Text("and".to_string()),
                SanitizedChild::Text(" ".to_string()),
                SanitizedChild::Element(Box::new(some_element))
            ])))
        };
        
        let children = SanitizedChildren::Multiple(vec![
            SanitizedChild::Text("Normal text".to_string()),
            SanitizedChild::Text(" ".to_string()),
            SanitizedChild::Element(Box::new(and_element))
        ]);
        
        let data = SanitizedData {
            source: Some(Box::new(children)),
            id: None,
            context: None,
            data_format: Some("JSX".to_string()),
        };
        
        let json_string = JsxHasher::stable_stringify(&data).unwrap();
        let hash = JsxHasher::hash_string(&json_string);
        
        // Expected: 5a4f590b6a4f90ae
        assert_eq!(hash, "5a4f590b6a4f90ae", "Deep nesting hash should match expected value");
        assert_eq!(json_string, r#"{"dataFormat":"JSX","source":["Normal text"," ",{"c":["and"," ",{"c":["some"," ",{"c":["deep ",{"c":"nesting"}]}]}]}]}"#, "JSON should match expected stringification for deep nesting");
    }

    #[test]
    fn test_comprehensive_hash_cases_variables() {
        // Test variable components: Currency, Var, DateTime, Num
        use crate::hash::{JsxHasher, SanitizedData, SanitizedChildren, SanitizedChild, SanitizedVariable, VariableType};
        
        // Currency variable
        let currency_var = SanitizedVariable {
            k: Some("_gt_cost_1".to_string()),
            v: Some(VariableType::Currency),
            b: None,
            t: None,
        };
        let currency_data = SanitizedData {
            source: Some(Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Variable(currency_var))))),
            id: None,
            context: None,
            data_format: Some("JSX".to_string()),
        };
        let currency_json = JsxHasher::stable_stringify(&currency_data).unwrap();
        let currency_hash = JsxHasher::hash_string(&currency_json);
        assert_eq!(currency_hash, "ca1ff7d6802b1d46", "Currency variable hash should match expected value");
        assert_eq!(currency_json, r#"{"dataFormat":"JSX","source":{"k":"_gt_cost_1","v":"c"}}"#, "Currency JSON should match expected format");

        // Regular Var variable
        let var_variable = SanitizedVariable {
            k: Some("_gt_value_1".to_string()),
            v: Some(VariableType::Variable),
            b: None,
            t: None,
        };
        let var_data = SanitizedData {
            source: Some(Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Variable(var_variable))))),
            id: None,
            context: None,
            data_format: Some("JSX".to_string()),
        };
        let var_json = JsxHasher::stable_stringify(&var_data).unwrap();
        let var_hash = JsxHasher::hash_string(&var_json);
        assert_eq!(var_hash, "933fa7740fe8c681", "Var variable hash should match expected value");
        assert_eq!(var_json, r#"{"dataFormat":"JSX","source":{"k":"_gt_value_1","v":"v"}}"#, "Var JSON should match expected format");

        // DateTime variable
        let date_var = SanitizedVariable {
            k: Some("_gt_date_1".to_string()),
            v: Some(VariableType::Date),
            b: None,
            t: None,
        };
        let date_data = SanitizedData {
            source: Some(Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Variable(date_var))))),
            id: None,
            context: None,
            data_format: Some("JSX".to_string()),
        };
        let date_json = JsxHasher::stable_stringify(&date_data).unwrap();
        let date_hash = JsxHasher::hash_string(&date_json);
        assert_eq!(date_hash, "1b218e0af4bb7cf8", "DateTime variable hash should match expected value");
        assert_eq!(date_json, r#"{"dataFormat":"JSX","source":{"k":"_gt_date_1","v":"d"}}"#, "DateTime JSON should match expected format");

        // Num variable
        let num_var = SanitizedVariable {
            k: Some("_gt_n_1".to_string()),
            v: Some(VariableType::Number),
            b: None,
            t: None,
        };
        let num_data = SanitizedData {
            source: Some(Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Variable(num_var))))),
            id: None,
            context: None,
            data_format: Some("JSX".to_string()),
        };
        let num_json = JsxHasher::stable_stringify(&num_data).unwrap();
        let num_hash = JsxHasher::hash_string(&num_json);
        assert_eq!(num_hash, "2280bcd71389dedf", "Num variable hash should match expected value");
        assert_eq!(num_json, r#"{"dataFormat":"JSX","source":{"k":"_gt_n_1","v":"n"}}"#, "Num JSON should match expected format");
    }

    #[test]
    fn test_comprehensive_hash_cases_branch_and_plural() {
        // Test Branch and Plural components
        use crate::hash::{JsxHasher, SanitizedData, SanitizedChildren, SanitizedChild, SanitizedVariable};
        use std::collections::BTreeMap;
        
        // Simple Branch component
        let mut branch_branches = BTreeMap::new();
        branch_branches.insert("file".to_string(), Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Text("file.svg".to_string())))));
        branch_branches.insert("directory".to_string(), Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Text("public".to_string())))));
        
        let branch_var = SanitizedVariable {
            k: None,
            v: None,
            b: Some(branch_branches),
            t: Some("b".to_string()),
        };
        let branch_data = SanitizedData {
            source: Some(Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Variable(branch_var))))),
            id: None,
            context: None,
            data_format: Some("JSX".to_string()),
        };
        let branch_json = JsxHasher::stable_stringify(&branch_data).unwrap();
        let branch_hash = JsxHasher::hash_string(&branch_json);
        assert_eq!(branch_hash, "2beb0a01f9518392", "Branch component hash should match expected value");
        assert_eq!(branch_json, r#"{"dataFormat":"JSX","source":{"b":{"directory":"public","file":"file.svg"},"t":"b"}}"#, "Branch JSON should match expected format");

        // Simple Plural component
        let mut plural_branches = BTreeMap::new();
        plural_branches.insert("singular".to_string(), Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Text("File".to_string())))));
        plural_branches.insert("plural".to_string(), Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Text("Files".to_string())))));
        
        let plural_var = SanitizedVariable {
            k: None,
            v: None,
            b: Some(plural_branches),
            t: Some("p".to_string()),
        };
        let plural_data = SanitizedData {
            source: Some(Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Variable(plural_var))))),
            id: None,
            context: None,
            data_format: Some("JSX".to_string()),
        };
        let plural_json = JsxHasher::stable_stringify(&plural_data).unwrap();
        let plural_hash = JsxHasher::hash_string(&plural_json);
        assert_eq!(plural_hash, "a5a6e0e02a6ec321", "Plural component hash should match expected value");
        assert_eq!(plural_json, r#"{"dataFormat":"JSX","source":{"b":{"plural":"Files","singular":"File"},"t":"p"}}"#, "Plural JSON should match expected format");
    }

    #[test]
    fn test_comprehensive_hash_cases_jsx_content_in_attributes() {
        // Test Branch with JSX content in attributes
        use crate::hash::{JsxHasher, SanitizedData, SanitizedChildren, SanitizedChild, SanitizedVariable};
        use std::collections::BTreeMap;
        
        // Branch with JSX content in file attribute
        let mut branch_branches = BTreeMap::new();
        branch_branches.insert("directory".to_string(), Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Text("public".to_string())))));
        // JSX content gets wrapped in {"c": "content"}
        branch_branches.insert("file".to_string(), Box::new(SanitizedChildren::Wrapped {
            c: Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Text("Here is some translatable static content".to_string()))))
        }));
        
        let branch_var = SanitizedVariable {
            k: None,
            v: None,
            b: Some(branch_branches),
            t: Some("b".to_string()),
        };
        let branch_data = SanitizedData {
            source: Some(Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Variable(branch_var))))),
            id: None,
            context: None,
            data_format: Some("JSX".to_string()),
        };
        let branch_json = JsxHasher::stable_stringify(&branch_data).unwrap();
        let branch_hash = JsxHasher::hash_string(&branch_json);
        assert_eq!(branch_hash, "cc6c212a3f21856f", "Branch with JSX content hash should match expected value");
        assert_eq!(branch_json, r#"{"dataFormat":"JSX","source":{"b":{"directory":"public","file":{"c":"Here is some translatable static content"}},"t":"b"}}"#, "Branch with JSX content JSON should match expected format");

        // Plural with JSX content in singular attribute
        let mut plural_branches = BTreeMap::new();
        plural_branches.insert("plural".to_string(), Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Text("Files".to_string())))));
        // JSX content gets wrapped in {"c": "content"}
        plural_branches.insert("singular".to_string(), Box::new(SanitizedChildren::Wrapped {
            c: Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Text("Here is some translatable static content".to_string()))))
        }));
        
        let plural_var = SanitizedVariable {
            k: None,
            v: None,
            b: Some(plural_branches),
            t: Some("p".to_string()),
        };
        let plural_data = SanitizedData {
            source: Some(Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Variable(plural_var))))),
            id: None,
            context: None,
            data_format: Some("JSX".to_string()),
        };
        let plural_json = JsxHasher::stable_stringify(&plural_data).unwrap();
        let plural_hash = JsxHasher::hash_string(&plural_json);
        assert_eq!(plural_hash, "68724f741aa727ef", "Plural with JSX content hash should match expected value");
        assert_eq!(plural_json, r#"{"dataFormat":"JSX","source":{"b":{"plural":"Files","singular":{"c":"Here is some translatable static content"}},"t":"p"}}"#, "Plural with JSX content JSON should match expected format");
    }

    #[test]
    fn test_comprehensive_hash_cases_nested_components() {
        // Test nested Branch and Plural components
        use crate::hash::{JsxHasher, SanitizedData, SanitizedChildren, SanitizedChild, SanitizedVariable};
        use std::collections::BTreeMap;
        
        // Nested Branch component: Branch with another Branch in file attribute
        let mut inner_branch_branches = BTreeMap::new();
        inner_branch_branches.insert("file".to_string(), Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Text("file.svg".to_string())))));
        inner_branch_branches.insert("directory".to_string(), Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Text("public".to_string())))));
        
        let inner_branch_var = SanitizedVariable {
            k: None,
            v: None,
            b: Some(inner_branch_branches),
            t: Some("b".to_string()),
        };
        
        let mut outer_branch_branches = BTreeMap::new();
        outer_branch_branches.insert("directory".to_string(), Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Text("public".to_string())))));
        outer_branch_branches.insert("file".to_string(), Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Variable(inner_branch_var)))));
        
        let outer_branch_var = SanitizedVariable {
            k: None,
            v: None,
            b: Some(outer_branch_branches),
            t: Some("b".to_string()),
        };
        
        let branch_data = SanitizedData {
            source: Some(Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Variable(outer_branch_var))))),
            id: None,
            context: None,
            data_format: Some("JSX".to_string()),
        };
        let branch_json = JsxHasher::stable_stringify(&branch_data).unwrap();
        let branch_hash = JsxHasher::hash_string(&branch_json);
        assert_eq!(branch_hash, "fd6a98279e2dadd3", "Nested Branch component hash should match expected value");
        assert_eq!(branch_json, r#"{"dataFormat":"JSX","source":{"b":{"directory":"public","file":{"b":{"directory":"public","file":"file.svg"},"t":"b"}},"t":"b"}}"#, "Nested Branch JSON should match expected format");

        // Nested Plural component: Plural with another Plural in singular attribute
        let mut inner_plural_branches = BTreeMap::new();
        inner_plural_branches.insert("singular".to_string(), Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Text("File".to_string())))));
        inner_plural_branches.insert("plural".to_string(), Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Text("Files".to_string())))));
        
        let inner_plural_var = SanitizedVariable {
            k: None,
            v: None,
            b: Some(inner_plural_branches),
            t: Some("p".to_string()),
        };
        
        let mut outer_plural_branches = BTreeMap::new();
        outer_plural_branches.insert("plural".to_string(), Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Text("Files".to_string())))));
        outer_plural_branches.insert("singular".to_string(), Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Variable(inner_plural_var)))));
        
        let outer_plural_var = SanitizedVariable {
            k: None,
            v: None,
            b: Some(outer_plural_branches),
            t: Some("p".to_string()),
        };
        
        let plural_data = SanitizedData {
            source: Some(Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Variable(outer_plural_var))))),
            id: None,
            context: None,
            data_format: Some("JSX".to_string()),
        };
        let plural_json = JsxHasher::stable_stringify(&plural_data).unwrap();
        let plural_hash = JsxHasher::hash_string(&plural_json);
        assert_eq!(plural_hash, "38cbabceed5bba24", "Nested Plural component hash should match expected value");
        assert_eq!(plural_json, r#"{"dataFormat":"JSX","source":{"b":{"plural":"Files","singular":{"b":{"plural":"Files","singular":"File"},"t":"p"}},"t":"p"}}"#, "Nested Plural JSON should match expected format");
    }

    #[test]
    fn test_no_aliasing_issues() {
        // Test that we don't treat non-GT components as GT components
        let visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, false, None);
        
        // Without any imports from gt-next, these should NOT be treated as GT components
        let t_name = Atom::from("T");
        let plural_name = Atom::from("Plural");
        let var_name = Atom::from("Var");
        
        assert!(!visitor.should_track_component_as_translation(&t_name), 
               "T should not be tracked without gt-next import");
        assert!(!visitor.should_track_component_as_translation(&plural_name), 
               "Plural should not be tracked without gt-next import");
        assert!(!visitor.should_track_component_as_variable(&var_name), 
               "Var should not be tracked without gt-next import");
               
        // Namespace components should also not be tracked without proper imports
        let gt_name = Atom::from("GT");
        let (is_translation, is_variable) = visitor.should_track_namespace_component(&gt_name, &t_name);
        assert!(!is_translation && !is_variable, 
               "GT.T should not be tracked without namespace import");
    }

    #[test] 
    fn test_aliasing_prevention_with_imports() {
        // Test that we properly track only when imported from gt-next
        let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, false, None);
        
        // Add some imports to the visitor as if we processed: import { T, Plural } from 'gt-next'
        visitor.gt_next_translation_imports.insert(Atom::from("T"));
        visitor.gt_next_translation_imports.insert(Atom::from("Plural"));
        visitor.gt_next_variable_imports.insert(Atom::from("Var"));
        
        // Now these should be tracked
        let t_name = Atom::from("T");
        let plural_name = Atom::from("Plural");
        let var_name = Atom::from("Var");
        
        assert!(visitor.should_track_component_as_translation(&t_name), 
               "T should be tracked when imported from gt-next");
        assert!(visitor.should_track_component_as_translation(&plural_name), 
               "Plural should be tracked when imported from gt-next");
        assert!(visitor.should_track_component_as_variable(&var_name), 
               "Var should be tracked when imported from gt-next");
               
        // But other component names should still not be tracked
        let custom_name = Atom::from("CustomT");
        assert!(!visitor.should_track_component_as_translation(&custom_name), 
               "CustomT should not be tracked even with other imports");
    }

    #[test]
    fn test_direct_import_tracking() {
        // Test direct imports without aliases: import { T, Branch, Var, useGT } from 'gt-next'
        let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, false, None);
        
        // Simulate direct imports processing
        visitor.gt_next_translation_imports.insert(Atom::from("T"));
        visitor.gt_next_translation_import_aliases.insert(Atom::from("T"), Atom::from("T"));
        
        visitor.gt_next_translation_imports.insert(Atom::from("Branch"));
        visitor.gt_next_branch_import_aliases.insert(Atom::from("Branch"), Atom::from("Branch"));
        
        visitor.gt_next_variable_imports.insert(Atom::from("Var"));
        visitor.gt_next_variable_import_aliases.insert(Atom::from("Var"), Atom::from("Var"));
        
        visitor.gt_translation_functions.insert(Atom::from("useGT"));
        visitor.gt_next_translation_function_import_aliases.insert(Atom::from("useGT"), Atom::from("useGT"));
        
        // Test that all direct imports are tracked
        assert!(visitor.should_track_component_as_translation(&Atom::from("T")), 
               "T should be tracked as direct import");
        assert!(visitor.should_track_component_as_translation(&Atom::from("Branch")), 
               "Branch should be tracked as direct import");
        assert!(visitor.should_track_component_as_variable(&Atom::from("Var")), 
               "Var should be tracked as direct import");
        assert!(visitor.gt_translation_functions.contains(&Atom::from("useGT")), 
               "useGT should be tracked as direct import");
               
        // Verify aliases map to themselves
        assert_eq!(visitor.gt_next_translation_import_aliases.get(&Atom::from("T")), 
                  Some(&Atom::from("T")), "T should map to itself");
        assert_eq!(visitor.gt_next_branch_import_aliases.get(&Atom::from("Branch")), 
                  Some(&Atom::from("Branch")), "Branch should map to itself");
    }

    #[test]
    fn test_aliased_import_tracking() {
        // Test aliased imports: import { T as MyT, Branch as B, Var as Variable, useGT as useTranslation } from 'gt-next'
        let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, false, None);
        
        // Simulate aliased imports processing
        visitor.gt_next_translation_imports.insert(Atom::from("MyT"));
        visitor.gt_next_translation_import_aliases.insert(Atom::from("MyT"), Atom::from("T"));
        
        visitor.gt_next_branch_import_aliases.insert(Atom::from("B"), Atom::from("Branch"));
        
        visitor.gt_next_variable_imports.insert(Atom::from("Variable"));
        visitor.gt_next_variable_import_aliases.insert(Atom::from("Variable"), Atom::from("Var"));
        
        visitor.gt_translation_functions.insert(Atom::from("useTranslation"));
        visitor.gt_next_translation_function_import_aliases.insert(Atom::from("useTranslation"), Atom::from("useGT"));
        
        // Test that aliased names are tracked
        assert!(visitor.should_track_component_as_translation(&Atom::from("MyT")), 
               "MyT should be tracked as aliased T");
        assert!(visitor.should_track_component_as_variable(&Atom::from("Variable")), 
               "Variable should be tracked as aliased Var");
        assert!(visitor.gt_translation_functions.contains(&Atom::from("useTranslation")), 
               "useTranslation should be tracked as aliased useGT");
               
        // Test that original names are NOT tracked (since they weren't directly imported)
        assert!(!visitor.should_track_component_as_translation(&Atom::from("T")), 
               "T should not be tracked when imported as MyT");
        assert!(!visitor.should_track_component_as_variable(&Atom::from("Var")), 
               "Var should not be tracked when imported as Variable");
        assert!(!visitor.gt_translation_functions.contains(&Atom::from("useGT")), 
               "useGT should not be tracked when imported as useTranslation");
               
        // Verify alias mappings
        assert_eq!(visitor.gt_next_translation_import_aliases.get(&Atom::from("MyT")), 
                  Some(&Atom::from("T")), "MyT should map to T");
        assert_eq!(visitor.gt_next_branch_import_aliases.get(&Atom::from("B")), 
                  Some(&Atom::from("Branch")), "B should map to Branch");
        assert_eq!(visitor.gt_next_variable_import_aliases.get(&Atom::from("Variable")), 
                  Some(&Atom::from("Var")), "Variable should map to Var");
        assert_eq!(visitor.gt_next_translation_function_import_aliases.get(&Atom::from("useTranslation")), 
                  Some(&Atom::from("useGT")), "useTranslation should map to useGT");
    }

    #[test]
    fn test_all_component_types_direct_imports() {
        // Test all supported component types: T, Branch, Plural, Var, Num, Currency, DateTime, useGT, getGT
        let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, false, None);
        
        // Translation components
        visitor.gt_next_translation_imports.insert(Atom::from("T"));
        visitor.gt_next_translation_import_aliases.insert(Atom::from("T"), Atom::from("T"));
        
        // Branch components  
        visitor.gt_next_branch_import_aliases.insert(Atom::from("Branch"), Atom::from("Branch"));
        visitor.gt_next_branch_import_aliases.insert(Atom::from("Plural"), Atom::from("Plural"));
        
        // Variable components
        visitor.gt_next_variable_imports.insert(Atom::from("Var"));
        visitor.gt_next_variable_import_aliases.insert(Atom::from("Var"), Atom::from("Var"));
        visitor.gt_next_variable_imports.insert(Atom::from("Num"));
        visitor.gt_next_variable_import_aliases.insert(Atom::from("Num"), Atom::from("Num"));
        visitor.gt_next_variable_imports.insert(Atom::from("Currency"));
        visitor.gt_next_variable_import_aliases.insert(Atom::from("Currency"), Atom::from("Currency"));
        visitor.gt_next_variable_imports.insert(Atom::from("DateTime"));
        visitor.gt_next_variable_import_aliases.insert(Atom::from("DateTime"), Atom::from("DateTime"));
        
        // Translation functions
        visitor.gt_translation_functions.insert(Atom::from("useGT"));
        visitor.gt_next_translation_function_import_aliases.insert(Atom::from("useGT"), Atom::from("useGT"));
        visitor.gt_translation_functions.insert(Atom::from("getGT"));
        visitor.gt_next_translation_function_import_aliases.insert(Atom::from("getGT"), Atom::from("getGT"));
        
        // Test translation components
        assert!(visitor.should_track_component_as_translation(&Atom::from("T")), 
               "T should be tracked as translation component");
               
        // Test variable components
        assert!(visitor.should_track_component_as_variable(&Atom::from("Var")), 
               "Var should be tracked as variable component");
        assert!(visitor.should_track_component_as_variable(&Atom::from("Num")), 
               "Num should be tracked as variable component");
        assert!(visitor.should_track_component_as_variable(&Atom::from("Currency")), 
               "Currency should be tracked as variable component");
        assert!(visitor.should_track_component_as_variable(&Atom::from("DateTime")), 
               "DateTime should be tracked as variable component");
               
        // Test translation functions
        assert!(visitor.gt_translation_functions.contains(&Atom::from("useGT")), 
               "useGT should be tracked as translation function");
        assert!(visitor.gt_translation_functions.contains(&Atom::from("getGT")), 
               "getGT should be tracked as translation function");
               
        // Test that branch components have aliases (even though they don't use the main tracking)
        assert!(visitor.gt_next_branch_import_aliases.contains_key(&Atom::from("Branch")), 
               "Branch should have alias mapping");
        assert!(visitor.gt_next_branch_import_aliases.contains_key(&Atom::from("Plural")), 
               "Plural should have alias mapping");
    }

    #[test]
    fn test_all_component_types_aliased_imports() {
        // Test all component types with aliases
        let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, false, None);
        
        // Aliased translation components
        visitor.gt_next_translation_imports.insert(Atom::from("MyT"));
        visitor.gt_next_translation_import_aliases.insert(Atom::from("MyT"), Atom::from("T"));
        
        // Aliased branch components
        visitor.gt_next_branch_import_aliases.insert(Atom::from("MyBranch"), Atom::from("Branch"));
        visitor.gt_next_branch_import_aliases.insert(Atom::from("MyPlural"), Atom::from("Plural"));
        
        // Aliased variable components  
        visitor.gt_next_variable_imports.insert(Atom::from("MyVar"));
        visitor.gt_next_variable_import_aliases.insert(Atom::from("MyVar"), Atom::from("Var"));
        visitor.gt_next_variable_imports.insert(Atom::from("MyNum"));
        visitor.gt_next_variable_import_aliases.insert(Atom::from("MyNum"), Atom::from("Num"));
        visitor.gt_next_variable_imports.insert(Atom::from("MyCurrency"));
        visitor.gt_next_variable_import_aliases.insert(Atom::from("MyCurrency"), Atom::from("Currency"));
        visitor.gt_next_variable_imports.insert(Atom::from("MyDateTime"));
        visitor.gt_next_variable_import_aliases.insert(Atom::from("MyDateTime"), Atom::from("DateTime"));
        
        // Aliased translation functions
        visitor.gt_translation_functions.insert(Atom::from("useTranslation"));
        visitor.gt_next_translation_function_import_aliases.insert(Atom::from("useTranslation"), Atom::from("useGT"));
        visitor.gt_translation_functions.insert(Atom::from("getTranslation"));
        visitor.gt_next_translation_function_import_aliases.insert(Atom::from("getTranslation"), Atom::from("getGT"));
        
        // Test that aliased names work
        assert!(visitor.should_track_component_as_translation(&Atom::from("MyT")), 
               "MyT should be tracked as aliased T");
        assert!(visitor.should_track_component_as_variable(&Atom::from("MyVar")), 
               "MyVar should be tracked as aliased Var");
        assert!(visitor.should_track_component_as_variable(&Atom::from("MyNum")), 
               "MyNum should be tracked as aliased Num");
        assert!(visitor.should_track_component_as_variable(&Atom::from("MyCurrency")), 
               "MyCurrency should be tracked as aliased Currency");
        assert!(visitor.should_track_component_as_variable(&Atom::from("MyDateTime")), 
               "MyDateTime should be tracked as aliased DateTime");
        assert!(visitor.gt_translation_functions.contains(&Atom::from("useTranslation")), 
               "useTranslation should be tracked as aliased useGT");
        assert!(visitor.gt_translation_functions.contains(&Atom::from("getTranslation")), 
               "getTranslation should be tracked as aliased getGT");
               
        // Test that original names are NOT tracked
        assert!(!visitor.should_track_component_as_translation(&Atom::from("T")), 
               "T should not be tracked when imported as MyT");
        assert!(!visitor.should_track_component_as_variable(&Atom::from("Var")), 
               "Var should not be tracked when imported as MyVar");
        assert!(!visitor.gt_translation_functions.contains(&Atom::from("useGT")), 
               "useGT should not be tracked when imported as useTranslation");
               
        // Verify all alias mappings
        assert_eq!(visitor.gt_next_translation_import_aliases.get(&Atom::from("MyT")), 
                  Some(&Atom::from("T")), "MyT should map to T");
        assert_eq!(visitor.gt_next_branch_import_aliases.get(&Atom::from("MyBranch")), 
                  Some(&Atom::from("Branch")), "MyBranch should map to Branch");
        assert_eq!(visitor.gt_next_variable_import_aliases.get(&Atom::from("MyVar")), 
                  Some(&Atom::from("Var")), "MyVar should map to Var");
        assert_eq!(visitor.gt_next_translation_function_import_aliases.get(&Atom::from("useTranslation")), 
                  Some(&Atom::from("useGT")), "useTranslation should map to useGT");
    }

    #[test]
    fn test_mixed_direct_and_aliased_imports() {
        // Test mixing direct and aliased imports in same file
        let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, false, None);
        
        // Direct imports
        visitor.gt_next_translation_imports.insert(Atom::from("T"));
        visitor.gt_next_translation_import_aliases.insert(Atom::from("T"), Atom::from("T"));
        visitor.gt_next_variable_imports.insert(Atom::from("Var"));
        visitor.gt_next_variable_import_aliases.insert(Atom::from("Var"), Atom::from("Var"));
        
        // Aliased imports
        visitor.gt_next_branch_import_aliases.insert(Atom::from("B"), Atom::from("Branch"));
        visitor.gt_translation_functions.insert(Atom::from("useTranslation"));
        visitor.gt_next_translation_function_import_aliases.insert(Atom::from("useTranslation"), Atom::from("useGT"));
        
        // Test direct imports work
        assert!(visitor.should_track_component_as_translation(&Atom::from("T")), 
               "T should work as direct import");
        assert!(visitor.should_track_component_as_variable(&Atom::from("Var")), 
               "Var should work as direct import");
               
        // Test aliased imports work
        assert!(visitor.gt_translation_functions.contains(&Atom::from("useTranslation")), 
               "useTranslation should work as aliased useGT");
               
        // Test non-imported names don't work
        assert!(!visitor.should_track_component_as_variable(&Atom::from("Currency")), 
               "Currency should not work when not imported");
        assert!(!visitor.gt_translation_functions.contains(&Atom::from("getGT")), 
               "getGT should not work when not imported");
    }

    #[test]
    fn test_import_alias_collision_handling() {
        // Test edge case: import { T as Var } - alias collision with different component types
        let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, false, None);
        
        // Import T as Var (translation component aliased as variable name)
        visitor.gt_next_translation_imports.insert(Atom::from("Var")); // Note: local name is "Var" but it's a translation component
        visitor.gt_next_translation_import_aliases.insert(Atom::from("Var"), Atom::from("T"));
        
        // The aliased "Var" should be tracked as translation (because original was T)
        assert!(visitor.should_track_component_as_translation(&Atom::from("Var")), 
               "Var (aliased T) should be tracked as translation component");
        assert!(!visitor.should_track_component_as_variable(&Atom::from("Var")), 
               "Var (aliased T) should NOT be tracked as variable component");
               
        // Verify the mapping
        assert_eq!(visitor.gt_next_translation_import_aliases.get(&Atom::from("Var")), 
                  Some(&Atom::from("T")), "Var should map back to T");
    }
}