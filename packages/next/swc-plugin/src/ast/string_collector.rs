use swc_core::common::Span;
use swc_core::ecma::ast::*;

/// Content extracted from a t() function call
#[derive(Debug, Clone)]
pub struct TranslationContent {
  /// The string message: t("Hello world") → "Hello world"
  pub message: String,
  /// Pre-calculated hash for this content
  pub hash: String,
  /// Optional ID from options: t("text", {id: "greeting"}) → Some("greeting")
  pub id: Option<String>,
  /// Optional context from options: t("text", {context: "nav"}) → Some("nav")
  pub context: Option<String>,
  /// Optional max chars from options: t("text", {maxChars: 10}) → Some(10)
  pub max_chars: Option<i32>,
}

/// Content extracted from JSX translation components like <T>
#[derive(Debug, Clone)]
pub struct TranslationJsx {
  /// Pre-calculated hash for this JSX content
  pub hash: String,
}

/// Just a hash value for simple hash injection
#[derive(Debug, Clone)]
pub struct TranslationHash {
  /// The hash value to inject
  pub hash: String,
}

/// Collection of all translation data for a single useGT/getGT call
#[derive(Debug, Clone, Default)]
pub struct TranslationData {
  /// Multiple content items from t() function calls
  pub content: Vec<TranslationContent>,
  /// Single JSX component data (if any)
  pub jsx: Option<TranslationJsx>,
  /// Single hash value (if any)
  pub hash: Option<TranslationHash>,
}

/// Simplified string collector for two-pass transformation
///
/// Pass 1 (Observation):
/// - Mark useGT/getGT calls with unique IDs based on global counter
/// - Collect t() strings, JSX components, and hashes and associate with those IDs
///
/// Pass 2 (Action):
/// - Look up collected content by regenerating same unique IDs
/// - Inject content arrays into useGT/getGT calls or hash attributes into components
#[derive(Debug, Default)]
pub struct StringCollector {
  /// THE CORE DATA STRUCTURE
  /// Vector of translation calls indexed by counter ID
  /// Index 0: All translation data for counter_id 0 (first useGT/getGT call)
  /// Index 1: All translation data for counter_id 1 (second useGT/getGT call), etc.
  aggregators: Vec<TranslationData>,

  /// Global counter incremented for each useGT/getGT call encountered
  /// Also serves as the next index for calls_needing_injection
  global_call_counter: u32,
}

impl StringCollector {
  /// Create a new empty string collector
  pub fn new() -> Self {
    Self {
      aggregators: Vec::new(),
      global_call_counter: 0,
    }
  }

  /// Increment counter and return the current counter ID for a useGT/getGT call
  ///
  /// These IDs are:
  /// - Deterministic: Same visitation order = same IDs  
  /// - Stable: Don't change when AST is modified
  /// - Unique: Global counter ensures no collisions ever
  /// - Simple: No scope tracking needed
  pub fn increment_counter(&mut self) -> u32 {
    self.global_call_counter += 1;
    self.global_call_counter
  }

  /// Get current global counter value (for debugging/testing)
  pub fn get_counter(&self) -> u32 {
    self.global_call_counter
  }

  /// Pass 1: Initialize a useGT/getGT call for later content injection
  ///
  /// This creates an empty TranslationCall that content will be added to
  pub fn initialize_aggregator(&mut self, counter_id: u32) {
    // Ensure the Vec is large enough to hold this index
    while self.aggregators.len() <= counter_id as usize {
      self.aggregators.push(TranslationData::default());
    }
  }

  /// Pass 1: Add translation content from a t() call to a specific useGT/getGT
  /// Multiple content items can be added to the same call
  pub fn set_translation_content(&mut self, counter_id: u32, content: TranslationContent) {
    if let Some(call) = self.aggregators.get_mut(counter_id as usize) {
      call.content.push(content);
    } else {
      eprintln!("Warning: Trying to add content to uninitialized call ID: {counter_id}");
    }
  }

  /// Pass 1: Set JSX translation content for a specific useGT/getGT
  /// Only one JSX item can be set per call (overwrites if called multiple times)
  pub fn set_translation_jsx(&mut self, counter_id: u32, jsx: TranslationJsx) {
    if let Some(call) = self.aggregators.get_mut(counter_id as usize) {
      call.jsx = Some(jsx);
    } else {
      eprintln!("Warning: Trying to set JSX for uninitialized call ID: {counter_id}");
    }
  }

  /// Pass 1: Set hash-only content for a specific useGT/getGT  
  /// Only one hash can be set per call (overwrites if called multiple times)
  pub fn set_translation_hash(&mut self, counter_id: u32, hash: TranslationHash) {
    if let Some(call) = self.aggregators.get_mut(counter_id as usize) {
      call.hash = Some(hash);
    } else {
      eprintln!("Warning: Trying to set hash for uninitialized call ID: {counter_id}");
    }
  }

  /// Pass 2: Get translation call data for injection into a specific useGT/getGT call
  ///
  /// Returns None if no call was initialized for this counter_id
  pub fn get_translation_data(&self, counter_id: u32) -> Option<&TranslationData> {
    self.aggregators.get(counter_id as usize)
  }

  /// Get the translation content for a specific useGT/getGT call
  pub fn get_translation_content(&self, counter_id: u32) -> Option<&Vec<TranslationContent>> {
    self
      .aggregators
      .get(counter_id as usize)
      .map(|data| &data.content)
  }

  /// Get the translation JSX for a specific useGT/getGT call
  pub fn get_translation_jsx(&self, counter_id: u32) -> Option<&TranslationJsx> {
    // Filter by jsx
    self
      .aggregators
      .get(counter_id as usize)
      .and_then(|data| data.jsx.as_ref())
  }

  /// Get the translation hash for a specific useGT/getGT call
  pub fn get_translation_hash(&self, counter_id: u32) -> Option<&TranslationHash> {
    self
      .aggregators
      .get(counter_id as usize)
      .and_then(|data| data.hash.as_ref())
  }

  /// Pass 2: Check if a call has any content to inject
  pub fn has_content_for_injection(&self, counter_id: u32) -> bool {
    self
      .aggregators
      .get(counter_id as usize)
      .map(|call| !call.content.is_empty() || call.jsx.is_some() || call.hash.is_some())
      .unwrap_or(false)
  }

  /// Helper: Create a TranslationContent from t() call components
  pub fn create_translation_content(
    message: String,
    hash: String,
    id: Option<String>,
    context: Option<String>,
    max_chars: Option<i32>,
  ) -> TranslationContent {
    TranslationContent {
      message,
      hash,
      id,
      context,
      max_chars,
    }
  }

  /// Helper: Create a TranslationJsx from JSX component props
  pub fn create_translation_jsx(hash: String) -> TranslationJsx {
    TranslationJsx { hash }
  }

  /// Helper: Create a TranslationHash for simple hash injection
  pub fn create_translation_hash(hash: String) -> TranslationHash {
    TranslationHash { hash }
  }

  /// Create an array literal for injection from TranslationContent: [{message: "text", hash: "abc"}, ...]
  /// This is the only array creation method needed since only content becomes arrays
  pub fn create_content_array(&self, contents: &[TranslationContent], span: Span) -> ArrayLit {
    let elements: Vec<Option<ExprOrSpread>> = contents
      .iter()
      .map(|content| {
        let object = self.create_content_object(content, span);
        Some(ExprOrSpread {
          spread: None,
          expr: Box::new(Expr::Object(object)),
        })
      })
      .collect();

    ArrayLit {
      span,
      elems: elements,
    }
  }

  // Helper: Generate a key-value pair for an object literal
  fn generate_key_value_pair(key: &str, value: &str, span: Span) -> PropOrSpread {
    PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
      key: PropName::Ident(
        Ident {
          span,
          sym: key.into(),
          optional: false,
          ctxt: Default::default(),
        }
        .into(),
      ),
      value: Box::new(Expr::Lit(Lit::Str(Str {
        span,
        value: value.into(),
        raw: None,
      }))),
    })))
  }

  // Helper: Generate a key-value pair for an object literal with a number value
  fn generate_key_value_pair_number(key: &str, value: i32, span: Span) -> PropOrSpread {
    PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
      key: PropName::Ident(
        Ident {
          span,
          sym: key.into(),
          optional: false,
          ctxt: Default::default(),
        }
        .into(),
      ),
      value: Box::new(Expr::Lit(Lit::Num(Number {
        span,
        value: value.into(),
        raw: None,
      }))),
    })))
  }

  /// Create an object literal for a single content item: {message: "text", hash: "abc", ...}
  fn create_content_object(&self, content: &TranslationContent, span: Span) -> ObjectLit {
    let mut props = vec![
      // message: "Hello world"
      Self::generate_key_value_pair("message", &content.message, span),
      // hash: "abc123"
      Self::generate_key_value_pair("$_hash", &content.hash, span),
    ];

    // Add optional id property
    if let Some(id) = &content.id {
      props.push(Self::generate_key_value_pair("$id", id, span));
    }

    // Add optional context property
    if let Some(context) = &content.context {
      props.push(Self::generate_key_value_pair("$context", context, span));
    }

    // Add optional max chars property
    if let Some(max_chars) = &content.max_chars {
      props.push(Self::generate_key_value_pair_number("$maxChars", *max_chars, span));
    }

    ObjectLit { span, props }
  }

  /// Debug/testing helper: Get total number of calls initialized
  pub fn total_calls(&self) -> usize {
    self.aggregators.len()
  }

  /// Debug/testing helper: Get total number of content items collected
  /// Counts TranslationContent items, JSX items, and Hash items
  pub fn total_content_items(&self) -> usize {
    self
      .aggregators
      .iter()
      .map(|call| {
        let mut count = call.content.len();
        if call.jsx.is_some() {
          count += 1;
        }
        if call.hash.is_some() {
          count += 1;
        }
        count
      })
      .sum()
  }

  /// Debug/testing helper: Get all counter IDs that have been initialized
  pub fn get_call_ids(&self) -> Vec<u32> {
    (0..self.aggregators.len() as u32).collect()
  }

  /// Reset all state (useful for testing)
  pub fn clear(&mut self) {
    self.aggregators.clear();
    self.global_call_counter = 0;
  }

  /// Reset the counter to a specific value
  pub fn reset_counter(&mut self) {
    self.global_call_counter = 0;
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use swc_core::common::DUMMY_SP;

  #[test]
  fn test_counter_id_generation() {
    let mut collector = StringCollector::new();

    // Global counter increments for each call
    let counter_id1 = collector.increment_counter();
    let counter_id2 = collector.increment_counter();
    let counter_id3 = collector.increment_counter();

    assert_eq!(counter_id1, 1);
    assert_eq!(counter_id2, 2);
    assert_eq!(counter_id3, 3);

    // IDs should be deterministic
    let mut collector2 = StringCollector::new();
    let counter_id1_again = collector2.increment_counter();
    assert_eq!(counter_id1, counter_id1_again);

    // Counter should increment properly
    assert_eq!(collector.get_counter(), 3);
  }

  #[test]
  fn test_call_initialization_and_content_addition() {
    let mut collector = StringCollector::new();

    // Initialize a call
    let counter_id = collector.increment_counter();
    collector.initialize_aggregator(counter_id);

    // Should start empty
    assert_eq!(collector.total_calls(), 2); // counter_id=1 requires indices 0 and 1
    assert_eq!(collector.total_content_items(), 0);
    assert!(!collector.has_content_for_injection(counter_id));

    // Add content
    let content = TranslationContent {
      message: "Hello world".to_string(),
      hash: "abc123".to_string(),
      id: Some("greeting".to_string()),
      context: None,
      max_chars: None,
    };

    collector.set_translation_content(counter_id, content);

    // Should now have content
    assert_eq!(collector.total_content_items(), 1);
    assert!(collector.has_content_for_injection(counter_id));

    let retrieved = collector.get_translation_data(counter_id).unwrap();
    assert_eq!(retrieved.content.len(), 1);
    assert_eq!(retrieved.content[0].message, "Hello world");
    assert_eq!(retrieved.content[0].id, Some("greeting".to_string()));
    assert!(retrieved.jsx.is_none());
    assert!(retrieved.hash.is_none());
  }

  #[test]
  fn test_multiple_content_items() {
    let mut collector = StringCollector::new();
    let counter_id = collector.increment_counter();

    collector.initialize_aggregator(counter_id);

    // Add multiple content items
    collector.set_translation_content(
      counter_id,
      TranslationContent {
        message: "First".to_string(),
        hash: "hash1".to_string(),
        id: None,
        context: None,
        max_chars: None,
      },
    );

    collector.set_translation_content(
      counter_id,
      TranslationContent {
        message: "Second".to_string(),
        hash: "hash2".to_string(),
        id: Some("second".to_string()),
        context: Some("test".to_string()),
        max_chars: None,
      },
    );

    let retrieved = collector.get_translation_data(counter_id).unwrap();
    assert_eq!(retrieved.content.len(), 2);
    assert_eq!(retrieved.content[0].message, "First");
    assert_eq!(retrieved.content[1].message, "Second");
    assert_eq!(retrieved.content[1].id, Some("second".to_string()));
  }

  #[test]
  fn test_multiple_separate_calls() {
    let mut collector = StringCollector::new();

    // Create multiple separate calls - global counter increments
    let counter_id1 = collector.increment_counter(); // 0
    let counter_id2 = collector.increment_counter(); // 1
    let counter_id3 = collector.increment_counter(); // 2

    assert_eq!(counter_id1, 1);
    assert_eq!(counter_id2, 2);
    assert_eq!(counter_id3, 3);

    collector.initialize_aggregator(counter_id1);
    collector.initialize_aggregator(counter_id2);
    collector.initialize_aggregator(counter_id3);

    // Add content to different calls
    collector.set_translation_content(
      counter_id1,
      TranslationContent {
        message: "First Call".to_string(),
        hash: "hash1".to_string(),
        id: None,
        context: None,
        max_chars: None,
      },
    );

    collector.set_translation_content(
      counter_id3,
      TranslationContent {
        message: "Third Call".to_string(),
        hash: "hash3".to_string(),
        id: None,
        context: None,
        max_chars: None,
      },
    );

    // Content should be isolated by unique IDs
    let call1 = collector.get_translation_data(counter_id1).unwrap();
    let call2 = collector.get_translation_data(counter_id2).unwrap();
    let call3 = collector.get_translation_data(counter_id3).unwrap();

    assert_eq!(call1.content.len(), 1);
    assert_eq!(call2.content.len(), 0); // No content added
    assert_eq!(call3.content.len(), 1);

    assert_eq!(call1.content[0].message, "First Call");
    assert_eq!(call3.content[0].message, "Third Call");
  }

  #[test]
  fn test_content_array_creation() {
    let collector = StringCollector::new();

    let contents = vec![
      TranslationContent {
        message: "Hello".to_string(),
        hash: "hash1".to_string(),
        id: Some("greeting".to_string()),
        context: None,
        max_chars: None,
      },
      TranslationContent {
        message: "World".to_string(),
        hash: "hash2".to_string(),
        id: None,
        context: Some("global".to_string()),
        max_chars: None,
      },
    ];

    let array = collector.create_content_array(&contents, DUMMY_SP);

    assert_eq!(array.elems.len(), 2);
    assert!(array.elems[0].is_some());
    assert!(array.elems[1].is_some());
  }

  #[test]
  fn test_clear_functionality() {
    let mut collector = StringCollector::new();

    let counter_id = collector.increment_counter();
    collector.initialize_aggregator(counter_id);
    collector.set_translation_content(
      counter_id,
      TranslationContent {
        message: "Test".to_string(),
        hash: "hash".to_string(),
        id: None,
        context: None,
        max_chars: None,
      },
    );

    assert_eq!(collector.total_calls(), 2); // counter_id=1 requires indices 0 and 1
    assert_eq!(collector.total_content_items(), 1);
    assert_eq!(collector.get_counter(), 1);

    collector.clear();

    assert_eq!(collector.total_calls(), 0);
    assert_eq!(collector.total_content_items(), 0);
    assert_eq!(collector.get_counter(), 0);
  }

  #[test]
  fn test_safe_out_of_bounds_access() {
    let collector = StringCollector::new();

    // Test safe access with .get_translation_call() - should return None for out-of-bounds
    assert!(collector.get_translation_data(0).is_none());
    assert!(collector.get_translation_data(999).is_none());
    assert!(!collector.has_content_for_injection(0));
    assert!(!collector.has_content_for_injection(999));
  }

  #[test]
  fn test_translation_jsx_content() {
    let mut collector = StringCollector::new();

    let counter_id = collector.increment_counter();
    collector.initialize_aggregator(counter_id);

    // Add JSX content
    let jsx = StringCollector::create_translation_jsx("jsx-hash-123".to_string());

    collector.set_translation_jsx(counter_id, jsx);

    // Verify content was added
    assert_eq!(collector.total_content_items(), 1);
    assert!(collector.has_content_for_injection(counter_id));

    let retrieved = collector.get_translation_data(counter_id).unwrap();
    assert_eq!(retrieved.content.len(), 0); // No t() content
    assert!(retrieved.jsx.is_some());
    assert!(retrieved.hash.is_none());

    let jsx = retrieved.jsx.as_ref().unwrap();
    assert_eq!(jsx.hash, "jsx-hash-123");
  }

  #[test]
  fn test_translation_hash_content() {
    let mut collector = StringCollector::new();

    let counter_id = collector.increment_counter();
    collector.initialize_aggregator(counter_id);

    // Add hash-only content
    let hash = StringCollector::create_translation_hash("hash-only-456".to_string());
    collector.set_translation_hash(counter_id, hash);

    // Verify content was added
    assert_eq!(collector.total_content_items(), 1);
    assert!(collector.has_content_for_injection(counter_id));

    let retrieved = collector.get_translation_data(counter_id).unwrap();
    assert_eq!(retrieved.content.len(), 0); // No t() content
    assert!(retrieved.jsx.is_none());
    assert!(retrieved.hash.is_some());

    let hash = retrieved.hash.as_ref().unwrap();
    assert_eq!(hash.hash, "hash-only-456");
  }

  #[test]
  fn test_mixed_content_types() {
    let mut collector = StringCollector::new();

    let counter_id = collector.increment_counter();
    collector.initialize_aggregator(counter_id);

    // Add different types of content to the same call
    let content1 = StringCollector::create_translation_content(
      "Hello from t()".to_string(),
      "content-hash".to_string(),
      Some("content-id".to_string()),
      None,
      None,
    );

    let content2 = StringCollector::create_translation_content(
      "Second t() call".to_string(),
      "content-hash-2".to_string(),
      None,
      Some("test-context".to_string()),
      None,
    );

    let jsx = StringCollector::create_translation_jsx("jsx-hash".to_string());

    let hash = StringCollector::create_translation_hash("simple-hash".to_string());

    collector.set_translation_content(counter_id, content1);
    collector.set_translation_content(counter_id, content2);
    collector.set_translation_jsx(counter_id, jsx);
    collector.set_translation_hash(counter_id, hash);

    // Verify all content was added: 2 content + 1 jsx + 1 hash = 4 total
    assert_eq!(collector.total_content_items(), 4);
    assert!(collector.has_content_for_injection(counter_id));

    let retrieved = collector.get_translation_data(counter_id).unwrap();

    // Check content array
    assert_eq!(retrieved.content.len(), 2);
    assert_eq!(retrieved.content[0].message, "Hello from t()");
    assert_eq!(retrieved.content[0].hash, "content-hash");
    assert_eq!(retrieved.content[1].message, "Second t() call");
    assert_eq!(retrieved.content[1].hash, "content-hash-2");

    // Check JSX
    assert!(retrieved.jsx.is_some());
    let jsx = retrieved.jsx.as_ref().unwrap();
    assert_eq!(jsx.hash, "jsx-hash");

    // Check Hash
    assert!(retrieved.hash.is_some());
    let hash = retrieved.hash.as_ref().unwrap();
    assert_eq!(hash.hash, "simple-hash");
  }

  #[test]
  fn test_create_content_array() {
    let collector = StringCollector::new();

    // Create content array from TranslationContent slice
    let contents = vec![
      TranslationContent {
        message: "Hello".to_string(),
        hash: "content-hash".to_string(),
        id: Some("greeting".to_string()),
        context: None,
        max_chars: None,
      },
      TranslationContent {
        message: "World".to_string(),
        hash: "content-hash-2".to_string(),
        id: None,
        context: Some("global".to_string()),
        max_chars: None,
      },
    ];

    let array = collector.create_content_array(&contents, DUMMY_SP);

    // Should create array with 2 object elements (only content, not JSX/Hash)
    assert_eq!(array.elems.len(), 2);
    assert!(array.elems[0].is_some());
    assert!(array.elems[1].is_some());
  }

  #[test]
  fn test_helper_creation_methods() {
    // Test TranslationContent creation
    let content = StringCollector::create_translation_content(
      "Test message".to_string(),
      "test-hash".to_string(),
      Some("test-id".to_string()),
      Some("test-context".to_string()),
      None,
    );

    assert_eq!(content.message, "Test message");
    assert_eq!(content.hash, "test-hash");
    assert_eq!(content.id, Some("test-id".to_string()));
    assert_eq!(content.context, Some("test-context".to_string()));
    assert_eq!(content.max_chars, None);

    // Test TranslationJsx creation
    let jsx = StringCollector::create_translation_jsx("jsx-hash".to_string());

    assert_eq!(jsx.hash, "jsx-hash");

    // Test TranslationHash creation
    let hash = StringCollector::create_translation_hash("simple-hash".to_string());
    assert_eq!(hash.hash, "simple-hash");
  }

  #[test]
  fn test_translation_content_with_max_chars() {
    // Test creation with max_chars
    let content_with_max_chars = StringCollector::create_translation_content(
      "Test with max chars".to_string(),
      "test-hash-max".to_string(),
      Some("test-id".to_string()),
      None,
      Some(50),
    );

    assert_eq!(content_with_max_chars.message, "Test with max chars");
    assert_eq!(content_with_max_chars.hash, "test-hash-max");
    assert_eq!(content_with_max_chars.id, Some("test-id".to_string()));
    assert_eq!(content_with_max_chars.context, None);
    assert_eq!(content_with_max_chars.max_chars, Some(50));

    // Test creation with all fields including max_chars
    let content_complete = StringCollector::create_translation_content(
      "Complete test".to_string(),
      "complete-hash".to_string(),
      Some("complete-id".to_string()),
      Some("complete-context".to_string()),
      Some(100),
    );

    assert_eq!(content_complete.message, "Complete test");
    assert_eq!(content_complete.hash, "complete-hash");
    assert_eq!(content_complete.id, Some("complete-id".to_string()));
    assert_eq!(content_complete.context, Some("complete-context".to_string()));
    assert_eq!(content_complete.max_chars, Some(100));
  }

  #[test]
  fn test_string_collector_with_max_chars() {
    let mut collector = StringCollector::new();

    let counter_id = collector.increment_counter();
    collector.initialize_aggregator(counter_id);

    // Test setting content with max_chars
    let content_with_max_chars = StringCollector::create_translation_content(
      "Message with limit".to_string(),
      "hash-limit".to_string(),
      Some("limit-id".to_string()),
      None,
      Some(25),
    );

    collector.set_translation_content(counter_id, content_with_max_chars);

    // Verify the content was stored correctly
    let stored_data = collector.get_translation_data(counter_id).unwrap();
    assert_eq!(stored_data.content.len(), 1);
    assert_eq!(stored_data.content[0].message, "Message with limit");
    assert_eq!(stored_data.content[0].max_chars, Some(25));

    // Test setting multiple contents with different max_chars values
    let content_no_limit = StringCollector::create_translation_content(
      "No limit message".to_string(),
      "hash-no-limit".to_string(),
      None,
      Some("test-context".to_string()),
      None,
    );

    collector.set_translation_content(counter_id, content_no_limit);

    let content_high_limit = StringCollector::create_translation_content(
      "High limit message".to_string(),
      "hash-high-limit".to_string(),
      Some("high-id".to_string()),
      Some("high-context".to_string()),
      Some(200),
    );

    collector.set_translation_content(counter_id, content_high_limit);

    // Verify all contents are stored with correct max_chars
    let final_data = collector.get_translation_data(counter_id).unwrap();
    assert_eq!(final_data.content.len(), 3);
    
    // Check first content (has max_chars)
    assert_eq!(final_data.content[0].max_chars, Some(25));
    
    // Check second content (no max_chars)
    assert_eq!(final_data.content[1].max_chars, None);
    
    // Check third content (has high max_chars)
    assert_eq!(final_data.content[2].max_chars, Some(200));
  }

  #[test]
  fn test_content_object_generation_with_max_chars() {
    let collector = StringCollector::new();
    
    // Test object creation with max_chars
    let content_with_max_chars = TranslationContent {
      message: "Test message".to_string(),
      hash: "test-hash".to_string(),
      id: Some("test-id".to_string()),
      context: Some("test-context".to_string()),
      max_chars: Some(42),
    };

    let span = swc_core::common::DUMMY_SP;
    let obj = collector.create_content_object(&content_with_max_chars, span);

    // Should have 5 properties: message, $hash, $id, $context, $maxChars
    assert_eq!(obj.props.len(), 5);

    // Verify the max_chars property is included as a number
    let max_chars_prop = obj.props.iter().find(|prop| {
      if let PropOrSpread::Prop(p) = prop {
        if let Prop::KeyValue(kv) = p.as_ref() {
          if let PropName::Ident(ident) = &kv.key {
            return ident.sym.as_ref() == "$maxChars";
          }
        }
      }
      false
    });

    assert!(max_chars_prop.is_some(), "Should have $maxChars property");
    
    if let Some(PropOrSpread::Prop(prop)) = max_chars_prop {
      if let Prop::KeyValue(kv) = prop.as_ref() {
        if let Expr::Lit(Lit::Num(num)) = kv.value.as_ref() {
          assert_eq!(num.value, 42.0, "Max chars should be 42");
        } else {
          panic!("Max chars value should be a number literal");
        }
      }
    }

    // Test object creation without max_chars
    let content_without_max_chars = TranslationContent {
      message: "Test message".to_string(),
      hash: "test-hash".to_string(),
      id: Some("test-id".to_string()),
      context: None,
      max_chars: None,
    };

    let obj_no_max = collector.create_content_object(&content_without_max_chars, span);

    // Should have 3 properties: message, $hash, $id (no $maxChars)
    assert_eq!(obj_no_max.props.len(), 3);

    // Verify no max_chars property is present
    let has_max_chars = obj_no_max.props.iter().any(|prop| {
      if let PropOrSpread::Prop(p) = prop {
        if let Prop::KeyValue(kv) = p.as_ref() {
          if let PropName::Ident(ident) = &kv.key {
            return ident.sym.as_ref() == "$maxChars";
          }
        }
      }
      false
    });

    assert!(!has_max_chars, "Should not have $maxChars property when None");
  }

  #[test]
  fn test_jsx_overwrite_behavior() {
    let mut collector = StringCollector::new();

    let counter_id = collector.increment_counter();
    collector.initialize_aggregator(counter_id);

    // Set initial JSX
    let jsx1 = StringCollector::create_translation_jsx("first-jsx-hash".to_string());
    collector.set_translation_jsx(counter_id, jsx1);

    // Verify first JSX is set
    let call = collector.get_translation_data(counter_id).unwrap();
    assert!(call.jsx.is_some());
    assert_eq!(call.jsx.as_ref().unwrap().hash, "first-jsx-hash");

    // Overwrite with second JSX
    let jsx2 = StringCollector::create_translation_jsx("second-jsx-hash".to_string());
    collector.set_translation_jsx(counter_id, jsx2);

    // Verify second JSX overwrote the first
    let call = collector.get_translation_data(counter_id).unwrap();
    assert!(call.jsx.is_some());
    assert_eq!(call.jsx.as_ref().unwrap().hash, "second-jsx-hash");

    // Should still count as only 1 item
    assert_eq!(collector.total_content_items(), 1);
  }

  #[test]
  fn test_hash_overwrite_behavior() {
    let mut collector = StringCollector::new();

    let counter_id = collector.increment_counter();
    collector.initialize_aggregator(counter_id);

    // Set initial hash
    let hash1 = StringCollector::create_translation_hash("first-hash".to_string());
    collector.set_translation_hash(counter_id, hash1);

    // Verify first hash is set
    let call = collector.get_translation_data(counter_id).unwrap();
    assert!(call.hash.is_some());
    assert_eq!(call.hash.as_ref().unwrap().hash, "first-hash");

    // Overwrite with second hash
    let hash2 = StringCollector::create_translation_hash("second-hash".to_string());
    collector.set_translation_hash(counter_id, hash2);

    // Verify second hash overwrote the first
    let call = collector.get_translation_data(counter_id).unwrap();
    assert!(call.hash.is_some());
    assert_eq!(call.hash.as_ref().unwrap().hash, "second-hash");

    // Should still count as only 1 item
    assert_eq!(collector.total_content_items(), 1);
  }

  #[test]
  fn test_multiple_content_additions() {
    let mut collector = StringCollector::new();

    let counter_id = collector.increment_counter();
    collector.initialize_aggregator(counter_id);

    // Add multiple content items
    for i in 1..=5 {
      let content = StringCollector::create_translation_content(
        format!("Message {i}"),
        format!("hash-{i}"),
        Some(format!("id-{i}")),
        if i % 2 == 0 {
          Some(format!("context-{i}"))
        } else {
          None
        },
        None,
      );
      collector.set_translation_content(counter_id, content);
    }

    // Verify all content items were added
    let call = collector.get_translation_data(counter_id).unwrap();
    assert_eq!(call.content.len(), 5);
    assert_eq!(collector.total_content_items(), 5);

    // Verify content order and properties
    for i in 0..5 {
      let idx = i + 1;
      assert_eq!(call.content[i].message, format!("Message {idx}"));
      assert_eq!(call.content[i].hash, format!("hash-{idx}"));
      assert_eq!(call.content[i].id, Some(format!("id-{idx}")));

      if idx % 2 == 0 {
        assert_eq!(call.content[i].context, Some(format!("context-{idx}")));
      } else {
        assert_eq!(call.content[i].context, None);
      }
      assert_eq!(call.content[i].max_chars, None);
    }
  }

  #[test]
  fn test_empty_call_behavior() {
    let mut collector = StringCollector::new();

    let counter_id = collector.increment_counter();
    collector.initialize_aggregator(counter_id);

    // Call should be initialized but empty
    let call = collector.get_translation_data(counter_id).unwrap();
    assert_eq!(call.content.len(), 0);
    assert!(call.jsx.is_none());
    assert!(call.hash.is_none());

    // Should have no content to inject
    assert!(!collector.has_content_for_injection(counter_id));
    assert_eq!(collector.total_content_items(), 0);

    // Create content array from empty call
    let array = collector.create_content_array(&call.content, DUMMY_SP);
    assert_eq!(array.elems.len(), 0);
  }

  #[test]
  fn test_content_array_from_call() {
    let mut collector = StringCollector::new();

    let counter_id = collector.increment_counter();
    collector.initialize_aggregator(counter_id);

    // Add some content
    collector.set_translation_content(
      counter_id,
      StringCollector::create_translation_content(
        "First".to_string(),
        "hash1".to_string(),
        Some("id1".to_string()),
        None,
        None,
      ),
    );

    collector.set_translation_content(
      counter_id,
      StringCollector::create_translation_content(
        "Second".to_string(),
        "hash2".to_string(),
        None,
        Some("context2".to_string()),
        None,
      ),
    );

    // Also add JSX and Hash (these should not appear in content array)
    collector.set_translation_jsx(
      counter_id,
      StringCollector::create_translation_jsx("jsx-hash".to_string()),
    );

    collector.set_translation_hash(
      counter_id,
      StringCollector::create_translation_hash("simple-hash".to_string()),
    );

    // Get the call and create array from its content
    let call = collector.get_translation_data(counter_id).unwrap();
    let array = collector.create_content_array(&call.content, DUMMY_SP);

    // Array should only contain the 2 content items, not JSX or Hash
    assert_eq!(array.elems.len(), 2);
    assert!(array.elems[0].is_some());
    assert!(array.elems[1].is_some());

    // Verify total counts
    assert_eq!(call.content.len(), 2);
    assert!(call.jsx.is_some());
    assert!(call.hash.is_some());
    assert_eq!(collector.total_content_items(), 4); // 2 content + 1 jsx + 1 hash
  }

  #[test]
  fn test_comprehensive_workflow() {
    let mut collector = StringCollector::new();

    // Create 3 separate calls
    let call1_id = collector.increment_counter(); // 1
    let call2_id = collector.increment_counter(); // 2
    let call3_id = collector.increment_counter(); // 3

    collector.initialize_aggregator(call1_id);
    collector.initialize_aggregator(call2_id);
    collector.initialize_aggregator(call3_id);

    // Call 1: Multiple content + JSX + Hash
    collector.set_translation_content(
      call1_id,
      StringCollector::create_translation_content(
        "Call1 Content1".to_string(),
        "hash1-1".to_string(),
        Some("id1-1".to_string()),
        None,
        None,
      ),
    );
    collector.set_translation_content(
      call1_id,
      StringCollector::create_translation_content(
        "Call1 Content2".to_string(),
        "hash1-2".to_string(),
        None,
        Some("ctx1-2".to_string()),
        None,
      ),
    );
    collector.set_translation_jsx(
      call1_id,
      StringCollector::create_translation_jsx("jsx1".to_string()),
    );
    collector.set_translation_hash(
      call1_id,
      StringCollector::create_translation_hash("simple1".to_string()),
    );

    // Call 2: Only content
    collector.set_translation_content(
      call2_id,
      StringCollector::create_translation_content(
        "Call2 Only Content".to_string(),
        "hash2".to_string(),
        None,
        None,
        None,
      ),
    );

    // Call 3: Only JSX
    collector.set_translation_jsx(
      call3_id,
      StringCollector::create_translation_jsx("jsx3".to_string()),
    );

    // Verify totals
    assert_eq!(collector.total_calls(), 4); // counter_ids 1,2,3 require indices 0,1,2,3
    assert_eq!(collector.total_content_items(), 6); // 2 + 1 + 0 content, 1 + 0 + 1 jsx, 1 + 0 + 0 hash = 6

    // Verify Call 1
    let call1 = collector.get_translation_data(call1_id).unwrap();
    assert_eq!(call1.content.len(), 2);
    assert!(call1.jsx.is_some());
    assert!(call1.hash.is_some());
    assert!(collector.has_content_for_injection(call1_id));

    // Verify Call 2
    let call2 = collector.get_translation_data(call2_id).unwrap();
    assert_eq!(call2.content.len(), 1);
    assert!(call2.jsx.is_none());
    assert!(call2.hash.is_none());
    assert!(collector.has_content_for_injection(call2_id));

    // Verify Call 3
    let call3 = collector.get_translation_data(call3_id).unwrap();
    assert_eq!(call3.content.len(), 0);
    assert!(call3.jsx.is_some());
    assert!(call3.hash.is_none());
    assert!(collector.has_content_for_injection(call3_id)); // JSX counts as content

    // Test content array creation
    let array1 = collector.create_content_array(&call1.content, DUMMY_SP);
    let array2 = collector.create_content_array(&call2.content, DUMMY_SP);
    let array3 = collector.create_content_array(&call3.content, DUMMY_SP);

    assert_eq!(array1.elems.len(), 2);
    assert_eq!(array2.elems.len(), 1);
    assert_eq!(array3.elems.len(), 0);

    // Test clear functionality
    collector.clear();
    assert_eq!(collector.total_calls(), 0);
    assert_eq!(collector.total_content_items(), 0);
    assert_eq!(collector.get_counter(), 0);
    assert!(collector.get_translation_data(call1_id).is_none());
  }
}
