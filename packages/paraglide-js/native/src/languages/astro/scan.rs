//! Byte-level scanning of an Astro file's JavaScript and HTML. Every position returned is at an
//! ASCII byte or the end of the text, so the text can be sliced there.

use memchr::{memchr, memchr3, memmem};

/// What a byte starts in JavaScript.
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Class {
  Space,
  /// An identifier or keyword: letters, `_`, `$`, `#` and any non-ASCII character.
  Word,
  Digit,
  Other,
}

const CLASSES: [Class; 256] = {
  let mut classes = [Class::Other; 256];
  let mut byte = 0;
  while byte < 256 {
    let b = byte as u8;
    classes[byte] = if b == b' ' || b == b'\t' || b == b'\n' || b == b'\r' || b == 0x0b || b == 0x0c
    {
      Class::Space
    } else if b.is_ascii_alphabetic() || b == b'_' || b == b'$' || b == b'#' || b >= 0x80 {
      Class::Word
    } else if b.is_ascii_digit() {
      Class::Digit
    } else {
      Class::Other
    };
    byte += 1;
  }
  classes
};

pub fn class(byte: u8) -> Class {
  CLASSES[byte as usize]
}

/// A byte that continues an identifier (or a number).
fn is_word_part(byte: u8) -> bool {
  matches!(class(byte), Class::Word | Class::Digit)
}

/// HTML's whitespace.
pub fn is_space(byte: u8) -> bool {
  matches!(byte, b' ' | b'\t' | b'\n' | b'\r' | 0x0c)
}

pub fn skip_space(bytes: &[u8], mut pos: usize) -> usize {
  while pos < bytes.len() && is_space(bytes[pos]) {
    pos += 1;
  }
  pos
}

/// The end of the identifier, keyword or number that continues at `pos`.
pub fn word_end(bytes: &[u8], mut pos: usize) -> usize {
  while pos < bytes.len() && is_word_part(bytes[pos]) {
    pos += 1;
  }
  pos
}

/// The end of a number's digits, letters and dots from `pos`.
pub fn number_end(bytes: &[u8], mut pos: usize) -> usize {
  while pos < bytes.len() && (is_word_part(bytes[pos]) || bytes[pos] == b'.') {
    pos += 1;
  }
  pos
}

/// The end of an ASCII identifier (`[A-Za-z_$][A-Za-z0-9_$]*`) at `pos`, or `pos` if none is.
pub fn ascii_identifier_end(bytes: &[u8], pos: usize) -> usize {
  let is_start = |byte: u8| byte.is_ascii_alphabetic() || byte == b'_' || byte == b'$';
  if !bytes.get(pos).is_some_and(|&byte| is_start(byte)) {
    return pos;
  }

  let mut end = pos + 1;
  while end < bytes.len() && (is_start(bytes[end]) || bytes[end].is_ascii_digit()) {
    end += 1;
  }
  end
}

/// After the string literal that starts at `start` with `quote`; at the line's end when it is not
/// closed there.
pub fn string_end(bytes: &[u8], start: usize, quote: u8) -> usize {
  let mut pos = start + 1;
  while pos < bytes.len() {
    let Some(found) = memchr3(quote, b'\\', b'\n', &bytes[pos..]) else {
      return bytes.len();
    };
    pos += found;
    match bytes[pos] {
      b'\\' => pos += escape_length(bytes, pos),
      b'\n' => return pos,
      _ => return pos + 1,
    }
  }
  bytes.len()
}

/// The length of the escape sequence at `pos`, as far as where it ends matters: `\` and the
/// character after it, a whole CRLF line break included.
fn escape_length(bytes: &[u8], pos: usize) -> usize {
  if bytes.get(pos + 1) == Some(&b'\r') && bytes.get(pos + 2) == Some(&b'\n') {
    3
  } else {
    2
  }
}

/// After the regular expression literal that starts at `start`, flags included; at the line's end
/// when it is not closed there.
pub fn regex_end(bytes: &[u8], start: usize) -> usize {
  let mut pos = start + 1;
  let mut is_in_class = false;
  while pos < bytes.len() {
    match bytes[pos] {
      b'\\' => pos += 2,
      b'[' => {
        is_in_class = true;
        pos += 1;
      }
      b']' => {
        is_in_class = false;
        pos += 1;
      }
      b'/' if !is_in_class => return word_end(bytes, pos + 1),
      b'\n' | b'\r' => return pos,
      _ => pos += 1,
    }
  }
  bytes.len()
}

/// The end of the line comment at `start`: its line break.
pub fn line_comment_end(bytes: &[u8], start: usize) -> usize {
  memchr(b'\n', &bytes[start..]).map_or(bytes.len(), |found| start + found)
}

/// After the block comment `/* … */` at `start`.
pub fn block_comment_end(bytes: &[u8], start: usize) -> usize {
  find(bytes, start + 2, b"*/").map_or(bytes.len(), |found| found + 2)
}

/// Where `needle` next occurs from `from`.
pub fn find(bytes: &[u8], from: usize, needle: &[u8]) -> Option<usize> {
  memmem::find(bytes.get(from..)?, needle).map(|found| from + found)
}

/// After the next `>` from `pos`.
pub fn after_gt(bytes: &[u8], pos: usize) -> usize {
  memchr(b'>', &bytes[pos.min(bytes.len())..]).map_or(bytes.len(), |found| pos + found + 1)
}

/// Keywords after which an expression starts, so that `/` begins a regular expression and `<`
/// an element.
pub fn is_expression_keyword(word: &[u8]) -> bool {
  matches!(
    word,
    b"return"
      | b"typeof"
      | b"instanceof"
      | b"in"
      | b"of"
      | b"new"
      | b"delete"
      | b"void"
      | b"throw"
      | b"case"
      | b"do"
      | b"else"
      | b"yield"
      | b"await"
      | b"async"
  )
}

/// The closing `>` of the type parameters of a generic arrow function, `<T>(x: T) => x`, whose
/// `<` is at `start`: followed by `(`.
pub fn generic_arrow_parameters_end(bytes: &[u8], start: usize) -> Option<usize> {
  /// Type parameters longer than this are not looked for.
  const MAX_LENGTH: usize = 1024;

  let first = skip_space(bytes, start + 1);
  if !bytes
    .get(first)
    .is_some_and(|&byte| byte.is_ascii_alphabetic() || byte == b'_' || byte == b'$')
  {
    return None;
  }

  let end = bytes.len().min(start + MAX_LENGTH);
  let mut angles = 1u32;
  let mut brackets = 0u32;
  let mut pos = first;
  while pos < end {
    match bytes[pos] {
      b'<' => angles += 1,
      // `=>` in a function type.
      b'>' if bytes[pos - 1] == b'=' => {}
      b'>' => {
        angles -= 1;
        if angles == 0 {
          let after = skip_space(bytes, pos + 1);
          return (brackets == 0 && bytes.get(after) == Some(&b'(')).then_some(pos);
        }
      }
      b'(' | b'[' | b'{' => brackets += 1,
      b')' | b']' | b'}' => brackets = brackets.checked_sub(1)?,
      b'\'' | b'"' => {
        pos = string_end(bytes, pos, bytes[pos]);
        continue;
      }
      b';' => return None,
      _ => {}
    }
    pos += 1;
  }
  None
}

/// The last byte of `bytes[start..end)` that is not whitespace.
pub fn last_non_space(bytes: &[u8], start: usize, end: usize) -> Option<u8> {
  bytes[start..end]
    .iter()
    .rev()
    .copied()
    .find(|&byte| !is_space(byte))
}

/// Whether the `return` keyword that ends at `pos` returns a value: nothing but spaces before an
/// expression on its line.
pub fn returns_value(bytes: &[u8], mut pos: usize) -> bool {
  while pos < bytes.len() && matches!(bytes[pos], b' ' | b'\t') {
    pos += 1;
  }
  match bytes.get(pos) {
    None | Some(b'\n' | b'\r' | b';' | b'}') => false,
    Some(b'/') => bytes.get(pos + 1) != Some(&b'/'),
    Some(_) => true,
  }
}

// ---------------------------------------------------------------- HTML

/// The end of a tag name from `pos`.
pub fn tag_name_end(bytes: &[u8], mut pos: usize) -> usize {
  while pos < bytes.len() && !matches!(bytes[pos], b'/' | b'>' | b'{') && !is_space(bytes[pos]) {
    pos += 1;
  }
  pos
}

/// The end of the attribute name that starts at `start`, which is part of it whatever it is.
pub fn attribute_name_end(bytes: &[u8], start: usize) -> usize {
  let mut pos = start + 1;
  while pos < bytes.len()
    && !matches!(bytes[pos], b'=' | b'/' | b'>' | b'{')
    && !is_space(bytes[pos])
  {
    pos += 1;
  }
  pos
}

/// The end of an unquoted attribute value from `pos`.
pub fn unquoted_value_end(bytes: &[u8], mut pos: usize) -> usize {
  while pos < bytes.len() && bytes[pos] != b'>' && !is_space(bytes[pos]) {
    pos += 1;
  }
  pos
}

/// After the quoted attribute value at `start`: HTML ends it only at its closing quote.
pub fn quoted_value_end(bytes: &[u8], start: usize) -> Option<usize> {
  let quote = bytes[start];
  memchr(quote, &bytes[start + 1..]).map(|found| start + 1 + found + 1)
}

/// Where the end tag `</name` of a raw text element starts, from `pos`; the text's end if none.
pub fn raw_text_end(bytes: &[u8], mut pos: usize, name: &[u8]) -> usize {
  while let Some(found) = find(bytes, pos, b"</") {
    let after = found + 2 + name.len();
    let is_end_tag = bytes.get(found + 2..after) == Some(name)
      && bytes
        .get(after)
        .is_none_or(|&byte| matches!(byte, b'>' | b'/') || is_space(byte));
    if is_end_tag {
      return found;
    }
    pos = found + 2;
  }
  bytes.len()
}

/// HTML's void elements, which have no end tag.
pub fn is_void_element(name: &[u8]) -> bool {
  matches!(
    name,
    b"area"
      | b"base"
      | b"br"
      | b"col"
      | b"embed"
      | b"hr"
      | b"img"
      | b"input"
      | b"keygen"
      | b"link"
      | b"meta"
      | b"param"
      | b"source"
      | b"track"
      | b"wbr"
  )
}

/// What a tag's name is in JSX.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum TagName {
  /// A component, `Card` or `ui.Card`: the name is a reference.
  Component,
  /// A lowercase or dashed name, `div` or `my-element`, valid in JSX.
  Intrinsic,
  /// A name that is not valid in JSX: written as an intrinsic placeholder.
  Invalid,
}

impl TagName {
  pub fn of(name: &[u8]) -> TagName {
    let Some(&first) = name.first() else {
      return TagName::Invalid;
    };

    if name.contains(&b'.') {
      let is_member_expression = name
        .split(|&byte| byte == b'.')
        .all(|part| !part.is_empty() && ascii_identifier_end(part, 0) == part.len());
      return if is_member_expression {
        TagName::Component
      } else {
        TagName::Invalid
      };
    }

    let is_intrinsic = first.is_ascii_lowercase() || name.contains(&b'-') || name.contains(&b':');
    if is_intrinsic {
      return if is_jsx_name(name) {
        TagName::Intrinsic
      } else {
        TagName::Invalid
      };
    }

    if ascii_identifier_end(name, 0) == name.len() {
      TagName::Component
    } else {
      TagName::Invalid
    }
  }
}

/// A JSX attribute or intrinsic element name: an identifier that may contain `-`, or two such
/// joined by `:`.
pub fn is_jsx_name(name: &[u8]) -> bool {
  let mut parts = name.splitn(2, |&byte| byte == b':');
  parts.all(|part| {
    part
      .first()
      .is_some_and(|&first| first.is_ascii_alphabetic() || first == b'_' || first == b'$')
      && part
        .iter()
        .all(|&byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'$' | b'-'))
  })
}

/// An attribute name as a JavaScript string's content: itself when it needs no escaping.
pub fn property_key(name: &str) -> &str {
  let is_plain = name
    .bytes()
    .all(|byte| byte.is_ascii_graphic() && byte != b'"' && byte != b'\\');
  if is_plain {
    name
  } else {
    "_"
  }
}
