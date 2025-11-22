#[cfg(test)]
mod tests {
    use crate::visitor::expr_utils::{is_allowed_dynamic_content, validate_declare_static};
    use swc_core::common::{DUMMY_SP, SyntaxContext};
    use swc_core::ecma::atoms::Atom;
    use swc_core::ecma::ast::*;
    
    #[test]
    fn test_is_allowed_dynamic_content_basic() {
        // Test string literal - should pass
        let string_expr = JSXExpr::Expr(Box::new(Expr::Lit(Lit::Str(Str {
            span: DUMMY_SP,
            value: Atom::new("hello"),
            raw: None,
        }))));
        assert!(is_allowed_dynamic_content(&string_expr));
        
        // Test number literal - should pass
        let number_expr = JSXExpr::Expr(Box::new(Expr::Lit(Lit::Num(Number {
            span: DUMMY_SP,
            value: 42.0,
            raw: None,
        }))));
        assert!(is_allowed_dynamic_content(&number_expr));
        
        // Test variable - should fail
        let var_expr = JSXExpr::Expr(Box::new(Expr::Ident(Ident {
            span: DUMMY_SP,
            sym: Atom::new("someVariable"),
            optional: false,
            ctxt: SyntaxContext::empty(),
        })));
        assert!(!is_allowed_dynamic_content(&var_expr));
        
        // Test undefined - should pass
        let undefined_expr = JSXExpr::Expr(Box::new(Expr::Ident(Ident {
            span: DUMMY_SP,
            sym: Atom::new("undefined"),
            optional: false,
            ctxt: SyntaxContext::empty(),
        })));
        assert!(is_allowed_dynamic_content(&undefined_expr));
        
        // Test empty JSX expression - should pass
        let empty_expr = JSXExpr::JSXEmptyExpr(JSXEmptyExpr { span: DUMMY_SP });
        assert!(is_allowed_dynamic_content(&empty_expr));
        
        // Test array literal - should fail
        let array_expr = JSXExpr::Expr(Box::new(Expr::Array(ArrayLit {
            span: DUMMY_SP,
            elems: vec![],
        })));
        assert!(!is_allowed_dynamic_content(&array_expr));
    }
    
    #[test]
    fn test_is_allowed_dynamic_content_unary() {
        // Test +123 - should pass
        let plus_num = JSXExpr::Expr(Box::new(Expr::Unary(UnaryExpr {
            span: DUMMY_SP,
            op: UnaryOp::Plus,
            arg: Box::new(Expr::Lit(Lit::Num(Number {
                span: DUMMY_SP,
                value: 123.0,
                raw: None,
            }))),
        })));
        assert!(is_allowed_dynamic_content(&plus_num));
        
        // Test -123 - should pass
        let minus_num = JSXExpr::Expr(Box::new(Expr::Unary(UnaryExpr {
            span: DUMMY_SP,
            op: UnaryOp::Minus,
            arg: Box::new(Expr::Lit(Lit::Num(Number {
                span: DUMMY_SP,
                value: 123.0,
                raw: None,
            }))),
        })));
        assert!(is_allowed_dynamic_content(&minus_num));
        
        // Test +variable - should fail
        let plus_var = JSXExpr::Expr(Box::new(Expr::Unary(UnaryExpr {
            span: DUMMY_SP,
            op: UnaryOp::Plus,
            arg: Box::new(Expr::Ident(Ident {
                span: DUMMY_SP,
                sym: Atom::new("variable"),
                optional: false,
                ctxt: SyntaxContext::empty(),
            })),
        })));
        assert!(!is_allowed_dynamic_content(&plus_var));
        
        // Test !value - should fail
        let not_var = JSXExpr::Expr(Box::new(Expr::Unary(UnaryExpr {
            span: DUMMY_SP,
            op: UnaryOp::Bang,
            arg: Box::new(Expr::Ident(Ident {
                span: DUMMY_SP,
                sym: Atom::new("value"),
                optional: false,
                ctxt: SyntaxContext::empty(),
            })),
        })));
        assert!(!is_allowed_dynamic_content(&not_var));
    }

    #[test]
    fn test_validate_declare_static_with_call_expression() {
        // Test: declareStatic(getName())
        let call_expr = CallExpr {
            span: DUMMY_SP,
            ctxt: SyntaxContext::empty(),
            callee: Callee::Expr(Box::new(Expr::Ident(Ident {
                span: DUMMY_SP,
                sym: Atom::new("declareStatic"),
                optional: false,
                ctxt: SyntaxContext::empty(),
            }))),
            args: vec![ExprOrSpread {
                spread: None,
                expr: Box::new(Expr::Call(CallExpr {
                    span: DUMMY_SP,
                    ctxt: SyntaxContext::empty(),
                    callee: Callee::Expr(Box::new(Expr::Ident(Ident {
                        span: DUMMY_SP,
                        sym: Atom::new("getName"),
                        optional: false,
                        ctxt: SyntaxContext::empty(),
                    }))),
                    args: vec![],
                    type_args: None,
                })),
            }],
            type_args: None,
        };

        let mut errors = Vec::new();
        validate_declare_static(&call_expr, &mut errors);
        assert!(errors.is_empty(), "Should accept direct call expression");
    }

    #[test]
    fn test_validate_declare_static_with_await_expression() {
        // Test: declareStatic(await getName())
        let call_expr = CallExpr {
            span: DUMMY_SP,
            ctxt: SyntaxContext::empty(),
            callee: Callee::Expr(Box::new(Expr::Ident(Ident {
                span: DUMMY_SP,
                sym: Atom::new("declareStatic"),
                optional: false,
                ctxt: SyntaxContext::empty(),
            }))),
            args: vec![ExprOrSpread {
                spread: None,
                expr: Box::new(Expr::Await(AwaitExpr {
                    span: DUMMY_SP,
                    arg: Box::new(Expr::Call(CallExpr {
                        span: DUMMY_SP,
                        ctxt: SyntaxContext::empty(),
                        callee: Callee::Expr(Box::new(Expr::Ident(Ident {
                            span: DUMMY_SP,
                            sym: Atom::new("getName"),
                            optional: false,
                            ctxt: SyntaxContext::empty(),
                        }))),
                        args: vec![],
                        type_args: None,
                    })),
                })),
            }],
            type_args: None,
        };

        let mut errors = Vec::new();
        validate_declare_static(&call_expr, &mut errors);
        assert!(errors.is_empty(), "Should accept await expression wrapping call");
    }

    #[test]
    fn test_validate_declare_static_with_await_non_call() {
        // Test: declareStatic(await "string") - should fail
        let call_expr = CallExpr {
            span: DUMMY_SP,
            ctxt: SyntaxContext::empty(),
            callee: Callee::Expr(Box::new(Expr::Ident(Ident {
                span: DUMMY_SP,
                sym: Atom::new("declareStatic"),
                optional: false,
                ctxt: SyntaxContext::empty(),
            }))),
            args: vec![ExprOrSpread {
                spread: None,
                expr: Box::new(Expr::Await(AwaitExpr {
                    span: DUMMY_SP,
                    arg: Box::new(Expr::Lit(Lit::Str(Str {
                        span: DUMMY_SP,
                        value: Atom::new("not a call"),
                        raw: None,
                    }))),
                })),
            }],
            type_args: None,
        };

        let mut errors = Vec::new();
        validate_declare_static(&call_expr, &mut errors);
        assert_eq!(errors.len(), 1, "Should reject await wrapping non-call");
        assert!(errors[0].contains("call expression"));
    }

    #[test]
    fn test_validate_declare_static_with_string_literal() {
        // Test: declareStatic("string") - should fail
        let call_expr = CallExpr {
            span: DUMMY_SP,
            ctxt: SyntaxContext::empty(),
            callee: Callee::Expr(Box::new(Expr::Ident(Ident {
                span: DUMMY_SP,
                sym: Atom::new("declareStatic"),
                optional: false,
                ctxt: SyntaxContext::empty(),
            }))),
            args: vec![ExprOrSpread {
                spread: None,
                expr: Box::new(Expr::Lit(Lit::Str(Str {
                    span: DUMMY_SP,
                    value: Atom::new("not a call"),
                    raw: None,
                }))),
            }],
            type_args: None,
        };

        let mut errors = Vec::new();
        validate_declare_static(&call_expr, &mut errors);
        assert_eq!(errors.len(), 1, "Should reject string literal");
        assert!(errors[0].contains("call expression"));
    }

    #[test]
    fn test_validate_declare_static_with_no_arguments() {
        // Test: declareStatic() - should fail
        let call_expr = CallExpr {
            span: DUMMY_SP,
            ctxt: SyntaxContext::empty(),
            callee: Callee::Expr(Box::new(Expr::Ident(Ident {
                span: DUMMY_SP,
                sym: Atom::new("declareStatic"),
                optional: false,
                ctxt: SyntaxContext::empty(),
            }))),
            args: vec![],
            type_args: None,
        };

        let mut errors = Vec::new();
        validate_declare_static(&call_expr, &mut errors);
        assert_eq!(errors.len(), 1, "Should reject no arguments");
        assert!(errors[0].contains("exactly one argument"));
    }

    #[test]
    fn test_validate_declare_static_with_multiple_arguments() {
        // Test: declareStatic(getName(), extra()) - should fail
        let call_expr = CallExpr {
            span: DUMMY_SP,
            ctxt: SyntaxContext::empty(),
            callee: Callee::Expr(Box::new(Expr::Ident(Ident {
                span: DUMMY_SP,
                sym: Atom::new("declareStatic"),
                optional: false,
                ctxt: SyntaxContext::empty(),
            }))),
            args: vec![
                ExprOrSpread {
                    spread: None,
                    expr: Box::new(Expr::Call(CallExpr {
                        span: DUMMY_SP,
                        ctxt: SyntaxContext::empty(),
                        callee: Callee::Expr(Box::new(Expr::Ident(Ident {
                            span: DUMMY_SP,
                            sym: Atom::new("getName"),
                            optional: false,
                            ctxt: SyntaxContext::empty(),
                        }))),
                        args: vec![],
                        type_args: None,
                    })),
                },
                ExprOrSpread {
                    spread: None,
                    expr: Box::new(Expr::Call(CallExpr {
                        span: DUMMY_SP,
                        ctxt: SyntaxContext::empty(),
                        callee: Callee::Expr(Box::new(Expr::Ident(Ident {
                            span: DUMMY_SP,
                            sym: Atom::new("extra"),
                            optional: false,
                            ctxt: SyntaxContext::empty(),
                        }))),
                        args: vec![],
                        type_args: None,
                    })),
                },
            ],
            type_args: None,
        };

        let mut errors = Vec::new();
        validate_declare_static(&call_expr, &mut errors);
        assert_eq!(errors.len(), 1, "Should reject multiple arguments");
        assert!(errors[0].contains("exactly one argument"));
    }
}