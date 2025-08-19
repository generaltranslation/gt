use swc_core::ecma::ast::*;

pub fn extract_template_string(tpl: &Tpl) -> Option<String> {
  if tpl.exprs.is_empty() && tpl.quasis.len() == 1 {
    if let Some(quasi) = tpl.quasis.first() {
      if let Some(cooked) = &quasi.cooked {
        return Some(cooked.to_string());
      } else {
        return Some(quasi.raw.to_string());
      }
    }
  }
  None
}

pub fn extract_string_from_jsx_attr(jsx_attr: &JSXAttr) -> Option<String> {
  match &jsx_attr.value {
    Some(JSXAttrValue::Lit(Lit::Str(str_lit))) => Some(str_lit.value.to_string()),
    Some(JSXAttrValue::JSXExprContainer(expr_container)) => match &expr_container.expr {
      JSXExpr::Expr(expr) => match expr.as_ref() {
        Expr::Lit(Lit::Str(str_lit)) => Some(str_lit.value.to_string()),
        Expr::Tpl(tpl) => extract_template_string(tpl),
        _ => None,
      },
      _ => None,
    },
    _ => None,
  }
}

pub fn extract_attribute_from_jsx_attr(
  element: &JSXElement,
  attribute_name: &str,
) -> Option<String> {
  element.opening.attrs.iter().find_map(|attr| {
    if let JSXAttrOrSpread::JSXAttr(jsx_attr) = attr {
      if let JSXAttrName::Ident(ident) = &jsx_attr.name {
        if ident.sym.as_ref() == attribute_name {
          extract_string_from_jsx_attr(jsx_attr)
        } else {
          None
        }
      } else {
        None
      }
    } else {
      None
    }
  })
}

#[cfg(test)]
mod tests {
  use super::*;
  use swc_core::common::{SyntaxContext, DUMMY_SP};
  use swc_core::ecma::atoms::Atom;

  // Helper to create template literal with optional expressions
  fn create_template_literal(raw: &str, cooked: Option<&str>) -> Tpl {
    Tpl {
      span: DUMMY_SP,
      exprs: vec![], // Empty expressions for simple case
      quasis: vec![TplElement {
        span: DUMMY_SP,
        tail: true,
        cooked: cooked.map(Atom::new),
        raw: Atom::new(raw),
      }],
    }
  }

  // Helper to create template literal with expressions (complex case)
  fn create_complex_template_literal() -> Tpl {
    Tpl {
      span: DUMMY_SP,
      exprs: vec![Box::new(Expr::Ident(Ident {
        span: DUMMY_SP,
        sym: Atom::new("name"),
        optional: false,
        ctxt: SyntaxContext::empty(),
      }))], // Has expressions, so not simple
      quasis: vec![
        TplElement {
          span: DUMMY_SP,
          tail: false,
          cooked: Some(Atom::new("Hello ")),
          raw: Atom::new("Hello "),
        },
        TplElement {
          span: DUMMY_SP,
          tail: true,
          cooked: Some(Atom::new("!")),
          raw: Atom::new("!"),
        },
      ],
    }
  }

  // Helper to create JSX attribute with string literal value
  fn create_string_attr(name: &str, value: &str) -> JSXAttrOrSpread {
    JSXAttrOrSpread::JSXAttr(JSXAttr {
      span: DUMMY_SP,
      name: JSXAttrName::Ident(
        Ident {
          span: DUMMY_SP,
          sym: Atom::new(name),
          optional: false,
          ctxt: SyntaxContext::empty(),
        }
        .into(),
      ),
      value: Some(JSXAttrValue::Lit(Lit::Str(Str {
        span: DUMMY_SP,
        value: Atom::new(value),
        raw: None,
      }))),
    })
  }

  // Helper to create JSX attribute with expression container
  fn create_expr_attr(name: &str, expr: Expr) -> JSXAttrOrSpread {
    JSXAttrOrSpread::JSXAttr(JSXAttr {
      span: DUMMY_SP,
      name: JSXAttrName::Ident(
        Ident {
          span: DUMMY_SP,
          sym: Atom::new(name),
          optional: false,
          ctxt: SyntaxContext::empty(),
        }
        .into(),
      ),
      value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
        span: DUMMY_SP,
        expr: JSXExpr::Expr(Box::new(expr)),
      })),
    })
  }

  // Helper to create JSX element
  fn create_jsx_element(tag_name: &str, attrs: Vec<JSXAttrOrSpread>) -> JSXElement {
    JSXElement {
      span: DUMMY_SP,
      opening: JSXOpeningElement {
        span: DUMMY_SP,
        name: JSXElementName::Ident(Ident {
          span: DUMMY_SP,
          sym: Atom::new(tag_name),
          optional: false,
          ctxt: SyntaxContext::empty(),
        }),
        attrs,
        self_closing: false,
        type_args: None,
      },
      children: vec![],
      closing: Some(JSXClosingElement {
        span: DUMMY_SP,
        name: JSXElementName::Ident(Ident {
          span: DUMMY_SP,
          sym: Atom::new(tag_name),
          optional: false,
          ctxt: SyntaxContext::empty(),
        }),
      }),
    }
  }

  mod extract_template_string {
    use super::*;

    #[test]
    fn extracts_simple_template_with_cooked() {
      let tpl = create_template_literal("hello world", Some("hello world"));
      let result = extract_template_string(&tpl);
      assert_eq!(result, Some("hello world".to_string()));
    }

    #[test]
    fn extracts_simple_template_without_cooked() {
      let tpl = create_template_literal("hello\\nworld", None);
      let result = extract_template_string(&tpl);
      assert_eq!(result, Some("hello\\nworld".to_string()));
    }

    #[test]
    fn rejects_template_with_expressions() {
      let tpl = create_complex_template_literal();
      let result = extract_template_string(&tpl);
      assert_eq!(result, None);
    }

    #[test]
    fn handles_empty_template() {
      let tpl = create_template_literal("", Some(""));
      let result = extract_template_string(&tpl);
      assert_eq!(result, Some("".to_string()));
    }

    #[test]
    fn handles_template_with_no_quasis() {
      let tpl = Tpl {
        span: DUMMY_SP,
        exprs: vec![],
        quasis: vec![], // Empty quasis
      };
      let result = extract_template_string(&tpl);
      assert_eq!(result, None);
    }

    #[test]
    fn handles_template_with_multiple_quasis() {
      let tpl = Tpl {
        span: DUMMY_SP,
        exprs: vec![], // No expressions but multiple quasis
        quasis: vec![
          TplElement {
            span: DUMMY_SP,
            tail: false,
            cooked: Some(Atom::new("hello")),
            raw: Atom::new("hello"),
          },
          TplElement {
            span: DUMMY_SP,
            tail: true,
            cooked: Some(Atom::new("world")),
            raw: Atom::new("world"),
          },
        ],
      };
      let result = extract_template_string(&tpl);
      assert_eq!(result, None); // Should reject multiple quasis even without expressions
    }
  }

  mod extract_string_from_jsx_attr {
    use super::*;

    #[test]
    fn extracts_string_literal() {
      let attr = JSXAttr {
        span: DUMMY_SP,
        name: JSXAttrName::Ident(
          Ident {
            span: DUMMY_SP,
            sym: Atom::new("test"),
            optional: false,
            ctxt: SyntaxContext::empty(),
          }
          .into(),
        ),
        value: Some(JSXAttrValue::Lit(Lit::Str(Str {
          span: DUMMY_SP,
          value: Atom::new("hello world"),
          raw: None,
        }))),
      };
      let result = extract_string_from_jsx_attr(&attr);
      assert_eq!(result, Some("hello world".to_string()));
    }

    #[test]
    fn extracts_string_from_expression() {
      let attr = JSXAttr {
        span: DUMMY_SP,
        name: JSXAttrName::Ident(
          Ident {
            span: DUMMY_SP,
            sym: Atom::new("test"),
            optional: false,
            ctxt: SyntaxContext::empty(),
          }
          .into(),
        ),
        value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
          span: DUMMY_SP,
          expr: JSXExpr::Expr(Box::new(Expr::Lit(Lit::Str(Str {
            span: DUMMY_SP,
            value: Atom::new("from expression"),
            raw: None,
          })))),
        })),
      };
      let result = extract_string_from_jsx_attr(&attr);
      assert_eq!(result, Some("from expression".to_string()));
    }

    #[test]
    fn extracts_template_from_expression() {
      let tpl = create_template_literal("template string", Some("template string"));
      let attr = JSXAttr {
        span: DUMMY_SP,
        name: JSXAttrName::Ident(
          Ident {
            span: DUMMY_SP,
            sym: Atom::new("test"),
            optional: false,
            ctxt: SyntaxContext::empty(),
          }
          .into(),
        ),
        value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
          span: DUMMY_SP,
          expr: JSXExpr::Expr(Box::new(Expr::Tpl(tpl))),
        })),
      };
      let result = extract_string_from_jsx_attr(&attr);
      assert_eq!(result, Some("template string".to_string()));
    }

    #[test]
    fn returns_none_for_no_value() {
      let attr = JSXAttr {
        span: DUMMY_SP,
        name: JSXAttrName::Ident(
          Ident {
            span: DUMMY_SP,
            sym: Atom::new("test"),
            optional: false,
            ctxt: SyntaxContext::empty(),
          }
          .into(),
        ),
        value: None,
      };
      let result = extract_string_from_jsx_attr(&attr);
      assert_eq!(result, None);
    }

    #[test]
    fn returns_none_for_non_string_literal() {
      let attr = JSXAttr {
        span: DUMMY_SP,
        name: JSXAttrName::Ident(
          Ident {
            span: DUMMY_SP,
            sym: Atom::new("test"),
            optional: false,
            ctxt: SyntaxContext::empty(),
          }
          .into(),
        ),
        value: Some(JSXAttrValue::Lit(Lit::Num(Number {
          span: DUMMY_SP,
          value: 42.0,
          raw: None,
        }))),
      };
      let result = extract_string_from_jsx_attr(&attr);
      assert_eq!(result, None);
    }

    #[test]
    fn returns_none_for_non_string_expression() {
      let attr = JSXAttr {
        span: DUMMY_SP,
        name: JSXAttrName::Ident(
          Ident {
            span: DUMMY_SP,
            sym: Atom::new("test"),
            optional: false,
            ctxt: SyntaxContext::empty(),
          }
          .into(),
        ),
        value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
          span: DUMMY_SP,
          expr: JSXExpr::Expr(Box::new(Expr::Lit(Lit::Num(Number {
            span: DUMMY_SP,
            value: 42.0,
            raw: None,
          })))),
        })),
      };
      let result = extract_string_from_jsx_attr(&attr);
      assert_eq!(result, None);
    }
  }

  mod extract_attribute_from_jsx_attr {
    use super::*;

    #[test]
    fn extracts_existing_attribute() {
      let attrs = vec![
        create_string_attr("id", "test-id"),
        create_string_attr("className", "test-class"),
      ];
      let element = create_jsx_element("div", attrs);
      let result = extract_attribute_from_jsx_attr(&element, "id");
      assert_eq!(result, Some("test-id".to_string()));
    }

    #[test]
    fn returns_none_for_missing_attribute() {
      let attrs = vec![create_string_attr("className", "test-class")];
      let element = create_jsx_element("div", attrs);
      let result = extract_attribute_from_jsx_attr(&element, "id");
      assert_eq!(result, None);
    }

    #[test]
    fn extracts_attribute_from_expression() {
      let expr = Expr::Lit(Lit::Str(Str {
        span: DUMMY_SP,
        value: Atom::new("dynamic-id"),
        raw: None,
      }));
      let attrs = vec![create_expr_attr("id", expr)];
      let element = create_jsx_element("div", attrs);
      let result = extract_attribute_from_jsx_attr(&element, "id");
      assert_eq!(result, Some("dynamic-id".to_string()));
    }

    #[test]
    fn extracts_first_matching_attribute() {
      let attrs = vec![
        create_string_attr("id", "first-id"),
        create_string_attr("id", "second-id"), // Duplicate attribute
        create_string_attr("className", "test-class"),
      ];
      let element = create_jsx_element("div", attrs);
      let result = extract_attribute_from_jsx_attr(&element, "id");
      assert_eq!(result, Some("first-id".to_string()));
    }

    #[test]
    fn handles_element_with_no_attributes() {
      let element = create_jsx_element("div", vec![]);
      let result = extract_attribute_from_jsx_attr(&element, "id");
      assert_eq!(result, None);
    }

    #[test]
    fn handles_case_sensitive_matching() {
      let attrs = vec![create_string_attr("ID", "uppercase-id")];
      let element = create_jsx_element("div", attrs);

      // Should not match different case
      let result = extract_attribute_from_jsx_attr(&element, "id");
      assert_eq!(result, None);

      // Should match exact case
      let result = extract_attribute_from_jsx_attr(&element, "ID");
      assert_eq!(result, Some("uppercase-id".to_string()));
    }

    #[test]
    fn handles_empty_attribute_name_search() {
      let attrs = vec![create_string_attr("", "empty-name")];
      let element = create_jsx_element("div", attrs);
      let result = extract_attribute_from_jsx_attr(&element, "");
      assert_eq!(result, Some("empty-name".to_string()));
    }

    #[test]
    fn handles_template_in_attribute() {
      let tpl = create_template_literal("template-value", Some("template-value"));
      let expr = Expr::Tpl(tpl);
      let attrs = vec![create_expr_attr("data-value", expr)];
      let element = create_jsx_element("div", attrs);
      let result = extract_attribute_from_jsx_attr(&element, "data-value");
      assert_eq!(result, Some("template-value".to_string()));
    }
  }

  mod edge_cases {
    use super::*;

    #[test]
    fn handles_jsx_spread_attributes() {
      // JSXSpread attributes should be ignored by our function
      let spread_attr = JSXAttrOrSpread::SpreadElement(SpreadElement {
        dot3_token: DUMMY_SP,
        expr: Box::new(Expr::Ident(Ident {
          span: DUMMY_SP,
          sym: Atom::new("props"),
          optional: false,
          ctxt: SyntaxContext::empty(),
        })),
      });

      let attrs = vec![spread_attr, create_string_attr("id", "real-id")];

      let element = create_jsx_element("div", attrs);
      let result = extract_attribute_from_jsx_attr(&element, "id");
      assert_eq!(result, Some("real-id".to_string()));
    }

    #[test]
    fn integration_test_all_functions() {
      // Test that all functions work together
      let tpl = create_template_literal("integrated-test", Some("integrated-test"));
      let expr = Expr::Tpl(tpl);
      let attrs = vec![
        create_string_attr("className", "test-class"),
        create_expr_attr("data-template", expr),
      ];

      let element = create_jsx_element("TestComponent", attrs);

      // Should extract string literal
      let class_result = extract_attribute_from_jsx_attr(&element, "className");
      assert_eq!(class_result, Some("test-class".to_string()));

      // Should extract template literal
      let template_result = extract_attribute_from_jsx_attr(&element, "data-template");
      assert_eq!(template_result, Some("integrated-test".to_string()));

      // Should return None for non-existent
      let missing_result = extract_attribute_from_jsx_attr(&element, "missing");
      assert_eq!(missing_result, None);
    }
  }
}
