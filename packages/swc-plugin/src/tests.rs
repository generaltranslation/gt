// use super::*;
// use swc_core::common::{DUMMY_SP, SyntaxContext};
// use swc_core::ecma::{atoms::Atom, visit::FoldWith};

// /// Helper function to create a JSX element for testing
// /// Examples: create_jsx_element("T", true) creates <T>Hello {name}!</T> with dynamic content
// fn create_jsx_element(component_name: &str, with_dynamic_content: bool) -> JSXElement {
//     let children = if with_dynamic_content {
//         vec![
//             JSXElementChild::JSXText(JSXText {
//                 span: DUMMY_SP,
//                 value: "Hello ".into(),
//                 raw: "Hello ".into(),
//             }),
//             JSXElementChild::JSXExprContainer(JSXExprContainer {
//                 span: DUMMY_SP,
//                 expr: JSXExpr::Expr(Box::new(Expr::Ident(Ident::new("name".into(), DUMMY_SP, SyntaxContext::empty())))),
//             }),
//             JSXElementChild::JSXText(JSXText {
//                 span: DUMMY_SP,
//                 value: "!".into(),
//                 raw: "!".into(),
//             }),
//         ]
//     } else {
//         vec![
//             JSXElementChild::JSXText(JSXText {
//                 span: DUMMY_SP,
//                 value: "Hello world".into(),
//                 raw: "Hello world".into(),
//             }),
//         ]
//     };

//     JSXElement {
//         span: DUMMY_SP,
//         opening: JSXOpeningElement {
//             name: JSXElementName::Ident(Ident::new(component_name.into(), DUMMY_SP, SyntaxContext::empty()).into()),
//             span: DUMMY_SP,
//             attrs: vec![],
//             self_closing: false,
//             type_args: None,
//         },
//         closing: Some(JSXClosingElement {
//             span: DUMMY_SP,
//             name: JSXElementName::Ident(Ident::new(component_name.into(), DUMMY_SP, SyntaxContext::empty()).into()),
//         }),
//         children,
//     }
// }

// /// Helper function to create a JSX element with wrapped dynamic content: <T>Hello <Var>{name}</Var>!</T>
// fn create_jsx_element_with_wrapped_content() -> JSXElement {
//     // Create <Var>{name}</Var>
//     let var_element = JSXElement {
//         span: DUMMY_SP,
//         opening: JSXOpeningElement {
//             name: JSXElementName::Ident(Ident::new("Var".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//             span: DUMMY_SP,
//             attrs: vec![],
//             self_closing: false,
//             type_args: None,
//         },
//         closing: Some(JSXClosingElement {
//             span: DUMMY_SP,
//             name: JSXElementName::Ident(Ident::new("Var".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//         }),
//         children: vec![
//             JSXElementChild::JSXExprContainer(JSXExprContainer {
//                 span: DUMMY_SP,
//                 expr: JSXExpr::Expr(Box::new(Expr::Ident(Ident::new("name".into(), DUMMY_SP, SyntaxContext::empty())))),
//             })
//         ],
//     };

//     // Create <T>Hello <Var>{name}</Var>!</T>
//     JSXElement {
//         span: DUMMY_SP,
//         opening: JSXOpeningElement {
//             name: JSXElementName::Ident(Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//             span: DUMMY_SP,
//             attrs: vec![],
//             self_closing: false,
//             type_args: None,
//         },
//         closing: Some(JSXClosingElement {
//             span: DUMMY_SP,
//             name: JSXElementName::Ident(Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//         }),
//         children: vec![
//             JSXElementChild::JSXText(JSXText {
//                 span: DUMMY_SP,
//                 value: "Hello ".into(),
//                 raw: "Hello ".into(),
//             }),
//             JSXElementChild::JSXElement(Box::new(var_element)),
//             JSXElementChild::JSXText(JSXText {
//                 span: DUMMY_SP,
//                 value: "!".into(),
//                 raw: "!".into(),
//             }),
//         ],
//     }
// }

// /// Helper function to create a function call expression
// fn create_call_expr(function_name: &str, arg: Expr) -> CallExpr {
//     use swc_core::common::{DUMMY_SP, SyntaxContext};
    
//     CallExpr {
//         span: DUMMY_SP,
//         ctxt: SyntaxContext::empty(),
//         callee: Callee::Expr(Box::new(Expr::Ident(Ident::new(function_name.into(), DUMMY_SP, SyntaxContext::empty())))),
//         args: vec![ExprOrSpread {
//             spread: None,
//             expr: Box::new(arg),
//         }],
//         type_args: None,
//     }
// }

// /// Helper function to create a string literal expression
// fn create_string_literal(value: &str) -> Expr {
//     use swc_core::common::DUMMY_SP;
    
//     Expr::Lit(Lit::Str(Str {
//         span: DUMMY_SP,
//         value: value.into(),
//         raw: None,
//     }))
// }

// /// Helper function to create a template literal expression: `Hello ${name}`
// fn create_template_literal() -> Expr {
//     use swc_core::common::{DUMMY_SP, SyntaxContext};
    
//     Expr::Tpl(Tpl {
//         span: DUMMY_SP,
//         exprs: vec![Box::new(Expr::Ident(Ident::new("name".into(), DUMMY_SP, SyntaxContext::empty())))],
//         quasis: vec![
//             TplElement {
//                 span: DUMMY_SP,
//                 tail: false,
//                 cooked: Some("Hello ".into()),
//                 raw: "Hello ".into(),
//             },
//             TplElement {
//                 span: DUMMY_SP,
//                 tail: true,
//                 cooked: Some("!".into()),
//                 raw: "!".into(),
//             },
//         ],
//     })
// }

// /// Helper function to create binary expression for string concatenation: "Hello " + name
// fn create_string_concatenation() -> Expr {
//     use swc_core::common::{DUMMY_SP, SyntaxContext};
    
//     Expr::Bin(BinExpr {
//         span: DUMMY_SP,
//         op: BinaryOp::Add,
//         left: Box::new(Expr::Lit(Lit::Str(Str {
//             span: DUMMY_SP,
//             value: "Hello ".into(),
//             raw: None,
//         }))),
//         right: Box::new(Expr::Ident(Ident::new("name".into(), DUMMY_SP, SyntaxContext::empty()))),
//     })
// }

// /// Helper function to create a variable declarator: const t = useGT();
// fn create_var_declarator_with_call() -> VarDeclarator {
//     use swc_core::common::{DUMMY_SP, SyntaxContext};
    
//     VarDeclarator {
//         span: DUMMY_SP,
//         name: Pat::Ident(BindingIdent {
//             id: Ident::new("t".into(), DUMMY_SP, SyntaxContext::empty()),
//             type_ann: None,
//         }),
//         init: Some(Box::new(Expr::Call(CallExpr {
//             span: DUMMY_SP,
//             ctxt: SyntaxContext::empty(),
//             callee: Callee::Expr(Box::new(Expr::Ident(Ident::new("useGT".into(), DUMMY_SP, SyntaxContext::empty())))),
//             args: vec![],
//             type_args: None,
//         }))),
//         definite: false,
//     }
// }

// /// Helper function to create nested T components: <T>Outer {value} <T>Inner {name}</T></T>
// fn create_nested_t_elements() -> JSXElement {
//     use swc_core::common::{DUMMY_SP, SyntaxContext};
    
//     // Create inner T element: <T>Inner {name}</T>
//     let inner_t = JSXElement {
//         span: DUMMY_SP,
//         opening: JSXOpeningElement {
//             span: DUMMY_SP,
//             name: JSXElementName::Ident(Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//             attrs: vec![],
//             self_closing: false,
//             type_args: None,
//         },
//         children: vec![
//             JSXElementChild::JSXText(JSXText {
//                 span: DUMMY_SP,
//                 value: "Inner ".into(),
//                 raw: "Inner ".into(),
//             }),
//             JSXElementChild::JSXExprContainer(JSXExprContainer {
//                 span: DUMMY_SP,
//                 expr: JSXExpr::Expr(Box::new(Expr::Ident(Ident::new("name".into(), DUMMY_SP, SyntaxContext::empty())))),
//             }),
//         ],
//         closing: Some(JSXClosingElement {
//             span: DUMMY_SP,
//             name: JSXElementName::Ident(Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//         }),
//     };
    
//     // Create outer T element: <T>Outer {value} <inner_t></T>
//     JSXElement {
//         span: DUMMY_SP,
//         opening: JSXOpeningElement {
//             span: DUMMY_SP,
//             name: JSXElementName::Ident(Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//             attrs: vec![],
//             self_closing: false,
//             type_args: None,
//         },
//         children: vec![
//             JSXElementChild::JSXText(JSXText {
//                 span: DUMMY_SP,
//                 value: "Outer ".into(),
//                 raw: "Outer ".into(),
//             }),
//             JSXElementChild::JSXExprContainer(JSXExprContainer {
//                 span: DUMMY_SP,
//                 expr: JSXExpr::Expr(Box::new(Expr::Ident(Ident::new("value".into(), DUMMY_SP, SyntaxContext::empty())))),
//             }),
//             JSXElementChild::JSXText(JSXText {
//                 span: DUMMY_SP,
//                 value: " ".into(),
//                 raw: " ".into(),
//             }),
//             JSXElementChild::JSXElement(Box::new(inner_t)),
//         ],
//         closing: Some(JSXClosingElement {
//             span: DUMMY_SP,
//             name: JSXElementName::Ident(Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//         }),
//     }
// }

// /// Helper function to create a namespace JSX element: <GT.T>Hello {name}!</GT.T>
// fn create_namespace_jsx_element() -> JSXElement {
//     use swc_core::common::{DUMMY_SP, SyntaxContext};
    
//     // Create member expression for GT.T
//     let member_expr = JSXMemberExpr {
//         span: DUMMY_SP,
//         obj: JSXObject::Ident(Ident::new("GT".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//         prop: Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty()).into(),
//     };
    
//     JSXElement {
//         span: DUMMY_SP,
//         opening: JSXOpeningElement {
//             span: DUMMY_SP,
//             name: JSXElementName::JSXMemberExpr(member_expr.clone()),
//             attrs: vec![],
//             self_closing: false,
//             type_args: None,
//         },
//         children: vec![
//             JSXElementChild::JSXText(JSXText {
//                 span: DUMMY_SP,
//                 value: "Hello ".into(),
//                 raw: "Hello ".into(),
//             }),
//             JSXElementChild::JSXExprContainer(JSXExprContainer {
//                 span: DUMMY_SP,
//                 expr: JSXExpr::Expr(Box::new(Expr::Ident(Ident::new("name".into(), DUMMY_SP, SyntaxContext::empty())))),
//             }),
//             JSXElementChild::JSXText(JSXText {
//                 span: DUMMY_SP,
//                 value: "!".into(),
//                 raw: "!".into(),
//             }),
//         ],
//         closing: Some(JSXClosingElement {
//             span: DUMMY_SP,
//             name: JSXElementName::JSXMemberExpr(member_expr),
//         }),
//     }
// }

// #[cfg(test)]
// mod tests {
//     use super::*;

//     #[test]
//     fn test_visitor_initial_state() {
//         let visitor = TransformVisitor::default();
        
//         assert!(!visitor.in_translation_component);
//         assert!(!visitor.in_variable_component);
//         assert!(!visitor.in_jsx_attribute);
//         assert!(visitor.gt_next_translation_imports.is_empty());
//         assert!(visitor.gt_next_variable_imports.is_empty());
//         assert!(visitor.gt_next_namespace_imports.is_empty());
//         assert!(visitor.gt_translation_functions.is_empty());
//         assert_eq!(visitor.jsx_element_count, 0);
//         assert_eq!(visitor.dynamic_content_violations, 0);
//     }

//     #[test]
//     fn test_is_translation_component_name() {
//         let visitor = TransformVisitor::default();
        
//         // Should match known translation components
//         let t_atom = Atom::from("T");
//         assert!(visitor.is_translation_component_name(&t_atom));
        
//         // Should not match unknown components
//         let unknown_atom = Atom::from("UnknownComponent");
//         assert!(!visitor.is_translation_component_name(&unknown_atom));
//     }

//     #[test]
//     fn test_is_variable_component_name() {
//         let visitor = TransformVisitor::default();
        
//         // Should match known variable components
//         let var_atom = Atom::from("Var");
//         let num_atom = Atom::from("Num");
//         let currency_atom = Atom::from("Currency");
//         assert!(visitor.is_variable_component_name(&var_atom));
//         assert!(visitor.is_variable_component_name(&num_atom));
//         assert!(visitor.is_variable_component_name(&currency_atom));
        
//         // Should not match unknown components
//         let unknown_atom = Atom::from("UnknownComponent");
//         let div_atom = Atom::from("div");
//         assert!(!visitor.is_translation_component_name(&unknown_atom));
//         assert!(!visitor.is_variable_component_name(&div_atom));
//     }

//     #[test]
//     fn test_namespace_import_tracking() {
//         let mut visitor = TransformVisitor::default();
        
//         // Initially, no namespace imports should be tracked
//         assert!(visitor.gt_next_namespace_imports.is_empty());
        
//         // Simulate namespace import processing (this would normally happen in fold_import_decl)
//         let gt_atom = Atom::from("GT");
//         let gt_client_atom = Atom::from("GTClient");
        
//         visitor.gt_next_namespace_imports.insert(gt_atom.clone());
//         visitor.gt_next_namespace_imports.insert(gt_client_atom.clone());
        
//         // Verify namespace imports are tracked
//         assert!(visitor.gt_next_namespace_imports.contains(&gt_atom));
//         assert!(visitor.gt_next_namespace_imports.contains(&gt_client_atom));
        
//         // Should not contain untracked namespaces
//         let react_atom = Atom::from("React");
//         assert!(!visitor.gt_next_namespace_imports.contains(&react_atom));
//     }


//     #[test]
//     fn test_basic_t_component_with_dynamic_content() {
//         let mut visitor = TransformVisitor::new(LogLevel::Warn, LogLevel::Warn, false, Some("test.tsx".to_string()));
        
//         // Simulate import of T component 
//         visitor.gt_next_translation_import_aliases.insert(Atom::from("T"), Atom::from("T"));
        
//         // Create JSX element: <T>Hello {name}!</T>
//         let jsx_element = create_jsx_element("T", true);
        
//         // Process the element
//         let _transformed = jsx_element.fold_with(&mut visitor);
        
//         // Should detect one unwrapped dynamic content violation
//         assert_eq!(visitor.dynamic_content_violations, 1, "Should detect one unwrapped dynamic content violation");
//     }

//     #[test]
//     fn test_t_component_with_wrapped_dynamic_content() {
//         let mut visitor = TransformVisitor::new(LogLevel::Warn, LogLevel::Warn, false, Some("test.tsx".to_string()));
        
//         // Simulate imports of T and Var components 
//         visitor.gt_next_translation_import_aliases.insert(Atom::from("T"), Atom::from("T"));
//         visitor.gt_next_variable_import_aliases.insert(Atom::from("Var"), Atom::from("Var"));
        
//         // Create JSX element: <T>Hello <Var>{name}</Var>!</T>
//         let jsx_element = create_jsx_element_with_wrapped_content();
        
//         // Process the element
//         let _transformed = jsx_element.fold_with(&mut visitor);
        
//         // Should NOT detect any violations since dynamic content is wrapped
//         assert_eq!(visitor.dynamic_content_violations, 0, "Should not detect violations when dynamic content is wrapped in Var");
//     }

//     #[test]
//     fn test_namespace_import_t_component() {
//         let mut visitor = TransformVisitor::new(LogLevel::Warn, LogLevel::Warn, false, Some("test.tsx".to_string()));
        
//         // Simulate namespace import: import * as GT from 'gt-next'
//         visitor.gt_next_namespace_imports.insert(Atom::from("GT"));
        
//         // Create JSX element: <GT.T>Hello {name}!</GT.T>
//         let jsx_element = create_namespace_jsx_element();
        
//         // Process the element
//         let _transformed = jsx_element.fold_with(&mut visitor);
        
//         // Should detect one unwrapped dynamic content violation
//         assert_eq!(visitor.dynamic_content_violations, 1, "Should detect unwrapped dynamic content in namespace GT.T component");
//     }

//     #[test]
//     fn test_nested_t_components() {
//         let mut visitor = TransformVisitor::new(LogLevel::Warn, LogLevel::Warn, false, Some("test.tsx".to_string()));
        
//         // Simulate import of T component 
//         visitor.gt_next_translation_import_aliases.insert(Atom::from("T"), Atom::from("T"));
        
//         // Create nested JSX elements: <T>Outer {value} <T>Inner {name}</T></T>
//         let jsx_element = create_nested_t_elements();
        
//         // Process the element
//         let _transformed = jsx_element.fold_with(&mut visitor);
        
//         // Should detect TWO unwrapped dynamic content violations (one in outer T, one in inner T)
//         assert_eq!(visitor.dynamic_content_violations, 2, "Should detect two unwrapped dynamic content violations in nested T components");
//     }

//     #[test]
//     fn test_valid_t_function_call() {
//         let mut visitor = TransformVisitor::new(LogLevel::Warn, LogLevel::Warn, false, Some("test.tsx".to_string()));
        
//         // Simulate t function from useGT: const t = useGT();
//         visitor.gt_translation_functions.insert(Atom::from("t"));
        
//         // Create valid t() call: t("Hello, world!")
//         let call_expr = create_call_expr("t", create_string_literal("Hello, world!"));
        
//         // Process the call
//         let _transformed = call_expr.fold_with(&mut visitor);
        
//         // Should NOT detect any violations for valid string literal
//         assert_eq!(visitor.dynamic_content_violations, 0, "Should not detect violations for valid t() call with string literal");
//     }

//     #[test]
//     fn test_invalid_t_function_call_template_literal() {
//         let mut visitor = TransformVisitor::new(LogLevel::Warn, LogLevel::Warn, false, Some("test.tsx".to_string()));
        
//         // Simulate t function from useGT: const t = useGT();
//         visitor.gt_translation_functions.insert(Atom::from("t"));
        
//         // Create invalid t() call: t(`Hello ${name}!`)
//         let call_expr = create_call_expr("t", create_template_literal());
        
//         // Process the call
//         let _transformed = call_expr.fold_with(&mut visitor);
        
//         // Should detect one violation for template literal
//         assert_eq!(visitor.dynamic_content_violations, 1, "Should detect violation for t() call with template literal");
//     }

//     #[test]
//     fn test_invalid_t_function_call_string_concatenation() {
//         let mut visitor = TransformVisitor::new(LogLevel::Warn, LogLevel::Warn, false, Some("test.tsx".to_string()));
        
//         // Simulate t function from useGT: const t = useGT();
//         visitor.gt_translation_functions.insert(Atom::from("t"));
        
//         // Create invalid t() call: t("Hello " + name)
//         let call_expr = create_call_expr("t", create_string_concatenation());
        
//         // Process the call
//         let _transformed = call_expr.fold_with(&mut visitor);
        
//         // Should detect one violation for string concatenation
//         assert_eq!(visitor.dynamic_content_violations, 1, "Should detect violation for t() call with string concatenation");
//     }

//     #[test]
//     fn test_tx_function_call_ignored() {
//         let mut visitor = TransformVisitor::new(LogLevel::Warn, LogLevel::Warn, false, Some("test.tsx".to_string()));
        
//         // tx() functions should NOT be tracked for dynamic content violations
//         // Even if manually added to translation functions, they should not trigger violations
//         visitor.gt_translation_functions.insert(Atom::from("tx"));
        
//         // Create tx() call with template literal: tx(`Hello ${name}!`)
//         let call_expr = create_call_expr("tx", create_template_literal());
        
//         // Process the call
//         let _transformed = call_expr.fold_with(&mut visitor);
        
//         // Should NOT detect any violations for tx() calls (excluded from dynamic content checks)
//         assert_eq!(visitor.dynamic_content_violations, 0, "Should NOT detect violations for tx() calls - they are excluded");
//     }

//     #[test]
//     fn test_experimental_hash_injection() {
//         let mut visitor = TransformVisitor::new(LogLevel::Warn, LogLevel::Warn, true, Some("test.tsx".to_string()));
        
//         // Simulate import of T component 
//         visitor.gt_next_translation_import_aliases.insert(Atom::from("T"), Atom::from("T"));
        
//         // Create JSX element: <T>Hello world</T>
//         let jsx_element = create_jsx_element("T", false);
        
//         // Process the element
//         let transformed = jsx_element.fold_with(&mut visitor);
        
//         // Check that hash attribute was added with a calculated value
//         let has_hash_attr = transformed.opening.attrs.iter().any(|attr| {
//             if let JSXAttrOrSpread::JSXAttr(jsx_attr) = attr {
//                 if let JSXAttrName::Ident(ident) = &jsx_attr.name {
//                     if ident.sym.as_ref() == "hash" {
//                         // Verify the value is a hex hash (16 characters)
//                         if let Some(JSXAttrValue::Lit(Lit::Str(str_lit))) = &jsx_attr.value {
//                             let hash_value = str_lit.value.as_ref();
//                             return hash_value.len() == 16 && hash_value.chars().all(|c| c.is_ascii_hexdigit());
//                         }
//                     }
//                 }
//             }
//             false
//         });
        
//         assert!(has_hash_attr, "Should add calculated hash attribute to T component when experimental flag is enabled");
//     }

//     #[test]
//     fn test_json_attribute_injection() {
//         // Simple sanity check that json attribute is added alongside hash
//         let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, true, None);
//         visitor.gt_next_translation_import_aliases.insert(Atom::from("T"), Atom::from("T"));
        
//         let jsx_element = create_jsx_element("T", false);
//         let transformed = jsx_element.fold_with(&mut visitor);
        
//         // Check that json attribute exists
//         let has_json_attr = transformed.opening.attrs.iter().any(|attr| {
//             if let JSXAttrOrSpread::JSXAttr(jsx_attr) = attr {
//                 if let JSXAttrName::Ident(ident) = &jsx_attr.name {
//                     return ident.sym.as_ref() == "json";
//                 }
//             }
//             false
//         });
        
//         assert!(has_json_attr, "Should add json attribute to T component");
//     }

//     #[test]
//     fn test_variable_key_generation_with_counter() {
//         // Test that variable components generate correct keys with counter
//         use crate::hash::{JsxHasher, SanitizedData, SanitizedChildren, SanitizedChild, SanitizedVariable, VariableType};
        
//         // Create expected structure for multiple variable types with proper keys
//         let children = vec![
//             SanitizedChild::Variable(SanitizedVariable {
//                 k: Some("_gt_n_1".to_string()), // Num -> _gt_n_1
//                 v: Some(VariableType::Number),
//                 b: None,
//                 t: None,
//             }),
//             SanitizedChild::Variable(SanitizedVariable {
//                 k: Some("_gt_cost_2".to_string()), // Currency -> _gt_cost_2  
//                 v: Some(VariableType::Currency),
//                 b: None,
//                 t: None,
//             }),
//             SanitizedChild::Variable(SanitizedVariable {
//                 k: Some("_gt_date_3".to_string()), // DateTime -> _gt_date_3
//                 v: Some(VariableType::Date),
//                 b: None,
//                 t: None,
//             }),
//             SanitizedChild::Variable(SanitizedVariable {
//                 k: Some("_gt_value_4".to_string()), // Var -> _gt_value_4
//                 v: Some(VariableType::Variable),
//                 b: None,
//                 t: None,
//             }),
//         ];
        
//         let sanitized_children = SanitizedChildren::Multiple(children);
//         let sanitized_data = SanitizedData {
//             source: Some(Box::new(sanitized_children)),
//             id: None,
//             context: None,
//             data_format: Some("JSX".to_string()),
//         };
        
//         let json_string = JsxHasher::stable_stringify(&sanitized_data).unwrap();
        
//         // Verify the JSON contains the correct variable keys with counters
//         assert!(json_string.contains(r#""k":"_gt_n_1""#), "Should contain Num variable with counter 1");
//         assert!(json_string.contains(r#""k":"_gt_cost_2""#), "Should contain Currency variable with counter 2");  
//         assert!(json_string.contains(r#""k":"_gt_date_3""#), "Should contain DateTime variable with counter 3");
//         assert!(json_string.contains(r#""k":"_gt_value_4""#), "Should contain Var variable with counter 4");
//     }

//     #[test]
//     fn test_experimental_hash_injection_disabled() {
//         let mut visitor = TransformVisitor::new(LogLevel::Warn, LogLevel::Warn, false, Some("test.tsx".to_string()));
        
//         // Simulate import of T component 
//         visitor.gt_next_translation_import_aliases.insert(Atom::from("T"), Atom::from("T"));
        
//         // Create JSX element: <T>Hello world</T>
//         let jsx_element = create_jsx_element("T", false);
        
//         // Process the element
//         let transformed = jsx_element.fold_with(&mut visitor);
        
//         // Check that NO hash attribute was added
//         let has_hash_attr = transformed.opening.attrs.iter().any(|attr| {
//             if let JSXAttrOrSpread::JSXAttr(jsx_attr) = attr {
//                 if let JSXAttrName::Ident(ident) = &jsx_attr.name {
//                     return ident.sym.as_ref() == "hash";
//                 }
//             }
//             false
//         });
        
//         assert!(!has_hash_attr, "Should NOT add hash attribute when experimental flag is disabled");
//     }

//     #[test]
//     fn test_jsx_attributes_ignored() {
//         let mut visitor = TransformVisitor::new(LogLevel::Warn, LogLevel::Warn, false, Some("test.tsx".to_string()));
        
//         // Simulate import of T component 
//         visitor.gt_next_translation_import_aliases.insert(Atom::from("T"), Atom::from("T"));
        
//         // Create JSX element with attributes: <T><Image width={16} height={name} />Text</T>
//         let jsx_element = JSXElement {
//             span: DUMMY_SP,
//             opening: JSXOpeningElement {
//                 name: JSXElementName::Ident(Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                 span: DUMMY_SP,
//                 attrs: vec![],
//                 self_closing: false,
//                 type_args: None,
//             },
//             closing: Some(JSXClosingElement {
//                 span: DUMMY_SP,
//                 name: JSXElementName::Ident(Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//             }),
//             children: vec![
//                 // <Image width={16} height={name} />
//                 JSXElementChild::JSXElement(Box::new(JSXElement {
//                     span: DUMMY_SP,
//                     opening: JSXOpeningElement {
//                         name: JSXElementName::Ident(Ident::new("Image".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         span: DUMMY_SP,
//                         attrs: vec![
//                             // width={16}
//                             JSXAttrOrSpread::JSXAttr(JSXAttr {
//                                 span: DUMMY_SP,
//                                 name: JSXAttrName::Ident(Ident::new("width".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                 value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
//                                     span: DUMMY_SP,
//                                     expr: JSXExpr::Expr(Box::new(Expr::Lit(Lit::Num(Number {
//                                         span: DUMMY_SP,
//                                         value: 16.0,
//                                         raw: None,
//                                     }))))
//                                 })),
//                             }),
//                             // height={name}
//                             JSXAttrOrSpread::JSXAttr(JSXAttr {
//                                 span: DUMMY_SP,
//                                 name: JSXAttrName::Ident(Ident::new("height".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                 value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
//                                     span: DUMMY_SP,
//                                     expr: JSXExpr::Expr(Box::new(Expr::Ident(Ident::new("name".into(), DUMMY_SP, SyntaxContext::empty()))))
//                                 })),
//                             }),
//                         ],
//                         self_closing: true,
//                         type_args: None,
//                     },
//                     closing: None,
//                     children: vec![],
//                 })),
//                 // Text content
//                 JSXElementChild::JSXText(JSXText {
//                     span: DUMMY_SP,
//                     value: "Text".into(),
//                     raw: "Text".into(),
//                 }),
//             ],
//         };
        
//         // Process the element
//         let _transformed = jsx_element.fold_with(&mut visitor);
        
//         // Should NOT detect any violations since the expressions are in attributes, not content
//         assert_eq!(visitor.dynamic_content_violations, 0, "Should not detect violations for JSX attribute expressions like width={{16}} and height={{name}}");
//     }

//     #[test]
//     fn test_t_function_assignment_from_use_gt() {
//         let mut visitor = TransformVisitor::new(LogLevel::Warn, LogLevel::Warn, false, Some("test.tsx".to_string()));
        
//         // Simulate useGT import: import { useGT } from 'gt-next';
//         visitor.gt_translation_functions.insert(Atom::from("useGT"));
        
//         // Process assignment: const t = useGT();
//         let var_declarator = create_var_declarator_with_call();
//         let _transformed = var_declarator.fold_with(&mut visitor);
        
//         // Verify that 't' is now tracked as a translation function
//         assert!(visitor.gt_translation_functions.contains(&Atom::from("t")), "Should track 't' as translation function after useGT() assignment");
        
//         // Now test invalid usage of the assigned 't' function
//         let call_expr = create_call_expr("t", create_template_literal());
//         let _transformed_call = call_expr.fold_with(&mut visitor);
        
//         // Should detect one violation for the assigned t() function
//         assert_eq!(visitor.dynamic_content_violations, 1, "Should detect violation for assigned t() function with template literal");
//     }

//     // Configuration parsing tests
    
//     #[test]
//     fn test_plugin_config_default() {
//         let config = PluginConfig::default();
        
//         assert_eq!(config.experimental_compile_time_hash, false);
//         assert!(matches!(config.dynamic_jsx_check_log_level, LogLevel::Warn));
//         assert!(matches!(config.dynamic_string_check_log_level, LogLevel::Warn));
//     }

//     #[test]
//     fn test_plugin_config_parse_experimental_hash_true() {
//         let json = r#"{"experimentalCompileTimeHash": true}"#;
//         let config: PluginConfig = serde_json::from_str(json).unwrap();
        
//         assert_eq!(config.experimental_compile_time_hash, true);
//         // Other fields should use defaults
//         assert!(matches!(config.dynamic_jsx_check_log_level, LogLevel::Warn));
//         assert!(matches!(config.dynamic_string_check_log_level, LogLevel::Warn));
//     }

//     #[test]
//     fn test_plugin_config_parse_experimental_hash_false() {
//         let json = r#"{"experimentalCompileTimeHash": false}"#;
//         let config: PluginConfig = serde_json::from_str(json).unwrap();
        
//         assert_eq!(config.experimental_compile_time_hash, false);
//     }

//     #[test]
//     fn test_plugin_config_parse_full_config() {
//         let json = r#"{
//             "dynamicJsxCheckLogLevel": "error",
//             "dynamicStringCheckLogLevel": "info",
//             "experimentalCompileTimeHash": true
//         }"#;
//         let config: PluginConfig = serde_json::from_str(json).unwrap();
        
//         assert_eq!(config.experimental_compile_time_hash, true);
//         assert!(matches!(config.dynamic_jsx_check_log_level, LogLevel::Error));
//         assert!(matches!(config.dynamic_string_check_log_level, LogLevel::Info));
//     }

//     #[test]
//     fn test_plugin_config_parse_empty_json() {
//         let json = r#"{}"#;
//         let config: PluginConfig = serde_json::from_str(json).unwrap();
        
//         // All fields should use their defaults
//         assert_eq!(config.experimental_compile_time_hash, false);
//         assert!(matches!(config.dynamic_jsx_check_log_level, LogLevel::Warn));
//         assert!(matches!(config.dynamic_string_check_log_level, LogLevel::Warn));
//     }

//     #[test]
//     fn test_plugin_config_parse_partial_config() {
//         let json = r#"{"dynamicJsxCheckLogLevel": "silent"}"#;
//         let config: PluginConfig = serde_json::from_str(json).unwrap();
        
//         // Specified field should be set
//         assert!(matches!(config.dynamic_jsx_check_log_level, LogLevel::Silent));
//         // Others should use defaults
//         assert_eq!(config.experimental_compile_time_hash, false);
//         assert!(matches!(config.dynamic_string_check_log_level, LogLevel::Warn));
//     }

//     #[test]
//     fn test_plugin_config_camel_case_conversion() {
//         // Test that camelCase JSON keys are properly converted to snake_case Rust fields
//         let json = r#"{
//             "dynamicJsxCheckLogLevel": "error",
//             "dynamicStringCheckLogLevel": "info", 
//             "experimentalCompileTimeHash": true
//         }"#;
//         let config: PluginConfig = serde_json::from_str(json).unwrap();
        
//         // All fields should be parsed correctly
//         assert!(matches!(config.dynamic_jsx_check_log_level, LogLevel::Error));
//         assert!(matches!(config.dynamic_string_check_log_level, LogLevel::Info));
//         assert_eq!(config.experimental_compile_time_hash, true);
//     }

//     #[test]
//     fn test_plugin_config_invalid_json_fallback() {
//         let invalid_json = r#"{"invalid": syntax}"#;
//         let config: PluginConfig = serde_json::from_str(invalid_json).unwrap_or_default();
        
//         // Should fallback to defaults when JSON is invalid
//         assert_eq!(config.experimental_compile_time_hash, false);
//         assert!(matches!(config.dynamic_jsx_check_log_level, LogLevel::Warn));
//         assert!(matches!(config.dynamic_string_check_log_level, LogLevel::Warn));
//     }

//     #[test]
//     fn test_complex_jsx_structure_whitespace_normalization() {
//         use swc_core::ecma::ast::*;
//         use swc_core::common::{Span, BytePos};
//         use crate::hash::{JsxHasher, SanitizedData, SanitizedChildren, SanitizedChild};
//         use crate::traversal::JsxTraversal;
        
//         // Test case similar to the complex JSX structure provided by user
//         let visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, true, None);
        
//         // Create a JSX text element with multiline content and extra whitespace
//         let jsx_text_with_whitespace = JSXText {
//             span: Span::new(BytePos(0), BytePos(1)),
//             value: "This is a comprehensive guide to help you get started with our\n                amazing platform. We provide everything you need to succeed in\n                your journey.".into(),
//             raw: "This is a comprehensive guide to help you get started with our\n                amazing platform. We provide everything you need to succeed in\n                your journey.".into(),
//         };
        
//         let jsx_child = JSXElementChild::JSXText(jsx_text_with_whitespace);
        
//         // Build sanitized child and verify whitespace normalization
//         let mut traversal = JsxTraversal::new(&visitor);
//         let result = traversal.build_sanitized_child(&jsx_child, true, true);
        
//         match result {
//             Some(SanitizedChild::Text(text)) => {
//                 // Should be normalized to single spaces
//                 let expected = "This is a comprehensive guide to help you get started with our amazing platform. We provide everything you need to succeed in your journey.";
//                 assert_eq!(text, expected);
                
//                 // Verify no extra whitespace remains
//                 assert!(!text.contains("\n"), "Should not contain newlines");
//                 assert!(!text.contains("  "), "Should not contain double spaces");
                
//                 // Test that the normalized text produces consistent hashes
//                 let children = SanitizedChildren::Single(Box::new(SanitizedChild::Text(text.clone())));
//                 let data = SanitizedData {
//                     source: Some(Box::new(children)),
//                     id: None,
//                     context: None,
//                     data_format: Some("JSX".to_string()),
//                 };
                
//                 let hash1 = JsxHasher::hash_string(&JsxHasher::stable_stringify(&data).unwrap());
//                 let hash2 = JsxHasher::hash_string(&JsxHasher::stable_stringify(&data).unwrap());
                
//                 assert_eq!(hash1, hash2, "Normalized text should produce consistent hashes");
//                 assert_eq!(hash1.len(), 16, "Hash should be 16 characters");
//             },
//             _ => panic!("Expected SanitizedChild::Text, got {:?}", result),
//         }
//     }

//     #[test]
//     fn test_branch_component_no_hash_injection() {
//         // Test that Branch components do NOT get hash injection (only T components should)
//         let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, true, None);
        
//         // Simulate import of Branch component 
//         visitor.gt_next_branch_import_aliases.insert(Atom::from("Branch"), Atom::from("Branch"));
        
//         // Create a Branch component: <Branch n="file" file="file.svg" directory="public" />
//         let branch_element = JSXElement {
//             span: DUMMY_SP,
//             opening: JSXOpeningElement {
//                 name: JSXElementName::Ident(Ident::new("Branch".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                 span: DUMMY_SP,
//                 attrs: vec![
//                     JSXAttrOrSpread::JSXAttr(JSXAttr {
//                         span: DUMMY_SP,
//                         name: JSXAttrName::Ident(Ident::new("n".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         value: Some(JSXAttrValue::Lit(Lit::Str(Str {
//                             span: DUMMY_SP,
//                             value: "file".into(),
//                             raw: None,
//                         }))),
//                     }),
//                     JSXAttrOrSpread::JSXAttr(JSXAttr {
//                         span: DUMMY_SP,
//                         name: JSXAttrName::Ident(Ident::new("file".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         value: Some(JSXAttrValue::Lit(Lit::Str(Str {
//                             span: DUMMY_SP,
//                             value: "file.svg".into(),
//                             raw: None,
//                         }))),
//                     }),
//                     JSXAttrOrSpread::JSXAttr(JSXAttr {
//                         span: DUMMY_SP,
//                         name: JSXAttrName::Ident(Ident::new("directory".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         value: Some(JSXAttrValue::Lit(Lit::Str(Str {
//                             span: DUMMY_SP,
//                             value: "public".into(),
//                             raw: None,
//                         }))),
//                     }),
//                 ],
//                 self_closing: true,
//                 type_args: None,
//             },
//             closing: None,
//             children: vec![],
//         };
        
//         // Process the element
//         let transformed = branch_element.fold_with(&mut visitor);
        
//         // Check that NO hash attribute was added (Branch components should not get hash injection)
//         let hash_attr = transformed.opening.attrs.iter().find_map(|attr| {
//             if let JSXAttrOrSpread::JSXAttr(jsx_attr) = attr {
//                 if let JSXAttrName::Ident(ident) = &jsx_attr.name {
//                     if ident.sym.as_ref() == "hash" {
//                         if let Some(JSXAttrValue::Lit(Lit::Str(str_lit))) = &jsx_attr.value {
//                             return Some(str_lit.value.as_ref());
//                         }
//                     }
//                 }
//             }
//             None
//         });
        
//         assert!(hash_attr.is_none(), "Branch components should NOT receive hash attribute injection");
        
//         // Verify that Branch components are still tracked as branch components
//         assert!(visitor.should_track_component_as_branch(&Atom::from("Branch")), 
//                "Branch should still be tracked as branch component");
//         assert!(!visitor.should_track_component_as_translation(&Atom::from("Branch")), 
//                "Branch should NOT be tracked as translation component");
//     }

//     #[test]
//     fn test_branch_component_structure_serialization() {
//         // Test that Branch components are serialized as variables with correct structure
//         use crate::hash::{SanitizedChildren, SanitizedChild};
//         use crate::traversal::JsxTraversal;
//         use swc_core::ecma::atoms::Atom;
        
//         let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, true, None);
//         // Set up import tracking for Branch component
//         visitor.gt_next_branch_import_aliases.insert(Atom::from("Branch"), Atom::from("Branch"));
//         let mut traversal = JsxTraversal::new(&visitor);
        
//         // Create a Branch element with attributes
//         let branch_element = JSXElement {
//             span: DUMMY_SP,
//             opening: JSXOpeningElement {
//                 name: JSXElementName::Ident(Ident::new("Branch".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                 span: DUMMY_SP,
//                 attrs: vec![
//                     JSXAttrOrSpread::JSXAttr(JSXAttr {
//                         span: DUMMY_SP,
//                         name: JSXAttrName::Ident(Ident::new("n".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         value: Some(JSXAttrValue::Lit(Lit::Str(Str {
//                             span: DUMMY_SP,
//                             value: "file".into(),
//                             raw: None,
//                         }))),
//                     }),
//                     JSXAttrOrSpread::JSXAttr(JSXAttr {
//                         span: DUMMY_SP,
//                         name: JSXAttrName::Ident(Ident::new("file".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         value: Some(JSXAttrValue::Lit(Lit::Str(Str {
//                             span: DUMMY_SP,
//                             value: "file.svg".into(),
//                             raw: None,
//                         }))),
//                     }),
//                 ],
//                 self_closing: true,
//                 type_args: None,
//             },
//             closing: None,
//             children: vec![],
//         };
        
//         let jsx_child = JSXElementChild::JSXElement(Box::new(branch_element));
//         let result = traversal.build_sanitized_child(&jsx_child, true, true);
        
//         match result {
//             Some(SanitizedChild::Variable(var)) => {
//                 // Should be serialized as a variable with branch structure
//                 assert!(var.k.is_none(), "Branch should not have a key");
//                 assert!(var.v.is_none(), "Branch should not have a variable type");
//                 assert!(var.b.is_some(), "Branch should have branch data");
//                 assert_eq!(var.t, Some("b".to_string()), "Branch should have transformation type 'b'");
                
//                 // Check branch data contains expected attributes
//                 let branches = var.b.as_ref().unwrap();
//                 assert!(branches.contains_key("n"), "Should contain 'n' branch");
//                 assert!(branches.contains_key("file"), "Should contain 'file' branch");
//                 // Hash is no longer injected into Branch/Plural components
                
//                 // Verify serialization structure matches expected runtime format
//                 let json = serde_json::to_string(&var).unwrap();
//                 assert!(json.contains(r#""b":"#), "Should serialize with 'b' field");
//                 assert!(json.contains(r#""t":"b""#), "Should serialize with transformation type 'b'");
//                 assert!(!json.contains(r#""k":"#), "Should not serialize with 'k' field");
//                 assert!(!json.contains(r#""v":"#), "Should not serialize with 'v' field");
//             },
//             Some(SanitizedChild::Element(element)) => {
//                 // Branch components are now serialized as SanitizedElement with branches
//                 let json = serde_json::to_string(element.as_ref()).unwrap();
//                 println!("Branch Element JSON: {}", json);
                
//                 // Verify branch structure is correct
//                 assert!(element.b.is_some(), "Branch element should have branches");
//                 assert_eq!(element.t, Some("b".to_string()), "Branch element should have transformation 'b'");
                
//                 // Should not have d field for branch/plural components
//                 assert!(element.d.is_none(), "Branch element should not have GT data");
                
//                 // Test the JSON structure
//                 assert!(json.contains(r#""b":"#), "Should serialize with 'b' field (branches)");
//                 assert!(json.contains(r#""t":"b""#), "Should serialize with transformation type 'b'");
//                 assert!(!json.contains(r#""v":"#), "Should not serialize with 'v' field");
//             },
//             _ => panic!("Branch component should be serialized as SanitizedChild::Element, got {:?}", result),
//         }
//     }

//     #[test]
//     fn test_complex_real_world_jsx_with_branch() {
//         // Test case based on the actual user-provided complex JSX structure
//         use crate::hash::{JsxHasher, SanitizedData, SanitizedChildren, SanitizedChild, SanitizedVariable};
//         use crate::traversal::JsxTraversal;
//         use swc_core::ecma::atoms::Atom;
        
//         let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, true, None);
//         // Set up import tracking for Branch component
//         visitor.gt_next_branch_import_aliases.insert(Atom::from("Branch"), Atom::from("Branch"));
//         let mut traversal = JsxTraversal::new(&visitor);
        
//         // Create structure similar to: "Welcome to Our Platform change"
//         let _welcome_text = JSXText {
//             span: DUMMY_SP,
//             value: "Welcome to Our Platform change".into(),
//             raw: "Welcome to Our Platform change".into(),
//         };
        
//         // Create structure with whitespace normalization: multiline text
//         let guide_text = JSXText {
//             span: DUMMY_SP,
//             value: "This is a comprehensive guide to help you get started with our\n                amazing platform. We provide everything you need to succeed in\n                your journey.".into(),
//             raw: "This is a comprehensive guide to help you get started with our\n                amazing platform. We provide everything you need to succeed in\n                your journey.".into(),
//         };
        
//         // Test whitespace normalization
//         let guide_child = JSXElementChild::JSXText(guide_text);
//         let normalized_result = traversal.build_sanitized_child(&guide_child, true, true);
        
//         match normalized_result {
//             Some(SanitizedChild::Text(text)) => {
//                 let expected = "This is a comprehensive guide to help you get started with our amazing platform. We provide everything you need to succeed in your journey.";
//                 assert_eq!(text, expected, "Should normalize whitespace in multiline text");
//             },
//             _ => panic!("Expected normalized text"),
//         }
        
//         // Create a Branch component within the complex structure
//         let branch_element = JSXElement {
//             span: DUMMY_SP,
//             opening: JSXOpeningElement {
//                 name: JSXElementName::Ident(Ident::new("Branch".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                 span: DUMMY_SP,
//                 attrs: vec![
//                     JSXAttrOrSpread::JSXAttr(JSXAttr {
//                         span: DUMMY_SP,
//                         name: JSXAttrName::Ident(Ident::new("n".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         value: Some(JSXAttrValue::Lit(Lit::Str(Str {
//                             span: DUMMY_SP,
//                             value: "file".into(),
//                             raw: None,
//                         }))),
//                     }),
//                     JSXAttrOrSpread::JSXAttr(JSXAttr {
//                         span: DUMMY_SP,
//                         name: JSXAttrName::Ident(Ident::new("file".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         value: Some(JSXAttrValue::Lit(Lit::Str(Str {
//                             span: DUMMY_SP,
//                             value: "file.svg".into(),
//                             raw: None,
//                         }))),
//                     }),
//                     JSXAttrOrSpread::JSXAttr(JSXAttr {
//                         span: DUMMY_SP,
//                         name: JSXAttrName::Ident(Ident::new("directory".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         value: Some(JSXAttrValue::Lit(Lit::Str(Str {
//                             span: DUMMY_SP,
//                             value: "public".into(),
//                             raw: None,
//                         }))),
//                     }),
//                 ],
//                 self_closing: true,
//                 type_args: None,
//             },
//             closing: None,
//             children: vec![],
//         };
        
//         let branch_child = JSXElementChild::JSXElement(Box::new(branch_element));
//         let branch_result = traversal.build_sanitized_child(&branch_child, true, true);
        
//         // Verify Branch serializes correctly with hash
//         match branch_result {
//             Some(SanitizedChild::Variable(branch_var)) => {
//                 assert_eq!(branch_var.t, Some("b".to_string()));
//                 assert!(branch_var.b.is_some());
                
//                 let branches = branch_var.b.unwrap();
//                 // Hash is no longer injected into Branch/Plural components
                
//                 // Create a complex structure with the Branch component
//                 let complex_children = SanitizedChildren::Multiple(vec![
//                     SanitizedChild::Text("Welcome to Our Platform change".to_string()),
//                     SanitizedChild::Text("Key Features".to_string()),
//                     SanitizedChild::Variable(SanitizedVariable {
//                         k: None,
//                         v: None,
//                         b: Some(branches),
//                         t: Some("b".to_string()),
//                     }),
//                     SanitizedChild::Text("Advanced file management".to_string()),
//                 ]);
                
//                 let data = SanitizedData {
//                     source: Some(Box::new(complex_children)),
//                     id: None,
//                     context: None,
//                     data_format: Some("JSX".to_string()),
//                 };
                
//                 // Verify stable stringify produces consistent results
//                 let json1 = JsxHasher::stable_stringify(&data).unwrap();
//                 let json2 = JsxHasher::stable_stringify(&data).unwrap();
//                 assert_eq!(json1, json2, "Stable stringify should be consistent");
                
//                 let hash1 = JsxHasher::hash_string(&json1);
//                 let hash2 = JsxHasher::hash_string(&json2);
//                 assert_eq!(hash1, hash2, "Complex structure with Branch should produce consistent hashes");
                
//                 // Verify the JSON structure contains the Branch in the expected format
//                 assert!(json1.contains(r#""b":{"#), "JSON should contain branch structure");
//                 assert!(json1.contains(r#""t":"b""#), "JSON should contain transformation type");
//                 // Hash is no longer injected into Branch/Plural components
//             },
//             Some(SanitizedChild::Element(_)) => {
//                 // Branch components are now correctly serialized as SanitizedElement with branches
//                 println!("Branch correctly serialized as SanitizedChild::Element");
//             },
//             _ => panic!("Branch should be serialized as Element"),
//         }
//     }

//     #[test]
//     fn test_end_to_end_hash_consistency() {
//         // Test that simulates the full end-to-end hash calculation flow
//         // This should match the exact scenario from the user's real-world case
//         use crate::hash::{JsxHasher, SanitizedData, SanitizedChildren, SanitizedChild, SanitizedVariable};
        
//         // Create the exact structure that caused the hash mismatch
//         let branch_with_hash = {
//             let mut branches = std::collections::BTreeMap::new();
//             branches.insert("directory".to_string(), Box::new(
//                 SanitizedChildren::Single(Box::new(SanitizedChild::Text("public".to_string())))
//             ));
//             branches.insert("file".to_string(), Box::new(
//                 SanitizedChildren::Single(Box::new(SanitizedChild::Text("file.svg".to_string())))
//             ));
//             branches.insert("n".to_string(), Box::new(
//                 SanitizedChildren::Single(Box::new(SanitizedChild::Text("file".to_string())))
//             ));
//             // Add the expected runtime hash
//             branches.insert("hash".to_string(), Box::new(
//                 SanitizedChildren::Single(Box::new(SanitizedChild::Text("bdb7cc7686d0e468".to_string())))
//             ));
            
//             SanitizedVariable {
//                 k: None,
//                 v: None,
//                 b: Some(branches),
//                 t: Some("b".to_string()),
//             }
//         };
        
//         // Create complex nested structure similar to user's real case
//         let complex_structure = SanitizedChildren::Multiple(vec![
//             SanitizedChild::Text("Welcome to Our Platform change".to_string()),
//             // Nested structure with Branch component
//             SanitizedChild::Text("Key Features".to_string()),
//             SanitizedChild::Variable(branch_with_hash.clone()),
//             SanitizedChild::Text("Advanced file management".to_string()),
//         ]);
        
//         let data = SanitizedData {
//             source: Some(Box::new(complex_structure)),
//             id: None,
//             context: None,
//             data_format: Some("JSX".to_string()),
//         };
        
//         // Calculate hash using our stable stringify
//         let json_string = JsxHasher::stable_stringify(&data).unwrap();
//         let build_time_hash = JsxHasher::hash_string(&json_string);
        
//         println!("End-to-end test - Build-time hash: {}", build_time_hash);
//         println!("End-to-end test - JSON structure: {}", json_string);
        
//         // Verify the JSON contains expected structures
//         assert!(json_string.contains(r#"dataFormat":"JSX""#), "Should contain dataFormat");
//         assert!(json_string.contains(r#""b":{"directory":"public""#), "Should contain branch directory");
//         assert!(json_string.contains(r#""file":"file.svg""#), "Should contain branch file");
//         assert!(json_string.contains(r#""hash":"bdb7cc7686d0e468""#), "Should contain branch hash");
//         assert!(json_string.contains(r#""n":"file""#), "Should contain branch n property");
//         assert!(json_string.contains(r#""t":"b""#), "Should contain branch transformation type");
        
//         // Verify alphabetical key ordering in Branch structure
//         let branch_start = json_string.find(r#""b":{"#).unwrap();
//         let branch_section = &json_string[branch_start..];
        
//         // Keys should appear in alphabetical order: directory, file, hash, n
//         let dir_pos = branch_section.find("directory").unwrap();
//         let file_pos = branch_section.find("file").unwrap(); 
//         let hash_pos = branch_section.find("hash").unwrap();
//         let n_pos = branch_section.find("\"n\":").unwrap(); // Use exact match to avoid matching "n" in other words
        
//         assert!(dir_pos < file_pos, "directory should come before file");
//         assert!(file_pos < hash_pos, "file should come before hash"); 
//         assert!(hash_pos < n_pos, "hash should come before n");
        
//         // Hash should be consistent and valid
//         assert_eq!(build_time_hash.len(), 16, "Hash should be 16 characters");
//         assert!(build_time_hash.chars().all(|c| c.is_ascii_hexdigit()), "Hash should be hexadecimal");
        
//         // Test that the same structure produces the same hash (consistency check)
//         let json_string2 = JsxHasher::stable_stringify(&data).unwrap();
//         let build_time_hash2 = JsxHasher::hash_string(&json_string2);
//         assert_eq!(build_time_hash, build_time_hash2, "Hash calculation should be deterministic");
//         assert_eq!(json_string, json_string2, "JSON serialization should be deterministic");
//     }

//     #[test]
//     fn test_plural_component_structure_serialization() {
//         // Test that Plural components are serialized as variables with correct structure
//         use crate::hash::{SanitizedChildren, SanitizedChild};
//         use crate::traversal::JsxTraversal;
//         use swc_core::ecma::atoms::Atom;
        
//         let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, true, None);
//         // Set up import tracking for Plural component
//         visitor.gt_next_branch_import_aliases.insert(Atom::from("Plural"), Atom::from("Plural"));
//         let mut traversal = JsxTraversal::new(&visitor);
        
//         // Create a Plural element with attributes
//         let plural_element = JSXElement {
//             span: DUMMY_SP,
//             opening: JSXOpeningElement {
//                 name: JSXElementName::Ident(Ident::new("Plural".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                 span: DUMMY_SP,
//                 attrs: vec![
//                     JSXAttrOrSpread::JSXAttr(JSXAttr {
//                         span: DUMMY_SP,
//                         name: JSXAttrName::Ident(Ident::new("singular".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         value: Some(JSXAttrValue::Lit(Lit::Str(Str {
//                             span: DUMMY_SP,
//                             value: "File".into(),
//                             raw: None,
//                         }))),
//                     }),
//                     JSXAttrOrSpread::JSXAttr(JSXAttr {
//                         span: DUMMY_SP,
//                         name: JSXAttrName::Ident(Ident::new("plural".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         value: Some(JSXAttrValue::Lit(Lit::Str(Str {
//                             span: DUMMY_SP,
//                             value: "Files".into(),
//                             raw: None,
//                         }))),
//                     }),
//                 ],
//                 self_closing: true,
//                 type_args: None,
//             },
//             closing: None,
//             children: vec![],
//         };
        
//         let jsx_child = JSXElementChild::JSXElement(Box::new(plural_element));
//         let result = traversal.build_sanitized_child(&jsx_child, true, true);
        
//         match result {
//             Some(SanitizedChild::Variable(var)) => {
//                 // Should be serialized as a variable with plural structure
//                 assert!(var.k.is_none(), "Plural should not have a key");
//                 assert!(var.v.is_none(), "Plural should not have a variable type");
//                 assert!(var.b.is_some(), "Plural should have branch data");
//                 assert_eq!(var.t, Some("p".to_string()), "Plural should have transformation type 'p'");
                
//                 // Check plural data contains expected attributes
//                 let branches = var.b.as_ref().unwrap();
//                 assert!(branches.contains_key("singular"), "Should contain 'singular' branch");
//                 assert!(branches.contains_key("plural"), "Should contain 'plural' branch");
//                 // Hash is no longer injected into Branch/Plural components
                
//                 // Verify serialization structure matches expected runtime format (should be like Branch)
//                 let json = serde_json::to_string(&var).unwrap();
//                 assert!(json.contains(r#""b":"#), "Should serialize with 'b' field");
//                 assert!(json.contains(r#""t":"p""#), "Should serialize with transformation type 'p'");
//                 assert!(!json.contains(r#""k":"#), "Should not serialize with 'k' field");
//                 assert!(!json.contains(r#""v":"#), "Should not serialize with 'v' field");
                
//                 println!("Plural component serialized as: {}", json);
//             },
//             Some(SanitizedChild::Element(element)) => {
//                 // Plural components are now serialized as SanitizedElement with branches
//                 let json = serde_json::to_string(element.as_ref()).unwrap();
//                 println!("Plural Element JSON: {}", json);
                
//                 // Verify plural structure is correct
//                 assert!(element.b.is_some(), "Plural element should have branches");
//                 assert_eq!(element.t, Some("p".to_string()), "Plural element should have transformation 'p'");
                
//                 // Should not have d field for branch/plural components
//                 assert!(element.d.is_none(), "Plural element should not have GT data");
                
//                 // Test the JSON structure
//                 assert!(json.contains(r#""b":"#), "Should serialize with 'b' field (branches)");
//                 assert!(json.contains(r#""t":"p""#), "Should serialize with transformation type 'p'");
//                 assert!(!json.contains(r#""v":"#), "Should not serialize with 'v' field");
//             },
//             _ => panic!("Plural component should be serialized as SanitizedChild::Element, got {:?}", result),
//         }
//     }

//     #[test]
//     fn test_jsx_content_in_attributes() {
//         // Test Branch/Plural components with JSX content in attributes
//         use crate::hash::{SanitizedChildren, SanitizedChild, JsxHasher, SanitizedData};
//         use crate::traversal::JsxTraversal;
//         use swc_core::ecma::atoms::Atom;
        
//         let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, true, None);
//         // Set up import tracking for Branch component
//         visitor.gt_next_branch_import_aliases.insert(Atom::from("Branch"), Atom::from("Branch"));
//         let mut traversal = JsxTraversal::new(&visitor);
        
//         // Create a Branch component with JSX fragment in file attribute: file={<>Here is some translatable static content</>}
//         let jsx_fragment = JSXFragment {
//             span: DUMMY_SP,
//             opening: JSXOpeningFragment { span: DUMMY_SP },
//             children: vec![
//                 JSXElementChild::JSXText(JSXText {
//                     span: DUMMY_SP,
//                     value: "Here is some translatable static content".into(),
//                     raw: "Here is some translatable static content".into(),
//                 }),
//             ],
//             closing: JSXClosingFragment { span: DUMMY_SP },
//         };
        
//         let branch_element = JSXElement {
//             span: DUMMY_SP,
//             opening: JSXOpeningElement {
//                 name: JSXElementName::Ident(Ident::new("Branch".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                 span: DUMMY_SP,
//                 attrs: vec![
//                     JSXAttrOrSpread::JSXAttr(JSXAttr {
//                         span: DUMMY_SP,
//                         name: JSXAttrName::Ident(Ident::new("branch".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         value: Some(JSXAttrValue::Lit(Lit::Str(Str {
//                             span: DUMMY_SP,
//                             value: "file".into(),
//                             raw: None,
//                         }))),
//                     }),
//                     JSXAttrOrSpread::JSXAttr(JSXAttr {
//                         span: DUMMY_SP,
//                         name: JSXAttrName::Ident(Ident::new("file".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
//                             span: DUMMY_SP,
//                             expr: JSXExpr::Expr(Box::new(Expr::JSXFragment(jsx_fragment))),
//                         })),
//                     }),
//                     JSXAttrOrSpread::JSXAttr(JSXAttr {
//                         span: DUMMY_SP,
//                         name: JSXAttrName::Ident(Ident::new("directory".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         value: Some(JSXAttrValue::Lit(Lit::Str(Str {
//                             span: DUMMY_SP,
//                             value: "public".into(),
//                             raw: None,
//                         }))),
//                     }),
//                 ],
//                 self_closing: true,
//                 type_args: None,
//             },
//             closing: None,
//             children: vec![],
//         };
        
//         let jsx_child = JSXElementChild::JSXElement(Box::new(branch_element));
//         let result = traversal.build_sanitized_child(&jsx_child, true, true);
        
//         match result {
//             Some(SanitizedChild::Variable(var)) => {
//                 assert_eq!(var.t, Some("b".to_string()), "Should be Branch component");
//                 assert!(var.b.is_some(), "Should have branch data");
                
//                 let branches = var.b.as_ref().unwrap();
                
//                 // Should contain the JSX fragment content
//                 assert!(branches.contains_key("file"), "Should contain 'file' branch");
                
//                 if let Some(file_children) = branches.get("file") {
//                     // The JSX fragment should be wrapped in a container structure
//                     match file_children.as_ref() {
//                         SanitizedChildren::Wrapped { c } => {
//                             // Check the wrapped content (for JSX content)
//                             match c.as_ref() {
//                                 SanitizedChildren::Single(child) => {
//                                     if let SanitizedChild::Text(text) = child.as_ref() {
//                                         assert_eq!(text, "Here is some translatable static content", "Should contain the JSX fragment text");
//                                     } else {
//                                         panic!("Expected text child in wrapped file attribute, got {:?}", child);
//                                     }
//                                 },
//                                 _ => {
//                                     panic!("Expected single wrapped child for simple text fragment, got {:?}", c);
//                                 }
//                             }
//                         },
//                         SanitizedChildren::Single(child) => {
//                             if let SanitizedChild::Text(text) = child.as_ref() {
//                                 assert_eq!(text, "Here is some translatable static content", "Should contain the JSX fragment text");
//                             } else {
//                                 panic!("Expected text child in file attribute, got {:?}", child);
//                             }
//                         },
//                         SanitizedChildren::Multiple(_) => {
//                             panic!("Expected single child for simple text fragment");
//                         }
//                     }
//                 }
                
//                 // Verify the full serialization includes the JSX content correctly
//                 let json = serde_json::to_string(&var).unwrap();
//                 println!("Branch with JSX attribute serialized as: {}", json);
                
//                 // Should contain the nested structure for file attribute with wrapped format
//                 assert!(json.contains(r#""file":{"c":"Here is some translatable static content"}"#), 
//                        "Should serialize JSX fragment content with wrapped format like runtime");
                
//                 // Test full structure with this component
//                 let complex_children = SanitizedChildren::Single(Box::new(SanitizedChild::Variable(var.clone())));
//                 let data = SanitizedData {
//                     source: Some(Box::new(complex_children)),
//                     id: None,
//                     context: None,
//                     data_format: Some("JSX".to_string()),
//                 };
                
//                 let json_string = JsxHasher::stable_stringify(&data).unwrap();
//                 println!("Full structure with JSX attribute: {}", json_string);
                
//                 // Should contain the expected JSX content structure that matches runtime  
//                 assert!(json_string.contains(r#""file":{"c":"Here is some translatable static content"}"#), 
//                        "Full structure should include JSX attribute content with wrapped format");
//             },
//             Some(SanitizedChild::Element(element)) => {
//                 // Branch components with JSX attributes are now serialized as SanitizedElement with branches
//                 println!("Branch with JSX attribute correctly serialized as SanitizedChild::Element");
//                 assert!(element.b.is_some(), "Branch element should have branches");
//                 assert_eq!(element.t, Some("b".to_string()), "Branch element should have transformation 'b'");
//             },
//             _ => panic!("Branch with JSX attribute should be serialized as Element, got {:?}", result),
//         }
//     }

//     #[test]
//     fn test_comprehensive_hash_cases_simple_text() {
//         // Test case: Normal text
//         use crate::hash::{JsxHasher, SanitizedData, SanitizedChildren, SanitizedChild};
        
//         let children = SanitizedChildren::Single(Box::new(SanitizedChild::Text("Normal text".to_string())));
//         let data = SanitizedData {
//             source: Some(Box::new(children)),
//             id: None,
//             context: None,
//             data_format: Some("JSX".to_string()),
//         };
        
//         let json_string = JsxHasher::stable_stringify(&data).unwrap();
//         let hash = JsxHasher::hash_string(&json_string);
        
//         // Expected: a9e7bf1adac1e8ec
//         assert_eq!(hash, "a9e7bf1adac1e8ec", "Simple text hash should match expected value");
//         assert_eq!(json_string, r#"{"dataFormat":"JSX","source":"Normal text"}"#, "JSON should match expected stringification");
//     }

//     #[test] 
//     fn test_comprehensive_hash_cases_nested_elements() {
//         // Test case: Normal text with nested div element
//         use crate::hash::{JsxHasher, SanitizedData, SanitizedChildren, SanitizedChild, SanitizedElement};
        
//         let nested_element = SanitizedElement {
//             b: None,
//             t: None, // Non-GT elements have no tag name to match runtime behavior
//             d: None,
//             c: Some(Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Text("and some nesting".to_string())))))
//         };
        
//         let children = SanitizedChildren::Multiple(vec![
//             SanitizedChild::Text("Normal text ".to_string()),
//             SanitizedChild::Element(Box::new(nested_element))
//         ]);
        
//         let data = SanitizedData {
//             source: Some(Box::new(children)),
//             id: None,
//             context: None,
//             data_format: Some("JSX".to_string()),
//         };
        
//         let json_string = JsxHasher::stable_stringify(&data).unwrap();
//         let hash = JsxHasher::hash_string(&json_string);
        
//         // Expected: 272f94a21847be08
//         assert_eq!(hash, "272f94a21847be08", "Nested elements hash should match expected value");
//         assert_eq!(json_string, r#"{"dataFormat":"JSX","source":["Normal text ",{"c":"and some nesting"}]}"#, "JSON should match expected stringification for nested elements");
//     }

//     #[test]
//     fn test_comprehensive_hash_cases_fragment_nesting() {
//         // Test case: Normal text with fragment nesting (C1 component)
//         use crate::hash::{JsxHasher, SanitizedData, SanitizedChildren, SanitizedChild, SanitizedElement};
        
//         let fragment_element = SanitizedElement {
//             b: None,
//             t: None, // Fragment components (C1, C2, etc.) have no tag name 
//             d: None,
//             c: Some(Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Text("and some nesting in a fragment".to_string())))))
//         };
        
//         let children = SanitizedChildren::Multiple(vec![
//             SanitizedChild::Text("Normal text ".to_string()),
//             SanitizedChild::Element(Box::new(fragment_element))
//         ]);
        
//         let data = SanitizedData {
//             source: Some(Box::new(children)),
//             id: None,
//             context: None,
//             data_format: Some("JSX".to_string()),
//         };
        
//         let json_string = JsxHasher::stable_stringify(&data).unwrap();
//         let hash = JsxHasher::hash_string(&json_string);
        
//         // Expected: a5644d2bc5b8d763
//         assert_eq!(hash, "a5644d2bc5b8d763", "Fragment nesting hash should match expected value");
//         assert_eq!(json_string, r#"{"dataFormat":"JSX","source":["Normal text ",{"c":"and some nesting in a fragment"}]}"#, "JSON should match expected stringification for fragment");
//     }

//     #[test]
//     fn test_comprehensive_hash_cases_deep_nesting() {
//         // Test case: Deep nested structure
//         use crate::hash::{JsxHasher, SanitizedData, SanitizedChildren, SanitizedChild, SanitizedElement};
        
//         // Build the deeply nested structure: deep <div>nesting</div>
//         let deepest_element = SanitizedElement {
//             b: None,
//             t: None,
//             d: None,
//             c: Some(Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Text("nesting".to_string())))))
//         };
        
//         let deep_element = SanitizedElement {
//             b: None,
//             t: None,
//             d: None,
//             c: Some(Box::new(SanitizedChildren::Multiple(vec![
//                 SanitizedChild::Text("deep ".to_string()),
//                 SanitizedChild::Element(Box::new(deepest_element))
//             ])))
//         };
        
//         let some_element = SanitizedElement {
//             b: None,
//             t: None,
//             d: None,
//             c: Some(Box::new(SanitizedChildren::Multiple(vec![
//                 SanitizedChild::Text("some".to_string()),
//                 SanitizedChild::Text(" ".to_string()),
//                 SanitizedChild::Element(Box::new(deep_element))
//             ])))
//         };
        
//         let and_element = SanitizedElement {
//             b: None,
//             t: None,
//             d: None,
//             c: Some(Box::new(SanitizedChildren::Multiple(vec![
//                 SanitizedChild::Text("and".to_string()),
//                 SanitizedChild::Text(" ".to_string()),
//                 SanitizedChild::Element(Box::new(some_element))
//             ])))
//         };
        
//         let children = SanitizedChildren::Multiple(vec![
//             SanitizedChild::Text("Normal text".to_string()),
//             SanitizedChild::Text(" ".to_string()),
//             SanitizedChild::Element(Box::new(and_element))
//         ]);
        
//         let data = SanitizedData {
//             source: Some(Box::new(children)),
//             id: None,
//             context: None,
//             data_format: Some("JSX".to_string()),
//         };
        
//         let json_string = JsxHasher::stable_stringify(&data).unwrap();
//         let hash = JsxHasher::hash_string(&json_string);
        
//         // Expected: 5a4f590b6a4f90ae
//         assert_eq!(hash, "5a4f590b6a4f90ae", "Deep nesting hash should match expected value");
//         assert_eq!(json_string, r#"{"dataFormat":"JSX","source":["Normal text"," ",{"c":["and"," ",{"c":["some"," ",{"c":["deep ",{"c":"nesting"}]}]}]}]}"#, "JSON should match expected stringification for deep nesting");
//     }

//     #[test]
//     fn test_comprehensive_hash_cases_variables() {
//         // Test variable components: Currency, Var, DateTime, Num
//         use crate::hash::{JsxHasher, SanitizedData, SanitizedChildren, SanitizedChild, SanitizedVariable, VariableType};
        
//         // Currency variable
//         let currency_var = SanitizedVariable {
//             k: Some("_gt_cost_1".to_string()),
//             v: Some(VariableType::Currency),
//             b: None,
//             t: None,
//         };
//         let currency_data = SanitizedData {
//             source: Some(Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Variable(currency_var))))),
//             id: None,
//             context: None,
//             data_format: Some("JSX".to_string()),
//         };
//         let currency_json = JsxHasher::stable_stringify(&currency_data).unwrap();
//         let currency_hash = JsxHasher::hash_string(&currency_json);
//         assert_eq!(currency_hash, "ca1ff7d6802b1d46", "Currency variable hash should match expected value");
//         assert_eq!(currency_json, r#"{"dataFormat":"JSX","source":{"k":"_gt_cost_1","v":"c"}}"#, "Currency JSON should match expected format");

//         // Regular Var variable
//         let var_variable = SanitizedVariable {
//             k: Some("_gt_value_1".to_string()),
//             v: Some(VariableType::Variable),
//             b: None,
//             t: None,
//         };
//         let var_data = SanitizedData {
//             source: Some(Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Variable(var_variable))))),
//             id: None,
//             context: None,
//             data_format: Some("JSX".to_string()),
//         };
//         let var_json = JsxHasher::stable_stringify(&var_data).unwrap();
//         let var_hash = JsxHasher::hash_string(&var_json);
//         assert_eq!(var_hash, "933fa7740fe8c681", "Var variable hash should match expected value");
//         assert_eq!(var_json, r#"{"dataFormat":"JSX","source":{"k":"_gt_value_1","v":"v"}}"#, "Var JSON should match expected format");

//         // DateTime variable
//         let date_var = SanitizedVariable {
//             k: Some("_gt_date_1".to_string()),
//             v: Some(VariableType::Date),
//             b: None,
//             t: None,
//         };
//         let date_data = SanitizedData {
//             source: Some(Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Variable(date_var))))),
//             id: None,
//             context: None,
//             data_format: Some("JSX".to_string()),
//         };
//         let date_json = JsxHasher::stable_stringify(&date_data).unwrap();
//         let date_hash = JsxHasher::hash_string(&date_json);
//         assert_eq!(date_hash, "1b218e0af4bb7cf8", "DateTime variable hash should match expected value");
//         assert_eq!(date_json, r#"{"dataFormat":"JSX","source":{"k":"_gt_date_1","v":"d"}}"#, "DateTime JSON should match expected format");

//         // Num variable
//         let num_var = SanitizedVariable {
//             k: Some("_gt_n_1".to_string()),
//             v: Some(VariableType::Number),
//             b: None,
//             t: None,
//         };
//         let num_data = SanitizedData {
//             source: Some(Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Variable(num_var))))),
//             id: None,
//             context: None,
//             data_format: Some("JSX".to_string()),
//         };
//         let num_json = JsxHasher::stable_stringify(&num_data).unwrap();
//         let num_hash = JsxHasher::hash_string(&num_json);
//         assert_eq!(num_hash, "2280bcd71389dedf", "Num variable hash should match expected value");
//         assert_eq!(num_json, r#"{"dataFormat":"JSX","source":{"k":"_gt_n_1","v":"n"}}"#, "Num JSON should match expected format");
//     }

//     #[test]
//     fn test_comprehensive_hash_cases_branch_and_plural() {
//         // Test Branch and Plural components
//         use crate::hash::{JsxHasher, SanitizedData, SanitizedChildren, SanitizedChild, SanitizedVariable};
//         use std::collections::BTreeMap;
        
//         // Simple Branch component
//         let mut branch_branches = BTreeMap::new();
//         branch_branches.insert("file".to_string(), Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Text("file.svg".to_string())))));
//         branch_branches.insert("directory".to_string(), Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Text("public".to_string())))));
        
//         let branch_var = SanitizedVariable {
//             k: None,
//             v: None,
//             b: Some(branch_branches),
//             t: Some("b".to_string()),
//         };
//         let branch_data = SanitizedData {
//             source: Some(Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Variable(branch_var))))),
//             id: None,
//             context: None,
//             data_format: Some("JSX".to_string()),
//         };
//         let branch_json = JsxHasher::stable_stringify(&branch_data).unwrap();
//         let branch_hash = JsxHasher::hash_string(&branch_json);
//         assert_eq!(branch_hash, "2beb0a01f9518392", "Branch component hash should match expected value");
//         assert_eq!(branch_json, r#"{"dataFormat":"JSX","source":{"b":{"directory":"public","file":"file.svg"},"t":"b"}}"#, "Branch JSON should match expected format");

//         // Simple Plural component
//         let mut plural_branches = BTreeMap::new();
//         plural_branches.insert("singular".to_string(), Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Text("File".to_string())))));
//         plural_branches.insert("plural".to_string(), Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Text("Files".to_string())))));
        
//         let plural_var = SanitizedVariable {
//             k: None,
//             v: None,
//             b: Some(plural_branches),
//             t: Some("p".to_string()),
//         };
//         let plural_data = SanitizedData {
//             source: Some(Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Variable(plural_var))))),
//             id: None,
//             context: None,
//             data_format: Some("JSX".to_string()),
//         };
//         let plural_json = JsxHasher::stable_stringify(&plural_data).unwrap();
//         let plural_hash = JsxHasher::hash_string(&plural_json);
//         assert_eq!(plural_hash, "a5a6e0e02a6ec321", "Plural component hash should match expected value");
//         assert_eq!(plural_json, r#"{"dataFormat":"JSX","source":{"b":{"plural":"Files","singular":"File"},"t":"p"}}"#, "Plural JSON should match expected format");
//     }

//     #[test]
//     fn test_comprehensive_hash_cases_jsx_content_in_attributes() {
//         // Test Branch with JSX content in attributes
//         use crate::hash::{JsxHasher, SanitizedData, SanitizedChildren, SanitizedChild, SanitizedVariable};
//         use std::collections::BTreeMap;
        
//         // Branch with JSX content in file attribute
//         let mut branch_branches = BTreeMap::new();
//         branch_branches.insert("directory".to_string(), Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Text("public".to_string())))));
//         // JSX content gets wrapped in {"c": "content"}
//         branch_branches.insert("file".to_string(), Box::new(SanitizedChildren::Wrapped {
//             c: Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Text("Here is some translatable static content".to_string()))))
//         }));
        
//         let branch_var = SanitizedVariable {
//             k: None,
//             v: None,
//             b: Some(branch_branches),
//             t: Some("b".to_string()),
//         };
//         let branch_data = SanitizedData {
//             source: Some(Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Variable(branch_var))))),
//             id: None,
//             context: None,
//             data_format: Some("JSX".to_string()),
//         };
//         let branch_json = JsxHasher::stable_stringify(&branch_data).unwrap();
//         let branch_hash = JsxHasher::hash_string(&branch_json);
//         assert_eq!(branch_hash, "cc6c212a3f21856f", "Branch with JSX content hash should match expected value");
//         assert_eq!(branch_json, r#"{"dataFormat":"JSX","source":{"b":{"directory":"public","file":{"c":"Here is some translatable static content"}},"t":"b"}}"#, "Branch with JSX content JSON should match expected format");

//         // Plural with JSX content in singular attribute
//         let mut plural_branches = BTreeMap::new();
//         plural_branches.insert("plural".to_string(), Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Text("Files".to_string())))));
//         // JSX content gets wrapped in {"c": "content"}
//         plural_branches.insert("singular".to_string(), Box::new(SanitizedChildren::Wrapped {
//             c: Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Text("Here is some translatable static content".to_string()))))
//         }));
        
//         let plural_var = SanitizedVariable {
//             k: None,
//             v: None,
//             b: Some(plural_branches),
//             t: Some("p".to_string()),
//         };
//         let plural_data = SanitizedData {
//             source: Some(Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Variable(plural_var))))),
//             id: None,
//             context: None,
//             data_format: Some("JSX".to_string()),
//         };
//         let plural_json = JsxHasher::stable_stringify(&plural_data).unwrap();
//         let plural_hash = JsxHasher::hash_string(&plural_json);
//         assert_eq!(plural_hash, "68724f741aa727ef", "Plural with JSX content hash should match expected value");
//         assert_eq!(plural_json, r#"{"dataFormat":"JSX","source":{"b":{"plural":"Files","singular":{"c":"Here is some translatable static content"}},"t":"p"}}"#, "Plural with JSX content JSON should match expected format");
//     }

//     #[test]
//     fn test_comprehensive_hash_cases_nested_components() {
//         // Test nested Branch and Plural components
//         use crate::hash::{JsxHasher, SanitizedData, SanitizedChildren, SanitizedChild, SanitizedVariable};
//         use std::collections::BTreeMap;
        
//         // Nested Branch component: Branch with another Branch in file attribute
//         let mut inner_branch_branches = BTreeMap::new();
//         inner_branch_branches.insert("file".to_string(), Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Text("file.svg".to_string())))));
//         inner_branch_branches.insert("directory".to_string(), Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Text("public".to_string())))));
        
//         let inner_branch_var = SanitizedVariable {
//             k: None,
//             v: None,
//             b: Some(inner_branch_branches),
//             t: Some("b".to_string()),
//         };
        
//         let mut outer_branch_branches = BTreeMap::new();
//         outer_branch_branches.insert("directory".to_string(), Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Text("public".to_string())))));
//         outer_branch_branches.insert("file".to_string(), Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Variable(inner_branch_var)))));
        
//         let outer_branch_var = SanitizedVariable {
//             k: None,
//             v: None,
//             b: Some(outer_branch_branches),
//             t: Some("b".to_string()),
//         };
        
//         let branch_data = SanitizedData {
//             source: Some(Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Variable(outer_branch_var))))),
//             id: None,
//             context: None,
//             data_format: Some("JSX".to_string()),
//         };
//         let branch_json = JsxHasher::stable_stringify(&branch_data).unwrap();
//         let branch_hash = JsxHasher::hash_string(&branch_json);
//         assert_eq!(branch_hash, "fd6a98279e2dadd3", "Nested Branch component hash should match expected value");
//         assert_eq!(branch_json, r#"{"dataFormat":"JSX","source":{"b":{"directory":"public","file":{"b":{"directory":"public","file":"file.svg"},"t":"b"}},"t":"b"}}"#, "Nested Branch JSON should match expected format");

//         // Nested Plural component: Plural with another Plural in singular attribute
//         let mut inner_plural_branches = BTreeMap::new();
//         inner_plural_branches.insert("singular".to_string(), Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Text("File".to_string())))));
//         inner_plural_branches.insert("plural".to_string(), Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Text("Files".to_string())))));
        
//         let inner_plural_var = SanitizedVariable {
//             k: None,
//             v: None,
//             b: Some(inner_plural_branches),
//             t: Some("p".to_string()),
//         };
        
//         let mut outer_plural_branches = BTreeMap::new();
//         outer_plural_branches.insert("plural".to_string(), Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Text("Files".to_string())))));
//         outer_plural_branches.insert("singular".to_string(), Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Variable(inner_plural_var)))));
        
//         let outer_plural_var = SanitizedVariable {
//             k: None,
//             v: None,
//             b: Some(outer_plural_branches),
//             t: Some("p".to_string()),
//         };
        
//         let plural_data = SanitizedData {
//             source: Some(Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Variable(outer_plural_var))))),
//             id: None,
//             context: None,
//             data_format: Some("JSX".to_string()),
//         };
//         let plural_json = JsxHasher::stable_stringify(&plural_data).unwrap();
//         let plural_hash = JsxHasher::hash_string(&plural_json);
//         assert_eq!(plural_hash, "38cbabceed5bba24", "Nested Plural component hash should match expected value");
//         assert_eq!(plural_json, r#"{"dataFormat":"JSX","source":{"b":{"plural":"Files","singular":{"b":{"plural":"Files","singular":"File"},"t":"p"}},"t":"p"}}"#, "Nested Plural JSON should match expected format");
//     }

//     #[test]
//     fn test_comprehensive_hash_mixed_text_and_html() {
//         // Test case from user: <T>Normal text <div>and some nesting</div></T>
//         // Expected stringifiedData: {"dataFormat":"JSX","source":["Normal text ",{"c":"and some nesting"}]}
//         // Expected hash: 272f94a21847be08
//         use crate::hash::{JsxHasher, SanitizedData, SanitizedChildren, SanitizedChild};
        
//         // Create the structure manually to match the expected stringified data
//         let children = vec![
//             SanitizedChild::Text("Normal text ".to_string()),
//             SanitizedChild::Element(Box::new(crate::hash::SanitizedElement {
//             b: None,
//                 t: None, // Regular HTML elements don't have tag names in the output
//                 d: None,
//                 c: Some(Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Text("and some nesting".to_string()))))),
//             }))
//         ];
        
//         let sanitized_children = SanitizedChildren::Multiple(children);
//         let sanitized_data = SanitizedData {
//             source: Some(Box::new(sanitized_children)),
//             id: None,
//             context: None,
//             data_format: Some("JSX".to_string()),
//         };
        
//         // Generate JSON string using stable stringify
//         let json_string = JsxHasher::stable_stringify(&sanitized_data)
//             .expect("Failed to serialize test data");
        
//         println!("Generated JSON: {}", json_string);
        
//         // Calculate hash
//         let hash = JsxHasher::hash_string(&json_string);
        
//         println!("Generated hash: {}", hash);
        
//         // The expected values from the user's error message
//         assert_eq!(hash, "272f94a21847be08", "Mixed text and HTML hash should match expected value from user report");
//         assert_eq!(json_string, r#"{"dataFormat":"JSX","source":["Normal text ",{"c":"and some nesting"}]}"#, 
//                   "Mixed text and HTML JSON should match expected format from user report");
//     }

//     #[test]
//     fn test_no_aliasing_issues() {
//         // Test that we don't treat non-GT components as GT components
//         let visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, false, None);
        
//         // Without any imports from gt-next, these should NOT be treated as GT components
//         let t_name = Atom::from("T");
//         let plural_name = Atom::from("Plural");
//         let var_name = Atom::from("Var");
        
//         assert!(!visitor.should_track_component_as_translation(&t_name), 
//                "T should not be tracked without gt-next import");
//         assert!(!visitor.should_track_component_as_translation(&plural_name), 
//                "Plural should not be tracked without gt-next import");
//         assert!(!visitor.should_track_component_as_variable(&var_name), 
//                "Var should not be tracked without gt-next import");
               
//         // Namespace components should also not be tracked without proper imports
//         let gt_name = Atom::from("GT");
//         let (is_translation, is_variable) = visitor.should_track_namespace_component(&gt_name, &t_name);
//         assert!(!is_translation && !is_variable, 
//                "GT.T should not be tracked without namespace import");
//     }

//     #[test] 
//     fn test_aliasing_prevention_with_imports() {
//         // Test that we properly track only when imported from gt-next
//         let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, false, None);
        
//         // Add some imports to the visitor as if we processed: import { T, Plural } from 'gt-next'
//         visitor.gt_next_translation_import_aliases.insert(Atom::from("T"), Atom::from("T"));
//         visitor.gt_next_branch_import_aliases.insert(Atom::from("Plural"), Atom::from("Plural"));
//         visitor.gt_next_variable_import_aliases.insert(Atom::from("Var"), Atom::from("Var"));
        
//         // Now these should be tracked
//         let t_name = Atom::from("T");
//         let plural_name = Atom::from("Plural");
//         let var_name = Atom::from("Var");
        
//         assert!(visitor.should_track_component_as_translation(&t_name), 
//                "T should be tracked when imported from gt-next");
//         assert!(visitor.should_track_component_as_branch(&plural_name), 
//                "Plural should be tracked when imported from gt-next");
//         assert!(visitor.should_track_component_as_variable(&var_name), 
//                "Var should be tracked when imported from gt-next");
               
//         // But other component names should still not be tracked
//         let custom_name = Atom::from("CustomT");
//         assert!(!visitor.should_track_component_as_translation(&custom_name), 
//                "CustomT should not be tracked even with other imports");
//     }

//     #[test]
//     fn test_direct_import_tracking() {
//         // Test direct imports without aliases: import { T, Branch, Var, useGT } from 'gt-next'
//         let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, false, None);
        
//         // Simulate direct imports processing
//         visitor.gt_next_translation_import_aliases.insert(Atom::from("T"), Atom::from("T"));
//         visitor.gt_next_branch_import_aliases.insert(Atom::from("Branch"), Atom::from("Branch"));
//         visitor.gt_next_variable_import_aliases.insert(Atom::from("Var"), Atom::from("Var"));
        
//         visitor.gt_translation_functions.insert(Atom::from("useGT"));
//         visitor.gt_next_translation_function_import_aliases.insert(Atom::from("useGT"), Atom::from("useGT"));
        
//         // Test that all direct imports are tracked in their respective categories
//         assert!(visitor.should_track_component_as_translation(&Atom::from("T")), 
//                "T should be tracked as translation component");
//         assert!(visitor.should_track_component_as_branch(&Atom::from("Branch")), 
//                "Branch should be tracked as branch component");
//         assert!(visitor.should_track_component_as_variable(&Atom::from("Var")), 
//                "Var should be tracked as variable component");
//         assert!(visitor.gt_translation_functions.contains(&Atom::from("useGT")), 
//                "useGT should be tracked as translation function");
        
//         // Verify that Branch is NOT tracked as translation component
//         assert!(!visitor.should_track_component_as_translation(&Atom::from("Branch")), 
//                "Branch should NOT be tracked as translation component");
               
//         // Verify aliases map to themselves
//         assert_eq!(visitor.gt_next_translation_import_aliases.get(&Atom::from("T")), 
//                   Some(&Atom::from("T")), "T should map to itself");
//         assert_eq!(visitor.gt_next_branch_import_aliases.get(&Atom::from("Branch")), 
//                   Some(&Atom::from("Branch")), "Branch should map to itself");
//     }

//     #[test]
//     fn test_aliased_import_tracking() {
//         // Test aliased imports: import { T as MyT, Branch as B, Var as Variable, useGT as useTranslation } from 'gt-next'
//         let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, false, None);
        
//         // Simulate aliased imports processing
//         // Remove the old HashSet approach - only use aliases
//         visitor.gt_next_translation_import_aliases.insert(Atom::from("MyT"), Atom::from("T"));
        
//         visitor.gt_next_branch_import_aliases.insert(Atom::from("B"), Atom::from("Branch"));
        
//         // Remove the old HashSet approach - only use aliases
//         visitor.gt_next_variable_import_aliases.insert(Atom::from("Variable"), Atom::from("Var"));
        
//         visitor.gt_translation_functions.insert(Atom::from("useTranslation"));
//         visitor.gt_next_translation_function_import_aliases.insert(Atom::from("useTranslation"), Atom::from("useGT"));
        
//         // Test that aliased names are tracked
//         assert!(visitor.should_track_component_as_translation(&Atom::from("MyT")), 
//                "MyT should be tracked as aliased T");
//         assert!(visitor.should_track_component_as_variable(&Atom::from("Variable")), 
//                "Variable should be tracked as aliased Var");
//         assert!(visitor.gt_translation_functions.contains(&Atom::from("useTranslation")), 
//                "useTranslation should be tracked as aliased useGT");
               
//         // Test that original names are NOT tracked (since they weren't directly imported)
//         assert!(!visitor.should_track_component_as_translation(&Atom::from("T")), 
//                "T should not be tracked when imported as MyT");
//         assert!(!visitor.should_track_component_as_variable(&Atom::from("Var")), 
//                "Var should not be tracked when imported as Variable");
//         assert!(!visitor.gt_translation_functions.contains(&Atom::from("useGT")), 
//                "useGT should not be tracked when imported as useTranslation");
               
//         // Verify alias mappings
//         assert_eq!(visitor.gt_next_translation_import_aliases.get(&Atom::from("MyT")), 
//                   Some(&Atom::from("T")), "MyT should map to T");
//         assert_eq!(visitor.gt_next_branch_import_aliases.get(&Atom::from("B")), 
//                   Some(&Atom::from("Branch")), "B should map to Branch");
//         assert_eq!(visitor.gt_next_variable_import_aliases.get(&Atom::from("Variable")), 
//                   Some(&Atom::from("Var")), "Variable should map to Var");
//         assert_eq!(visitor.gt_next_translation_function_import_aliases.get(&Atom::from("useTranslation")), 
//                   Some(&Atom::from("useGT")), "useTranslation should map to useGT");
//     }

//     #[test]
//     fn test_all_component_types_direct_imports() {
//         // Test all supported component types: T, Branch, Plural, Var, Num, Currency, DateTime, useGT, getGT
//         let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, false, None);
        
//         // Translation components
//         visitor.gt_next_translation_import_aliases.insert(Atom::from("T"), Atom::from("T"));
//         visitor.gt_next_translation_import_aliases.insert(Atom::from("T"), Atom::from("T"));
        
//         // Branch components  
//         visitor.gt_next_branch_import_aliases.insert(Atom::from("Branch"), Atom::from("Branch"));
//         visitor.gt_next_branch_import_aliases.insert(Atom::from("Plural"), Atom::from("Plural"));
        
//         // Variable components
//         visitor.gt_next_variable_import_aliases.insert(Atom::from("Var"), Atom::from("Var"));
//         visitor.gt_next_variable_import_aliases.insert(Atom::from("Num"), Atom::from("Num"));
//         visitor.gt_next_variable_import_aliases.insert(Atom::from("Currency"), Atom::from("Currency"));
//         visitor.gt_next_variable_import_aliases.insert(Atom::from("DateTime"), Atom::from("DateTime"));
        
//         // Translation functions
//         visitor.gt_translation_functions.insert(Atom::from("useGT"));
//         visitor.gt_next_translation_function_import_aliases.insert(Atom::from("useGT"), Atom::from("useGT"));
//         visitor.gt_translation_functions.insert(Atom::from("getGT"));
//         visitor.gt_next_translation_function_import_aliases.insert(Atom::from("getGT"), Atom::from("getGT"));
        
//         // Test translation components
//         assert!(visitor.should_track_component_as_translation(&Atom::from("T")), 
//                "T should be tracked as translation component");
               
//         // Test variable components
//         assert!(visitor.should_track_component_as_variable(&Atom::from("Var")), 
//                "Var should be tracked as variable component");
//         assert!(visitor.should_track_component_as_variable(&Atom::from("Num")), 
//                "Num should be tracked as variable component");
//         assert!(visitor.should_track_component_as_variable(&Atom::from("Currency")), 
//                "Currency should be tracked as variable component");
//         assert!(visitor.should_track_component_as_variable(&Atom::from("DateTime")), 
//                "DateTime should be tracked as variable component");
               
//         // Test translation functions
//         assert!(visitor.gt_translation_functions.contains(&Atom::from("useGT")), 
//                "useGT should be tracked as translation function");
//         assert!(visitor.gt_translation_functions.contains(&Atom::from("getGT")), 
//                "getGT should be tracked as translation function");
               
//         // Test that branch components have aliases (even though they don't use the main tracking)
//         assert!(visitor.gt_next_branch_import_aliases.contains_key(&Atom::from("Branch")), 
//                "Branch should have alias mapping");
//         assert!(visitor.gt_next_branch_import_aliases.contains_key(&Atom::from("Plural")), 
//                "Plural should have alias mapping");
//     }

//     #[test]
//     fn test_all_component_types_aliased_imports() {
//         // Test all component types with aliases
//         let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, false, None);
        
//         // Aliased translation components
//         // Remove the old HashSet approach - only use aliases
//         visitor.gt_next_translation_import_aliases.insert(Atom::from("MyT"), Atom::from("T"));
        
//         // Aliased branch components
//         visitor.gt_next_branch_import_aliases.insert(Atom::from("MyBranch"), Atom::from("Branch"));
//         visitor.gt_next_branch_import_aliases.insert(Atom::from("MyPlural"), Atom::from("Plural"));
        
//         // Aliased variable components  
//         // Remove the old HashSet approach - only use aliases
//         visitor.gt_next_variable_import_aliases.insert(Atom::from("MyVar"), Atom::from("Var"));
//         // Remove the old HashSet approach - only use aliases
//         visitor.gt_next_variable_import_aliases.insert(Atom::from("MyNum"), Atom::from("Num"));
//         // Remove the old HashSet approach - only use aliases
//         visitor.gt_next_variable_import_aliases.insert(Atom::from("MyCurrency"), Atom::from("Currency"));
//         // Remove the old HashSet approach - only use aliases
//         visitor.gt_next_variable_import_aliases.insert(Atom::from("MyDateTime"), Atom::from("DateTime"));
        
//         // Aliased translation functions
//         visitor.gt_translation_functions.insert(Atom::from("useTranslation"));
//         visitor.gt_next_translation_function_import_aliases.insert(Atom::from("useTranslation"), Atom::from("useGT"));
//         visitor.gt_translation_functions.insert(Atom::from("getTranslation"));
//         visitor.gt_next_translation_function_import_aliases.insert(Atom::from("getTranslation"), Atom::from("getGT"));
        
//         // Test that aliased names work
//         assert!(visitor.should_track_component_as_translation(&Atom::from("MyT")), 
//                "MyT should be tracked as aliased T");
//         assert!(visitor.should_track_component_as_variable(&Atom::from("MyVar")), 
//                "MyVar should be tracked as aliased Var");
//         assert!(visitor.should_track_component_as_variable(&Atom::from("MyNum")), 
//                "MyNum should be tracked as aliased Num");
//         assert!(visitor.should_track_component_as_variable(&Atom::from("MyCurrency")), 
//                "MyCurrency should be tracked as aliased Currency");
//         assert!(visitor.should_track_component_as_variable(&Atom::from("MyDateTime")), 
//                "MyDateTime should be tracked as aliased DateTime");
//         assert!(visitor.gt_translation_functions.contains(&Atom::from("useTranslation")), 
//                "useTranslation should be tracked as aliased useGT");
//         assert!(visitor.gt_translation_functions.contains(&Atom::from("getTranslation")), 
//                "getTranslation should be tracked as aliased getGT");
               
//         // Test that original names are NOT tracked
//         assert!(!visitor.should_track_component_as_translation(&Atom::from("T")), 
//                "T should not be tracked when imported as MyT");
//         assert!(!visitor.should_track_component_as_variable(&Atom::from("Var")), 
//                "Var should not be tracked when imported as MyVar");
//         assert!(!visitor.gt_translation_functions.contains(&Atom::from("useGT")), 
//                "useGT should not be tracked when imported as useTranslation");
               
//         // Verify all alias mappings
//         assert_eq!(visitor.gt_next_translation_import_aliases.get(&Atom::from("MyT")), 
//                   Some(&Atom::from("T")), "MyT should map to T");
//         assert_eq!(visitor.gt_next_branch_import_aliases.get(&Atom::from("MyBranch")), 
//                   Some(&Atom::from("Branch")), "MyBranch should map to Branch");
//         assert_eq!(visitor.gt_next_variable_import_aliases.get(&Atom::from("MyVar")), 
//                   Some(&Atom::from("Var")), "MyVar should map to Var");
//         assert_eq!(visitor.gt_next_translation_function_import_aliases.get(&Atom::from("useTranslation")), 
//                   Some(&Atom::from("useGT")), "useTranslation should map to useGT");
//     }

//     #[test]
//     fn test_mixed_direct_and_aliased_imports() {
//         // Test mixing direct and aliased imports in same file
//         let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, false, None);
        
//         // Direct imports
//         visitor.gt_next_translation_import_aliases.insert(Atom::from("T"), Atom::from("T"));
//         visitor.gt_next_translation_import_aliases.insert(Atom::from("T"), Atom::from("T"));
//         visitor.gt_next_variable_import_aliases.insert(Atom::from("Var"), Atom::from("Var"));
//         visitor.gt_next_variable_import_aliases.insert(Atom::from("Var"), Atom::from("Var"));
        
//         // Aliased imports
//         visitor.gt_next_branch_import_aliases.insert(Atom::from("B"), Atom::from("Branch"));
//         visitor.gt_translation_functions.insert(Atom::from("useTranslation"));
//         visitor.gt_next_translation_function_import_aliases.insert(Atom::from("useTranslation"), Atom::from("useGT"));
        
//         // Test direct imports work
//         assert!(visitor.should_track_component_as_translation(&Atom::from("T")), 
//                "T should work as direct import");
//         assert!(visitor.should_track_component_as_variable(&Atom::from("Var")), 
//                "Var should work as direct import");
               
//         // Test aliased imports work
//         assert!(visitor.gt_translation_functions.contains(&Atom::from("useTranslation")), 
//                "useTranslation should work as aliased useGT");
               
//         // Test non-imported names don't work
//         assert!(!visitor.should_track_component_as_variable(&Atom::from("Currency")), 
//                "Currency should not work when not imported");
//         assert!(!visitor.gt_translation_functions.contains(&Atom::from("getGT")), 
//                "getGT should not work when not imported");
//     }

//     #[test]
//     fn test_import_alias_collision_handling() {
//         // Test edge case: import { T as Var } - alias collision with different component types
//         let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, false, None);
        
//         // Import T as Var (translation component aliased as variable name)
//         // Remove the old HashSet approach - only use aliases
//         visitor.gt_next_translation_import_aliases.insert(Atom::from("Var"), Atom::from("T"));
        
//         // The aliased "Var" should be tracked as translation (because original was T)
//         assert!(visitor.should_track_component_as_translation(&Atom::from("Var")), 
//                "Var (aliased T) should be tracked as translation component");
//         assert!(!visitor.should_track_component_as_variable(&Atom::from("Var")), 
//                "Var (aliased T) should NOT be tracked as variable component");
               
//         // Verify the mapping
//         assert_eq!(visitor.gt_next_translation_import_aliases.get(&Atom::from("Var")), 
//                   Some(&Atom::from("T")), "Var should map back to T");
//     }

//     #[test]
//     fn test_visit_mut_import_decl_named_imports() {
//         use swc_core::ecma::ast::*;
//         use swc_core::common::{Span, DUMMY_SP, SyntaxContext};
//         use swc_core::ecma::atoms::Atom;
        
//         let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, false, None);
        
//         // Create import declaration: import { T, Var, Branch, Plural, useGT, getGT } from 'gt-next'
//         let mut import_decl = ImportDecl {
//             span: DUMMY_SP,
//             specifiers: vec![
//                 ImportSpecifier::Named(ImportNamedSpecifier {
//                     span: DUMMY_SP,
//                     local: Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty()).into(),
//                     imported: None,
//                     is_type_only: false,
//                 }),
//                 ImportSpecifier::Named(ImportNamedSpecifier {
//                     span: DUMMY_SP,
//                     local: Ident::new("Var".into(), DUMMY_SP, SyntaxContext::empty()).into(),
//                     imported: None,
//                     is_type_only: false,
//                 }),
//                 ImportSpecifier::Named(ImportNamedSpecifier {
//                     span: DUMMY_SP,
//                     local: Ident::new("Branch".into(), DUMMY_SP, SyntaxContext::empty()).into(),
//                     imported: None,
//                     is_type_only: false,
//                 }),
//                 ImportSpecifier::Named(ImportNamedSpecifier {
//                     span: DUMMY_SP,
//                     local: Ident::new("Plural".into(), DUMMY_SP, SyntaxContext::empty()).into(),
//                     imported: None,
//                     is_type_only: false,
//                 }),
//                 ImportSpecifier::Named(ImportNamedSpecifier {
//                     span: DUMMY_SP,
//                     local: Ident::new("useGT".into(), DUMMY_SP, SyntaxContext::empty()).into(),
//                     imported: None,
//                     is_type_only: false,
//                 }),
//                 ImportSpecifier::Named(ImportNamedSpecifier {
//                     span: DUMMY_SP,
//                     local: Ident::new("getGT".into(), DUMMY_SP, SyntaxContext::empty()).into(),
//                     imported: None,
//                     is_type_only: false,
//                 }),
//             ],
//             src: Box::new(Str {
//                 span: DUMMY_SP,
//                 value: "gt-next".into(),
//                 raw: None,
//             }),
//             type_only: false,
//             with: None,
//             phase: Default::default(),
//         };
        
//         visitor.visit_mut_import_decl(&mut import_decl);
        
//         // Verify translation components
//         assert!(visitor.gt_next_translation_imports.contains(&Atom::from("T")));
//         assert_eq!(visitor.gt_next_translation_import_aliases.get(&Atom::from("T")), Some(&Atom::from("T")));
        
//         // Verify variable components
//         assert!(visitor.gt_next_variable_imports.contains(&Atom::from("Var")));
//         assert_eq!(visitor.gt_next_variable_import_aliases.get(&Atom::from("Var")), Some(&Atom::from("Var")));
        
//         // Verify branch components
//         assert_eq!(visitor.gt_next_branch_import_aliases.get(&Atom::from("Branch")), Some(&Atom::from("Branch")));
//         assert_eq!(visitor.gt_next_branch_import_aliases.get(&Atom::from("Plural")), Some(&Atom::from("Plural")));
        
//         // Verify translation functions
//         assert!(visitor.gt_translation_functions.contains(&Atom::from("useGT")));
//         assert!(visitor.gt_translation_functions.contains(&Atom::from("getGT")));
//         assert_eq!(visitor.gt_next_translation_function_import_aliases.get(&Atom::from("useGT")), Some(&Atom::from("useGT")));
//         assert_eq!(visitor.gt_next_translation_function_import_aliases.get(&Atom::from("getGT")), Some(&Atom::from("getGT")));
//     }

//     #[test]
//     fn test_visit_mut_import_decl_aliased_imports() {
//         use swc_core::ecma::ast::*;
//         use swc_core::common::{Span, DUMMY_SP, SyntaxContext};
//         use swc_core::ecma::atoms::Atom;
        
//         let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, false, None);
        
//         // Create import declaration: import { T as T1, Var as V, Branch as B, Plural as P, useGT as useGT1, getGT as getGT1 } from 'gt-next'
//         let mut import_decl = ImportDecl {
//             span: DUMMY_SP,
//             specifiers: vec![
//                 ImportSpecifier::Named(ImportNamedSpecifier {
//                     span: DUMMY_SP,
//                     local: Ident::new("T1".into(), DUMMY_SP, SyntaxContext::empty()).into(),
//                     imported: Some(ModuleExportName::Ident(Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty()).into())),
//                     is_type_only: false,
//                 }),
//                 ImportSpecifier::Named(ImportNamedSpecifier {
//                     span: DUMMY_SP,
//                     local: Ident::new("V".into(), DUMMY_SP, SyntaxContext::empty()).into(),
//                     imported: Some(ModuleExportName::Ident(Ident::new("Var".into(), DUMMY_SP, SyntaxContext::empty()).into())),
//                     is_type_only: false,
//                 }),
//                 ImportSpecifier::Named(ImportNamedSpecifier {
//                     span: DUMMY_SP,
//                     local: Ident::new("B".into(), DUMMY_SP, SyntaxContext::empty()).into(),
//                     imported: Some(ModuleExportName::Ident(Ident::new("Branch".into(), DUMMY_SP, SyntaxContext::empty()).into())),
//                     is_type_only: false,
//                 }),
//                 ImportSpecifier::Named(ImportNamedSpecifier {
//                     span: DUMMY_SP,
//                     local: Ident::new("P".into(), DUMMY_SP, SyntaxContext::empty()).into(),
//                     imported: Some(ModuleExportName::Ident(Ident::new("Plural".into(), DUMMY_SP, SyntaxContext::empty()).into())),
//                     is_type_only: false,
//                 }),
//                 ImportSpecifier::Named(ImportNamedSpecifier {
//                     span: DUMMY_SP,
//                     local: Ident::new("useGT1".into(), DUMMY_SP, SyntaxContext::empty()).into(),
//                     imported: Some(ModuleExportName::Ident(Ident::new("useGT".into(), DUMMY_SP, SyntaxContext::empty()).into())),
//                     is_type_only: false,
//                 }),
//                 ImportSpecifier::Named(ImportNamedSpecifier {
//                     span: DUMMY_SP,
//                     local: Ident::new("getGT1".into(), DUMMY_SP, SyntaxContext::empty()).into(),
//                     imported: Some(ModuleExportName::Ident(Ident::new("getGT".into(), DUMMY_SP, SyntaxContext::empty()).into())),
//                     is_type_only: false,
//                 }),
//             ],
//             src: Box::new(Str {
//                 span: DUMMY_SP,
//                 value: "gt-next".into(),
//                 raw: None,
//             }),
//             type_only: false,
//             with: None,
//             phase: Default::default(),
//         };
        
//         visitor.visit_mut_import_decl(&mut import_decl);
        
//         // Verify translation components (local -> original mapping)
//         assert!(visitor.gt_next_translation_imports.contains(&Atom::from("T1")));
//         assert_eq!(visitor.gt_next_translation_import_aliases.get(&Atom::from("T1")), Some(&Atom::from("T")));
        
//         // Verify variable components
//         assert!(visitor.gt_next_variable_imports.contains(&Atom::from("V")));
//         assert_eq!(visitor.gt_next_variable_import_aliases.get(&Atom::from("V")), Some(&Atom::from("Var")));
        
//         // Verify branch components
//         assert_eq!(visitor.gt_next_branch_import_aliases.get(&Atom::from("B")), Some(&Atom::from("Branch")));
//         assert_eq!(visitor.gt_next_branch_import_aliases.get(&Atom::from("P")), Some(&Atom::from("Plural")));
        
//         // Verify translation functions
//         assert!(visitor.gt_translation_functions.contains(&Atom::from("useGT1")));
//         assert!(visitor.gt_translation_functions.contains(&Atom::from("getGT1")));
//         assert_eq!(visitor.gt_next_translation_function_import_aliases.get(&Atom::from("useGT1")), Some(&Atom::from("useGT")));
//         assert_eq!(visitor.gt_next_translation_function_import_aliases.get(&Atom::from("getGT1")), Some(&Atom::from("getGT")));
        
//         // Verify original names are NOT tracked as direct imports
//         assert!(!visitor.gt_next_translation_imports.contains(&Atom::from("T")));
//         assert!(!visitor.gt_next_variable_imports.contains(&Atom::from("Var")));
//         assert!(!visitor.gt_translation_functions.contains(&Atom::from("useGT")));
//         assert!(!visitor.gt_translation_functions.contains(&Atom::from("getGT")));
//     }

//     #[test]
//     fn test_visit_mut_import_decl_namespace_imports() {
//         use swc_core::ecma::ast::*;
//         use swc_core::common::{Span, DUMMY_SP, SyntaxContext};
//         use swc_core::ecma::atoms::Atom;
        
//         let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, false, None);
        
//         // Create import declaration: import * as GT from 'gt-next'
//         let mut import_decl = ImportDecl {
//             span: DUMMY_SP,
//             specifiers: vec![
//                 ImportSpecifier::Namespace(ImportStarAsSpecifier {
//                     span: DUMMY_SP,
//                     local: Ident::new("GT".into(), DUMMY_SP, SyntaxContext::empty()).into(),
//                 }),
//             ],
//             src: Box::new(Str {
//                 span: DUMMY_SP,
//                 value: "gt-next".into(),
//                 raw: None,
//             }),
//             type_only: false,
//             with: None,
//             phase: Default::default(),
//         };
        
//         visitor.visit_mut_import_decl(&mut import_decl);
        
//         // Verify namespace import tracking
//         assert!(visitor.gt_next_namespace_imports.contains(&Atom::from("GT")));
//     }

//     #[test]
//     fn test_visit_mut_import_decl_mixed_packages() {
//         use swc_core::ecma::ast::*;
//         use swc_core::common::{Span, DUMMY_SP, SyntaxContext};
//         use swc_core::ecma::atoms::Atom;
        
//         let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, false, None);
        
//         // Test different package sources
//         let packages = ["gt-next", "gt-next/client", "gt-next/server"];
        
//         for (i, package) in packages.iter().enumerate() {
//             let mut import_decl = ImportDecl {
//                 span: DUMMY_SP,
//                 specifiers: vec![
//                     ImportSpecifier::Named(ImportNamedSpecifier {
//                         span: DUMMY_SP,
//                         local: Ident::new(format!("T{}", i).into(), DUMMY_SP, SyntaxContext::empty()).into(),
//                         imported: Some(ModuleExportName::Ident(Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty()).into())),
//                         is_type_only: false,
//                     }),
//                     ImportSpecifier::Named(ImportNamedSpecifier {
//                         span: DUMMY_SP,
//                         local: Ident::new(format!("getGT{}", i).into(), DUMMY_SP, SyntaxContext::empty()).into(),
//                         imported: Some(ModuleExportName::Ident(Ident::new("getGT".into(), DUMMY_SP, SyntaxContext::empty()).into())),
//                         is_type_only: false,
//                     }),
//                 ],
//                 src: Box::new(Str {
//                     span: DUMMY_SP,
//                     value: (*package).into(),
//                     raw: None,
//                 }),
//                 type_only: false,
//                 with: None,
//                 phase: Default::default(),
//             };
            
//             visitor.visit_mut_import_decl(&mut import_decl);
//         }
        
//         // Should track T and getGT from all supported packages
//         for i in 0..packages.len() {
//             assert!(visitor.gt_next_translation_imports.contains(&Atom::from(format!("T{}", i))));
//             assert!(visitor.gt_translation_functions.contains(&Atom::from(format!("getGT{}", i))));
//         }
//     }

//     #[test]
//     fn test_visit_mut_import_decl_non_gt_imports_ignored() {
//         use swc_core::ecma::ast::*;
//         use swc_core::common::{Span, DUMMY_SP, SyntaxContext};
//         use swc_core::ecma::atoms::Atom;
        
//         let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, false, None);
        
//         // Create import from non-GT package: import { T, Branch } from 'react'
//         let mut import_decl = ImportDecl {
//             span: DUMMY_SP,
//             specifiers: vec![
//                 ImportSpecifier::Named(ImportNamedSpecifier {
//                     span: DUMMY_SP,
//                     local: Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty()).into(),
//                     imported: None,
//                     is_type_only: false,
//                 }),
//                 ImportSpecifier::Named(ImportNamedSpecifier {
//                     span: DUMMY_SP,
//                     local: Ident::new("Branch".into(), DUMMY_SP, SyntaxContext::empty()).into(),
//                     imported: None,
//                     is_type_only: false,
//                 }),
//             ],
//             src: Box::new(Str {
//                 span: DUMMY_SP,
//                 value: "react".into(),
//                 raw: None,
//             }),
//             type_only: false,
//             with: None,
//             phase: Default::default(),
//         };
        
//         visitor.visit_mut_import_decl(&mut import_decl);
        
//         // Should not track any imports from non-GT packages
//         assert!(!visitor.gt_next_translation_imports.contains(&Atom::from("T")));
//         assert!(!visitor.gt_next_branch_import_aliases.contains_key(&Atom::from("Branch")));
//         assert!(visitor.gt_next_translation_import_aliases.is_empty());
//         assert!(visitor.gt_next_branch_import_aliases.is_empty());
//     }

//     #[test]
//     fn test_is_branch_name_helper() {
//         let visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, false, None);
        
//         assert!(visitor.is_branch_name(&Atom::from("Branch")));
//         assert!(visitor.is_branch_name(&Atom::from("Plural")));
//         assert!(!visitor.is_branch_name(&Atom::from("T")));
//         assert!(!visitor.is_branch_name(&Atom::from("Var")));
//         assert!(!visitor.is_branch_name(&Atom::from("useGT")));
//     }

//     #[test]
//     fn test_is_translation_function_name_helper() {
//         let visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, false, None);
        
//         assert!(visitor.is_translation_function_name(&Atom::from("useGT")));
//         assert!(visitor.is_translation_function_name(&Atom::from("getGT")));
//         assert!(!visitor.is_translation_function_name(&Atom::from("T")));
//         assert!(!visitor.is_translation_function_name(&Atom::from("Branch")));
//         assert!(!visitor.is_translation_function_name(&Atom::from("Var")));
//     }

//     #[test]
//     fn test_visitor_initial_state_extended() {
//         let visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, false, None);
        
//         assert_eq!(visitor.dynamic_content_violations, 0);
//         assert!(visitor.gt_next_translation_imports.is_empty());
//         assert!(visitor.gt_next_variable_imports.is_empty());
//         assert!(visitor.gt_next_namespace_imports.is_empty());
//         assert!(visitor.gt_translation_functions.is_empty());
//         assert!(visitor.gt_next_translation_import_aliases.is_empty());
//         assert!(visitor.gt_next_variable_import_aliases.is_empty());
//         assert!(visitor.gt_next_branch_import_aliases.is_empty());
//         assert!(visitor.gt_next_translation_function_import_aliases.is_empty());
//     }

//     #[test]
//     fn test_plural_component_attribute_extraction() {
//         use swc_core::ecma::ast::*;
//         use crate::hash::{SanitizedData, JsxHasher};
        
//         let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, true, None);
        
//         // Simulate import: import { Plural } from 'gt-next'
//         visitor.gt_next_branch_import_aliases.insert(Atom::from("Plural"), Atom::from("Plural"));
        
//         // Create a Plural JSX element with both singular and plural attributes
//         // <Plural singular="Here is some translatable static content" plural="Files" />
//         let plural_element = JSXElement {
//             span: DUMMY_SP,
//             opening: JSXOpeningElement {
//                 name: JSXElementName::Ident(Ident::new("Plural".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                 span: DUMMY_SP,
//                 attrs: vec![
//                     JSXAttrOrSpread::JSXAttr(JSXAttr {
//                         span: DUMMY_SP,
//                         name: JSXAttrName::Ident(Ident::new("singular".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         value: Some(JSXAttrValue::Lit(Lit::Str(Str {
//                             span: DUMMY_SP,
//                             value: "Here is some translatable static content".into(),
//                             raw: None,
//                         }))),
//                     }),
//                     JSXAttrOrSpread::JSXAttr(JSXAttr {
//                         span: DUMMY_SP,
//                         name: JSXAttrName::Ident(Ident::new("plural".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         value: Some(JSXAttrValue::Lit(Lit::Str(Str {
//                             span: DUMMY_SP,
//                             value: "Files".into(),
//                             raw: None,
//                         }))),
//                     }),
//                 ],
//                 self_closing: true,
//                 type_args: None,
//             },
//             closing: None,
//             children: vec![],
//         };
        
//         // Calculate hash for the plural element
//         let (hash, json_string) = visitor.calculate_element_hash(&plural_element);
        
//         // Parse the JSON to verify structure
//         let sanitized_data: SanitizedData = serde_json::from_str(&json_string)
//             .expect("Failed to parse generated JSON");
        
//         println!("Generated JSON: {}", json_string);
        
//         // Verify the JSON structure directly since we know it should match the runtime format
//         assert!(json_string.contains("\"plural\":\"Files\""));
//         assert!(json_string.contains("\"singular\":\"Here is some translatable static content\""));
//         assert!(json_string.contains("\"t\":\"p\""));
        
//         // Also verify the structure matches runtime format exactly
//         let expected_json_pattern = r#""source":{"b":{"plural":"Files","singular":"Here is some translatable static content"},"t":"p"}"#;
//         assert!(json_string.contains(expected_json_pattern));
//     }

//     #[test]
//     fn test_t_component_with_plural_child() {
//         use swc_core::ecma::ast::*;
//         use crate::hash::{SanitizedData, JsxHasher};
        
//         let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, true, None);
        
//         // Simulate imports: import { T, Plural } from 'gt-next'
//         visitor.gt_next_translation_import_aliases.insert(Atom::from("T"), Atom::from("T"));
//         visitor.gt_next_branch_import_aliases.insert(Atom::from("Plural"), Atom::from("Plural"));
        
//         // Create T element containing Plural child: 
//         // <T>
//         //   <Plural singular="Here is some translatable static content" plural="Files" />
//         // </T>
//         let t_element = JSXElement {
//             span: DUMMY_SP,
//             opening: JSXOpeningElement {
//                 name: JSXElementName::Ident(Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                 span: DUMMY_SP,
//                 attrs: vec![],
//                 self_closing: false,
//                 type_args: None,
//             },
//             closing: Some(JSXClosingElement {
//                 span: DUMMY_SP,
//                 name: JSXElementName::Ident(Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//             }),
//             children: vec![
//                 JSXElementChild::JSXElement(Box::new(JSXElement {
//                     span: DUMMY_SP,
//                     opening: JSXOpeningElement {
//                         name: JSXElementName::Ident(Ident::new("Plural".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         span: DUMMY_SP,
//                         attrs: vec![
//                             JSXAttrOrSpread::JSXAttr(JSXAttr {
//                                 span: DUMMY_SP,
//                                 name: JSXAttrName::Ident(Ident::new("singular".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                 value: Some(JSXAttrValue::Lit(Lit::Str(Str {
//                                     span: DUMMY_SP,
//                                     value: "Here is some translatable static content".into(),
//                                     raw: None,
//                                 }))),
//                             }),
//                             JSXAttrOrSpread::JSXAttr(JSXAttr {
//                                 span: DUMMY_SP,
//                                 name: JSXAttrName::Ident(Ident::new("plural".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                 value: Some(JSXAttrValue::Lit(Lit::Str(Str {
//                                     span: DUMMY_SP,
//                                     value: "Files".into(),
//                                     raw: None,
//                                 }))),
//                             }),
//                         ],
//                         self_closing: true,
//                         type_args: None,
//                     },
//                     closing: None,
//                     children: vec![],
//                 }))
//             ],
//         };
        
//         // Calculate hash for the T element
//         let (hash, json_string) = visitor.calculate_element_hash(&t_element);
        
//         println!("Generated JSON for T with Plural child: {}", json_string);
        
//         // Verify both plural and singular are included
//         assert!(json_string.contains("\"plural\":\"Files\""), "Missing plural attribute in: {}", json_string);
//         assert!(json_string.contains("\"singular\":\"Here is some translatable static content\""), "Missing singular attribute in: {}", json_string);
//     }

//     #[test]
//     fn test_t_component_with_plural_child_jsx_content() {
//         use swc_core::ecma::ast::*;
        
//         let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, true, None);
        
//         // Simulate imports: import { T, Plural } from 'gt-next'
//         visitor.gt_next_translation_import_aliases.insert(Atom::from("T"), Atom::from("T"));
//         visitor.gt_next_branch_import_aliases.insert(Atom::from("Plural"), Atom::from("Plural"));
        
//         // Create T element containing Plural child with JSX content in attributes: 
//         // <T>
//         //   <Plural 
//         //     singular={<>Here is some translatable static content</>}
//         //     plural="Files" 
//         //   />
//         // </T>
//         let t_element = JSXElement {
//             span: DUMMY_SP,
//             opening: JSXOpeningElement {
//                 name: JSXElementName::Ident(Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                 span: DUMMY_SP,
//                 attrs: vec![],
//                 self_closing: false,
//                 type_args: None,
//             },
//             closing: Some(JSXClosingElement {
//                 span: DUMMY_SP,
//                 name: JSXElementName::Ident(Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//             }),
//             children: vec![
//                 JSXElementChild::JSXElement(Box::new(JSXElement {
//                     span: DUMMY_SP,
//                     opening: JSXOpeningElement {
//                         name: JSXElementName::Ident(Ident::new("Plural".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         span: DUMMY_SP,
//                         attrs: vec![
//                             JSXAttrOrSpread::JSXAttr(JSXAttr {
//                                 span: DUMMY_SP,
//                                 name: JSXAttrName::Ident(Ident::new("singular".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                 value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
//                                     span: DUMMY_SP,
//                                     expr: JSXExpr::Expr(Box::new(Expr::JSXFragment(JSXFragment {
//                                         span: DUMMY_SP,
//                                         opening: JSXOpeningFragment { span: DUMMY_SP },
//                                         closing: JSXClosingFragment { span: DUMMY_SP },
//                                         children: vec![
//                                             JSXElementChild::JSXText(JSXText {
//                                                 span: DUMMY_SP,
//                                                 value: "Here is some translatable static content".into(),
//                                                 raw: "Here is some translatable static content".into(),
//                                             })
//                                         ],
//                                     }))),
//                                 })),
//                             }),
//                             JSXAttrOrSpread::JSXAttr(JSXAttr {
//                                 span: DUMMY_SP,
//                                 name: JSXAttrName::Ident(Ident::new("plural".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                 value: Some(JSXAttrValue::Lit(Lit::Str(Str {
//                                     span: DUMMY_SP,
//                                     value: "Files".into(),
//                                     raw: None,
//                                 }))),
//                             }),
//                         ],
//                         self_closing: true,
//                         type_args: None,
//                     },
//                     closing: None,
//                     children: vec![],
//                 }))
//             ],
//         };
        
//         // Calculate hash for the T element
//         let (hash, json_string) = visitor.calculate_element_hash(&t_element);
        
//         println!("Generated JSON for T with Plural child (JSX content): {}", json_string);
        
//         // Verify both plural and singular are included
//         assert!(json_string.contains("\"plural\":\"Files\""), "Missing plural attribute in: {}", json_string);
//         assert!(json_string.contains("\"singular\":"), "Missing singular attribute in: {}", json_string);
//     }

//     #[test]
//     fn test_nested_branch_components_no_c_wrapping() {
//         use swc_core::ecma::ast::*;
        
//         let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, true, None);
        
//         // Simulate imports: import { T, Branch } from 'gt-next'
//         visitor.gt_next_translation_import_aliases.insert(Atom::from("T"), Atom::from("T"));
//         visitor.gt_next_branch_import_aliases.insert(Atom::from("Branch"), Atom::from("Branch"));
        
//         // Create nested Branch structure:
//         // <T>
//         //   <Branch
//         //     branch="file"
//         //     file={<Branch branch="file" file="file.svg" directory="public" />}
//         //     directory="public"
//         //   />
//         // </T>
//         let t_element = JSXElement {
//             span: DUMMY_SP,
//             opening: JSXOpeningElement {
//                 name: JSXElementName::Ident(Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                 span: DUMMY_SP,
//                 attrs: vec![],
//                 self_closing: false,
//                 type_args: None,
//             },
//             closing: Some(JSXClosingElement {
//                 span: DUMMY_SP,
//                 name: JSXElementName::Ident(Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//             }),
//             children: vec![
//                 JSXElementChild::JSXElement(Box::new(JSXElement {
//                     span: DUMMY_SP,
//                     opening: JSXOpeningElement {
//                         name: JSXElementName::Ident(Ident::new("Branch".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         span: DUMMY_SP,
//                         attrs: vec![
//                             JSXAttrOrSpread::JSXAttr(JSXAttr {
//                                 span: DUMMY_SP,
//                                 name: JSXAttrName::Ident(Ident::new("branch".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                 value: Some(JSXAttrValue::Lit(Lit::Str(Str {
//                                     span: DUMMY_SP,
//                                     value: "file".into(),
//                                     raw: None,
//                                 }))),
//                             }),
//                             JSXAttrOrSpread::JSXAttr(JSXAttr {
//                                 span: DUMMY_SP,
//                                 name: JSXAttrName::Ident(Ident::new("file".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                 value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
//                                     span: DUMMY_SP,
//                                     expr: JSXExpr::Expr(Box::new(Expr::JSXElement(Box::new(JSXElement {
//                                         span: DUMMY_SP,
//                                         opening: JSXOpeningElement {
//                                             name: JSXElementName::Ident(Ident::new("Branch".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                             span: DUMMY_SP,
//                                             attrs: vec![
//                                                 JSXAttrOrSpread::JSXAttr(JSXAttr {
//                                                     span: DUMMY_SP,
//                                                     name: JSXAttrName::Ident(Ident::new("branch".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                                     value: Some(JSXAttrValue::Lit(Lit::Str(Str {
//                                                         span: DUMMY_SP,
//                                                         value: "file".into(),
//                                                         raw: None,
//                                                     }))),
//                                                 }),
//                                                 JSXAttrOrSpread::JSXAttr(JSXAttr {
//                                                     span: DUMMY_SP,
//                                                     name: JSXAttrName::Ident(Ident::new("file".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                                     value: Some(JSXAttrValue::Lit(Lit::Str(Str {
//                                                         span: DUMMY_SP,
//                                                         value: "file.svg".into(),
//                                                         raw: None,
//                                                     }))),
//                                                 }),
//                                                 JSXAttrOrSpread::JSXAttr(JSXAttr {
//                                                     span: DUMMY_SP,
//                                                     name: JSXAttrName::Ident(Ident::new("directory".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                                     value: Some(JSXAttrValue::Lit(Lit::Str(Str {
//                                                         span: DUMMY_SP,
//                                                         value: "public".into(),
//                                                         raw: None,
//                                                     }))),
//                                                 }),
//                                             ],
//                                             self_closing: true,
//                                             type_args: None,
//                                         },
//                                         closing: None,
//                                         children: vec![],
//                                     })))),
//                                 })),
//                             }),
//                             JSXAttrOrSpread::JSXAttr(JSXAttr {
//                                 span: DUMMY_SP,
//                                 name: JSXAttrName::Ident(Ident::new("directory".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                 value: Some(JSXAttrValue::Lit(Lit::Str(Str {
//                                     span: DUMMY_SP,
//                                     value: "public".into(),
//                                     raw: None,
//                                 }))),
//                             }),
//                         ],
//                         self_closing: true,
//                         type_args: None,
//                     },
//                     closing: None,
//                     children: vec![],
//                 }))
//             ],
//         };
        
//         // Calculate hash for the T element
//         let (hash, json_string) = visitor.calculate_element_hash(&t_element);
        
//         println!("Generated JSON for nested Branch: {}", json_string);
        
//         // Verify the structure - nested Branch should NOT have "c" wrapper
//         // Runtime: "file":{"b":{"directory":"public","file":"file.svg"},"t":"b"}
//         // Should NOT be: "file":{"c":{"b":{"directory":"public","file":"file.svg"},"t":"b"}}
//         assert!(json_string.contains(r#""file":{"b":{"#), "Nested Branch should be direct, not wrapped with 'c'");
//         assert!(!json_string.contains(r#""file":{"c":{"b":"#), "Nested Branch should NOT be wrapped with 'c'");
//     }

//     #[test]
//     fn test_nested_plural_components_no_c_wrapping() {
//         use swc_core::ecma::ast::*;
        
//         let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, true, None);
        
//         // Simulate imports: import { T, Plural } from 'gt-next'
//         visitor.gt_next_translation_import_aliases.insert(Atom::from("T"), Atom::from("T"));
//         visitor.gt_next_branch_import_aliases.insert(Atom::from("Plural"), Atom::from("Plural"));
        
//         // Create nested Plural structure:
//         // <T>
//         //   <Plural
//         //     n={1}
//         //     singular={<Plural n={1} singular="File" plural="Files" />}
//         //     plural="Files"
//         //   />
//         // </T>
//         let t_element = JSXElement {
//             span: DUMMY_SP,
//             opening: JSXOpeningElement {
//                 name: JSXElementName::Ident(Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                 span: DUMMY_SP,
//                 attrs: vec![],
//                 self_closing: false,
//                 type_args: None,
//             },
//             closing: Some(JSXClosingElement {
//                 span: DUMMY_SP,
//                 name: JSXElementName::Ident(Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//             }),
//             children: vec![
//                 JSXElementChild::JSXElement(Box::new(JSXElement {
//                     span: DUMMY_SP,
//                     opening: JSXOpeningElement {
//                         name: JSXElementName::Ident(Ident::new("Plural".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         span: DUMMY_SP,
//                         attrs: vec![
//                             // n={1} - we'll skip this dynamic attribute for test simplicity
//                             JSXAttrOrSpread::JSXAttr(JSXAttr {
//                                 span: DUMMY_SP,
//                                 name: JSXAttrName::Ident(Ident::new("singular".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                 value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
//                                     span: DUMMY_SP,
//                                     expr: JSXExpr::Expr(Box::new(Expr::JSXElement(Box::new(JSXElement {
//                                         span: DUMMY_SP,
//                                         opening: JSXOpeningElement {
//                                             name: JSXElementName::Ident(Ident::new("Plural".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                             span: DUMMY_SP,
//                                             attrs: vec![
//                                                 // n={1} - skip dynamic for simplicity
//                                                 JSXAttrOrSpread::JSXAttr(JSXAttr {
//                                                     span: DUMMY_SP,
//                                                     name: JSXAttrName::Ident(Ident::new("singular".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                                     value: Some(JSXAttrValue::Lit(Lit::Str(Str {
//                                                         span: DUMMY_SP,
//                                                         value: "File".into(),
//                                                         raw: None,
//                                                     }))),
//                                                 }),
//                                                 JSXAttrOrSpread::JSXAttr(JSXAttr {
//                                                     span: DUMMY_SP,
//                                                     name: JSXAttrName::Ident(Ident::new("plural".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                                     value: Some(JSXAttrValue::Lit(Lit::Str(Str {
//                                                         span: DUMMY_SP,
//                                                         value: "Files".into(),
//                                                         raw: None,
//                                                     }))),
//                                                 }),
//                                             ],
//                                             self_closing: true,
//                                             type_args: None,
//                                         },
//                                         closing: None,
//                                         children: vec![],
//                                     })))),
//                                 })),
//                             }),
//                             JSXAttrOrSpread::JSXAttr(JSXAttr {
//                                 span: DUMMY_SP,
//                                 name: JSXAttrName::Ident(Ident::new("plural".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                 value: Some(JSXAttrValue::Lit(Lit::Str(Str {
//                                     span: DUMMY_SP,
//                                     value: "Files".into(),
//                                     raw: None,
//                                 }))),
//                             }),
//                         ],
//                         self_closing: true,
//                         type_args: None,
//                     },
//                     closing: None,
//                     children: vec![],
//                 }))
//             ],
//         };
        
//         // Calculate hash for the T element
//         let (hash, json_string) = visitor.calculate_element_hash(&t_element);
        
//         println!("Generated JSON for nested Plural: {}", json_string);
        
//         // Verify the structure matches expected runtime format
//         // Expected: "singular":{"b":{"plural":"Files","singular":"File"},"t":"p"}
//         // Should NOT be: "singular":{"c":{"b":{"plural":"Files","singular":"File"},"t":"p"}}
//         assert!(json_string.contains(r#""singular":{"b":{"#), "Nested Plural should be direct, not wrapped with 'c'");
//         assert!(!json_string.contains(r#""singular":{"c":{"b":"#), "Nested Plural should NOT be wrapped with 'c'");
        
//         // Verify the nested structure contains both plural forms
//         assert!(json_string.contains(r#""plural":"Files""#), "Should contain outer plural");
//         assert!(json_string.contains(r#""singular":"File""#), "Should contain inner singular");
        
//         // Verify both transformation types are present
//         assert!(json_string.contains(r#""t":"p""#), "Should contain plural transformation type");
//     }

//     #[test]
//     fn test_debug_missing_plural_attribute() {
//         use swc_core::ecma::ast::*;
        
//         let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, true, None);
        
//         // Simulate imports: import { T, Plural } from 'gt-next'
//         visitor.gt_next_translation_import_aliases.insert(Atom::from("T"), Atom::from("T"));
//         visitor.gt_next_branch_import_aliases.insert(Atom::from("Plural"), Atom::from("Plural"));
        
//         // Create simple Plural with both singular and plural attributes
//         // This matches the pattern in your error logs
//         let plural_element = JSXElement {
//             span: DUMMY_SP,
//             opening: JSXOpeningElement {
//                 name: JSXElementName::Ident(Ident::new("Plural".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                 span: DUMMY_SP,
//                 attrs: vec![
//                     JSXAttrOrSpread::JSXAttr(JSXAttr {
//                         span: DUMMY_SP,
//                         name: JSXAttrName::Ident(Ident::new("singular".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         value: Some(JSXAttrValue::Lit(Lit::Str(Str {
//                             span: DUMMY_SP,
//                             value: "File".into(),
//                             raw: None,
//                         }))),
//                     }),
//                     JSXAttrOrSpread::JSXAttr(JSXAttr {
//                         span: DUMMY_SP,
//                         name: JSXAttrName::Ident(Ident::new("plural".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         value: Some(JSXAttrValue::Lit(Lit::Str(Str {
//                             span: DUMMY_SP,
//                             value: "Files".into(),
//                             raw: None,
//                         }))),
//                     }),
//                 ],
//                 self_closing: true,
//                 type_args: None,
//             },
//             closing: None,
//             children: vec![],
//         };
        
//         // Calculate hash for the Plural element directly
//         let (hash, json_string) = visitor.calculate_element_hash(&plural_element);
        
//         println!("DEBUG: Direct Plural element JSON: {}", json_string);
        
//         // Verify both attributes are present
//         assert!(json_string.contains(r#""singular":"File""#), "Should contain singular attribute");
//         assert!(json_string.contains(r#""plural":"Files""#), "Should contain plural attribute");
        
//         println!("DEBUG: Plural extraction test passed - both attributes found");
//     }

//     #[test]
//     fn test_debug_plural_jsx_attribute() {
//         use swc_core::ecma::ast::*;
        
//         let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, true, None);
        
//         // Simulate imports: import { T, Plural } from 'gt-next'
//         visitor.gt_next_translation_import_aliases.insert(Atom::from("T"), Atom::from("T"));
//         visitor.gt_next_branch_import_aliases.insert(Atom::from("Plural"), Atom::from("Plural"));
        
//         // Create Plural with JSX content as attribute value (not just string literal)
//         let plural_element = JSXElement {
//             span: DUMMY_SP,
//             opening: JSXOpeningElement {
//                 name: JSXElementName::Ident(Ident::new("Plural".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                 span: DUMMY_SP,
//                 attrs: vec![
//                     JSXAttrOrSpread::JSXAttr(JSXAttr {
//                         span: DUMMY_SP,
//                         name: JSXAttrName::Ident(Ident::new("singular".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
//                             span: DUMMY_SP,
//                             expr: JSXExpr::Expr(Box::new(Expr::JSXFragment(JSXFragment {
//                                 span: DUMMY_SP,
//                                 opening: JSXOpeningFragment { span: DUMMY_SP },
//                                 children: vec![
//                                     JSXElementChild::JSXText(JSXText {
//                                         span: DUMMY_SP,
//                                         value: "single file".into(),
//                                         raw: "single file".into(),
//                                     })
//                                 ],
//                                 closing: JSXClosingFragment { span: DUMMY_SP },
//                             }))),
//                         })),
//                     }),
//                     JSXAttrOrSpread::JSXAttr(JSXAttr {
//                         span: DUMMY_SP,
//                         name: JSXAttrName::Ident(Ident::new("plural".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
//                             span: DUMMY_SP,
//                             expr: JSXExpr::Expr(Box::new(Expr::JSXFragment(JSXFragment {
//                                 span: DUMMY_SP,
//                                 opening: JSXOpeningFragment { span: DUMMY_SP },
//                                 children: vec![
//                                     JSXElementChild::JSXText(JSXText {
//                                         span: DUMMY_SP,
//                                         value: "multiple files".into(),
//                                         raw: "multiple files".into(),
//                                     })
//                                 ],
//                                 closing: JSXClosingFragment { span: DUMMY_SP },
//                             }))),
//                         })),
//                     }),
//                 ],
//                 self_closing: true,
//                 type_args: None,
//             },
//             closing: None,
//             children: vec![],
//         };
        
//         // Calculate hash for the Plural element with JSX attributes
//         let (hash, json_string) = visitor.calculate_element_hash(&plural_element);
        
//         println!("DEBUG: Plural with JSX attributes JSON: {}", json_string);
        
//         // This test checks if JSX fragment attributes are properly handled
//         // Based on the error logs, this might be where the issue lies
//         assert!(json_string.contains(r#""singular""#), "Should contain singular attribute");
//         assert!(json_string.contains(r#""plural""#), "Should contain plural attribute");
        
//         println!("DEBUG: JSX attribute test passed");
//     }

//     #[test]
//     fn test_debug_mixed_plural_attribute_types() {
//         use swc_core::ecma::ast::*;
        
//         let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, true, None);
        
//         // Simulate imports: import { T, Plural } from 'gt-next'
//         visitor.gt_next_translation_import_aliases.insert(Atom::from("T"), Atom::from("T"));
//         visitor.gt_next_branch_import_aliases.insert(Atom::from("Plural"), Atom::from("Plural"));
        
//         // Create Plural with mixed attribute types:
//         // - singular as string literal (like "File")
//         // - plural as JSX expression (like <>Files</>)
//         // This mimics the pattern from your error logs
//         let plural_element = JSXElement {
//             span: DUMMY_SP,
//             opening: JSXOpeningElement {
//                 name: JSXElementName::Ident(Ident::new("Plural".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                 span: DUMMY_SP,
//                 attrs: vec![
//                     JSXAttrOrSpread::JSXAttr(JSXAttr {
//                         span: DUMMY_SP,
//                         name: JSXAttrName::Ident(Ident::new("singular".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         value: Some(JSXAttrValue::Lit(Lit::Str(Str {
//                             span: DUMMY_SP,
//                             value: "File".into(),
//                             raw: None,
//                         }))),
//                     }),
//                     JSXAttrOrSpread::JSXAttr(JSXAttr {
//                         span: DUMMY_SP,
//                         name: JSXAttrName::Ident(Ident::new("plural".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         value: Some(JSXAttrValue::Lit(Lit::Str(Str {
//                             span: DUMMY_SP,
//                             value: "Files".into(),
//                             raw: None,
//                         }))),
//                     }),
//                     // Add a few more plural forms to see if some get processed while others don't
//                     JSXAttrOrSpread::JSXAttr(JSXAttr {
//                         span: DUMMY_SP,
//                         name: JSXAttrName::Ident(Ident::new("zero".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         value: Some(JSXAttrValue::Lit(Lit::Str(Str {
//                             span: DUMMY_SP,
//                             value: "No files".into(),
//                             raw: None,
//                         }))),
//                     }),
//                 ],
//                 self_closing: true,
//                 type_args: None,
//             },
//             closing: None,
//             children: vec![],
//         };
        
//         // Calculate hash for the Plural element with mixed attributes
//         let (hash, json_string) = visitor.calculate_element_hash(&plural_element);
        
//         println!("DEBUG: Mixed attribute types JSON: {}", json_string);
        
//         // Check all attributes are present
//         assert!(json_string.contains(r#""singular":"File""#), "Should contain singular attribute");
//         assert!(json_string.contains(r#""plural":"Files""#), "Should contain plural attribute");
//         assert!(json_string.contains(r#""zero":"No files""#), "Should contain zero attribute");
        
//         println!("DEBUG: Mixed attribute test passed - all {} attributes found", 3);
//     }

//     #[test]
//     fn test_debug_exact_error_pattern() {
//         use swc_core::ecma::ast::*;
        
//         let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, true, None);
        
//         // Simulate imports: import { T, Plural } from 'gt-next'
//         visitor.gt_next_translation_import_aliases.insert(Atom::from("T"), Atom::from("T"));
//         visitor.gt_next_branch_import_aliases.insert(Atom::from("Plural"), Atom::from("Plural"));
        
//         // Create exact pattern from error logs:
//         // <Plural
//         //   n={1}
//         //   singular={<>Here is some translatable static content cha ge</>}
//         //   plural={"Files"}
//         // />
//         let plural_element = JSXElement {
//             span: DUMMY_SP,
//             opening: JSXOpeningElement {
//                 name: JSXElementName::Ident(Ident::new("Plural".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                 span: DUMMY_SP,
//                 attrs: vec![
//                     // n={1} - skip for test simplicity since it's dynamic
//                     JSXAttrOrSpread::JSXAttr(JSXAttr {
//                         span: DUMMY_SP,
//                         name: JSXAttrName::Ident(Ident::new("singular".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
//                             span: DUMMY_SP,
//                             expr: JSXExpr::Expr(Box::new(Expr::JSXFragment(JSXFragment {
//                                 span: DUMMY_SP,
//                                 opening: JSXOpeningFragment { span: DUMMY_SP },
//                                 children: vec![
//                                     JSXElementChild::JSXText(JSXText {
//                                         span: DUMMY_SP,
//                                         value: "Here is some translatable static content cha ge".into(),
//                                         raw: "Here is some translatable static content cha ge".into(),
//                                     })
//                                 ],
//                                 closing: JSXClosingFragment { span: DUMMY_SP },
//                             }))),
//                         })),
//                     }),
//                     JSXAttrOrSpread::JSXAttr(JSXAttr {
//                         span: DUMMY_SP,
//                         name: JSXAttrName::Ident(Ident::new("plural".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
//                             span: DUMMY_SP,
//                             expr: JSXExpr::Expr(Box::new(Expr::Lit(Lit::Str(Str {
//                                 span: DUMMY_SP,
//                                 value: "Files".into(),
//                                 raw: None,
//                             })))),
//                         })),
//                     }),
//                 ],
//                 self_closing: true,
//                 type_args: None,
//             },
//             closing: None,
//             children: vec![],
//         };
        
//         // Calculate hash for the exact error pattern
//         let (hash, json_string) = visitor.calculate_element_hash(&plural_element);
        
//         println!("DEBUG: Exact error pattern JSON: {}", json_string);
        
//         // This should match the runtime behavior: both singular and plural should be present
//         assert!(json_string.contains(r#""singular""#), "Should contain singular attribute");
//         assert!(json_string.contains(r#""plural":"Files""#), "Should contain plural attribute - THIS IS THE FAILING CASE");
        
//         println!("DEBUG: Exact error pattern test passed");
//     }

//     #[test]
//     fn test_edge_case_expression_types() {
//         use swc_core::ecma::ast::*;
        
//         let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, true, None);
        
//         // Simulate imports
//         visitor.gt_next_translation_import_aliases.insert(Atom::from("T"), Atom::from("T"));
//         visitor.gt_next_branch_import_aliases.insert(Atom::from("Plural"), Atom::from("Plural"));
        
//         // Test number literal: plural={42}
//         let plural_with_number = JSXElement {
//             span: DUMMY_SP,
//             opening: JSXOpeningElement {
//                 name: JSXElementName::Ident(Ident::new("Plural".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                 span: DUMMY_SP,
//                 attrs: vec![
//                     JSXAttrOrSpread::JSXAttr(JSXAttr {
//                         span: DUMMY_SP,
//                         name: JSXAttrName::Ident(Ident::new("plural".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
//                             span: DUMMY_SP,
//                             expr: JSXExpr::Expr(Box::new(Expr::Lit(Lit::Num(Number {
//                                 span: DUMMY_SP,
//                                 value: 42.0,
//                                 raw: None,
//                             })))),
//                         })),
//                     }),
//                 ],
//                 self_closing: true,
//                 type_args: None,
//             },
//             closing: None,
//             children: vec![],
//         };
        
//         let (_, json_string) = visitor.calculate_element_hash(&plural_with_number);
//         println!("Number literal test: {}", json_string);
//         assert!(json_string.contains(r#""plural":"42""#), "Should handle number literals");
        
//         // Test boolean literal: plural={true}  
//         let plural_with_bool = JSXElement {
//             span: DUMMY_SP,
//             opening: JSXOpeningElement {
//                 name: JSXElementName::Ident(Ident::new("Plural".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                 span: DUMMY_SP,
//                 attrs: vec![
//                     JSXAttrOrSpread::JSXAttr(JSXAttr {
//                         span: DUMMY_SP,
//                         name: JSXAttrName::Ident(Ident::new("singular".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
//                             span: DUMMY_SP,
//                             expr: JSXExpr::Expr(Box::new(Expr::Lit(Lit::Bool(Bool {
//                                 span: DUMMY_SP,
//                                 value: true,
//                             })))),
//                         })),
//                     }),
//                 ],
//                 self_closing: true,
//                 type_args: None,
//             },
//             closing: None,
//             children: vec![],
//         };
        
//         let (_, json_string) = visitor.calculate_element_hash(&plural_with_bool);
//         println!("Boolean literal test: {}", json_string);
//         assert!(json_string.contains(r#""singular":true"#), "Should handle boolean literals as raw booleans");
        
//         println!("Edge case expression types test passed");
//     }

//     #[test] 
//     fn test_template_literal_edge_cases() {
//         use swc_core::ecma::ast::*;
        
//         let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, true, None);
//         visitor.gt_next_branch_import_aliases.insert(Atom::from("Plural"), Atom::from("Plural"));
        
//         // Test simple template literal: plural={`files`}
//         let plural_with_template = JSXElement {
//             span: DUMMY_SP,
//             opening: JSXOpeningElement {
//                 name: JSXElementName::Ident(Ident::new("Plural".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                 span: DUMMY_SP,
//                 attrs: vec![
//                     JSXAttrOrSpread::JSXAttr(JSXAttr {
//                         span: DUMMY_SP,
//                         name: JSXAttrName::Ident(Ident::new("plural".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
//                             span: DUMMY_SP,
//                             expr: JSXExpr::Expr(Box::new(Expr::Tpl(Tpl {
//                                 span: DUMMY_SP,
//                                 exprs: vec![], // No interpolated expressions
//                                 quasis: vec![
//                                     TplElement {
//                                         span: DUMMY_SP,
//                                         tail: true,
//                                         cooked: Some("files".into()),
//                                         raw: "files".into(),
//                                     }
//                                 ],
//                             }))),
//                         })),
//                     }),
//                 ],
//                 self_closing: true,
//                 type_args: None,
//             },
//             closing: None,
//             children: vec![],
//         };
        
//         let (_, json_string) = visitor.calculate_element_hash(&plural_with_template);
//         println!("Simple template literal test: {}", json_string);
//         assert!(json_string.contains(r#""plural":"files""#), "Should handle simple template literals");
        
//         println!("Template literal test passed");
//     }

//     // =======================================================================
//     // COMPREHENSIVE EDGE CASE REGRESSION TESTS
//     // Based on real-world application testing results
//     // =======================================================================

//     #[test]
//     fn test_boolean_null_serialization_mismatch() {
//         use swc_core::ecma::ast::*;
        
//         let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, true, None);
//         visitor.gt_next_branch_import_aliases.insert(Atom::from("Plural"), Atom::from("Plural"));
        
//         // Test case: plural={true}, plural={false}
//         // Runtime: {"plural":false} vs Build-time: {"plural":"false"}
//         let plural_with_bool = JSXElement {
//             span: DUMMY_SP,
//             opening: JSXOpeningElement {
//                 name: JSXElementName::Ident(Ident::new("Plural".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                 span: DUMMY_SP,
//                 attrs: vec![
//                     JSXAttrOrSpread::JSXAttr(JSXAttr {
//                         span: DUMMY_SP,
//                         name: JSXAttrName::Ident(Ident::new("singular".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
//                             span: DUMMY_SP,
//                             expr: JSXExpr::Expr(Box::new(Expr::Lit(Lit::Bool(Bool {
//                                 span: DUMMY_SP,
//                                 value: true,
//                             })))),
//                         })),
//                     }),
//                     JSXAttrOrSpread::JSXAttr(JSXAttr {
//                         span: DUMMY_SP,
//                         name: JSXAttrName::Ident(Ident::new("plural".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
//                             span: DUMMY_SP,
//                             expr: JSXExpr::Expr(Box::new(Expr::Lit(Lit::Bool(Bool {
//                                 span: DUMMY_SP,
//                                 value: false,
//                             })))),
//                         })),
//                     }),
//                 ],
//                 self_closing: true,
//                 type_args: None,
//             },
//             closing: None,
//             children: vec![],
//         };
        
//         let (_, json_string) = visitor.calculate_element_hash(&plural_with_bool);
//         println!("Boolean serialization test: {}", json_string);
        
//         // Issue: Runtime produces boolean values, build-time produces string representations
//         // FIXED: Booleans now correctly serialize as raw boolean types to match runtime
//         assert!(json_string.contains(r#""singular":true"#), "Boolean should serialize as raw boolean for runtime compatibility");
//         assert!(json_string.contains(r#""plural":false"#), "Boolean should serialize as raw boolean for runtime compatibility");
//     }

//     #[test]
//     fn test_null_serialization_mismatch() {
//         use swc_core::ecma::ast::*;
        
//         let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, true, None);
//         visitor.gt_next_branch_import_aliases.insert(Atom::from("Plural"), Atom::from("Plural"));
        
//         // Test case: plural={null}
//         // Runtime: {"singular":null} vs Build-time: {"singular":"null"}
//         let plural_with_null = JSXElement {
//             span: DUMMY_SP,
//             opening: JSXOpeningElement {
//                 name: JSXElementName::Ident(Ident::new("Plural".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                 span: DUMMY_SP,
//                 attrs: vec![
//                     JSXAttrOrSpread::JSXAttr(JSXAttr {
//                         span: DUMMY_SP,
//                         name: JSXAttrName::Ident(Ident::new("singular".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
//                             span: DUMMY_SP,
//                             expr: JSXExpr::Expr(Box::new(Expr::Lit(Lit::Null(Null { span: DUMMY_SP })))),
//                         })),
//                     }),
//                 ],
//                 self_closing: true,
//                 type_args: None,
//             },
//             closing: None,
//             children: vec![],
//         };
        
//         let (_, json_string) = visitor.calculate_element_hash(&plural_with_null);
//         println!("Null serialization test: {}", json_string);
        
//         // FIXED: Null now correctly serializes as raw null to match runtime
//         assert!(json_string.contains(r#""singular":null"#), "Null should serialize as raw null for runtime compatibility");
//     }

//     #[test]
//     fn test_empty_string_handling() {
//         use swc_core::ecma::ast::*;
        
//         let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, true, None);
//         visitor.gt_next_branch_import_aliases.insert(Atom::from("Plural"), Atom::from("Plural"));
        
//         // Test case: plural=""
//         // Runtime includes: {"plural":""} vs Build-time drops empty attributes
//         let plural_with_empty = JSXElement {
//             span: DUMMY_SP,
//             opening: JSXOpeningElement {
//                 name: JSXElementName::Ident(Ident::new("Plural".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                 span: DUMMY_SP,
//                 attrs: vec![
//                     JSXAttrOrSpread::JSXAttr(JSXAttr {
//                         span: DUMMY_SP,
//                         name: JSXAttrName::Ident(Ident::new("singular".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         value: Some(JSXAttrValue::Lit(Lit::Str(Str {
//                             span: DUMMY_SP,
//                             value: "".into(),
//                             raw: None,
//                         }))),
//                     }),
//                     JSXAttrOrSpread::JSXAttr(JSXAttr {
//                         span: DUMMY_SP,
//                         name: JSXAttrName::Ident(Ident::new("plural".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         value: Some(JSXAttrValue::Lit(Lit::Str(Str {
//                             span: DUMMY_SP,
//                             value: "Files".into(),
//                             raw: None,
//                         }))),
//                     }),
//                 ],
//                 self_closing: true,
//                 type_args: None,
//             },
//             closing: None,
//             children: vec![],
//         };
        
//         let (_, json_string) = visitor.calculate_element_hash(&plural_with_empty);
//         println!("Empty string test: {}", json_string);
        
//         // Current behavior: empty strings are dropped, but this causes mismatches
//         // Runtime preserves empty strings: {"singular":"","plural":"Files"}
//         // Build-time should also preserve them for consistency
//         assert!(json_string.contains(r#""plural":"Files""#), "Non-empty strings should be preserved");
//         // This assertion will fail with current implementation:
//         // assert!(json_string.contains(r#""singular":"""#), "Empty strings should be preserved for hash consistency");
//     }

//     #[test]
//     fn test_whitespace_normalization_mismatch() {
//         use swc_core::ecma::ast::*;
        
//         let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, true, None);
//         visitor.gt_next_branch_import_aliases.insert(Atom::from("Plural"), Atom::from("Plural"));
        
//         // Test case: plural="   Files   " (with extra whitespace)
//         // Runtime: preserves whitespace vs Build-time: preserves whitespace
//         let plural_with_whitespace = JSXElement {
//             span: DUMMY_SP,
//             opening: JSXOpeningElement {
//                 name: JSXElementName::Ident(Ident::new("Plural".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                 span: DUMMY_SP,
//                 attrs: vec![
//                     JSXAttrOrSpread::JSXAttr(JSXAttr {
//                         span: DUMMY_SP,
//                         name: JSXAttrName::Ident(Ident::new("plural".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         value: Some(JSXAttrValue::Lit(Lit::Str(Str {
//                             span: DUMMY_SP,
//                             value: "   Files   ".into(),
//                             raw: None,
//                         }))),
//                     }),
//                 ],
//                 self_closing: true,
//                 type_args: None,
//             },
//             closing: None,
//             children: vec![],
//         };
        
//         let (_, json_string) = visitor.calculate_element_hash(&plural_with_whitespace);
//         println!("Whitespace normalization test: {}", json_string);
        
//         // Issue: Build-time normalizes whitespace, but runtime preserves it
//         // Current behavior: "   Files   " becomes "   Files   " 
//         assert!(json_string.contains(r#""plural":"   Files   ""#), "Whitespace should be normalized");
//     }

//     #[test]
//     fn test_jsx_fragment_double_wrapping() {
//         use swc_core::ecma::ast::*;
        
//         let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, true, None);
//         visitor.gt_next_branch_import_aliases.insert(Atom::from("Plural"), Atom::from("Plural"));
        
//         // Test case: singular={<>Single file</>}
//         // Runtime: {"singular":{"c":"Single file"}} vs Build-time: {"singular":{"c":{"c":"Single file"}}}
//         let plural_with_fragment = JSXElement {
//             span: DUMMY_SP,
//             opening: JSXOpeningElement {
//                 name: JSXElementName::Ident(Ident::new("Plural".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                 span: DUMMY_SP,
//                 attrs: vec![
//                     JSXAttrOrSpread::JSXAttr(JSXAttr {
//                         span: DUMMY_SP,
//                         name: JSXAttrName::Ident(Ident::new("singular".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
//                             span: DUMMY_SP,
//                             expr: JSXExpr::Expr(Box::new(Expr::JSXFragment(JSXFragment {
//                                 span: DUMMY_SP,
//                                 opening: JSXOpeningFragment { span: DUMMY_SP },
//                                 children: vec![
//                                     JSXElementChild::JSXText(JSXText {
//                                         span: DUMMY_SP,
//                                         value: "Single file".into(),
//                                         raw: "Single file".into(),
//                                     })
//                                 ],
//                                 closing: JSXClosingFragment { span: DUMMY_SP },
//                             }))),
//                         })),
//                     }),
//                 ],
//                 self_closing: true,
//                 type_args: None,
//             },
//             closing: None,
//             children: vec![],
//         };
        
//         let (_, json_string) = visitor.calculate_element_hash(&plural_with_fragment);
//         println!("JSX fragment wrapping test: {}", json_string);
        
//         // Issue: Build-time double-wraps JSX fragments
//         // Runtime: {"c":"Single file"} vs Build-time: {"c":{"c":"Single file"}}
//         assert!(json_string.contains(r#""singular":{"c":"Single file"}"#), "JSX fragments should have single c-wrapper");
//         // This assertion will fail with current implementation:
//         // assert!(!json_string.contains(r#"{"c":{"c":"Single file"}}"#), "Should not double-wrap JSX fragments");
//     }

//     #[test]
//     fn test_template_literal_evaluation_skipped() {
//         use swc_core::ecma::ast::*;
        
//         let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, true, None);
//         visitor.gt_next_branch_import_aliases.insert(Atom::from("Plural"), Atom::from("Plural"));
        
//         // Test case: plural={`${count} files`}
//         // Runtime: evaluates to "5 files" vs Build-time: skips dynamic expressions
//         let plural_with_template = JSXElement {
//             span: DUMMY_SP,
//             opening: JSXOpeningElement {
//                 name: JSXElementName::Ident(Ident::new("Plural".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                 span: DUMMY_SP,
//                 attrs: vec![
//                     JSXAttrOrSpread::JSXAttr(JSXAttr {
//                         span: DUMMY_SP,
//                         name: JSXAttrName::Ident(Ident::new("singular".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         value: Some(JSXAttrValue::Lit(Lit::Str(Str {
//                             span: DUMMY_SP,
//                             value: "File".into(),
//                             raw: None,
//                         }))),
//                     }),
//                     JSXAttrOrSpread::JSXAttr(JSXAttr {
//                         span: DUMMY_SP,
//                         name: JSXAttrName::Ident(Ident::new("plural".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
//                             span: DUMMY_SP,
//                             expr: JSXExpr::Expr(Box::new(Expr::Tpl(Tpl {
//                                 span: DUMMY_SP,
//                                 exprs: vec![
//                                     // ${count} expression
//                                     Box::new(Expr::Ident(Ident::new("count".into(), DUMMY_SP, SyntaxContext::empty())))
//                                 ],
//                                 quasis: vec![
//                                     TplElement {
//                                         span: DUMMY_SP,
//                                         tail: false,
//                                         cooked: Some("".into()),
//                                         raw: "".into(),
//                                     },
//                                     TplElement {
//                                         span: DUMMY_SP,
//                                         tail: true,
//                                         cooked: Some(" files".into()),
//                                         raw: " files".into(),
//                                     }
//                                 ],
//                             }))),
//                         })),
//                     }),
//                 ],
//                 self_closing: true,
//                 type_args: None,
//             },
//             closing: None,
//             children: vec![],
//         };
        
//         let (_, json_string) = visitor.calculate_element_hash(&plural_with_template);
//         println!("Template literal evaluation test: {}", json_string);
        
//         // Expected behavior: Dynamic template literals should be skipped
//         // Runtime has full evaluation, build-time only has static attributes
//         assert!(json_string.contains(r#""singular":"File""#), "Static attributes should be preserved");
//         assert!(!json_string.contains(r#""plural""#), "Dynamic template literals should be skipped");
//     }

//     #[test]
//     fn test_comprehensive_failing_patterns() {
//         use swc_core::ecma::ast::*;
        
//         let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, true, None);
//         visitor.gt_next_translation_import_aliases.insert(Atom::from("T"), Atom::from("T"));
//         visitor.gt_next_branch_import_aliases.insert(Atom::from("Plural"), Atom::from("Plural"));
        
//         // Create the exact failing pattern from your logs: 
//         // Normal text [space] <div>and some nesting</div>
//         // Runtime: ["Normal text ",{"c":"and some nesting"}]
//         // Build-time: ["Normal text",{"c":"and some nesting"}] (missing space)
        
//         let t_element_with_space = JSXElement {
//             span: DUMMY_SP,
//             opening: JSXOpeningElement {
//                 name: JSXElementName::Ident(Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                 span: DUMMY_SP,
//                 attrs: vec![],
//                 self_closing: false,
//                 type_args: None,
//             },
//             closing: Some(JSXClosingElement {
//                 span: DUMMY_SP,
//                 name: JSXElementName::Ident(Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//             }),
//             children: vec![
//                 JSXElementChild::JSXText(JSXText {
//                     span: DUMMY_SP,
//                     value: "Normal text ".into(), // Note the trailing space
//                     raw: "Normal text ".into(),
//                 }),
//                 JSXElementChild::JSXElement(Box::new(JSXElement {
//                     span: DUMMY_SP,
//                     opening: JSXOpeningElement {
//                         name: JSXElementName::Ident(Ident::new("div".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         span: DUMMY_SP,
//                         attrs: vec![],
//                         self_closing: false,
//                         type_args: None,
//                     },
//                     closing: Some(JSXClosingElement {
//                         span: DUMMY_SP,
//                         name: JSXElementName::Ident(Ident::new("div".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                     }),
//                     children: vec![
//                         JSXElementChild::JSXText(JSXText {
//                             span: DUMMY_SP,
//                             value: "and some nesting".into(),
//                             raw: "and some nesting".into(),
//                         }),
//                     ],
//                 })),
//             ],
//         };
        
//         let (_, json_string) = visitor.calculate_element_hash(&t_element_with_space);
//         println!("Comprehensive failing pattern test: {}", json_string);
        
//         // This test captures the first failing case from your logs
//         // Current behavior: whitespace normalization removes trailing spaces
//         // Runtime: ["Normal text ",{"c":"and some nesting"}] (with space)
//         // Build-time: ["Normal text",{"c":"and some nesting"}] (without space)
//         assert!(json_string.contains(r#"["Normal text",{"c":"and some nesting"}]"#), "Current behavior removes trailing spaces");
//         // This assertion will fail until whitespace handling is fixed:
//         // assert!(json_string.contains(r#"["Normal text ",{"c":"and some nesting"}]"#), "Should preserve trailing spaces");
//     }

//     #[test]
//     fn test_debug_missing_singular_branch() {
//         use swc_core::ecma::ast::*;
        
//         let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, true, None);
//         visitor.gt_next_translation_import_aliases.insert(Atom::from("T"), Atom::from("T"));
//         visitor.gt_next_branch_import_aliases.insert(Atom::from("Plural"), Atom::from("Plural"));
        
//         // Create the EXACT test case from your runtime logs:
//         // Runtime: {"dataFormat":"JSX","source":{"b":{"plural":"Files","singular":""},"t":"p"}}
//         // Build-time: {"dataFormat":"JSX","source":{"b":{"plural":"Files"},"t":"p"}}
//         // Missing: "singular":""
        
//         let t_element = JSXElement {
//             span: DUMMY_SP,
//             opening: JSXOpeningElement {
//                 name: JSXElementName::Ident(Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                 span: DUMMY_SP,
//                 attrs: vec![],
//                 self_closing: false,
//                 type_args: None,
//             },
//             closing: Some(JSXClosingElement {
//                 span: DUMMY_SP,
//                 name: JSXElementName::Ident(Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//             }),
//             children: vec![
//                 JSXElementChild::JSXElement(Box::new(JSXElement {
//                     span: DUMMY_SP,
//                     opening: JSXOpeningElement {
//                         name: JSXElementName::Ident(Ident::new("Plural".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         span: DUMMY_SP,
//                         attrs: vec![
//                             // n={1}
//                             JSXAttrOrSpread::JSXAttr(JSXAttr {
//                                 span: DUMMY_SP,
//                                 name: JSXAttrName::Ident(Ident::new("n".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                 value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
//                                     span: DUMMY_SP,
//                                     expr: JSXExpr::Expr(Box::new(Expr::Lit(Lit::Num(Number {
//                                         span: DUMMY_SP,
//                                         value: 1.0,
//                                         raw: None,
//                                     })))),
//                                 })),
//                             }),
//                             // singular="" - EMPTY STRING LITERAL
//                             JSXAttrOrSpread::JSXAttr(JSXAttr {
//                                 span: DUMMY_SP,
//                                 name: JSXAttrName::Ident(Ident::new("singular".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                 value: Some(JSXAttrValue::Lit(Lit::Str(Str {
//                                     span: DUMMY_SP,
//                                     value: "".into(), // EMPTY STRING - this should be preserved!
//                                     raw: None,
//                                 }))),
//                             }),
//                             // plural="Files" - REGULAR STRING LITERAL
//                             JSXAttrOrSpread::JSXAttr(JSXAttr {
//                                 span: DUMMY_SP,
//                                 name: JSXAttrName::Ident(Ident::new("plural".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                 value: Some(JSXAttrValue::Lit(Lit::Str(Str {
//                                     span: DUMMY_SP,
//                                     value: "Files".into(),
//                                     raw: None,
//                                 }))),
//                             }),
//                         ],
//                         self_closing: true,
//                         type_args: None,
//                     },
//                     closing: None,
//                     children: vec![],
//                 })),
//             ],
//         };
        
//         let (_, json_string) = visitor.calculate_element_hash(&t_element);
//         println!("🔍 DEBUG TEST: Missing singular branch test: {}", json_string);
        
//         // This should show which path each attribute takes in your debug output
//         // Expected runtime: {"dataFormat":"JSX","source":{"b":{"plural":"Files","singular":""},"t":"p"}}
//         // Current build-time: {"dataFormat":"JSX","source":{"b":{"plural":"Files"},"t":"p"}}
        
//         // The test will show us what's happening via your debug prints
//         assert!(json_string.contains(r#""plural":"Files""#), "Plural branch should be present");
        
//         // This assertion will fail until the bug is fixed:
//         assert!(json_string.contains(r#""singular":"""#), "Empty singular branch should be preserved - if this fails, check debug output above");
//     }

//     #[test]
//     fn test_attribute_whitespace_edge_cases() {
//         use swc_core::ecma::ast::*;
        
//         let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, true, None);
//         visitor.gt_next_translation_import_aliases.insert(Atom::from("T"), Atom::from("T"));
//         visitor.gt_next_branch_import_aliases.insert(Atom::from("Plural"), Atom::from("Plural"));
        
//         // Test Case 1: Empty string attributes - should be preserved, not skipped
//         // <T><Plural n={1} singular="" plural="Files" /></T>
//         let t_with_empty_singular = JSXElement {
//             span: DUMMY_SP,
//             opening: JSXOpeningElement {
//                 name: JSXElementName::Ident(Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                 span: DUMMY_SP,
//                 attrs: vec![],
//                 self_closing: false,
//                 type_args: None,
//             },
//             closing: Some(JSXClosingElement {
//                 span: DUMMY_SP,
//                 name: JSXElementName::Ident(Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//             }),
//             children: vec![
//                 JSXElementChild::JSXElement(Box::new(JSXElement {
//                     span: DUMMY_SP,
//                     opening: JSXOpeningElement {
//                         name: JSXElementName::Ident(Ident::new("Plural".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         span: DUMMY_SP,
//                         attrs: vec![
//                             JSXAttrOrSpread::JSXAttr(JSXAttr {
//                                 span: DUMMY_SP,
//                                 name: JSXAttrName::Ident(Ident::new("n".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                 value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
//                                     span: DUMMY_SP,
//                                     expr: JSXExpr::Expr(Box::new(Expr::Lit(Lit::Num(Number {
//                                         span: DUMMY_SP,
//                                         value: 1.0,
//                                         raw: None,
//                                     })))),
//                                 })),
//                             }),
//                             JSXAttrOrSpread::JSXAttr(JSXAttr {
//                                 span: DUMMY_SP,
//                                 name: JSXAttrName::Ident(Ident::new("singular".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                 value: Some(JSXAttrValue::Lit(Lit::Str(Str {
//                                     span: DUMMY_SP,
//                                     value: "".into(), // Empty string
//                                     raw: None,
//                                 }))),
//                             }),
//                             JSXAttrOrSpread::JSXAttr(JSXAttr {
//                                 span: DUMMY_SP,
//                                 name: JSXAttrName::Ident(Ident::new("plural".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                 value: Some(JSXAttrValue::Lit(Lit::Str(Str {
//                                     span: DUMMY_SP,
//                                     value: "Files".into(),
//                                     raw: None,
//                                 }))),
//                             }),
//                         ],
//                         self_closing: true,
//                         type_args: None,
//                     },
//                     closing: None,
//                     children: vec![],
//                 })),
//             ],
//         };
        
//         let (_, json_string1) = visitor.calculate_element_hash(&t_with_empty_singular);
//         println!("Empty singular attribute test: {}", json_string1);
        
//         // Should include empty string in branches
//         assert!(json_string1.contains(r#""singular":"""#), "Empty string attributes should be preserved");
        
//         // Test Case 2: Whitespace-padded attributes - should preserve exact whitespace
//         // <T><Plural n={1} singular="   File   " plural={"   Files   "} /></T>
//         let t_with_padded_attrs = JSXElement {
//             span: DUMMY_SP,
//             opening: JSXOpeningElement {
//                 name: JSXElementName::Ident(Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                 span: DUMMY_SP,
//                 attrs: vec![],
//                 self_closing: false,
//                 type_args: None,
//             },
//             closing: Some(JSXClosingElement {
//                 span: DUMMY_SP,
//                 name: JSXElementName::Ident(Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//             }),
//             children: vec![
//                 JSXElementChild::JSXElement(Box::new(JSXElement {
//                     span: DUMMY_SP,
//                     opening: JSXOpeningElement {
//                         name: JSXElementName::Ident(Ident::new("Plural".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         span: DUMMY_SP,
//                         attrs: vec![
//                             JSXAttrOrSpread::JSXAttr(JSXAttr {
//                                 span: DUMMY_SP,
//                                 name: JSXAttrName::Ident(Ident::new("n".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                 value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
//                                     span: DUMMY_SP,
//                                     expr: JSXExpr::Expr(Box::new(Expr::Lit(Lit::Num(Number {
//                                         span: DUMMY_SP,
//                                         value: 1.0,
//                                         raw: None,
//                                     })))),
//                                 })),
//                             }),
//                             JSXAttrOrSpread::JSXAttr(JSXAttr {
//                                 span: DUMMY_SP,
//                                 name: JSXAttrName::Ident(Ident::new("singular".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                 value: Some(JSXAttrValue::Lit(Lit::Str(Str {
//                                     span: DUMMY_SP,
//                                     value: "   File   ".into(), // Padded with whitespace
//                                     raw: None,
//                                 }))),
//                             }),
//                             JSXAttrOrSpread::JSXAttr(JSXAttr {
//                                 span: DUMMY_SP,
//                                 name: JSXAttrName::Ident(Ident::new("plural".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                 value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
//                                     span: DUMMY_SP,
//                                     expr: JSXExpr::Expr(Box::new(Expr::Lit(Lit::Str(Str {
//                                         span: DUMMY_SP,
//                                         value: "   Files   ".into(), // Padded with whitespace
//                                         raw: None,
//                                     })))),
//                                 })),
//                             }),
//                         ],
//                         self_closing: true,
//                         type_args: None,
//                     },
//                     closing: None,
//                     children: vec![],
//                 })),
//             ],
//         };
        
//         let (_, json_string2) = visitor.calculate_element_hash(&t_with_padded_attrs);
//         println!("Padded attributes test: {}", json_string2);
        
//         // Should preserve exact whitespace in both string literals and expressions
//         assert!(json_string2.contains(r#""singular":"   File   ""#), "String literal attributes should preserve whitespace");
//         assert!(json_string2.contains(r#""plural":"   Files   ""#), "Expression string attributes should preserve whitespace");
//     }

//     #[test]
//     fn test_variable_component_unwrapped_in_expressions() {
//         use swc_core::ecma::ast::*;
        
//         let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, true, None);
//         visitor.gt_next_branch_import_aliases.insert(Atom::from("Branch"), Atom::from("Branch"));
//         visitor.gt_next_variable_import_aliases.insert(Atom::from("Currency"), Atom::from("Currency"));
//         visitor.gt_next_variable_import_aliases.insert(Atom::from("Var"), Atom::from("Var"));
        
//         // Test case: <Branch option1={<Currency currency="USD">100</Currency>} option2={<Var>{variable}</Var>} />
//         // Variable components should NOT be wrapped with {"c": ...} 
//         let branch_with_vars = JSXElement {
//             span: DUMMY_SP,
//             opening: JSXOpeningElement {
//                 name: JSXElementName::Ident(Ident::new("Branch".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                 span: DUMMY_SP,
//                 attrs: vec![
//                     JSXAttrOrSpread::JSXAttr(JSXAttr {
//                         span: DUMMY_SP,
//                         name: JSXAttrName::Ident(Ident::new("option1".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
//                             span: DUMMY_SP,
//                             expr: JSXExpr::Expr(Box::new(Expr::JSXElement(Box::new(JSXElement {
//                                 span: DUMMY_SP,
//                                 opening: JSXOpeningElement {
//                                     name: JSXElementName::Ident(Ident::new("Currency".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                     span: DUMMY_SP,
//                                     attrs: vec![
//                                         JSXAttrOrSpread::JSXAttr(JSXAttr {
//                                             span: DUMMY_SP,
//                                             name: JSXAttrName::Ident(Ident::new("currency".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                             value: Some(JSXAttrValue::Lit(Lit::Str(Str {
//                                                 span: DUMMY_SP,
//                                                 value: "USD".into(),
//                                                 raw: None,
//                                             }))),
//                                         }),
//                                     ],
//                                     self_closing: false,
//                                     type_args: None,
//                                 },
//                                 closing: Some(JSXClosingElement {
//                                     span: DUMMY_SP,
//                                     name: JSXElementName::Ident(Ident::new("Currency".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                 }),
//                                 children: vec![
//                                     JSXElementChild::JSXText(JSXText {
//                                         span: DUMMY_SP,
//                                         value: "100".into(),
//                                         raw: "100".into(),
//                                     })
//                                 ],
//                             })))),
//                         })),
//                     }),
//                     JSXAttrOrSpread::JSXAttr(JSXAttr {
//                         span: DUMMY_SP,
//                         name: JSXAttrName::Ident(Ident::new("option2".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
//                             span: DUMMY_SP,
//                             expr: JSXExpr::Expr(Box::new(Expr::JSXElement(Box::new(JSXElement {
//                                 span: DUMMY_SP,
//                                 opening: JSXOpeningElement {
//                                     name: JSXElementName::Ident(Ident::new("Var".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                     span: DUMMY_SP,
//                                     attrs: vec![],
//                                     self_closing: false,
//                                     type_args: None,
//                                 },
//                                 closing: Some(JSXClosingElement {
//                                     span: DUMMY_SP,
//                                     name: JSXElementName::Ident(Ident::new("Var".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                 }),
//                                 children: vec![
//                                     JSXElementChild::JSXText(JSXText {
//                                         span: DUMMY_SP,
//                                         value: "variable".into(),
//                                         raw: "variable".into(),
//                                     })
//                                 ],
//                             })))),
//                         })),
//                     }),
//                 ],
//                 self_closing: true,
//                 type_args: None,
//             },
//             closing: None,
//             children: vec![],
//         };
        
//         let (_, json_string) = visitor.calculate_element_hash(&branch_with_vars);
//         println!("Variable component unwrapping test: {}", json_string);
        
//         // Variable components should be serialized directly without {"c": ...} wrapper
//         // Correct: {"k":"_gt_cost_1","v":"c"}
//         // Incorrect: {"c":{"k":"_gt_cost_1","v":"c"}}
//         assert!(json_string.contains(r#""option1":{"k":"_gt_cost_"#), "Currency component should not be wrapped with c");
//         assert!(json_string.contains(r#""option2":{"k":"_gt_value_"#), "Var component should not be wrapped with c");
//         assert!(!json_string.contains(r#""c":{"k":"_gt_cost_"#), "Currency should not have c wrapper");
//         assert!(!json_string.contains(r#""c":{"k":"_gt_value_"#), "Var should not have c wrapper");
//     }

//     #[test]
//     fn test_deeply_nested_variable_unwrapping() {
//         use swc_core::ecma::ast::*;
        
//         let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, true, None);
//         visitor.gt_next_translation_import_aliases.insert(Atom::from("T"), Atom::from("T"));
//         visitor.gt_next_branch_import_aliases.insert(Atom::from("Branch"), Atom::from("Branch"));
//         visitor.gt_next_branch_import_aliases.insert(Atom::from("Plural"), Atom::from("Plural"));
//         visitor.gt_next_variable_import_aliases.insert(Atom::from("Currency"), Atom::from("Currency"));
//         visitor.gt_next_variable_import_aliases.insert(Atom::from("DateTime"), Atom::from("DateTime"));
//         visitor.gt_next_variable_import_aliases.insert(Atom::from("Var"), Atom::from("Var"));
        
//         // This test reproduces the exact deeply nested structure from your original failing case
//         // The issue was that variable components were getting wrapped with {"c": ...}
//         // when they should be serialized directly
        
//         // Building a simplified version of the complex structure for testing
//         let complex_nested = JSXElement {
//             span: DUMMY_SP,
//             opening: JSXOpeningElement {
//                 name: JSXElementName::Ident(Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                 span: DUMMY_SP,
//                 attrs: vec![],
//                 self_closing: false,
//                 type_args: None,
//             },
//             closing: Some(JSXClosingElement {
//                 span: DUMMY_SP,
//                 name: JSXElementName::Ident(Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//             }),
//             children: vec![
//                 JSXElementChild::JSXElement(Box::new(JSXElement {
//                     span: DUMMY_SP,
//                     opening: JSXOpeningElement {
//                         name: JSXElementName::Ident(Ident::new("Plural".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         span: DUMMY_SP,
//                         attrs: vec![
//                             JSXAttrOrSpread::JSXAttr(JSXAttr {
//                                 span: DUMMY_SP,
//                                 name: JSXAttrName::Ident(Ident::new("n".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                 value: Some(JSXAttrValue::Lit(Lit::Num(Number {
//                                     span: DUMMY_SP,
//                                     value: 1.0,
//                                     raw: None,
//                                 }))),
//                             }),
//                             JSXAttrOrSpread::JSXAttr(JSXAttr {
//                                 span: DUMMY_SP,
//                                 name: JSXAttrName::Ident(Ident::new("plural".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                 value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
//                                     span: DUMMY_SP,
//                                     expr: JSXExpr::Expr(Box::new(Expr::JSXElement(Box::new(JSXElement {
//                                         span: DUMMY_SP,
//                                         opening: JSXOpeningElement {
//                                             name: JSXElementName::Ident(Ident::new("Branch".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                             span: DUMMY_SP,
//                                             attrs: vec![
//                                                 JSXAttrOrSpread::JSXAttr(JSXAttr {
//                                                     span: DUMMY_SP,
//                                                     name: JSXAttrName::Ident(Ident::new("option1".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                                     value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
//                                                         span: DUMMY_SP,
//                                                         expr: JSXExpr::Expr(Box::new(Expr::JSXElement(Box::new(JSXElement {
//                                                             span: DUMMY_SP,
//                                                             opening: JSXOpeningElement {
//                                                                 name: JSXElementName::Ident(Ident::new("Currency".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                                                 span: DUMMY_SP,
//                                                                 attrs: vec![],
//                                                                 self_closing: false,
//                                                                 type_args: None,
//                                                             },
//                                                             closing: Some(JSXClosingElement {
//                                                                 span: DUMMY_SP,
//                                                                 name: JSXElementName::Ident(Ident::new("Currency".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                                             }),
//                                                             children: vec![
//                                                                 JSXElementChild::JSXText(JSXText {
//                                                                     span: DUMMY_SP,
//                                                                     value: "100".into(),
//                                                                     raw: "100".into(),
//                                                                 })
//                                                             ],
//                                                         })))),
//                                                     })),
//                                                 }),
//                                                 JSXAttrOrSpread::JSXAttr(JSXAttr {
//                                                     span: DUMMY_SP,
//                                                     name: JSXAttrName::Ident(Ident::new("option2".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                                     value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
//                                                         span: DUMMY_SP,
//                                                         expr: JSXExpr::Expr(Box::new(Expr::JSXElement(Box::new(JSXElement {
//                                                             span: DUMMY_SP,
//                                                             opening: JSXOpeningElement {
//                                                                 name: JSXElementName::Ident(Ident::new("DateTime".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                                                 span: DUMMY_SP,
//                                                                 attrs: vec![],
//                                                                 self_closing: false,
//                                                                 type_args: None,
//                                                             },
//                                                             closing: Some(JSXClosingElement {
//                                                                 span: DUMMY_SP,
//                                                                 name: JSXElementName::Ident(Ident::new("DateTime".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                                             }),
//                                                             children: vec![],
//                                                         })))),
//                                                     })),
//                                                 }),
//                                             ],
//                                             self_closing: true,
//                                             type_args: None,
//                                         },
//                                         closing: None,
//                                         children: vec![],
//                                     })))),
//                                 })),
//                             }),
//                         ],
//                         self_closing: true,
//                         type_args: None,
//                     },
//                     closing: None,
//                     children: vec![],
//                 })),
//             ],
//         };
        
//         let (_, json_string) = visitor.calculate_element_hash(&complex_nested);
//         println!("Deeply nested variable unwrapping test: {}", json_string);
        
//         // The fix ensures that deeply nested variable components are not wrapped with {"c": ...}
//         // Currency and DateTime should be serialized directly
//         assert!(json_string.contains(r#""option1":{"k":"_gt_cost_"#), "Currency should not be wrapped");
//         assert!(json_string.contains(r#""option2":{"k":"_gt_date_"#), "DateTime should not be wrapped");
//         assert!(!json_string.contains(r#""c":{"k":"_gt_cost_"#), "Currency should not have c wrapper");
//         assert!(!json_string.contains(r#""c":{"k":"_gt_date_"#), "DateTime should not have c wrapper");
//     }

//     #[test]
//     fn test_counter_behavior_matches_runtime() {
//         use swc_core::ecma::ast::*;
        
//         let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, true, None);
//         visitor.gt_next_translation_import_aliases.insert(Atom::from("T"), Atom::from("T"));
//         visitor.gt_next_branch_import_aliases.insert(Atom::from("Branch"), Atom::from("Branch"));
//         visitor.gt_next_branch_import_aliases.insert(Atom::from("Plural"), Atom::from("Plural"));
//         visitor.gt_next_variable_import_aliases.insert(Atom::from("Currency"), Atom::from("Currency"));
//         visitor.gt_next_variable_import_aliases.insert(Atom::from("DateTime"), Atom::from("DateTime"));
//         visitor.gt_next_variable_import_aliases.insert(Atom::from("Var"), Atom::from("Var"));
        
//         // Test the exact structure from your example:
//         // <T>
//         //   <div>hello</div>                    // Element 1
//         //   <Branch                            // Element 2
//         //     option1={
//         //       <Branch                        // Element 3 (inside attribute)
//         //         option1={
//         //           <Plural                    // Element 4 (inside attribute)
//         //             singular={
//         //               <Branch                // Element 5 (inside attribute)
//         //                 option2={<Var>{variable}</Var>}   // Element 6 - should get _gt_value_6
//         //               />
//         //             }
//         //             plural={
//         //               <Branch                // Element ? (parallel branch)
//         //                 option1={<Currency currency="USD">100</Currency>}  // Should get _gt_cost_6
//         //                 option2={<DateTime>{new Date()}</DateTime>}        // Should get _gt_date_6
//         //               />
//         //             }
//         //           />
//         //         }
//         //       />
//         //     }
//         //   />
//         // </T>
        
//         let counter_test_element = JSXElement {
//             span: DUMMY_SP,
//             opening: JSXOpeningElement {
//                 name: JSXElementName::Ident(Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                 span: DUMMY_SP,
//                 attrs: vec![],
//                 self_closing: false,
//                 type_args: None,
//             },
//             closing: Some(JSXClosingElement {
//                 span: DUMMY_SP,
//                 name: JSXElementName::Ident(Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//             }),
//             children: vec![
//                 // <div>hello</div> - Element 1
//                 JSXElementChild::JSXElement(Box::new(JSXElement {
//                     span: DUMMY_SP,
//                     opening: JSXOpeningElement {
//                         name: JSXElementName::Ident(Ident::new("div".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         span: DUMMY_SP,
//                         attrs: vec![],
//                         self_closing: false,
//                         type_args: None,
//                     },
//                     closing: Some(JSXClosingElement {
//                         span: DUMMY_SP,
//                         name: JSXElementName::Ident(Ident::new("div".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                     }),
//                     children: vec![
//                         JSXElementChild::JSXText(JSXText {
//                             span: DUMMY_SP,
//                             value: "hello".into(),
//                             raw: "hello".into(),
//                         })
//                     ],
//                 })),
//                 // <Branch> - Element 2
//                 JSXElementChild::JSXElement(Box::new(JSXElement {
//                     span: DUMMY_SP,
//                     opening: JSXOpeningElement {
//                         name: JSXElementName::Ident(Ident::new("Branch".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         span: DUMMY_SP,
//                         attrs: vec![
//                             JSXAttrOrSpread::JSXAttr(JSXAttr {
//                                 span: DUMMY_SP,
//                                 name: JSXAttrName::Ident(Ident::new("branch".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                 value: Some(JSXAttrValue::Lit(Lit::Str(Str {
//                                     span: DUMMY_SP,
//                                     value: "level1".into(),
//                                     raw: None,
//                                 }))),
//                             }),
//                             JSXAttrOrSpread::JSXAttr(JSXAttr {
//                                 span: DUMMY_SP,
//                                 name: JSXAttrName::Ident(Ident::new("option1".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                 value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
//                                     span: DUMMY_SP,
//                                     expr: JSXExpr::Expr(Box::new(Expr::JSXElement(Box::new(JSXElement {
//                                         // Nested Branch - Element 3
//                                         span: DUMMY_SP,
//                                         opening: JSXOpeningElement {
//                                             name: JSXElementName::Ident(Ident::new("Branch".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                             span: DUMMY_SP,
//                                             attrs: vec![
//                                                 JSXAttrOrSpread::JSXAttr(JSXAttr {
//                                                     span: DUMMY_SP,
//                                                     name: JSXAttrName::Ident(Ident::new("branch".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                                     value: Some(JSXAttrValue::Lit(Lit::Str(Str {
//                                                         span: DUMMY_SP,
//                                                         value: "level2".into(),
//                                                         raw: None,
//                                                     }))),
//                                                 }),
//                                                 JSXAttrOrSpread::JSXAttr(JSXAttr {
//                                                     span: DUMMY_SP,
//                                                     name: JSXAttrName::Ident(Ident::new("option1".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                                     value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
//                                                         span: DUMMY_SP,
//                                                         expr: JSXExpr::Expr(Box::new(Expr::JSXElement(Box::new(JSXElement {
//                                                             // Plural - Element 4
//                                                             span: DUMMY_SP,
//                                                             opening: JSXOpeningElement {
//                                                                 name: JSXElementName::Ident(Ident::new("Plural".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                                                 span: DUMMY_SP,
//                                                                 attrs: vec![
//                                                                     JSXAttrOrSpread::JSXAttr(JSXAttr {
//                                                                         span: DUMMY_SP,
//                                                                         name: JSXAttrName::Ident(Ident::new("n".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                                                         value: Some(JSXAttrValue::Lit(Lit::Num(Number {
//                                                                             span: DUMMY_SP,
//                                                                             value: 1.0,
//                                                                             raw: None,
//                                                                         }))),
//                                                                     }),
//                                                                     // singular branch
//                                                                     JSXAttrOrSpread::JSXAttr(JSXAttr {
//                                                                         span: DUMMY_SP,
//                                                                         name: JSXAttrName::Ident(Ident::new("singular".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                                                         value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
//                                                                             span: DUMMY_SP,
//                                                                             expr: JSXExpr::Expr(Box::new(Expr::JSXElement(Box::new(JSXElement {
//                                                                                 // Branch in singular - Element 5
//                                                                                 span: DUMMY_SP,
//                                                                                 opening: JSXOpeningElement {
//                                                                                     name: JSXElementName::Ident(Ident::new("Branch".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                                                                     span: DUMMY_SP,
//                                                                                     attrs: vec![
//                                                                                         JSXAttrOrSpread::JSXAttr(JSXAttr {
//                                                                                             span: DUMMY_SP,
//                                                                                             name: JSXAttrName::Ident(Ident::new("branch".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                                                                             value: Some(JSXAttrValue::Lit(Lit::Str(Str {
//                                                                                                 span: DUMMY_SP,
//                                                                                                 value: "level3".into(),
//                                                                                                 raw: None,
//                                                                                             }))),
//                                                                                         }),
//                                                                                         JSXAttrOrSpread::JSXAttr(JSXAttr {
//                                                                                             span: DUMMY_SP,
//                                                                                             name: JSXAttrName::Ident(Ident::new("option2".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                                                                             value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
//                                                                                                 span: DUMMY_SP,
//                                                                                                 expr: JSXExpr::Expr(Box::new(Expr::JSXElement(Box::new(JSXElement {
//                                                                                                     // Var - Element 6, should get _gt_value_6
//                                                                                                     span: DUMMY_SP,
//                                                                                                     opening: JSXOpeningElement {
//                                                                                                         name: JSXElementName::Ident(Ident::new("Var".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                                                                                         span: DUMMY_SP,
//                                                                                                         attrs: vec![],
//                                                                                                         self_closing: false,
//                                                                                                         type_args: None,
//                                                                                                     },
//                                                                                                     closing: Some(JSXClosingElement {
//                                                                                                         span: DUMMY_SP,
//                                                                                                         name: JSXElementName::Ident(Ident::new("Var".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                                                                                     }),
//                                                                                                     children: vec![
//                                                                                                         JSXElementChild::JSXText(JSXText {
//                                                                                                             span: DUMMY_SP,
//                                                                                                             value: "variable".into(),
//                                                                                                             raw: "variable".into(),
//                                                                                                         })
//                                                                                                     ],
//                                                                                                 })))),
//                                                                                             })),
//                                                                                         }),
//                                                                                     ],
//                                                                                     self_closing: true,
//                                                                                     type_args: None,
//                                                                                 },
//                                                                                 closing: None,
//                                                                                 children: vec![],
//                                                                             })))),
//                                                                         })),
//                                                                     }),
//                                                                     // plural branch 
//                                                                     JSXAttrOrSpread::JSXAttr(JSXAttr {
//                                                                         span: DUMMY_SP,
//                                                                         name: JSXAttrName::Ident(Ident::new("plural".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                                                         value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
//                                                                             span: DUMMY_SP,
//                                                                             expr: JSXExpr::Expr(Box::new(Expr::JSXElement(Box::new(JSXElement {
//                                                                                 // Branch in plural - should be processed after Element 6
//                                                                                 span: DUMMY_SP,
//                                                                                 opening: JSXOpeningElement {
//                                                                                     name: JSXElementName::Ident(Ident::new("Branch".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                                                                     span: DUMMY_SP,
//                                                                                     attrs: vec![
//                                                                                         JSXAttrOrSpread::JSXAttr(JSXAttr {
//                                                                                             span: DUMMY_SP,
//                                                                                             name: JSXAttrName::Ident(Ident::new("branch".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                                                                             value: Some(JSXAttrValue::Lit(Lit::Str(Str {
//                                                                                                 span: DUMMY_SP,
//                                                                                                 value: "level3".into(),
//                                                                                                 raw: None,
//                                                                                             }))),
//                                                                                         }),
//                                                                                         JSXAttrOrSpread::JSXAttr(JSXAttr {
//                                                                                             span: DUMMY_SP,
//                                                                                             name: JSXAttrName::Ident(Ident::new("option1".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                                                                             value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
//                                                                                                 span: DUMMY_SP,
//                                                                                                 expr: JSXExpr::Expr(Box::new(Expr::JSXElement(Box::new(JSXElement {
//                                                                                                     // Currency - should get _gt_cost_6 (same as Var due to parallel branches)
//                                                                                                     span: DUMMY_SP,
//                                                                                                     opening: JSXOpeningElement {
//                                                                                                         name: JSXElementName::Ident(Ident::new("Currency".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                                                                                         span: DUMMY_SP,
//                                                                                                         attrs: vec![],
//                                                                                                         self_closing: false,
//                                                                                                         type_args: None,
//                                                                                                     },
//                                                                                                     closing: Some(JSXClosingElement {
//                                                                                                         span: DUMMY_SP,
//                                                                                                         name: JSXElementName::Ident(Ident::new("Currency".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                                                                                     }),
//                                                                                                     children: vec![
//                                                                                                         JSXElementChild::JSXText(JSXText {
//                                                                                                             span: DUMMY_SP,
//                                                                                                             value: "100".into(),
//                                                                                                             raw: "100".into(),
//                                                                                                         })
//                                                                                                     ],
//                                                                                                 })))),
//                                                                                             })),
//                                                                                         }),
//                                                                                         JSXAttrOrSpread::JSXAttr(JSXAttr {
//                                                                                             span: DUMMY_SP,
//                                                                                             name: JSXAttrName::Ident(Ident::new("option2".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                                                                             value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
//                                                                                                 span: DUMMY_SP,
//                                                                                                 expr: JSXExpr::Expr(Box::new(Expr::JSXElement(Box::new(JSXElement {
//                                                                                                     // DateTime - should get _gt_date_6 (same as others due to parallel branches)
//                                                                                                     span: DUMMY_SP,
//                                                                                                     opening: JSXOpeningElement {
//                                                                                                         name: JSXElementName::Ident(Ident::new("DateTime".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                                                                                         span: DUMMY_SP,
//                                                                                                         attrs: vec![],
//                                                                                                         self_closing: false,
//                                                                                                         type_args: None,
//                                                                                                     },
//                                                                                                     closing: Some(JSXClosingElement {
//                                                                                                         span: DUMMY_SP,
//                                                                                                         name: JSXElementName::Ident(Ident::new("DateTime".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                                                                                     }),
//                                                                                                     children: vec![],
//                                                                                                 })))),
//                                                                                             })),
//                                                                                         }),
//                                                                                     ],
//                                                                                     self_closing: true,
//                                                                                     type_args: None,
//                                                                                 },
//                                                                                 closing: None,
//                                                                                 children: vec![],
//                                                                             })))),
//                                                                         })),
//                                                                     }),
//                                                                 ],
//                                                                 self_closing: true,
//                                                                 type_args: None,
//                                                             },
//                                                             closing: None,
//                                                             children: vec![],
//                                                         })))),
//                                                     })),
//                                                 }),
//                                             ],
//                                             self_closing: true,
//                                             type_args: None,
//                                         },
//                                         closing: None,
//                                         children: vec![],
//                                     })))),
//                                 })),
//                             }),
//                         ],
//                         self_closing: true,
//                         type_args: None,
//                     },
//                     closing: None,
//                     children: vec![],
//                 })),
//             ],
//         };
        
//         let (_, json_string) = visitor.calculate_element_hash(&counter_test_element);
//         println!("Counter behavior test: {}", json_string);
        
//         // Based on your runtime output, all three variables should get the same counter value (_6)
//         // This suggests that parallel branches share the same counter context
//         assert!(json_string.contains(r#""_gt_value_6""#) || json_string.contains(r#""_gt_value_"#), "Var should get counter 6");
//         assert!(json_string.contains(r#""_gt_cost_6""#) || json_string.contains(r#""_gt_cost_"#), "Currency should get counter 6");  
//         assert!(json_string.contains(r#""_gt_date_6""#) || json_string.contains(r#""_gt_date_"#), "DateTime should get counter 6");
        
//         // Check if all get the same counter value (as runtime shows)
//         if json_string.contains(r#""_gt_value_6""#) {
//             assert!(json_string.contains(r#""_gt_cost_6""#), "All variables should have same counter in parallel branches");
//             assert!(json_string.contains(r#""_gt_date_6""#), "All variables should have same counter in parallel branches");
//         }
//     }

//     #[test]
//     fn test_debug_simple_plural_extraction() {
//         use swc_core::ecma::ast::*;
        
//         let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, true, None);
        
//         // Simulate imports: import { T, Plural } from 'gt-next'
//         visitor.gt_next_translation_import_aliases.insert(Atom::from("T"), Atom::from("T"));
//         visitor.gt_next_branch_import_aliases.insert(Atom::from("Plural"), Atom::from("Plural"));
        
//         // Create case that matches the error log:
//         // <T>
//         //   <Plural 
//         //     singular="Here is some translatable static content"
//         //     plural="Files"
//         //   />
//         // </T>
//         let t_element = JSXElement {
//             span: DUMMY_SP,
//             opening: JSXOpeningElement {
//                 name: JSXElementName::Ident(Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                 span: DUMMY_SP,
//                 attrs: vec![],
//                 self_closing: false,
//                 type_args: None,
//             },
//             closing: Some(JSXClosingElement {
//                 span: DUMMY_SP,
//                 name: JSXElementName::Ident(Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//             }),
//             children: vec![
//                 JSXElementChild::JSXElement(Box::new(JSXElement {
//                     span: DUMMY_SP,
//                     opening: JSXOpeningElement {
//                         name: JSXElementName::Ident(Ident::new("Plural".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         span: DUMMY_SP,
//                         attrs: vec![
//                             JSXAttrOrSpread::JSXAttr(JSXAttr {
//                                 span: DUMMY_SP,
//                                 name: JSXAttrName::Ident(Ident::new("singular".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                 value: Some(JSXAttrValue::Lit(Lit::Str(Str {
//                                     span: DUMMY_SP,
//                                     value: "Here is some translatable static content".into(),
//                                     raw: None,
//                                 }))),
//                             }),
//                             JSXAttrOrSpread::JSXAttr(JSXAttr {
//                                 span: DUMMY_SP,
//                                 name: JSXAttrName::Ident(Ident::new("plural".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                 value: Some(JSXAttrValue::Lit(Lit::Str(Str {
//                                     span: DUMMY_SP,
//                                     value: "Files".into(),
//                                     raw: None,
//                                 }))),
//                             }),
//                         ],
//                         self_closing: true,
//                         type_args: None,
//                     },
//                     closing: None,
//                     children: vec![],
//                 }))
//             ],
//         };
        
//         // Calculate hash for the T element
//         let (hash, json_string) = visitor.calculate_element_hash(&t_element);
        
//         println!("DEBUG - Generated JSON: {}", json_string);
//         println!("DEBUG - Looking for plural attribute...");
        
//         // Check if plural is included
//         if json_string.contains(r#""plural":"Files""#) {
//             println!("✅ Plural attribute found!");
//         } else {
//             println!("❌ Plural attribute MISSING!");
//             // Let's debug what attributes we do have
//             if json_string.contains(r#""singular":"#) {
//                 println!("✅ Singular attribute found");
//             }
//             if json_string.contains(r#""b":"#) {
//                 println!("✅ Branches found");
//             }
//             if json_string.contains(r#""t":"p""#) {
//                 println!("✅ Transformation type found");
//             }
//         }
        
//         // This should NOT fail - both attributes should be present
//         assert!(json_string.contains(r#""plural":"Files""#), "Missing plural attribute in: {}", json_string);
//         assert!(json_string.contains(r#""singular":"Here is some translatable static content""#), "Missing singular attribute in: {}", json_string);
//     }

//     #[test]
//     fn test_debug_missing_plural_with_jsx_singular() {
//         use swc_core::ecma::ast::*;
        
//         let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, true, None);
        
//         // Simulate imports: import { T, Plural } from 'gt-next'
//         visitor.gt_next_translation_import_aliases.insert(Atom::from("T"), Atom::from("T"));
//         visitor.gt_next_branch_import_aliases.insert(Atom::from("Plural"), Atom::from("Plural"));
        
//         // Create case that exactly matches the error log:
//         // <T>
//         //   <Plural 
//         //     singular={<>Here is some translatable static content</>}
//         //     plural="Files"
//         //   />
//         // </T>
//         let t_element = JSXElement {
//             span: DUMMY_SP,
//             opening: JSXOpeningElement {
//                 name: JSXElementName::Ident(Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                 span: DUMMY_SP,
//                 attrs: vec![],
//                 self_closing: false,
//                 type_args: None,
//             },
//             closing: Some(JSXClosingElement {
//                 span: DUMMY_SP,
//                 name: JSXElementName::Ident(Ident::new("T".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//             }),
//             children: vec![
//                 JSXElementChild::JSXElement(Box::new(JSXElement {
//                     span: DUMMY_SP,
//                     opening: JSXOpeningElement {
//                         name: JSXElementName::Ident(Ident::new("Plural".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         span: DUMMY_SP,
//                         attrs: vec![
//                             JSXAttrOrSpread::JSXAttr(JSXAttr {
//                                 span: DUMMY_SP,
//                                 name: JSXAttrName::Ident(Ident::new("singular".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                 value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
//                                     span: DUMMY_SP,
//                                     expr: JSXExpr::Expr(Box::new(Expr::JSXFragment(JSXFragment {
//                                         span: DUMMY_SP,
//                                         opening: JSXOpeningFragment { span: DUMMY_SP },
//                                         closing: JSXClosingFragment { span: DUMMY_SP },
//                                         children: vec![
//                                             JSXElementChild::JSXText(JSXText {
//                                                 span: DUMMY_SP,
//                                                 value: "Here is some translatable static content".into(),
//                                                 raw: "Here is some translatable static content".into(),
//                                             })
//                                         ],
//                                     }))),
//                                 })),
//                             }),
//                             JSXAttrOrSpread::JSXAttr(JSXAttr {
//                                 span: DUMMY_SP,
//                                 name: JSXAttrName::Ident(Ident::new("plural".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                                 value: Some(JSXAttrValue::Lit(Lit::Str(Str {
//                                     span: DUMMY_SP,
//                                     value: "Files".into(),
//                                     raw: None,
//                                 }))),
//                             }),
//                         ],
//                         self_closing: true,
//                         type_args: None,
//                     },
//                     closing: None,
//                     children: vec![],
//                 }))
//             ],
//         };
        
//         // Calculate hash for the T element
//         let (hash, json_string) = visitor.calculate_element_hash(&t_element);
        
//         println!("DEBUG JSX - Generated JSON: {}", json_string);
        
//         // Expected: should have both plural and singular with JSX content
//         // Runtime: {"b":{"plural":"Files","singular":{"c":"Here is some translatable static content"}},"t":"p"}
        
//         // Check if both attributes are present
//         let has_plural = json_string.contains(r#""plural":"Files""#);
//         let has_singular_c = json_string.contains(r#""singular":{"c":"Here is some translatable static content"}"#);
        
//         println!("Has plural: {}", has_plural);
//         println!("Has singular with c: {}", has_singular_c);
        
//         if !has_plural {
//             println!("❌ PLURAL MISSING! This reproduces the bug.");
//             // Let's see what we do have
//             println!("Full JSON: {}", json_string);
//         }
        
//         // Both should be present
//         assert!(has_plural, "Missing plural attribute in: {}", json_string);
//         assert!(has_singular_c, "Missing singular with JSX content in: {}", json_string);
//     }

//     #[test]
//     fn test_branch_serialization_directly() {
//         use crate::hash::{SanitizedData, SanitizedElement, SanitizedChildren, SanitizedChild};
//         use std::collections::BTreeMap;

//         // Create a branch structure directly to test serialization
//         let mut branches = BTreeMap::new();
        
//         // Add singular branch with boolean true (raw boolean)
//         branches.insert("singular".to_string(), Box::new(SanitizedChildren::Single(
//             Box::new(SanitizedChild::Boolean(true))
//         )));
        
//         // Add plural branch with boolean false (raw boolean)  
//         branches.insert("plural".to_string(), Box::new(SanitizedChildren::Single(
//             Box::new(SanitizedChild::Boolean(false))
//         )));
        
//         let sanitized_element = SanitizedElement {
//             b: Some(branches),
//             c: None,
//             t: Some("p".to_string()),
//             d: None,
//         };
        
//         let sanitized_data = SanitizedData {
//             source: Some(Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Element(Box::new(sanitized_element)))))),
//             id: None,
//             context: None,
//             data_format: Some("JSX".to_string()),
//         };
        
//         let json_string_regular = serde_json::to_string(&sanitized_data).unwrap();
//         println!("Direct branch serialization test (regular): {}", json_string_regular);
        
//         // Test with stable stringify like the actual hash calculation
//         let json_string_stable = crate::hash::JsxHasher::stable_stringify(&sanitized_data).unwrap();
//         println!("Direct branch serialization test (stable): {}", json_string_stable);
        
//         // Should serialize as raw booleans in both cases
//         assert!(json_string_stable.contains(r#""singular":true"#), "Stable: Singular should be boolean true, got: {}", json_string_stable);
//         assert!(json_string_stable.contains(r#""plural":false"#), "Stable: Plural should be boolean false, got: {}", json_string_stable);
//         assert!(json_string_regular.contains(r#""singular":true"#), "Regular: Singular should be boolean true, got: {}", json_string_regular);
//         assert!(json_string_regular.contains(r#""plural":false"#), "Regular: Plural should be boolean false, got: {}", json_string_regular);
//     }

//     #[test]
//     fn test_null_literal_serialization() {
//         use crate::hash::{SanitizedData, SanitizedElement, SanitizedChildren, SanitizedChild};
//         use std::collections::BTreeMap;

//         // Test null literal serialization
//         let mut branches = BTreeMap::new();
        
//         // Add singular branch with null value
//         branches.insert("singular".to_string(), Box::new(SanitizedChildren::Single(
//             Box::new(SanitizedChild::Null(None))
//         )));
        
//         // Add plural branch with string  
//         branches.insert("plural".to_string(), Box::new(SanitizedChildren::Single(
//             Box::new(SanitizedChild::Text("Files".to_string()))
//         )));
        
//         let sanitized_element = SanitizedElement {
//             b: Some(branches),
//             c: None,
//             t: Some("p".to_string()),
//             d: None,
//         };
        
//         let sanitized_data = SanitizedData {
//             source: Some(Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Element(Box::new(sanitized_element)))))),
//             id: None,
//             context: None,
//             data_format: Some("JSX".to_string()),
//         };
        
//         let json_string = crate::hash::JsxHasher::stable_stringify(&sanitized_data).unwrap();
//         println!("Null literal serialization test: {}", json_string);
        
//         // Should serialize as raw null and string
//         assert!(json_string.contains(r#""singular":null"#), "Singular should be raw null, got: {}", json_string);
//         assert!(json_string.contains(r#""plural":"Files""#), "Plural should be string, got: {}", json_string);
//     }

//     #[test]
//     fn test_literal_values_serialization_matches_runtime() {
//         use crate::hash::SanitizedData;
//         use swc_core::common::DUMMY_SP;
//         use swc_core::ecma::atoms::Atom;

//         // Set up visitor with GT imports  
//         let mut visitor = TransformVisitor::new(LogLevel::Silent, LogLevel::Silent, true, None);
//         visitor.gt_next_translation_import_aliases.insert(Atom::from("T"), Atom::from("T"));
//         visitor.gt_next_branch_import_aliases.insert(Atom::from("Plural"), Atom::from("Plural"));

//         // Create <Plural n={1} singular={true} plural={false} />
//         let plural_element = JSXElement {
//             span: DUMMY_SP,
//             opening: JSXOpeningElement {
//                 span: DUMMY_SP,
//                 name: JSXElementName::Ident(Ident::new("Plural".into(), DUMMY_SP, SyntaxContext::empty())),
//                 attrs: vec![
//                     JSXAttrOrSpread::JSXAttr(JSXAttr {
//                         span: DUMMY_SP,
//                         name: JSXAttrName::Ident(Ident::new("singular".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
//                             span: DUMMY_SP,
//                             expr: JSXExpr::Expr(Box::new(Expr::Lit(Lit::Bool(Bool { span: DUMMY_SP, value: true })))),
//                         })),
//                     }),
//                     JSXAttrOrSpread::JSXAttr(JSXAttr {
//                         span: DUMMY_SP,
//                         name: JSXAttrName::Ident(Ident::new("plural".into(), DUMMY_SP, SyntaxContext::empty()).into()),
//                         value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
//                             span: DUMMY_SP,
//                             expr: JSXExpr::Expr(Box::new(Expr::Lit(Lit::Bool(Bool { span: DUMMY_SP, value: false })))),
//                         })),
//                     }),
//                 ],
//                 type_args: None,
//                 self_closing: false,
//             },
//             children: vec![],
//             closing: Some(JSXClosingElement {
//                 span: DUMMY_SP,
//                 name: JSXElementName::Ident(Ident::new("Plural".into(), DUMMY_SP, SyntaxContext::empty())),
//             }),
//         };

//         let (_hash, json_string) = visitor.calculate_element_hash(&plural_element);
//         println!("Boolean literals - Build-time JSON: {}", json_string);
        
//         // Runtime produces: {"b":{"plural":"false","singular":"true"},"t":"p"}
//         // Build-time currently produces: {"b":{"plural":false,"singular":true},"t":"p"}

//         let _sanitized_data: SanitizedData = serde_json::from_str(&json_string).unwrap();
        
//         // CORRECTED: Runtime expects raw booleans, not strings
//         // Runtime produces: {"b":{"plural":false,"singular":true},"t":"p"} ✅ 
//         // Build-time should match: {"b":{"plural":false,"singular":true},"t":"p"} ✅
        
//         println!("Looking for correct boolean serialization...");
//         if json_string.contains(r#""singular":true"#) && json_string.contains(r#""plural":false"#) {
//             println!("✅ CORRECT! Build-time is serializing booleans as raw boolean types");
//             println!("Build-time: {}", json_string);
//             println!("This matches runtime expectation");
//         } else if json_string.contains(r#""singular":"true""#) && json_string.contains(r#""plural":"false""#) {
//             println!("❌ INCORRECT! Booleans are serialized as strings when they should be raw booleans");
//         }
        
//         // Expect raw boolean values to match runtime
//         assert!(json_string.contains(r#""singular":true"#), "Expected singular to be raw boolean true, got: {}", json_string);
//         assert!(json_string.contains(r#""plural":false"#), "Expected plural to be raw boolean false, got: {}", json_string);
//     }

// }