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
        let plural_atom = Atom::from("Plural");
        assert!(visitor.is_translation_component_name(&t_atom));
        assert!(visitor.is_translation_component_name(&plural_atom));
        
        // Should not match variable components
        let var_atom = Atom::from("Var");
        let num_atom = Atom::from("Num");
        assert!(!visitor.is_translation_component_name(&var_atom));
        assert!(!visitor.is_translation_component_name(&num_atom));
        
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
        
        // Check that hash attribute was added
        let has_hash_attr = transformed.opening.attrs.iter().any(|attr| {
            if let JSXAttrOrSpread::JSXAttr(jsx_attr) = attr {
                if let JSXAttrName::Ident(ident) = &jsx_attr.name {
                    if ident.sym.as_ref() == "hash" {
                        // Verify the value is "test"
                        if let Some(JSXAttrValue::Lit(Lit::Str(str_lit))) = &jsx_attr.value {
                            return str_lit.value.as_ref() == "test";
                        }
                    }
                }
            }
            false
        });
        
        assert!(has_hash_attr, "Should add hash='test' attribute to T component when experimental flag is enabled");
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
}