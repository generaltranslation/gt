#[cfg(test)]
mod tests {
    use crate::visitor::expr_utils::{extract_id_and_context_from_options, extract_number_from_expr, is_allowed_dynamic_content, validate_declare_static};
    use swc_core::common::{DUMMY_SP, SyntaxContext};
    use swc_core::ecma::atoms::Atom;
    use swc_core::ecma::ast::*;
    
    #[test]
    fn test_is_allowed_dynamic_content_basic() {
        // Test string literal - should pass
        let string_expr = JSXExpr::Expr(Box::new(Expr::Lit(Lit::Str(Str {
            span: DUMMY_SP,
            value: Atom::new("hello").into(),
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
                        value: Atom::new("not a call").into(),
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
                    value: Atom::new("not a call").into(),
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

    #[test]
    fn test_extract_number_from_expr_positive_integers() {
        // Test positive integer
        let positive_num = Expr::Lit(Lit::Num(Number {
            span: DUMMY_SP,
            value: 42.0,
            raw: None,
        }));
        assert_eq!(extract_number_from_expr(&positive_num), Some(42));

        // Test zero
        let zero_num = Expr::Lit(Lit::Num(Number {
            span: DUMMY_SP,
            value: 0.0,
            raw: None,
        }));
        assert_eq!(extract_number_from_expr(&zero_num), Some(0));

        // Test large positive integer
        let large_num = Expr::Lit(Lit::Num(Number {
            span: DUMMY_SP,
            value: 1000.0,
            raw: None,
        }));
        assert_eq!(extract_number_from_expr(&large_num), Some(1000));
    }

    #[test]
    fn test_extract_number_from_expr_converts_negatives_to_positive() {
        // Test negative integer literal - should return absolute value
        let negative_num = Expr::Lit(Lit::Num(Number {
            span: DUMMY_SP,
            value: -42.0,
            raw: None,
        }));
        assert_eq!(extract_number_from_expr(&negative_num), Some(42));

        // Test negative unary expression - should return absolute value
        let negative_unary = Expr::Unary(UnaryExpr {
            span: DUMMY_SP,
            op: UnaryOp::Minus,
            arg: Box::new(Expr::Lit(Lit::Num(Number {
                span: DUMMY_SP,
                value: 25.0,
                raw: None,
            }))),
        });
        assert_eq!(extract_number_from_expr(&negative_unary), Some(25));
    }

    #[test]
    fn test_extract_number_from_expr_rejects_decimals() {
        // Test positive decimal - should be rejected
        let decimal_num = Expr::Lit(Lit::Num(Number {
            span: DUMMY_SP,
            value: 3.14,
            raw: None,
        }));
        assert_eq!(extract_number_from_expr(&decimal_num), None);

        // Test negative decimal - should be rejected (because it's decimal, not because it's negative)
        let negative_decimal = Expr::Lit(Lit::Num(Number {
            span: DUMMY_SP,
            value: -2.5,
            raw: None,
        }));
        assert_eq!(extract_number_from_expr(&negative_decimal), None);

        // Test decimal in positive unary - should be rejected
        let decimal_unary = Expr::Unary(UnaryExpr {
            span: DUMMY_SP,
            op: UnaryOp::Plus,
            arg: Box::new(Expr::Lit(Lit::Num(Number {
                span: DUMMY_SP,
                value: 1.5,
                raw: None,
            }))),
        });
        assert_eq!(extract_number_from_expr(&decimal_unary), None);

        // Test decimal in negative unary - should be rejected
        let negative_decimal_unary = Expr::Unary(UnaryExpr {
            span: DUMMY_SP,
            op: UnaryOp::Minus,
            arg: Box::new(Expr::Lit(Lit::Num(Number {
                span: DUMMY_SP,
                value: 1.5,
                raw: None,
            }))),
        });
        assert_eq!(extract_number_from_expr(&negative_decimal_unary), None);
    }

    #[test]
    fn test_extract_number_from_expr_positive_unary() {
        // Test positive unary expression
        let positive_unary = Expr::Unary(UnaryExpr {
            span: DUMMY_SP,
            op: UnaryOp::Plus,
            arg: Box::new(Expr::Lit(Lit::Num(Number {
                span: DUMMY_SP,
                value: 50.0,
                raw: None,
            }))),
        });
        assert_eq!(extract_number_from_expr(&positive_unary), Some(50));

        // Test positive unary with zero
        let positive_zero_unary = Expr::Unary(UnaryExpr {
            span: DUMMY_SP,
            op: UnaryOp::Plus,
            arg: Box::new(Expr::Lit(Lit::Num(Number {
                span: DUMMY_SP,
                value: 0.0,
                raw: None,
            }))),
        });
        assert_eq!(extract_number_from_expr(&positive_zero_unary), Some(0));
    }

    #[test]
    fn test_extract_number_from_expr_rejects_other_unary_ops() {
        // Test bang operator
        let bang_unary = Expr::Unary(UnaryExpr {
            span: DUMMY_SP,
            op: UnaryOp::Bang,
            arg: Box::new(Expr::Lit(Lit::Num(Number {
                span: DUMMY_SP,
                value: 42.0,
                raw: None,
            }))),
        });
        assert_eq!(extract_number_from_expr(&bang_unary), None);

        // Test typeof operator
        let typeof_unary = Expr::Unary(UnaryExpr {
            span: DUMMY_SP,
            op: UnaryOp::TypeOf,
            arg: Box::new(Expr::Lit(Lit::Num(Number {
                span: DUMMY_SP,
                value: 42.0,
                raw: None,
            }))),
        });
        assert_eq!(extract_number_from_expr(&typeof_unary), None);
    }

    #[test]
    fn test_extract_number_from_expr_rejects_non_numeric() {
        // Test string literal
        let string_expr = Expr::Lit(Lit::Str(Str {
            span: DUMMY_SP,
            value: Atom::new("42").into(),
            raw: None,
        }));
        assert_eq!(extract_number_from_expr(&string_expr), None);

        // Test boolean literal
        let bool_expr = Expr::Lit(Lit::Bool(Bool {
            span: DUMMY_SP,
            value: true,
        }));
        assert_eq!(extract_number_from_expr(&bool_expr), None);

        // Test identifier
        let ident_expr = Expr::Ident(Ident {
            span: DUMMY_SP,
            sym: Atom::new("someVariable"),
            optional: false,
            ctxt: SyntaxContext::empty(),
        });
        assert_eq!(extract_number_from_expr(&ident_expr), None);

        // Test array literal
        let array_expr = Expr::Array(ArrayLit {
            span: DUMMY_SP,
            elems: vec![],
        });
        assert_eq!(extract_number_from_expr(&array_expr), None);
    }

    #[test]
    fn test_extract_number_from_expr_rejects_unary_non_numeric() {
        // Test positive unary with non-numeric argument
        let plus_string = Expr::Unary(UnaryExpr {
            span: DUMMY_SP,
            op: UnaryOp::Plus,
            arg: Box::new(Expr::Lit(Lit::Str(Str {
                span: DUMMY_SP,
                value: Atom::new("42").into(),
                raw: None,
            }))),
        });
        assert_eq!(extract_number_from_expr(&plus_string), None);

        // Test positive unary with identifier
        let plus_ident = Expr::Unary(UnaryExpr {
            span: DUMMY_SP,
            op: UnaryOp::Plus,
            arg: Box::new(Expr::Ident(Ident {
                span: DUMMY_SP,
                sym: Atom::new("variable"),
                optional: false,
                ctxt: SyntaxContext::empty(),
            })),
        });
        assert_eq!(extract_number_from_expr(&plus_ident), None);
    }

    // Helper to build an options object expression with given properties
    fn make_options_arg(props: Vec<(&str, Box<Expr>)>) -> ExprOrSpread {
        ExprOrSpread {
            spread: None,
            expr: Box::new(Expr::Object(ObjectLit {
                span: DUMMY_SP,
                props: props
                    .into_iter()
                    .map(|(key, value)| {
                        PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
                            key: PropName::Ident(IdentName {
                                span: DUMMY_SP,
                                sym: Atom::new(key),
                            }),
                            value,
                        })))
                    })
                    .collect(),
            })),
        }
    }

    fn str_expr(s: &str) -> Box<Expr> {
        Box::new(Expr::Lit(Lit::Str(Str {
            span: DUMMY_SP,
            value: Atom::new(s).into(),
            raw: None,
        })))
    }

    #[test]
    fn test_extract_format_from_options() {
        let options = make_options_arg(vec![("$format", str_expr("STRING"))]);
        let (id, context, max_chars, format, _has_derive_context) =
            extract_id_and_context_from_options(Some(&options));
        assert_eq!(format, Some("STRING".to_string()));
        assert_eq!(id, None);
        assert_eq!(context, None);
        assert_eq!(max_chars, None);
    }

    #[test]
    fn test_extract_format_none_when_absent() {
        let options = make_options_arg(vec![("$context", str_expr("greeting"))]);
        let (_id, _context, _max_chars, format, _has_derive_context) =
            extract_id_and_context_from_options(Some(&options));
        assert_eq!(format, None);
    }

    #[test]
    fn test_extract_format_with_other_options() {
        let options = make_options_arg(vec![
            ("$id", str_expr("hello")),
            ("$context", str_expr("greeting")),
            ("$format", str_expr("I18NEXT")),
        ]);
        let (id, context, _max_chars, format, _has_derive_context) =
            extract_id_and_context_from_options(Some(&options));
        assert_eq!(id, Some("hello".to_string()));
        assert_eq!(context, Some("greeting".to_string()));
        assert_eq!(format, Some("I18NEXT".to_string()));
    }

    #[test]
    fn test_extract_format_none_when_no_options() {
        let (_id, _context, _max_chars, format, _has_derive_context) =
            extract_id_and_context_from_options(None);
        assert_eq!(format, None);
    }

    // --- derive in context tests ---

    fn make_derive_call() -> Box<Expr> {
        Box::new(Expr::Call(CallExpr {
            span: DUMMY_SP,
            ctxt: SyntaxContext::empty(),
            callee: Callee::Expr(Box::new(Expr::Ident(Ident {
                span: DUMMY_SP,
                sym: Atom::new("derive"),
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
                        sym: Atom::new("getFormality"),
                        optional: false,
                        ctxt: SyntaxContext::empty(),
                    }))),
                    args: vec![],
                    type_args: None,
                })),
            }],
            type_args: None,
        }))
    }

    #[test]
    fn test_derive_call_in_context_is_recognized() {
        // { $context: derive(getFormality()) }
        let options = make_options_arg(vec![("$context", make_derive_call())]);
        let (_id, _context, _max_chars, _format, has_derive_context) =
            extract_id_and_context_from_options(Some(&options));

        assert!(
            has_derive_context,
            "derive() in $context should set has_derive_context to true"
        );
    }

    #[test]
    fn test_static_string_context_still_works() {
        // { $context: "greeting" } — regression check
        let options = make_options_arg(vec![("$context", str_expr("greeting"))]);
        let (_id, context, _max_chars, _format, has_derive_context) =
            extract_id_and_context_from_options(Some(&options));
        assert_eq!(context, Some("greeting".to_string()));
        assert!(!has_derive_context, "static string context should not set has_derive_context");
    }

    #[test]
    fn test_derive_ternary_in_context() {
        // { $context: derive(x ? "formal" : "casual") }
        let derive_call = Box::new(Expr::Call(CallExpr {
            span: DUMMY_SP,
            ctxt: SyntaxContext::empty(),
            callee: Callee::Expr(Box::new(Expr::Ident(Ident {
                span: DUMMY_SP,
                sym: Atom::new("derive"),
                optional: false,
                ctxt: SyntaxContext::empty(),
            }))),
            args: vec![ExprOrSpread {
                spread: None,
                expr: Box::new(Expr::Cond(CondExpr {
                    span: DUMMY_SP,
                    test: Box::new(Expr::Ident(Ident {
                        span: DUMMY_SP,
                        sym: Atom::new("x"),
                        optional: false,
                        ctxt: SyntaxContext::empty(),
                    })),
                    cons: Box::new(Expr::Lit(Lit::Str(Str {
                        span: DUMMY_SP,
                        value: Atom::new("formal").into(),
                        raw: None,
                    }))),
                    alt: Box::new(Expr::Lit(Lit::Str(Str {
                        span: DUMMY_SP,
                        value: Atom::new("casual").into(),
                        raw: None,
                    }))),
                })),
            }],
            type_args: None,
        }));

        let options = make_options_arg(vec![("$context", derive_call)]);
        let (_id, _context, _max_chars, _format, has_derive_context) =
            extract_id_and_context_from_options(Some(&options));

        assert!(
            has_derive_context,
            "derive(ternary) in $context should set has_derive_context to true"
        );
    }

    #[test]
    fn test_derive_in_context_concat() {
        // { $context: "prefix-" + derive(getFormality()) }
        let concat_expr = Box::new(Expr::Bin(BinExpr {
            span: DUMMY_SP,
            op: BinaryOp::Add,
            left: Box::new(Expr::Lit(Lit::Str(Str {
                span: DUMMY_SP,
                value: Atom::new("prefix-").into(),
                raw: None,
            }))),
            right: make_derive_call(),
        }));

        let options = make_options_arg(vec![("$context", concat_expr)]);
        let (_id, _context, _max_chars, _format, has_derive_context) =
            extract_id_and_context_from_options(Some(&options));

        assert!(
            has_derive_context,
            "string concat with derive() in $context should set has_derive_context to true"
        );
    }

    #[test]
    fn test_derive_in_context_template_literal() {
        // { $context: `prefix-${derive(getFormality())}` }
        let template_expr = Box::new(Expr::Tpl(Tpl {
            span: DUMMY_SP,
            exprs: vec![make_derive_call()],
            quasis: vec![
                TplElement {
                    span: DUMMY_SP,
                    tail: false,
                    cooked: Some(Atom::new("prefix-").into()),
                    raw: Atom::new("prefix-").into(),
                },
                TplElement {
                    span: DUMMY_SP,
                    tail: true,
                    cooked: Some(Atom::new("").into()),
                    raw: Atom::new("").into(),
                },
            ],
        }));

        let options = make_options_arg(vec![("$context", template_expr)]);
        let (_id, _context, _max_chars, _format, has_derive_context) =
            extract_id_and_context_from_options(Some(&options));

        assert!(
            has_derive_context,
            "template literal with derive() in $context should set has_derive_context to true"
        );
    }

    #[test]
    fn test_derive_in_context_ternary_outer() {
        // { $context: cond ? derive(getFormality()) : "fallback" }
        let cond_expr = Box::new(Expr::Cond(CondExpr {
            span: DUMMY_SP,
            test: Box::new(Expr::Ident(Ident {
                span: DUMMY_SP,
                sym: Atom::new("cond"),
                optional: false,
                ctxt: SyntaxContext::empty(),
            })),
            cons: make_derive_call(),
            alt: Box::new(Expr::Lit(Lit::Str(Str {
                span: DUMMY_SP,
                value: Atom::new("fallback").into(),
                raw: None,
            }))),
        }));

        let options = make_options_arg(vec![("$context", cond_expr)]);
        let (_id, _context, _max_chars, _format, has_derive_context) =
            extract_id_and_context_from_options(Some(&options));

        assert!(
            has_derive_context,
            "ternary with derive() in one branch of $context should set has_derive_context to true"
        );
    }
}