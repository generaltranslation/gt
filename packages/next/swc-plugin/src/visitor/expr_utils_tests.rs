#[cfg(test)]
mod tests {
    use crate::visitor::expr_utils::{contains_derive_call, is_allowed_dynamic_content};
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

    fn str_expr(s: &str) -> Box<Expr> {
        Box::new(Expr::Lit(Lit::Str(Str {
            span: DUMMY_SP,
            value: Atom::new(s).into(),
            raw: None,
        })))
    }

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
        // derive(getFormality())
        assert!(
            contains_derive_call(&make_derive_call()),
            "derive() should count as a derive call"
        );
    }

    #[test]
    fn test_static_string_context_still_works() {
        // "greeting"
        assert!(
            !contains_derive_call(&str_expr("greeting")),
            "a static string should not count as a derive call"
        );
    }

    #[test]
    fn test_derive_ternary_in_context() {
        // derive(x ? "formal" : "casual")
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

        assert!(
            contains_derive_call(&derive_call),
            "derive(ternary) should count as a derive call"
        );
    }

    #[test]
    fn test_derive_in_context_concat() {
        // "prefix-" + derive(getFormality())
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

        assert!(
            contains_derive_call(&concat_expr),
            "string concat with derive() should count as a derive call"
        );
    }

    #[test]
    fn test_derive_in_context_template_literal() {
        // `prefix-${derive(getFormality())}`
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

        assert!(
            contains_derive_call(&template_expr),
            "template literal with derive() should count as a derive call"
        );
    }

    #[test]
    fn test_derive_in_context_ternary_outer() {
        // cond ? derive(getFormality()) : "fallback"
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

        assert!(
            contains_derive_call(&cond_expr),
            "ternary with derive() in one branch should count as a derive call"
        );
    }
}