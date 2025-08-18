pub struct HashOperations<'a> {
    settings: &'a PluginSettings,
    logger: &'a Logger,
    // Borrow what you need, when you need it
}

impl<'a> HashOperations<'a> {
  pub fn new(settings: &'a PluginSettings, logger: &'a Logger) -> Self {
      Self { settings, logger }
  }

  pub fn calculate_element_hash(&self, element: &JSXElement) -> (String, String) {
    use crate::ast::JsxTraversal;
    use crate::hash::JsxHasher;
    
    let mut traversal = JsxTraversal::new(self);
    
    // Build sanitized children directly from JSX children
    if let Some(sanitized_children) = traversal.build_sanitized_children(&element.children) {
        // Get the id from the element
        let id = extract_attribute_from_jsx_attr(element, "id");

        // Get the context from the element
        let context = extract_attribute_from_jsx_attr(element, "context");

        // Get the id from the element
        // Create the full SanitizedData structure to match TypeScript implementation
        use crate::hash::SanitizedData;
        let sanitized_data = SanitizedData {
            source: Some(Box::new(sanitized_children)),
            id,
            context,
            data_format: Some("JSX".to_string()),
        };
        // Calculate hash using stable stringify (like TypeScript fast-json-stable-stringify)
        let json_string = JsxHasher::stable_stringify(&sanitized_data)
            .expect("Failed to serialize sanitized data");
        
        
        let hash = JsxHasher::hash_string(&json_string);
        (hash, json_string)
    } else {
        // Fallback to empty content hash with proper wrapper structure
        use crate::hash::{SanitizedData, SanitizedElement, SanitizedChild, SanitizedChildren};
        let empty_element = SanitizedElement {
            b: None,
            c: None,
            t: None,
            d: None,
        };
        
        let empty_children = SanitizedChildren::Single(Box::new(SanitizedChild::Element(Box::new(empty_element))));
        let sanitized_data = SanitizedData {
            source: Some(Box::new(empty_children)),
            id: None,
            context: None,
            data_format: Some("JSX".to_string()),
        };
        
        let json_string = JsxHasher::stable_stringify(&sanitized_data)
            .expect("Failed to serialize empty data");
        
        let hash = JsxHasher::hash_string(&json_string);
        (hash, json_string)
    }
  }

  pub fn inject_hash_attributes(
      &self,
      mut element: JSXElement,
      string_collector: &mut StringCollector  // Pass as parameter
  ) -> JSXElement {
      // Original logic, but string_collector passed in
  }
}