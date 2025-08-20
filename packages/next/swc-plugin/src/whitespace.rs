#[derive(Debug, PartialEq)]
enum WhitespaceType {
  NormalSpace,       // Regular space from typing
  Tab,               // Tab character from indentation
  Newline,           // Newline from text formatting
  HtmlEntity,        // Decoded HTML entities like &nbsp;
  UnicodeWhitespace, // Other Unicode whitespace
}

fn classify_whitespace_char(ch: char) -> Option<WhitespaceType> {
  match ch {
    ' ' => Some(WhitespaceType::NormalSpace),
    '\t' => Some(WhitespaceType::Tab),
    '\n' | '\r' => Some(WhitespaceType::Newline),
    '\u{00A0}' => Some(WhitespaceType::HtmlEntity), // &nbsp;
    '\u{00AD}' => Some(WhitespaceType::HtmlEntity), // &shy;
    '\u{202F}' => Some(WhitespaceType::HtmlEntity), // Narrow no-break space
    '\u{2060}' => Some(WhitespaceType::HtmlEntity), // Word joiner
    ch if ch.is_whitespace() => Some(WhitespaceType::UnicodeWhitespace),
    _ => None,
  }
}

pub fn has_significant_whitespace(text: &str) -> bool {
  for ch in text.chars() {
    match classify_whitespace_char(ch) {
      Some(WhitespaceType::NormalSpace) => continue,
      Some(WhitespaceType::Tab) => continue,
      Some(WhitespaceType::Newline) => continue,
      Some(WhitespaceType::HtmlEntity) => return true,
      Some(WhitespaceType::UnicodeWhitespace) => return true,
      None => continue, // Not whitespace
    }
  }
  false
}

pub fn is_normal_whitespace(ch: char) -> bool {
  match classify_whitespace_char(ch) {
    Some(WhitespaceType::NormalSpace) => true,
    Some(WhitespaceType::Tab) => true,
    Some(WhitespaceType::Newline) => true,
    Some(WhitespaceType::HtmlEntity) => false,
    Some(WhitespaceType::UnicodeWhitespace) => false,
    None => false,
  }
}

fn trim_with_callback<F>(text: &str, should_trim: F) -> &str
where
  F: Fn(char) -> bool,
{
  let mut start_byte = text.len();
  let mut end_byte = 0;

  // Find first character that shouldn't be trimmed
  for (byte_pos, ch) in text.char_indices() {
    if !should_trim(ch) {
      start_byte = byte_pos; // Start OF the character, not after
      break;
    }
  }

  // Find last character that shouldn't be trimmed
  for (byte_pos, ch) in text.char_indices().rev() {
    if !should_trim(ch) {
      end_byte = byte_pos + ch.len_utf8(); // End AFTER the character
      break;
    }
  }

  // Handle edge cases
  if start_byte >= text.len() || end_byte == 0 || start_byte >= end_byte {
    return "";
  }

  &text[start_byte..end_byte]
}

// Trim normal whitespace, but keep HTML entities and Unicode whitespace
pub fn trim_normal_whitespace(text: &str) -> &str {
  trim_with_callback(text, is_normal_whitespace)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_trim_normal_whitespace() {
    // Basic cases
    assert_eq!(trim_normal_whitespace("  hello  "), "hello");
    assert_eq!(trim_normal_whitespace("hello"), "hello");
    assert_eq!(trim_normal_whitespace(""), "");

    // Leading whitespace only
    assert_eq!(trim_normal_whitespace("  hello"), "hello");
    assert_eq!(trim_normal_whitespace("\t\nhello"), "hello");
    assert_eq!(trim_normal_whitespace("   \t  hello"), "hello");

    // Trailing whitespace only
    assert_eq!(trim_normal_whitespace("hello  "), "hello");
    assert_eq!(trim_normal_whitespace("hello\t\n"), "hello");
    assert_eq!(trim_normal_whitespace("hello   \t  "), "hello");

    // Mixed normal whitespace types
    assert_eq!(
      trim_normal_whitespace(" \t\n hello world \n\t "),
      "hello world"
    );
    assert_eq!(trim_normal_whitespace("\n\r\t  content  \t\r\n"), "content");

    // All normal whitespace (should return empty)
    assert_eq!(trim_normal_whitespace("   \t\n   "), "");
    assert_eq!(trim_normal_whitespace("\n\n\n"), "");
    assert_eq!(trim_normal_whitespace("\t\t\t"), "");
    assert_eq!(trim_normal_whitespace(" "), "");

    // HTML entities (&nbsp; etc) - should be preserved
    assert_eq!(
      trim_normal_whitespace("\u{00A0}hello\u{00A0}"),
      "\u{00A0}hello\u{00A0}"
    );
    assert_eq!(
      trim_normal_whitespace("\u{00AD}hello\u{00AD}"),
      "\u{00AD}hello\u{00AD}"
    );
    assert_eq!(
      trim_normal_whitespace("\u{202F}hello\u{202F}"),
      "\u{202F}hello\u{202F}"
    );
    assert_eq!(
      trim_normal_whitespace("\u{2060}hello\u{2060}"),
      "\u{2060}hello\u{2060}"
    );

    // Mixed normal and significant whitespace
    assert_eq!(
      trim_normal_whitespace("  \u{00A0}hello\u{00A0}  "),
      "\u{00A0}hello\u{00A0}"
    );
    assert_eq!(
      trim_normal_whitespace("\t\u{00A0}  hello  \u{00A0}\n"),
      "\u{00A0}  hello  \u{00A0}"
    );
    assert_eq!(
      trim_normal_whitespace(" \n\u{202F}content\u{202F} \t"),
      "\u{202F}content\u{202F}"
    );

    // All significant whitespace (should be preserved)
    assert_eq!(
      trim_normal_whitespace("\u{00A0}\u{00A0}"),
      "\u{00A0}\u{00A0}"
    );
    assert_eq!(trim_normal_whitespace("\u{202F}"), "\u{202F}");
    assert_eq!(
      trim_normal_whitespace("\u{00A0}\u{00AD}\u{202F}"),
      "\u{00A0}\u{00AD}\u{202F}"
    );

    // Edge cases with Unicode whitespace (should be preserved)
    assert_eq!(
      trim_normal_whitespace("\u{2000}hello\u{2000}"),
      "\u{2000}hello\u{2000}"
    );
    assert_eq!(
      trim_normal_whitespace("\u{3000}content\u{3000}"),
      "\u{3000}content\u{3000}"
    );

    // Single character content
    assert_eq!(trim_normal_whitespace("  x  "), "x");
    assert_eq!(trim_normal_whitespace("\t\n\u{00A0}\n\t"), "\u{00A0}");

    // Content with internal normal whitespace (should be preserved)
    assert_eq!(trim_normal_whitespace("  hello world  "), "hello world");
    assert_eq!(trim_normal_whitespace("\thello\tworld\t"), "hello\tworld");
    assert_eq!(trim_normal_whitespace("\nhello\nworld\n"), "hello\nworld");

    // Content with internal significant whitespace
    assert_eq!(
      trim_normal_whitespace("  hello\u{00A0}world  "),
      "hello\u{00A0}world"
    );
    assert_eq!(
      trim_normal_whitespace("\thello\u{202F}world\t"),
      "hello\u{202F}world"
    );

    // Complex mixed scenarios
    assert_eq!(
      trim_normal_whitespace(" \t\u{00A0} hello \u{202F} world \u{00A0}\n "),
      "\u{00A0} hello \u{202F} world \u{00A0}"
    );
    assert_eq!(
      trim_normal_whitespace("\n\u{2000}\u{3000}content\u{3000}\u{2000}\n"),
      "\u{2000}\u{3000}content\u{3000}\u{2000}"
    );
  }

  #[test]
  fn test_has_significant_whitespace() {
    // No significant whitespace
    assert!(!has_significant_whitespace("hello world"));
    assert!(!has_significant_whitespace("  \t\n  "));
    assert!(!has_significant_whitespace(""));

    // Has significant whitespace
    assert!(has_significant_whitespace("\u{00A0}"));
    assert!(has_significant_whitespace("hello\u{00A0}world"));
    assert!(has_significant_whitespace("  \u{202F}  "));
    assert!(has_significant_whitespace("\u{2000}content"));

    // Mixed cases
    assert!(has_significant_whitespace(" \t\u{00A0}\n "));
    assert!(!has_significant_whitespace("normal spaces only"));
  }

  #[test]
  fn test_whitespace_classification() {
    // Normal whitespace
    assert!(is_normal_whitespace(' '));
    assert!(is_normal_whitespace('\t'));
    assert!(is_normal_whitespace('\n'));
    assert!(is_normal_whitespace('\r'));

    // Significant whitespace (HTML entities)
    assert!(!is_normal_whitespace('\u{00A0}')); // &nbsp;
    assert!(!is_normal_whitespace('\u{00AD}')); // &shy;
    assert!(!is_normal_whitespace('\u{202F}')); // narrow no-break space
    assert!(!is_normal_whitespace('\u{2060}')); // word joiner

    // Unicode whitespace (should be significant)
    assert!(!is_normal_whitespace('\u{2000}')); // en quad
    assert!(!is_normal_whitespace('\u{3000}')); // ideographic space

    // Non-whitespace
    assert!(!is_normal_whitespace('a'));
    assert!(!is_normal_whitespace('1'));
    assert!(!is_normal_whitespace('!'));
  }
}
