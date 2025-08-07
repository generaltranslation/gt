use serde::{Serialize, Deserialize};
use sha2::{Sha256, Digest};
use std::collections::BTreeMap;

/// Variable types matching the TypeScript definition
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum VariableType {
    #[serde(rename = "v")]
    Variable, // Variable
    #[serde(rename = "n")]
    Number,   // Number
    #[serde(rename = "d")]
    Date,     // Date
    #[serde(rename = "c")]
    Currency, // Currency
}

/// Variables are used to store the variable name and type
#[derive(Serialize, Debug, Clone, PartialEq)]
pub struct Variable {
    pub k: String, // key
    #[serde(skip_serializing_if = "Option::is_none")]
    pub i: Option<i32>, // id
    #[serde(skip_serializing_if = "Option::is_none")]
    pub v: Option<VariableType>, // variable type
}

/// Map of data-_gt properties to their corresponding React props
#[derive(Serialize, Debug, Clone, PartialEq)]
pub struct HtmlContentProps {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pl: Option<String>, // placeholder
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ti: Option<String>, // title
    #[serde(skip_serializing_if = "Option::is_none")]
    pub alt: Option<String>, // alt
    #[serde(skip_serializing_if = "Option::is_none")]
    pub arl: Option<String>, // aria-label
    #[serde(skip_serializing_if = "Option::is_none")]
    pub arb: Option<String>, // aria-labelledby
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ard: Option<String>, // aria-describedby
}

/// GTProp is an internal property used to contain data for translating and rendering elements
#[derive(Serialize, Debug, Clone, PartialEq)]
pub struct GtProp {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub b: Option<BTreeMap<String, Box<JsxChildren>>>, // Branches
    #[serde(skip_serializing_if = "Option::is_none")]
    pub t: Option<String>, // Branch Transformation ('p' for plural, 'b' for branch)
    #[serde(flatten)]
    pub html_props: HtmlContentProps, // HTML content properties
}

/// JSX Element representation matching the TypeScript definition
#[derive(Serialize, Debug, Clone, PartialEq)]
pub struct JsxElement {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub t: Option<String>, // tag name
    #[serde(skip_serializing_if = "Option::is_none")]
    pub i: Option<i32>, // id
    #[serde(skip_serializing_if = "Option::is_none")]
    pub d: Option<GtProp>, // GT data
    #[serde(skip_serializing_if = "Option::is_none")]
    pub c: Option<Box<JsxChildren>>, // children
}

/// JSX Child can be text, element, or variable
#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(untagged)]
pub enum JsxChild {
    Text(String),
    Element(Box<JsxElement>),
    Variable(Variable),
}

/// JSX Children can be a single child or array of children
#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(untagged)]
pub enum JsxChildren {
    Single(Box<JsxChild>),
    Multiple(Vec<JsxChild>),
}

/// Sanitized data structure for hashing
#[derive(Serialize, Debug, Clone)]
pub struct SanitizedData {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<Box<JsxChildren>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data_format: Option<String>,
}

/// Hash calculator for JSX content
pub struct JsxHasher;

impl JsxHasher {
    /// Calculate hash for JSX content
    pub fn hash_source(
        source: &JsxChildren,
        context: Option<&str>,
        id: Option<&str>,
        data_format: &str,
    ) -> String {
        let sanitized_data = SanitizedData {
            source: Some(Box::new(Self::sanitize_jsx_children(source))),
            id: id.map(String::from),
            context: context.map(String::from),
            data_format: Some(data_format.to_string()),
        };

        let json_string = serde_json::to_string(&sanitized_data)
            .expect("Failed to serialize sanitized data");
        Self::hash_string(&json_string)
    }

    /// Hash a string using SHA256 and return first 16 hex characters
    pub fn hash_string(input: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(input.as_bytes());
        let result = hasher.finalize();
        format!("{:x}", result)[..16].to_string()
    }

    /// Sanitize JSX children by removing volatile data
    fn sanitize_jsx_children(children: &JsxChildren) -> JsxChildren {
        match children {
            JsxChildren::Single(child) => JsxChildren::Single(Box::new(Self::sanitize_jsx_child(child))),
            JsxChildren::Multiple(children_vec) => {
                JsxChildren::Multiple(
                    children_vec
                        .iter()
                        .map(|child| Self::sanitize_jsx_child(child))
                        .collect()
                )
            }
        }
    }

    /// Sanitize a single JSX child
    fn sanitize_jsx_child(child: &JsxChild) -> JsxChild {
        match child {
            JsxChild::Text(text) => JsxChild::Text(text.clone()),
            JsxChild::Variable(var) => {
                // Remove the 'i' field for sanitization
                JsxChild::Variable(Variable {
                    k: var.k.clone(),
                    i: None, // Remove ID for stable hashing
                    v: var.v.clone(),
                })
            }
            JsxChild::Element(element) => JsxChild::Element(Box::new(Self::sanitize_jsx_element(element))),
        }
    }

    /// Sanitize a JSX element
    fn sanitize_jsx_element(element: &JsxElement) -> JsxElement {
        JsxElement {
            t: element.t.clone(),
            i: None, // Remove ID for stable hashing
            d: element.d.as_ref().map(Self::sanitize_gt_prop),
            c: element.c.as_ref().map(|c| Box::new(Self::sanitize_jsx_children(c))),
        }
    }

    /// Sanitize GT properties
    fn sanitize_gt_prop(gt_prop: &GtProp) -> GtProp {
        GtProp {
            b: gt_prop.b.as_ref().map(|branches| {
                branches
                    .iter()
                    .map(|(key, value)| (key.clone(), Box::new(Self::sanitize_jsx_children(value))))
                    .collect()
            }),
            t: gt_prop.t.clone(),
            html_props: gt_prop.html_props.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_string_consistency() {
        let input = "test string";
        let hash1 = JsxHasher::hash_string(input);
        let hash2 = JsxHasher::hash_string(input);
        
        assert_eq!(hash1, hash2, "Hash should be consistent for same input");
        assert_eq!(hash1.len(), 16, "Hash should be 16 characters long");
        
        // Verify it's hex
        assert!(hash1.chars().all(|c| c.is_ascii_hexdigit()), "Hash should only contain hex characters");
    }

    #[test]
    fn test_hash_string_different_inputs() {
        let hash1 = JsxHasher::hash_string("input1");
        let hash2 = JsxHasher::hash_string("input2");
        
        assert_ne!(hash1, hash2, "Different inputs should produce different hashes");
    }

    #[test]
    fn test_variable_serialization() {
        let variable = Variable {
            k: "name".to_string(),
            i: Some(1),
            v: Some(VariableType::Variable),
        };

        let json = serde_json::to_string(&variable).unwrap();
        println!("Variable JSON: {}", json);
        
        // Should serialize as {"k":"name","i":1,"v":"v"}
        assert!(json.contains(r#""k":"name""#));
        assert!(json.contains(r#""v":"v""#));
    }

    #[test]
    fn test_jsx_child_text() {
        let child = JsxChild::Text("Hello world".to_string());
        let json = serde_json::to_string(&child).unwrap();
        
        assert_eq!(json, r#""Hello world""#);
    }

    #[test]
    fn test_jsx_children_single() {
        let children = JsxChildren::Single(Box::new(JsxChild::Text("Hello".to_string())));
        let json = serde_json::to_string(&children).unwrap();
        
        assert_eq!(json, r#""Hello""#);
    }

    #[test]
    fn test_jsx_children_multiple() {
        let children = JsxChildren::Multiple(vec![
            JsxChild::Text("Hello ".to_string()),
            JsxChild::Variable(Variable {
                k: "name".to_string(),
                i: None,
                v: Some(VariableType::Variable),
            }),
            JsxChild::Text("!".to_string()),
        ]);
        
        let json = serde_json::to_string(&children).unwrap();
        println!("Multiple children JSON: {}", json);
        
        // Should be an array
        assert!(json.starts_with('['));
        assert!(json.ends_with(']'));
        assert!(json.contains(r#""Hello ""#));
        assert!(json.contains(r#""k":"name""#));
    }

    #[test]
    fn test_jsx_element_serialization() {
        let element = JsxElement {
            t: Some("div".to_string()),
            i: Some(1),
            d: None,
            c: Some(Box::new(JsxChildren::Single(Box::new(JsxChild::Text("content".to_string()))))),
        };

        let json = serde_json::to_string(&element).unwrap();
        println!("JsxElement JSON: {}", json);
        
        assert!(json.contains(r#""t":"div""#));
        assert!(json.contains(r#""c":"content""#));
    }

    #[test]
    fn test_sanitization_removes_ids() {
        let element = JsxElement {
            t: Some("div".to_string()),
            i: Some(123), // This should be removed
            d: None,
            c: Some(Box::new(JsxChildren::Single(Box::new(JsxChild::Variable(Variable {
                k: "name".to_string(),
                i: Some(456), // This should also be removed
                v: Some(VariableType::Variable),
            }))))),
        };

        let sanitized = JsxHasher::sanitize_jsx_element(&element);
        
        assert_eq!(sanitized.i, None, "Element ID should be removed");
        if let Some(children_box) = &sanitized.c {
            if let JsxChildren::Single(child_box) = children_box.as_ref() {
                if let JsxChild::Variable(var) = child_box.as_ref() {
                    assert_eq!(var.i, None, "Variable ID should be removed");
                    assert_eq!(var.k, "name", "Variable key should be preserved");
                } else {
                    panic!("Expected variable child");
                }
            } else {
                panic!("Expected single child");
            }
        } else {
            panic!("Expected sanitized children");
        }
    }

    #[test]
    fn test_hash_source_with_simple_text() {
        let children = JsxChildren::Single(Box::new(JsxChild::Text("Hello world".to_string())));
        let hash = JsxHasher::hash_source(&children, None, None, "JSX");
        
        assert_eq!(hash.len(), 16, "Hash should be 16 characters");
        
        // Same input should produce same hash
        let hash2 = JsxHasher::hash_source(&children, None, None, "JSX");
        assert_eq!(hash, hash2, "Same input should produce same hash");
    }

    #[test]
    fn test_hash_source_with_context_and_id() {
        let children = JsxChildren::Single(Box::new(JsxChild::Text("Hello".to_string())));
        
        let hash1 = JsxHasher::hash_source(&children, None, None, "JSX");
        let hash2 = JsxHasher::hash_source(&children, Some("context"), None, "JSX");
        let hash3 = JsxHasher::hash_source(&children, None, Some("id"), "JSX");
        
        // All should be different
        assert_ne!(hash1, hash2, "Context should change hash");
        assert_ne!(hash1, hash3, "ID should change hash");
        assert_ne!(hash2, hash3, "Context and ID should produce different hashes");
    }

    #[test]
    fn test_hash_source_complex_structure() {
        let children = JsxChildren::Multiple(vec![
            JsxChild::Text("Hello ".to_string()),
            JsxChild::Variable(Variable {
                k: "name".to_string(),
                i: Some(999), // This should be sanitized out
                v: Some(VariableType::Variable),
            }),
            JsxChild::Text("!".to_string()),
        ]);

        let hash = JsxHasher::hash_source(&children, None, None, "JSX");
        assert_eq!(hash.len(), 16);
        
        // Create same structure but with different IDs - should hash the same
        let children2 = JsxChildren::Multiple(vec![
            JsxChild::Text("Hello ".to_string()),
            JsxChild::Variable(Variable {
                k: "name".to_string(),
                i: Some(123), // Different ID, but should be sanitized out
                v: Some(VariableType::Variable),
            }),
            JsxChild::Text("!".to_string()),
        ]);

        let hash2 = JsxHasher::hash_source(&children2, None, None, "JSX");
        assert_eq!(hash, hash2, "Different IDs should not affect hash after sanitization");
    }
}