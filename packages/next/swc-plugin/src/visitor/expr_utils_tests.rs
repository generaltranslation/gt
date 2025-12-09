#[cfg(test)]
mod tests {
    use crate::visitor::expr_utils::{extract_number_from_expr, is_allowed_dynamic_content};
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
            value: Atom::new("42"),
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
                value: Atom::new("42"),
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
}