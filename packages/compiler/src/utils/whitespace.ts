/**
 * Whitespace handling utilities for GT Babel plugin
 *
 * CRITICAL: This must match the Rust implementation exactly to ensure
 * consistent whitespace handling between SWC and Babel plugins.
 */

/**
 * Types of whitespace characters
 */
enum WhitespaceType {
  NormalSpace, // Regular space from typing
  Tab, // Tab character from indentation
  Newline, // Newline from text formatting
  HtmlEntity, // Decoded HTML entities like &nbsp;
  UnicodeWhitespace, // Other Unicode whitespace
}

/**
 * Classify a character as a specific type of whitespace
 */
function classifyWhitespaceChar(ch: string): WhitespaceType | null {
  if (ch.length !== 1) return null;

  switch (ch) {
    case ' ':
      return WhitespaceType.NormalSpace;
    case '\t':
      return WhitespaceType.Tab;
    case '\n':
    case '\r':
      return WhitespaceType.Newline;
    case '\u00A0': // &nbsp;
    case '\u00AD': // &shy;
    case '\u202F': // Narrow no-break space
    case '\u2060': // Word joiner
      return WhitespaceType.HtmlEntity;
    default:
      // Check if it's other Unicode whitespace
      if (/\s/.test(ch)) {
        return WhitespaceType.UnicodeWhitespace;
      }
      return null;
  }
}

/**
 * Check if text contains significant whitespace (HTML entities or Unicode whitespace)
 * that must be preserved during transformation
 */
export function hasSignificantWhitespace(text: string): boolean {
  for (const ch of text) {
    const type = classifyWhitespaceChar(ch);
    switch (type) {
      case WhitespaceType.NormalSpace:
      case WhitespaceType.Tab:
      case WhitespaceType.Newline:
        continue;
      case WhitespaceType.HtmlEntity:
      case WhitespaceType.UnicodeWhitespace:
        return true;
      case null:
        continue; // Not whitespace
    }
  }
  return false;
}

/**
 * Check if a character is "normal" whitespace (space, tab, newline)
 * that can be safely trimmed
 */
export function isNormalWhitespace(ch: string): boolean {
  if (ch.length !== 1) return false;

  const type = classifyWhitespaceChar(ch);
  switch (type) {
    case WhitespaceType.NormalSpace:
    case WhitespaceType.Tab:
    case WhitespaceType.Newline:
      return true;
    case WhitespaceType.HtmlEntity:
    case WhitespaceType.UnicodeWhitespace:
    case null:
      return false;
  }
}

/**
 * Generic trim function with callback to determine what should be trimmed
 */
function trimWithCallback(
  text: string,
  shouldTrim: (ch: string) => boolean
): string {
  if (text.length === 0) return '';

  let startIndex = text.length;
  let endIndex = 0;

  // Find first character that shouldn't be trimmed
  let currentIndex = 0;
  for (const ch of text) {
    if (!shouldTrim(ch)) {
      startIndex = currentIndex;
      break;
    }
    currentIndex++;
  }

  // Find last character that shouldn't be trimmed
  currentIndex = 0;
  for (const ch of text) {
    if (!shouldTrim(ch)) {
      endIndex = currentIndex + 1; // End AFTER the character
    }
    currentIndex++;
  }

  // Handle edge cases
  if (startIndex >= text.length || endIndex === 0 || startIndex >= endIndex) {
    return '';
  }

  return text.slice(startIndex, endIndex);
}

/**
 * Trim normal whitespace (space, tab, newline) but preserve HTML entities
 * and Unicode whitespace which are significant for translation
 */
export function trimNormalWhitespace(text: string): string {
  return trimWithCallback(text, isNormalWhitespace);
}
