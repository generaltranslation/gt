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


/// Sanitized JSX Element representation (no IDs for stable hashing)
#[derive(Serialize, Debug, Clone, PartialEq)]
pub struct SanitizedElement {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub t: Option<String>, // tag name
    #[serde(skip_serializing_if = "Option::is_none")]
    pub d: Option<SanitizedGtProp>, // GT data
    #[serde(skip_serializing_if = "Option::is_none")]
    pub c: Option<Box<SanitizedChildren>>, // children
}

/// Sanitized GT properties (no volatile data)
#[derive(Serialize, Debug, Clone, PartialEq)]
pub struct SanitizedGtProp {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub b: Option<BTreeMap<String, Box<SanitizedChildren>>>, // Branches
    #[serde(skip_serializing_if = "Option::is_none")]
    pub t: Option<String>, // Branch Transformation ('p' for plural, 'b' for branch)
    #[serde(flatten)]
    pub html_props: HtmlContentProps, // HTML content properties
}

/// Sanitized Variable (no ID for stable hashing)
#[derive(Serialize, Debug, Clone, PartialEq)]
pub struct SanitizedVariable {
    pub k: String, // key
    #[serde(skip_serializing_if = "Option::is_none")]
    pub v: Option<VariableType>, // variable type
}

/// Sanitized JSX Child can be text, element, or variable
#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(untagged)]
pub enum SanitizedChild {
    Text(String),
    Element(Box<SanitizedElement>),
    Variable(SanitizedVariable),
}

/// Sanitized JSX Children can be a single child or array of children
#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(untagged)]
pub enum SanitizedChildren {
    Single(Box<SanitizedChild>),
    Multiple(Vec<SanitizedChild>),
}

/// Sanitized data structure for hashing
#[derive(Serialize, Debug, Clone)]
pub struct SanitizedData {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<Box<SanitizedChildren>>,
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
    /// Calculate hash for sanitized JSX content
    pub fn hash_source(
        source: &SanitizedChildren,
        context: Option<&str>,
        id: Option<&str>,
        data_format: &str,
    ) -> String {
        let sanitized_data = SanitizedData {
            source: Some(Box::new(source.clone())),
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
    fn test_sanitized_variable_serialization() {
        let variable = SanitizedVariable {
            k: "name".to_string(),
            v: Some(VariableType::Variable),
        };

        let json = serde_json::to_string(&variable).unwrap();
        println!("SanitizedVariable JSON: {}", json);
        
        // Should serialize as {"k":"name","v":"v"} (no 'i' field)
        assert!(json.contains(r#""k":"name""#));
        assert!(json.contains(r#""v":"v""#));
        assert!(!json.contains("\"i\":"), "Should not contain 'i' field");
    }

    #[test]
    fn test_sanitized_child_text() {
        let child = SanitizedChild::Text("Hello world".to_string());
        let json = serde_json::to_string(&child).unwrap();
        
        assert_eq!(json, r#""Hello world""#);
    }

    #[test]
    fn test_sanitized_children_single() {
        let children = SanitizedChildren::Single(Box::new(SanitizedChild::Text("Hello".to_string())));
        let json = serde_json::to_string(&children).unwrap();
        
        assert_eq!(json, r#""Hello""#);
    }

    #[test]
    fn test_sanitized_children_multiple() {
        let children = SanitizedChildren::Multiple(vec![
            SanitizedChild::Text("Hello ".to_string()),
            SanitizedChild::Variable(SanitizedVariable {
                k: "name".to_string(),
                v: Some(VariableType::Variable),
            }),
            SanitizedChild::Text("!".to_string()),
        ]);
        
        let json = serde_json::to_string(&children).unwrap();
        println!("Multiple sanitized children JSON: {}", json);
        
        // Should be an array
        assert!(json.starts_with('['));
        assert!(json.ends_with(']'));
        assert!(json.contains(r#""Hello ""#));
        assert!(json.contains(r#""k":"name""#));
    }

    #[test]
    fn test_sanitized_element_serialization() {
        let element = SanitizedElement {
            t: Some("div".to_string()),
            d: None,
            c: Some(Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Text("content".to_string()))))),
        };

        let json = serde_json::to_string(&element).unwrap();
        println!("SanitizedElement JSON: {}", json);
        
        assert!(json.contains(r#""t":"div""#));
        assert!(json.contains(r#""c":"content""#));
        assert!(!json.contains("\"i\":"), "Should not contain 'i' field");
    }

    #[test]
    fn test_sanitized_structures_have_no_ids() {
        // Test that sanitized structures don't have ID fields
        let element = SanitizedElement {
            t: Some("div".to_string()),
            d: None,
            c: Some(Box::new(SanitizedChildren::Single(Box::new(SanitizedChild::Variable(SanitizedVariable {
                k: "name".to_string(),
                v: Some(VariableType::Variable),
            }))))),
        };

        let json = serde_json::to_string(&element).unwrap();
        
        // Verify no 'i' fields are present in the serialized JSON
        assert!(!json.contains("\"i\":"), "Sanitized structures should not contain 'i' fields");
        assert!(json.contains(r#""k":"name""#), "Variable key should be preserved");
        assert!(json.contains(r#""t":"div""#), "Element tag should be preserved");
    }

    #[test]
    fn test_hash_source_with_simple_text() {
        let children = SanitizedChildren::Single(Box::new(SanitizedChild::Text("Hello world".to_string())));
        let hash = JsxHasher::hash_source(&children, None, None, "JSX");
        
        assert_eq!(hash.len(), 16, "Hash should be 16 characters");
        
        // Same input should produce same hash
        let hash2 = JsxHasher::hash_source(&children, None, None, "JSX");
        assert_eq!(hash, hash2, "Same input should produce same hash");
    }

    #[test]
    fn test_hash_source_with_context_and_id() {
        let children = SanitizedChildren::Single(Box::new(SanitizedChild::Text("Hello".to_string())));
        
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
        let children = SanitizedChildren::Multiple(vec![
            SanitizedChild::Text("Hello ".to_string()),
            SanitizedChild::Variable(SanitizedVariable {
                k: "name".to_string(),
                v: Some(VariableType::Variable),
            }),
            SanitizedChild::Text("!".to_string()),
        ]);

        let hash = JsxHasher::hash_source(&children, None, None, "JSX");
        assert_eq!(hash.len(), 16);
        
        // Create same structure - should hash the same
        let children2 = SanitizedChildren::Multiple(vec![
            SanitizedChild::Text("Hello ".to_string()),
            SanitizedChild::Variable(SanitizedVariable {
                k: "name".to_string(),
                v: Some(VariableType::Variable),
            }),
            SanitizedChild::Text("!".to_string()),
        ]);

        let hash2 = JsxHasher::hash_source(&children2, None, None, "JSX");
        assert_eq!(hash, hash2, "Same sanitized content should produce same hash");
    }
}