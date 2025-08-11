#[derive(Debug, PartialEq)]
enum WhitespaceType {
    NormalSpace,           // Regular space from typing
    Tab,                   // Tab character from indentation
    Newline,              // Newline from text formatting
    HtmlEntity,           // Decoded HTML entities like &nbsp;
    UnicodeWhitespace,    // Other Unicode whitespace
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


fn is_normal_whitespace(ch: char) -> bool {
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
    F: Fn(char) -> bool
{
    let mut start_byte = 0;
    let mut end_byte = text.len();

    // Find first character that shouldn't be trimmed
    for (byte_pos, ch) in text.char_indices() {
        if !should_trim(ch) {
            start_byte = byte_pos;  // Start OF the character, not after
            break;
        }
    }

    // Find last character that shouldn't be trimmed
    for (byte_pos, ch) in text.char_indices().rev() {
        if !should_trim(ch) {
            end_byte = byte_pos + ch.len_utf8();  // End AFTER the character
            break;
        }
    }

    // Handle edge cases
    if start_byte >= end_byte {
        return "";
    }

    &text[start_byte..end_byte]
}


// Trim normal whitespace, but keep HTML entities and Unicode whitespace
pub fn trim_normal_whitespace<'a>(text: &'a str) -> &'a str {
    trim_with_callback(text, is_normal_whitespace)
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_trim_normal_whitespace() {
        // Should trim normal spaces
        assert_eq!(trim_normal_whitespace("  hello  "), "hello");

        // Should keep &nbsp; (non-breaking space)
        assert_eq!(trim_normal_whitespace("\u{00A0}hello\u{00A0}"), "\u{00A0}hello\u{00A0}");

        // Mixed case
        assert_eq!(trim_normal_whitespace("  \u{00A0}hello\u{00A0}  "), "\u{00A0}hello\u{00A0}");

        // All normal whitespace
        assert_eq!(trim_normal_whitespace("   \t\n   "), "");

        // All significant whitespace  
        assert_eq!(trim_normal_whitespace("\u{00A0}\u{00A0}"), "\u{00A0}\u{00A0}");
    }
}