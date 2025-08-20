#[cfg(test)]
mod tests {
    use crate::visitor::expr_utils::is_allowed_dynamic_content;
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
}