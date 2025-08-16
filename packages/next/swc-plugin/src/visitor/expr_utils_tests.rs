#[cfg(test)]
mod tests {
    use super::*;
    use swc_core::common::{DUMMY_SP, SyntaxContext};
    use swc_core::ecma::atoms::Atom;

    // Helper functions for creating test AST nodes
    fn create_string_literal(value: &str) -> Expr {
        Expr::Lit(Lit::Str(Str {
            span: DUMMY_SP,
            value: Atom::new(value),
            raw: None,
        }))
    }

    fn create_number_literal(value: f64) -> Expr {
        Expr::Lit(Lit::Num(Number {
            span: DUMMY_SP,
            value,
            raw: None,
        }))
    }

    fn create_bool_literal(value: bool) -> Expr {
        Expr::Lit(Lit::Bool(Bool {
            span: DUMMY_SP,
            value,
        }))
    }

    fn create_identifier(name: &str) -> Expr {
        Expr::Ident(Ident {
            span: DUMMY_SP,
            sym: Atom::new(name),
            optional: false,
            ctxt: SyntaxContext::empty(),
        })
    }

    fn create_object_expr(props: Vec<PropOrSpread>) -> Expr {
        Expr::Object(ObjectLit {
            span: DUMMY_SP,
            props,
        })
    }

    fn create_key_value_prop(key: &str, value: Expr) -> PropOrSpread {
        PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
            key: PropName::Ident(Ident {
                span: DUMMY_SP,
                sym: Atom::new(key),
                optional: false,
                ctxt: SyntaxContext::empty(),
            }.into()),
            value: Box::new(value),
        })))
    }

    fn create_expr_or_spread(expr: Expr) -> ExprOrSpread {
        ExprOrSpread {
            spread: None,
            expr: Box::new(expr),
        }
    }

    fn create_call_expr(function_name: &str, args: Vec<ExprOrSpread>) -> CallExpr {
        CallExpr {
            span: DUMMY_SP,
            callee: Callee::Expr(Box::new(create_identifier(function_name))),
            args,
            type_args: None,
            ctxt: SyntaxContext::empty(),
        }
    }

    mod extract_string_from_expr {
        use super::*;

        #[test]
        fn extracts_string_literal() {
            let expr = create_string_literal("hello world");
            let result = extract_string_from_expr(&expr);
            assert_eq!(result, Some("hello world".to_string()));
        }

        #[test]
        fn extracts_number_literal() {
            let expr = create_number_literal(42.5);
            let result = extract_string_from_expr(&expr);
            assert_eq!(result, Some("42.5".to_string()));
        }

        #[test]
        fn extracts_integer_number() {
            let expr = create_number_literal(42.0);
            let result = extract_string_from_expr(&expr);
            assert_eq!(result, Some("42".to_string()));
        }

        #[test]
        fn extracts_bool_true() {
            let expr = create_bool_literal(true);
            let result = extract_string_from_expr(&expr);
            assert_eq!(result, Some("true".to_string()));
        }

        #[test]
        fn extracts_bool_false() {
            let expr = create_bool_literal(false);
            let result = extract_string_from_expr(&expr);
            assert_eq!(result, Some("false".to_string()));
        }

        #[test]
        fn extracts_identifier() {
            let expr = create_identifier("myVariable");
            let result = extract_string_from_expr(&expr);
            assert_eq!(result, Some("myVariable".to_string()));
        }

        #[test]
        fn returns_none_for_unsupported_types() {
            let expr = create_object_expr(vec![]);
            let result = extract_string_from_expr(&expr);
            assert_eq!(result, None);
        }

        #[test]
        fn returns_none_for_array() {
            let expr = Expr::Array(ArrayLit {
                span: DUMMY_SP,
                elems: vec![],
            });
            let result = extract_string_from_expr(&expr);
            assert_eq!(result, None);
        }
    }

    mod extract_id_and_context_from_options {
        use super::*;

        #[test]
        fn extracts_id_and_context_from_object() {
            let props = vec![
                create_key_value_prop("$id", create_string_literal("test-id")),
                create_key_value_prop("$context", create_string_literal("test-context")),
                create_key_value_prop("name", create_string_literal("John")),
            ];
            let obj_expr = create_object_expr(props);
            let options = create_expr_or_spread(obj_expr);

            let (id, context) = extract_id_and_context_from_options(Some(&options));
            
            assert_eq!(id, Some("test-id".to_string()));
            assert_eq!(context, Some("test-context".to_string()));
        }

        #[test]
        fn extracts_only_id() {
            let props = vec![
                create_key_value_prop("$id", create_string_literal("only-id")),
                create_key_value_prop("name", create_string_literal("John")),
            ];
            let obj_expr = create_object_expr(props);
            let options = create_expr_or_spread(obj_expr);

            let (id, context) = extract_id_and_context_from_options(Some(&options));
            
            assert_eq!(id, Some("only-id".to_string()));
            assert_eq!(context, None);
        }

        #[test]
        fn extracts_only_context() {
            let props = vec![
                create_key_value_prop("$context", create_string_literal("only-context")),
                create_key_value_prop("name", create_string_literal("John")),
            ];
            let obj_expr = create_object_expr(props);
            let options = create_expr_or_spread(obj_expr);

            let (id, context) = extract_id_and_context_from_options(Some(&options));
            
            assert_eq!(id, None);
            assert_eq!(context, Some("only-context".to_string()));
        }

        #[test]
        fn handles_empty_object() {
            let obj_expr = create_object_expr(vec![]);
            let options = create_expr_or_spread(obj_expr);

            let (id, context) = extract_id_and_context_from_options(Some(&options));
            
            assert_eq!(id, None);
            assert_eq!(context, None);
        }

        #[test]
        fn handles_no_options() {
            let (id, context) = extract_id_and_context_from_options(None);
            
            assert_eq!(id, None);
            assert_eq!(context, None);
        }

        #[test]
        fn handles_non_object_options() {
            let options = create_expr_or_spread(create_identifier("myOptions"));

            let (id, context) = extract_id_and_context_from_options(Some(&options));
            
            assert_eq!(id, None);
            assert_eq!(context, None);
        }

        #[test]
        fn handles_different_value_types() {
            let props = vec![
                create_key_value_prop("$id", create_number_literal(123.0)),
                create_key_value_prop("$context", create_bool_literal(true)),
            ];
            let obj_expr = create_object_expr(props);
            let options = create_expr_or_spread(obj_expr);

            let (id, context) = extract_id_and_context_from_options(Some(&options));
            
            assert_eq!(id, Some("123".to_string()));
            assert_eq!(context, Some("true".to_string()));
        }

        #[test]
        fn ignores_non_target_properties() {
            let props = vec![
                create_key_value_prop("id", create_string_literal("wrong-id")), // missing $
                create_key_value_prop("context", create_string_literal("wrong-context")), // missing $
                create_key_value_prop("$id", create_string_literal("correct-id")),
                create_key_value_prop("name", create_string_literal("John")),
            ];
            let obj_expr = create_object_expr(props);
            let options = create_expr_or_spread(obj_expr);

            let (id, context) = extract_id_and_context_from_options(Some(&options));
            
            assert_eq!(id, Some("correct-id".to_string()));
            assert_eq!(context, None);
        }
    }

    mod create_string_prop {
        use super::*;

        #[test]
        fn creates_string_property() {
            let prop = create_string_prop("test-key", "test-value", DUMMY_SP);
            
            if let PropOrSpread::Prop(boxed_prop) = prop {
                if let Prop::KeyValue(kv) = boxed_prop.as_ref() {
                    if let PropName::Ident(ident) = &kv.key {
                        assert_eq!(ident.sym.as_ref(), "test-key");
                    } else {
                        panic!("Expected identifier key");
                    }
                    
                    if let Expr::Lit(Lit::Str(str_lit)) = kv.value.as_ref() {
                        assert_eq!(str_lit.value.as_ref(), "test-value");
                    } else {
                        panic!("Expected string literal value");
                    }
                } else {
                    panic!("Expected KeyValue prop");
                }
            } else {
                panic!("Expected Prop, not Spread");
            }
        }

        #[test]
        fn handles_empty_strings() {
            let prop = create_string_prop("", "", DUMMY_SP);
            
            if let PropOrSpread::Prop(boxed_prop) = prop {
                if let Prop::KeyValue(kv) = boxed_prop.as_ref() {
                    if let PropName::Ident(ident) = &kv.key {
                        assert_eq!(ident.sym.as_ref(), "");
                    }
                    if let Expr::Lit(Lit::Str(str_lit)) = kv.value.as_ref() {
                        assert_eq!(str_lit.value.as_ref(), "");
                    }
                }
            }
        }

        #[test]
        fn handles_special_characters() {
            let prop = create_string_prop("$hash", "abc123!@#", DUMMY_SP);
            
            if let PropOrSpread::Prop(boxed_prop) = prop {
                if let Prop::KeyValue(kv) = boxed_prop.as_ref() {
                    if let PropName::Ident(ident) = &kv.key {
                        assert_eq!(ident.sym.as_ref(), "$hash");
                    }
                    if let Expr::Lit(Lit::Str(str_lit)) = kv.value.as_ref() {
                        assert_eq!(str_lit.value.as_ref(), "abc123!@#");
                    }
                }
            }
        }
    }

    mod has_prop {
        use super::*;

        #[test]
        fn finds_existing_property() {
            let props = vec![
                create_string_prop("name", "John", DUMMY_SP),
                create_string_prop("$hash", "abc123", DUMMY_SP),
                create_string_prop("age", "30", DUMMY_SP),
            ];
            
            assert!(has_prop(&props, "$hash"));
            assert!(has_prop(&props, "name"));
            assert!(has_prop(&props, "age"));
        }

        #[test]
        fn returns_false_for_missing_property() {
            let props = vec![
                create_string_prop("name", "John", DUMMY_SP),
                create_string_prop("age", "30", DUMMY_SP),
            ];
            
            assert!(!has_prop(&props, "$hash"));
            assert!(!has_prop(&props, "missing"));
        }

        #[test]
        fn handles_empty_props() {
            let props = vec![];
            assert!(!has_prop(&props, "$hash"));
            assert!(!has_prop(&props, "anything"));
        }

        #[test]
        fn is_case_sensitive() {
            let props = vec![
                create_string_prop("$Hash", "abc123", DUMMY_SP),
            ];
            
            assert!(!has_prop(&props, "$hash")); // lowercase
            assert!(has_prop(&props, "$Hash"));  // exact case
        }

        #[test]
        fn handles_spread_properties() {
            let spread_prop = PropOrSpread::Spread(SpreadElement {
                dot3_token: DUMMY_SP,
                expr: Box::new(create_identifier("otherProps")),
            });
            
            let props = vec![
                spread_prop,
                create_string_prop("$hash", "abc123", DUMMY_SP),
            ];
            
            // Should find the regular prop, not be confused by spread
            assert!(has_prop(&props, "$hash"));
            assert!(!has_prop(&props, "spreadProp"));
        }
    }

    mod create_spread_options_call_expr {
        use super::*;

        #[test]
        fn creates_spread_call_with_hash() {
            let original_call = create_call_expr("t", vec![
                create_expr_or_spread(create_string_literal("Hello {name}")),
                create_expr_or_spread(create_identifier("options")),
            ]);

            let result = create_spread_options_call_expr(
                &original_call,
                &create_identifier("options"),
                "test-hash",
                None,
                DUMMY_SP
            );

            // Should have same number of args
            assert_eq!(result.args.len(), 2);
            
            // First arg should be unchanged
            if let Expr::Lit(Lit::Str(s)) = result.args[0].expr.as_ref() {
                assert_eq!(s.value.as_ref(), "Hello {name}");
            } else {
                panic!("First arg should be string literal");
            }

            // Second arg should be an object with spread + $hash
            if let Expr::Object(obj) = result.args[1].expr.as_ref() {
                assert_eq!(obj.props.len(), 2); // spread + $hash
                
                // First should be spread
                if let PropOrSpread::Spread(spread) = &obj.props[0] {
                    if let Expr::Ident(ident) = spread.expr.as_ref() {
                        assert_eq!(ident.sym.as_ref(), "options");
                    }
                } else {
                    panic!("First prop should be spread");
                }
                
                // Second should be $hash
                if let PropOrSpread::Prop(prop) = &obj.props[1] {
                    if let Prop::KeyValue(kv) = prop.as_ref() {
                        if let PropName::Ident(ident) = &kv.key {
                            assert_eq!(ident.sym.as_ref(), "$hash");
                        }
                        if let Expr::Lit(Lit::Str(s)) = kv.value.as_ref() {
                            assert_eq!(s.value.as_ref(), "test-hash");
                        }
                    }
                } else {
                    panic!("Second prop should be KeyValue");
                }
            } else {
                panic!("Second arg should be object");
            }
        }

        #[test]
        fn preserves_function_name_and_context() {
            let original_call = create_call_expr("myFunction", vec![
                create_expr_or_spread(create_string_literal("test")),
                create_expr_or_spread(create_identifier("opts")),
            ]);

            let result = create_spread_options_call_expr(
                &original_call,
                &create_identifier("opts"),
                "hash123",
                None,
                DUMMY_SP
            );

            // Should preserve function name
            if let Callee::Expr(callee) = &result.callee {
                if let Expr::Ident(ident) = callee.as_ref() {
                    assert_eq!(ident.sym.as_ref(), "myFunction");
                }
            }

            // Should preserve context
            assert_eq!(result.ctxt, original_call.ctxt);
        }

        #[test]
        fn works_with_member_expression() {
            let member_expr = Expr::Member(MemberExpr {
                span: DUMMY_SP,
                obj: Box::new(create_identifier("config")),
                prop: MemberProp::Ident(Ident {
                    span: DUMMY_SP,
                    sym: Atom::new("options"),
                    optional: false,
                    ctxt: SyntaxContext::empty(),
                }.into()),
            });

            let original_call = create_call_expr("t", vec![
                create_expr_or_spread(create_string_literal("test")),
                create_expr_or_spread(member_expr.clone()),
            ]);

            let result = create_spread_options_call_expr(
                &original_call,
                &member_expr,
                "hash456",
                None,
                DUMMY_SP
            );

            // Check that the spread expression is the member expression
            if let Expr::Object(obj) = result.args[1].expr.as_ref() {
                if let PropOrSpread::Spread(spread) = &obj.props[0] {
                    if let Expr::Member(member) = spread.expr.as_ref() {
                        if let Expr::Ident(obj_ident) = member.obj.as_ref() {
                            assert_eq!(obj_ident.sym.as_ref(), "config");
                        }
                    } else {
                        panic!("Spread should contain member expression");
                    }
                }
            }
        }

        #[test]
        fn handles_complex_expressions() {
            let call_expr = Expr::Call(CallExpr {
                span: DUMMY_SP,
                callee: Callee::Expr(Box::new(create_identifier("getOptions"))),
                args: vec![],
                type_args: None,
                ctxt: SyntaxContext::empty(),
            });

            let original_call = create_call_expr("t", vec![
                create_expr_or_spread(create_string_literal("test")),
                create_expr_or_spread(call_expr.clone()),
            ]);

            let result = create_spread_options_call_expr(
                &original_call,
                &call_expr,
                "complex-hash",
                None,
                DUMMY_SP
            );

            // Should handle function call in spread
            if let Expr::Object(obj) = result.args[1].expr.as_ref() {
                if let PropOrSpread::Spread(spread) = &obj.props[0] {
                    if let Expr::Call(call) = spread.expr.as_ref() {
                        if let Callee::Expr(callee) = &call.callee {
                            if let Expr::Ident(ident) = callee.as_ref() {
                                assert_eq!(ident.sym.as_ref(), "getOptions");
                            }
                        }
                    } else {
                        panic!("Spread should contain call expression");
                    }
                }
            }
        }
    }

    mod integration_tests {
        use super::*;

        #[test]
        fn full_workflow_object_literal_to_spread() {
            // Simulate: t("Hello {name}", { name: "John", $id: "test" })
            // Should become: t("Hello {name}", { name: "John", $id: "test", $hash: "..." })
            
            let props = vec![
                create_key_value_prop("name", create_string_literal("John")),
                create_key_value_prop("$id", create_string_literal("test-id")),
            ];
            let obj_expr = create_object_expr(props.clone());
            let options = create_expr_or_spread(obj_expr);

            // Extract id/context
            let (id, context) = extract_id_and_context_from_options(Some(&options));
            assert_eq!(id, Some("test-id".to_string()));
            assert_eq!(context, None);

            // Check if $hash already exists
            let obj_lit = if let Expr::Object(obj) = options.expr.as_ref() {
                obj
            } else {
                panic!("Expected object");
            };
            
            assert!(!has_prop(&obj_lit.props, "$hash"));
            assert!(has_prop(&obj_lit.props, "$id"));
        }

        #[test]
        fn full_workflow_variable_to_spread() {
            // Simulate: t("Hello {name}", options)
            // Should become: t("Hello {name}", { ...options, $hash: "..." })
            
            let variable_expr = create_identifier("userOptions");
            let options = create_expr_or_spread(variable_expr.clone());
            
            // This should return None, None since it's not an object literal
            let (id, context) = extract_id_and_context_from_options(Some(&options));
            assert_eq!(id, None);
            assert_eq!(context, None);

            // Create the spread call
            let original_call = create_call_expr("t", vec![
                create_expr_or_spread(create_string_literal("Hello {name}")),
                options,
            ]);

            let result = create_spread_options_call_expr(
                &original_call,
                &variable_expr,
                "computed-hash",
                None,
                DUMMY_SP
            );

            // Verify the transformation
            assert_eq!(result.args.len(), 2);
            if let Expr::Object(obj) = result.args[1].expr.as_ref() {
                assert_eq!(obj.props.len(), 2); // spread + $hash
            }
        }
    }
}