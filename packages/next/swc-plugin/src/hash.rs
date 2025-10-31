use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;

/// Variable types matching the TypeScript definition
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum VariableType {
  #[serde(rename = "v")]
  Variable, // Variable
  #[serde(rename = "n")]
  Number, // Number
  #[serde(rename = "d")]
  Date, // Date
  #[serde(rename = "c")]
  Currency, // Currency
}

/// Map of data-_gt properties to their corresponding React props
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct HtmlContentProps {
  #[serde(skip_serializing_if = "Option::is_none")]
  pub pl: Option<String>, // placeholder
  // #[serde(skip_serializing_if = "Option::is_none")]
  // pub ti: Option<String>, // title
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
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct SanitizedElement {
  #[serde(skip_serializing_if = "Option::is_none")]
  pub b: Option<BTreeMap<String, Box<SanitizedChild>>>, // branches (for Branch/Plural components)
  #[serde(skip_serializing_if = "Option::is_none")]
  pub c: Option<Box<SanitizedChildren>>, // children
  #[serde(skip_serializing_if = "Option::is_none")]
  pub t: Option<String>, // transformation type or tag name
  #[serde(skip_serializing_if = "Option::is_none")]
  pub d: Option<SanitizedGtProp>, // GT data (for other GT components)
}

/// Sanitized GT properties (no volatile data)
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct SanitizedGtProp {
  #[serde(skip_serializing_if = "Option::is_none")]
  pub b: Option<BTreeMap<String, Box<SanitizedChild>>>, // Branches
  #[serde(skip_serializing_if = "Option::is_none")]
  pub t: Option<String>, // Branch Transformation ('p' for plural, 'b' for branch)
  #[serde(flatten)]
  pub html_props: HtmlContentProps, // HTML content properties
}

/// Sanitized Variable (no ID for stable hashing)
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct SanitizedVariable {
  #[serde(skip_serializing_if = "Option::is_none")]
  pub k: Option<String>, // key (for regular variables)
  #[serde(skip_serializing_if = "Option::is_none")]
  pub v: Option<VariableType>, // variable type (for regular variables)
  #[serde(skip_serializing_if = "Option::is_none")]
  pub t: Option<String>, // transformation type ('b' for branches, 'p' for plurals, 'v' for variables)
}

/// Sanitized JSX Child can be text, element, variable, boolean, or null
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(untagged)]
pub enum SanitizedChild {
  Text(String), // TODO: make this string, boolean, number, or null
  Element(Box<SanitizedElement>),
  Variable(SanitizedVariable),
  Boolean(bool),
  Null(Option<()>), // Will serialize as null when None
  Fragment(Box<SanitizedChildren>),
}

/// Sanitized JSX Children can be a single child, array of children, or wrapped in element structure
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(untagged)]
pub enum SanitizedChildren {
  Single(Box<SanitizedChild>),
  Multiple(Vec<SanitizedChild>),
  // For attribute content that gets wrapped like {"c": "content"} or {"c": [...]}
  Wrapped { c: Box<SanitizedChildren> },
}

/// Sanitized data structure for hashing (matches TypeScript hashSource.ts)
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
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
  /// Hash a string using SHA256 and return first 16 hex characters
  pub fn hash_string(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    let result = hasher.finalize();
    format!("{result:x}")[..16].to_string()
  }

  /// Stable stringify like fast-json-stable-stringify (sorts keys alphabetically)
  pub fn stable_stringify<T: Serialize>(value: &T) -> Result<String, serde_json::Error> {
    // Convert to Value first, then sort keys recursively
    let mut json_value = serde_json::to_value(value)?;
    Self::sort_object_keys(&mut json_value);
    serde_json::to_string(&json_value)
  }

  /// Recursively sort object keys alphabetically  
  fn sort_object_keys(value: &mut serde_json::Value) {
    match value {
      serde_json::Value::Object(map) => {
        // Get all keys first
        let mut keys: Vec<String> = map.keys().cloned().collect();
        keys.sort();

        // Extract values in sorted order, process them, then rebuild map
        let mut sorted_entries: Vec<(String, serde_json::Value)> = Vec::new();

        for key in keys {
          if let Some(mut val) = map.remove(&key) {
            Self::sort_object_keys(&mut val);
            sorted_entries.push((key, val));
          }
        }

        // Rebuild the map (it's now empty from removes)
        for (key, val) in sorted_entries {
          map.insert(key, val);
        }
      }
      serde_json::Value::Array(arr) => {
        // Recursively sort array elements
        for item in arr {
          Self::sort_object_keys(item);
        }
      }
      _ => {} // Primitive values don't need sorting
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
    assert!(
      hash1.chars().all(|c| c.is_ascii_hexdigit()),
      "Hash should only contain hex characters"
    );
  }

  #[test]
  fn test_hash_string_different_inputs() {
    let hash1 = JsxHasher::hash_string("input1");
    let hash2 = JsxHasher::hash_string("input2");

    assert_ne!(
      hash1, hash2,
      "Different inputs should produce different hashes"
    );
  }

  #[test]
  fn test_sanitized_variable_serialization() {
    let variable = SanitizedVariable {
      k: Some("name".to_string()),
      v: Some(VariableType::Variable),
      t: None,
    };

    let json = serde_json::to_string(&variable).unwrap();
    println!("SanitizedVariable JSON: {json}");

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
        k: Some("name".to_string()),
        v: Some(VariableType::Variable),
        t: None,
      }),
      SanitizedChild::Text("!".to_string()),
    ]);

    let json = serde_json::to_string(&children).unwrap();
    println!("Multiple sanitized children JSON: {json}");

    // Should be an array
    assert!(json.starts_with('['));
    assert!(json.ends_with(']'));
    assert!(json.contains(r#""Hello ""#));
    assert!(json.contains(r#""k":"name""#));
  }

  #[test]
  fn test_sanitized_element_serialization() {
    let element = SanitizedElement {
      b: None,
      c: Some(Box::new(SanitizedChildren::Single(Box::new(
        SanitizedChild::Text("content".to_string()),
      )))),
      t: Some("div".to_string()),
      d: None,
    };

    let json = serde_json::to_string(&element).unwrap();
    println!("SanitizedElement JSON: {json}");

    assert!(json.contains(r#""t":"div""#));
    assert!(json.contains(r#""c":"content""#));
    assert!(!json.contains("\"i\":"), "Should not contain 'i' field");
  }

  #[test]
  fn test_sanitized_structures_have_no_ids() {
    // Test that sanitized structures don't have ID fields
    let element = SanitizedElement {
      b: None,
      c: Some(Box::new(SanitizedChildren::Single(Box::new(
        SanitizedChild::Variable(SanitizedVariable {
          k: Some("name".to_string()),
          v: Some(VariableType::Variable),
          t: None,
        }),
      )))),
      t: Some("div".to_string()),
      d: None,
    };

    let json = serde_json::to_string(&element).unwrap();

    // Verify no 'i' fields are present in the serialized JSON
    assert!(
      !json.contains("\"i\":"),
      "Sanitized structures should not contain 'i' fields"
    );
    assert!(
      json.contains(r#""k":"name""#),
      "Variable key should be preserved"
    );
    assert!(
      json.contains(r#""t":"div""#),
      "Element tag should be preserved"
    );
  }

  #[test]
  fn test_hash_source_with_simple_text() {
    let children =
      SanitizedChildren::Single(Box::new(SanitizedChild::Text("Hello world".to_string())));
    let sanitized_data = SanitizedData {
      source: Some(Box::new(children.clone())),
      id: None,
      context: None,
      data_format: Some("JSX".to_string()),
    };

    let json_string = JsxHasher::stable_stringify(&sanitized_data).unwrap();
    let hash = JsxHasher::hash_string(&json_string);

    assert_eq!(hash.len(), 16, "Hash should be 16 characters");

    // Same input should produce same hash
    let json_string2 = JsxHasher::stable_stringify(&sanitized_data).unwrap();
    let hash2 = JsxHasher::hash_string(&json_string2);
    assert_eq!(hash, hash2, "Same input should produce same hash");
  }

  #[test]
  fn test_hash_source_with_context_and_id() {
    let children = SanitizedChildren::Single(Box::new(SanitizedChild::Text("Hello".to_string())));

    let data1 = SanitizedData {
      source: Some(Box::new(children.clone())),
      id: None,
      context: None,
      data_format: Some("JSX".to_string()),
    };
    let data2 = SanitizedData {
      source: Some(Box::new(children.clone())),
      id: None,
      context: Some("context".to_string()),
      data_format: Some("JSX".to_string()),
    };
    let data3 = SanitizedData {
      source: Some(Box::new(children)),
      id: Some("id".to_string()),
      context: None,
      data_format: Some("JSX".to_string()),
    };

    let hash1 = JsxHasher::hash_string(&JsxHasher::stable_stringify(&data1).unwrap());
    let hash2 = JsxHasher::hash_string(&JsxHasher::stable_stringify(&data2).unwrap());
    let hash3 = JsxHasher::hash_string(&JsxHasher::stable_stringify(&data3).unwrap());

    // All should be different
    assert_ne!(hash1, hash2, "Context should change hash");
    assert_ne!(hash1, hash3, "ID should change hash");
    assert_ne!(
      hash2, hash3,
      "Context and ID should produce different hashes"
    );
  }

  #[test]
  fn test_stable_stringify_key_ordering() {
    let children =
      SanitizedChildren::Single(Box::new(SanitizedChild::Text("test text".to_string())));
    let data = SanitizedData {
      source: Some(Box::new(children)),
      id: None,
      context: None,
      data_format: Some("JSX".to_string()),
    };

    let stable_json = JsxHasher::stable_stringify(&data).unwrap();

    // With stable stringify, keys should be in alphabetical order
    // Expected order: dataFormat, source
    assert!(
      stable_json.contains(r#"{"dataFormat":"JSX","source":"#),
      "Keys should be in alphabetical order: dataFormat before source"
    );

    // Compare with regular serde_json to ensure they're different when keys are out of order
    let regular_json = serde_json::to_string(&data).unwrap();

    // Both should produce valid JSON that deserializes to the same data
    let stable_data: SanitizedData = serde_json::from_str(&stable_json).unwrap();
    let regular_data: SanitizedData = serde_json::from_str(&regular_json).unwrap();

    // Data should be equivalent regardless of key order
    assert_eq!(stable_data.data_format, regular_data.data_format);
    assert_eq!(stable_data.source.is_some(), regular_data.source.is_some());
  }

  #[test]
  fn test_branch_component_empty_hash() {
    // Test that empty Branch component produces the expected hash to match runtime
    let empty_children = SanitizedChildren::Multiple(vec![]);
    let data = SanitizedData {
      source: Some(Box::new(empty_children)),
      id: None,
      context: None,
      data_format: Some("JSX".to_string()),
    };

    let json_string = JsxHasher::stable_stringify(&data).unwrap();
    let hash = JsxHasher::hash_string(&json_string);

    println!("Empty Branch hash: {hash}");
    println!("Empty Branch JSON: {json_string}");

    // This should match the runtime hash for empty Branch components
    assert_eq!(hash.len(), 16, "Hash should be 16 characters");

    // The expected hash for empty JSX structure should be consistent
    let expected_json = r#"{"dataFormat":"JSX","source":[]}"#;
    let expected_hash = JsxHasher::hash_string(expected_json);
    assert_eq!(
      hash, expected_hash,
      "Stable stringify should produce same hash as direct JSON"
    );
  }

  #[test]
  fn test_hash_source_complex_structure() {
    let children = SanitizedChildren::Multiple(vec![
      SanitizedChild::Text("Hello ".to_string()),
      SanitizedChild::Variable(SanitizedVariable {
        k: Some("name".to_string()),
        v: Some(VariableType::Variable),
        t: None,
      }),
      SanitizedChild::Text("!".to_string()),
    ]);

    let data = SanitizedData {
      source: Some(Box::new(children.clone())),
      id: None,
      context: None,
      data_format: Some("JSX".to_string()),
    };

    let hash = JsxHasher::hash_string(&JsxHasher::stable_stringify(&data).unwrap());
    assert_eq!(hash.len(), 16);

    // Create same structure - should hash the same
    let children2 = SanitizedChildren::Multiple(vec![
      SanitizedChild::Text("Hello ".to_string()),
      SanitizedChild::Variable(SanitizedVariable {
        k: Some("name".to_string()),
        v: Some(VariableType::Variable),
        t: None,
      }),
      SanitizedChild::Text("!".to_string()),
    ]);

    let data2 = SanitizedData {
      source: Some(Box::new(children2)),
      id: None,
      context: None,
      data_format: Some("JSX".to_string()),
    };

    let hash2 = JsxHasher::hash_string(&JsxHasher::stable_stringify(&data2).unwrap());
    assert_eq!(
      hash, hash2,
      "Same sanitized content should produce same hash"
    );
  }
}
