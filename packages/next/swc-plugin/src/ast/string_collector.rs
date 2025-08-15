use swc_core::ecma::ast::*;
use swc_core::common::Span;

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
}

/// Simplified string collector for two-pass transformation
/// 
/// Pass 1 (Observation): 
/// - Mark useGT/getGT calls with unique IDs based on global counter
/// - Collect t() strings and associate with those IDs
/// 
/// Pass 2 (Action):
/// - Look up collected content by regenerating same unique IDs
/// - Inject content arrays into useGT/getGT calls
#[derive(Debug, Default)]
pub struct StringCollector {
    /// THE CORE DATA STRUCTURE
    /// Vector of content lists indexed by counter ID
    /// Index 0: All t() content for counter_id 0 (first useGT/getGT call)
    /// Index 1: All t() content for counter_id 1 (second useGT/getGT call), etc.
    calls_needing_injection: Vec<Vec<TranslationContent>>,
    
    /// Global counter incremented for each useGT/getGT call encountered
    /// Also serves as the next index for calls_needing_injection
    global_call_counter: u32,
}

impl StringCollector {
    /// Create a new empty string collector
    pub fn new() -> Self {
        Self {
            calls_needing_injection: Vec::new(),
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
    /// This creates an empty content list that t() calls will add to
    pub fn initialize_call(&mut self, counter_id: u32) {
        eprintln!("Initializing call for counter_id: {}", counter_id);
        // Ensure the Vec is large enough to hold this index
        while self.calls_needing_injection.len() <= counter_id as usize {
            self.calls_needing_injection.push(Vec::new());
        }
    }
    
    /// Pass 1: Add translation content from a t() call to a specific useGT/getGT
    /// 
    /// The counter_id should come from the scope tracker via get_translation_function()
    pub fn add_translation_content(&mut self, counter_id: u32, content: TranslationContent) {
        eprintln!("Adding content to counter_id: {}, message: {}", counter_id, content.message);
        if let Some(content_list) = self.calls_needing_injection.get_mut(counter_id as usize) {
            content_list.push(content);
        } else {
            // This shouldn't happen if we're using the API correctly
            eprintln!("Warning: Trying to add content to uninitialized call ID: {}", counter_id);
        }
    }
    
    /// Pass 2: Get content for injection into a specific useGT/getGT call
    /// 
    /// Returns None if no content was collected for this call
    pub fn get_content_for_injection(&self, counter_id: u32) -> Option<&Vec<TranslationContent>> {
        self.calls_needing_injection.get(counter_id as usize)
    }
    
    /// Pass 2: Check if a call has any content to inject
    pub fn has_content_for_injection(&self, counter_id: u32) -> bool {
        self.calls_needing_injection
            .get(counter_id as usize)
            .map(|list| !list.is_empty())
            .unwrap_or(false)
    }
    
    /// Helper: Create a TranslationContent from t() call components
    pub fn create_translation_content(
        message: String,
        hash: String,
        id: Option<String>,
        context: Option<String>,
    ) -> TranslationContent {
        TranslationContent {
            message,
            hash,
            id,
            context,
        }
    }
    
    /// Create an array literal for injection: [{message: "text", hash: "abc"}, ...]
    pub fn create_content_array(&self, contents: &[TranslationContent], span: Span) -> ArrayLit {
        let elements: Vec<Option<ExprOrSpread>> = contents.iter().map(|content| {
            let object = self.create_content_object(content, span);
            Some(ExprOrSpread {
                spread: None,
                expr: Box::new(Expr::Object(object)),
            })
        }).collect();
        
        ArrayLit {
            span,
            elems: elements,
        }
    }

    // Helper: Generate a key-value pair for an object literal
    fn generate_key_value_pair(key: &str, value: &str, span: Span) -> PropOrSpread {
        PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
            key: PropName::Ident(Ident {
                span,
                sym: key.into(),
                optional: false,
                ctxt: Default::default(),
            }.into()),
            value: Box::new(Expr::Lit(Lit::Str(Str {
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
            Self::generate_key_value_pair("hash", &content.hash, span),
        ];
        
        // Add optional id property
        if let Some(id) = &content.id {
            props.push(Self::generate_key_value_pair("id", &id, span));
        }
        
        // Add optional context property
        if let Some(context) = &content.context {
            props.push(Self::generate_key_value_pair("context", &context, span));
        }
        
        ObjectLit {
            span,
            props,
        }
    }
    
    /// Debug/testing helper: Get total number of calls initialized
    pub fn total_calls(&self) -> usize {
        self.calls_needing_injection.len()
    }
    
    /// Debug/testing helper: Get total number of content items collected
    pub fn total_content_items(&self) -> usize {
        self.calls_needing_injection
            .iter()
            .map(|list| list.len())
            .sum()
    }
    
    /// Debug/testing helper: Get all counter IDs that have been initialized
    pub fn get_call_ids(&self) -> Vec<u32> {
        (0..self.calls_needing_injection.len() as u32).collect()
    }
    
    /// Reset all state (useful for testing)
    pub fn clear(&mut self) {
        self.calls_needing_injection.clear();
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
        
        assert_eq!(counter_id1, 0);
        assert_eq!(counter_id2, 1);
        assert_eq!(counter_id3, 2);
        
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
        collector.initialize_call(counter_id);
        
        // Should start empty
        assert_eq!(collector.total_calls(), 1);
        assert_eq!(collector.total_content_items(), 0);
        assert!(!collector.has_content_for_injection(counter_id));
        
        // Add content
        let content = TranslationContent {
            message: "Hello world".to_string(),
            hash: "abc123".to_string(),
            id: Some("greeting".to_string()),
            context: None,
        };
        
        collector.add_translation_content(counter_id, content);
        
        // Should now have content
        assert_eq!(collector.total_content_items(), 1);
        assert!(collector.has_content_for_injection(counter_id));
        
        let retrieved = collector.get_content_for_injection(counter_id).unwrap();
        assert_eq!(retrieved.len(), 1);
        assert_eq!(retrieved[0].message, "Hello world");
        assert_eq!(retrieved[0].id, Some("greeting".to_string()));
    }
    
    
    #[test]
    fn test_multiple_content_items() {
        let mut collector = StringCollector::new();
        let counter_id = collector.increment_counter();
        
        collector.initialize_call(counter_id);
        
        // Add multiple content items
        collector.add_translation_content(counter_id, TranslationContent {
            message: "First".to_string(),
            hash: "hash1".to_string(),
            id: None,
            context: None,
        });
        
        collector.add_translation_content(counter_id, TranslationContent {
            message: "Second".to_string(),
            hash: "hash2".to_string(),
            id: Some("second".to_string()),
            context: Some("test".to_string()),
        });
        
        let retrieved = collector.get_content_for_injection(counter_id).unwrap();
        assert_eq!(retrieved.len(), 2);
        assert_eq!(retrieved[0].message, "First");
        assert_eq!(retrieved[1].message, "Second");
        assert_eq!(retrieved[1].id, Some("second".to_string()));
    }
    
    #[test]
    fn test_multiple_separate_calls() {
        let mut collector = StringCollector::new();
        
        // Create multiple separate calls - global counter increments
        let counter_id1 = collector.increment_counter();  // 0
        let counter_id2 = collector.increment_counter();  // 1
        let counter_id3 = collector.increment_counter();  // 2
        
        assert_eq!(counter_id1, 0);
        assert_eq!(counter_id2, 1);
        assert_eq!(counter_id3, 2);
        
        collector.initialize_call(counter_id1);
        collector.initialize_call(counter_id2);
        collector.initialize_call(counter_id3);
        
        // Add content to different calls
        collector.add_translation_content(counter_id1, TranslationContent {
            message: "First Call".to_string(),
            hash: "hash1".to_string(),
            id: None,
            context: None,
        });
        
        collector.add_translation_content(counter_id3, TranslationContent {
            message: "Third Call".to_string(),
            hash: "hash3".to_string(),
            id: None,
            context: None,
        });
        
        // Content should be isolated by unique IDs
        let call1_content = collector.get_content_for_injection(counter_id1).unwrap();
        let call2_content = collector.get_content_for_injection(counter_id2).unwrap();
        let call3_content = collector.get_content_for_injection(counter_id3).unwrap();
        
        assert_eq!(call1_content.len(), 1);
        assert_eq!(call2_content.len(), 0); // No content added
        assert_eq!(call3_content.len(), 1);
        
        assert_eq!(call1_content[0].message, "First Call");
        assert_eq!(call3_content[0].message, "Third Call");
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
            },
            TranslationContent {
                message: "World".to_string(),
                hash: "hash2".to_string(),
                id: None,
                context: Some("global".to_string()),
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
        collector.initialize_call(counter_id);
        collector.add_translation_content(counter_id, TranslationContent {
            message: "Test".to_string(),
            hash: "hash".to_string(),
            id: None,
            context: None,
        });
        
        assert_eq!(collector.total_calls(), 1);
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
        
        // Test safe access with .get() - should return None for out-of-bounds
        assert!(collector.get_content_for_injection(0).is_none());
        assert!(collector.get_content_for_injection(999).is_none());
        assert!(!collector.has_content_for_injection(0));
        assert!(!collector.has_content_for_injection(999));
    }
}