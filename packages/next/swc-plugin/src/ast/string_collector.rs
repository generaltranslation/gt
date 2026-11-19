/// Content extracted from JSX translation components like <T>
#[derive(Debug, Clone)]
pub struct TranslationJsx {
  /// Pre-calculated hash for this JSX content
  pub hash: String,
}

/// Translation data collected for one counter ID
#[derive(Debug, Clone, Default)]
pub struct TranslationData {
  /// JSX component data (if any)
  pub jsx: Option<TranslationJsx>,
}

/// Collector for the two-pass transformation
///
/// Pass 1 (Observation):
/// - Give each translation component a unique ID from the global counter
/// - Store its hash under that ID
///
/// Pass 2 (Action):
/// - Regenerate the same IDs and inject the stored hash into each component
#[derive(Debug, Default)]
pub struct StringCollector {
  /// Translation data indexed by counter ID
  aggregators: Vec<TranslationData>,

  /// Global counter incremented for each translation component encountered
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

  /// Increment counter and return the current counter ID for a translation component
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

  /// Pass 1: Make room for the translation data of a counter ID
  pub fn initialize_aggregator(&mut self, counter_id: u32) {
    // Ensure the Vec is large enough to hold this index
    while self.aggregators.len() <= counter_id as usize {
      self.aggregators.push(TranslationData::default());
    }
  }

  /// Pass 1: Set JSX translation content for a counter ID
  /// Only one JSX item can be set per call (overwrites if called multiple times)
  pub fn set_translation_jsx(&mut self, counter_id: u32, jsx: TranslationJsx) {
    if let Some(call) = self.aggregators.get_mut(counter_id as usize) {
      call.jsx = Some(jsx);
    } else {
      eprintln!("Warning: Trying to set JSX for uninitialized call ID: {counter_id}");
    }
  }

  /// Pass 2: Get the translation data stored for a counter ID
  ///
  /// Returns None if no call was initialized for this counter_id
  pub fn get_translation_data(&self, counter_id: u32) -> Option<&TranslationData> {
    self.aggregators.get(counter_id as usize)
  }

  /// Get the translation JSX for a counter ID
  pub fn get_translation_jsx(&self, counter_id: u32) -> Option<&TranslationJsx> {
    self
      .aggregators
      .get(counter_id as usize)
      .and_then(|data| data.jsx.as_ref())
  }

  /// Pass 2: Check if a call has any content to inject
  pub fn has_content_for_injection(&self, counter_id: u32) -> bool {
    self
      .aggregators
      .get(counter_id as usize)
      .is_some_and(|call| call.jsx.is_some())
  }

  /// Helper: Create a TranslationJsx from JSX component props
  pub fn create_translation_jsx(hash: String) -> TranslationJsx {
    TranslationJsx { hash }
  }

  /// Debug/testing helper: Get total number of calls initialized
  pub fn total_calls(&self) -> usize {
    self.aggregators.len()
  }

  /// Debug/testing helper: Get total number of JSX items collected
  pub fn total_content_items(&self) -> usize {
    self
      .aggregators
      .iter()
      .filter(|call| call.jsx.is_some())
      .count()
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
  fn test_clear_functionality() {
    let mut collector = StringCollector::new();

    let counter_id = collector.increment_counter();
    collector.initialize_aggregator(counter_id);
    collector.set_translation_jsx(
      counter_id,
      StringCollector::create_translation_jsx("hash".to_string()),
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
    assert!(retrieved.jsx.is_some());

    let jsx = retrieved.jsx.as_ref().unwrap();
    assert_eq!(jsx.hash, "jsx-hash-123");
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
  fn test_empty_call_behavior() {
    let mut collector = StringCollector::new();

    let counter_id = collector.increment_counter();
    collector.initialize_aggregator(counter_id);

    // Call should be initialized but empty
    let call = collector.get_translation_data(counter_id).unwrap();
    assert!(call.jsx.is_none());

    // Should have no content to inject
    assert!(!collector.has_content_for_injection(counter_id));
    assert_eq!(collector.total_content_items(), 0);
  }
}
