//! Texts that are not the file's own text, mapped back to it: an inline template, which is a
//! JavaScript string literal's content with its escapes resolved, and the values Angular decodes
//! character references in.

use std::borrow::Cow;

use crate::languages::CodeBuilder;

/// A character of a text that stands for more of the text it comes from, e.g. `&amp;` or `\n`.
#[derive(Clone, Copy, Debug)]
struct Replaced {
  /// Where it is in the text, and its length.
  at: u32,
  length: u32,
  /// What it stands for in the outer text.
  start: u32,
  end: u32,
}

/// A text made of consecutive parts of an outer text: the same characters from `base` on, but for
/// those replaced.
pub struct Mapped<'a> {
  pub text: Cow<'a, str>,
  base: u32,
  replaced: Vec<Replaced>,
}

/// A part of a mapped text in the outer text: a copy, or a text written for a range.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Piece {
  Copy(u32, u32),
  Replaced {
    start: u32,
    end: u32,
    at: u32,
    length: u32,
  },
}

impl<'a> Mapped<'a> {
  /// `text`, which is the outer text from `base` on.
  pub fn verbatim(text: &'a str, base: u32) -> Self {
    Mapped {
      text: Cow::Borrowed(text),
      base,
      replaced: Vec::new(),
    }
  }

  /// The offset in the outer text of `offset` in this one.
  pub fn outer(&self, offset: u32) -> u32 {
    let index = self
      .replaced
      .partition_point(|replaced| replaced.at <= offset);
    match index.checked_sub(1).map(|index| self.replaced[index]) {
      None => self.base + offset,
      Some(replaced) if offset < replaced.at + replaced.length => replaced.start,
      Some(replaced) => replaced.end + (offset - replaced.at - replaced.length),
    }
  }

  /// The parts of `text[start..end]` in the outer text, in order.
  pub fn pieces(&self, start: u32, end: u32, mut piece: impl FnMut(Piece)) {
    let mut at = start;
    let mut outer = self.outer(start);
    let first = self
      .replaced
      .partition_point(|replaced| replaced.at + replaced.length <= start);
    for replaced in &self.replaced[first..] {
      if replaced.at >= end {
        break;
      }
      if replaced.at > at {
        piece(Piece::Copy(outer, outer + (replaced.at - at)));
      }
      piece(Piece::Replaced {
        start: replaced.start,
        end: replaced.end,
        at: replaced.at,
        length: replaced.length,
      });
      at = replaced.at + replaced.length;
      outer = replaced.end;
    }
    if at < end {
      piece(Piece::Copy(outer, outer + (end - at)));
    }
  }
}

/// Builds a mapped text from consecutive parts of an outer text.
pub struct MappedBuilder {
  text: String,
  replaced: Vec<Replaced>,
}

impl MappedBuilder {
  pub fn new(capacity: usize) -> Self {
    MappedBuilder {
      text: String::with_capacity(capacity),
      replaced: Vec::new(),
    }
  }

  /// Appends `outer[start..end]`, as it is.
  pub fn copy(&mut self, outer: &str, start: usize, end: usize) {
    if end > start {
      self.text.push_str(&outer[start..end]);
    }
  }

  /// Appends `text` for `outer[start..end]`.
  pub fn replace(&mut self, text: &str, start: usize, end: usize) {
    let at = self.text.len() as u32;
    self.text.push_str(text);
    self.replaced.push(Replaced {
      at,
      length: text.len() as u32,
      start: start as u32,
      end: end as u32,
    });
  }

  /// The text, whose first part starts at `base` in the outer text.
  pub fn finish<'a>(self, base: u32) -> Mapped<'a> {
    Mapped {
      text: Cow::Owned(self.text),
      base,
      replaced: self.replaced,
    }
  }
}

/// Writes `inner.text[start..end]` (or the template's own `text[start..end]` without `inner`),
/// mapped to the file: `template` is the template's text in the file.
pub fn write_mapped(
  code: &mut CodeBuilder,
  template: &Mapped,
  inner: Option<&Mapped>,
  start: u32,
  end: u32,
) {
  let Some(inner) = inner else {
    write_template_range(code, template, start, end);
    return;
  };
  inner.pieces(start, end, |piece| match piece {
    Piece::Copy(start, end) => write_template_range(code, template, start, end),
    Piece::Replaced {
      start,
      end,
      at,
      length,
    } => {
      let text = &inner.text[at as usize..(at + length) as usize];
      code.write_for(
        template.outer(start) as usize,
        template.outer(end) as usize,
        text,
      );
    }
  });
}

fn write_template_range(code: &mut CodeBuilder, template: &Mapped, start: u32, end: u32) {
  template.pieces(start, end, |piece| match piece {
    Piece::Copy(start, end) => code.copy(start as usize, end as usize),
    Piece::Replaced {
      start,
      end,
      at,
      length,
    } => code.write_for(
      start as usize,
      end as usize,
      &template.text[at as usize..(at + length) as usize],
    ),
  });
}

/// The content of a JavaScript string literal, `source[start..end]`, with its escapes resolved as
/// Angular's `EscapedCharacterCursor` resolves them. Fails on an invalid hexadecimal escape.
pub fn unescape(source: &str, start: usize, end: usize) -> Result<Mapped<'_>, String> {
  let content = &source[start..end];
  if !content.contains('\\') {
    return Ok(Mapped::verbatim(content, start as u32));
  }

  let bytes = source.as_bytes();
  let mut text = MappedBuilder::new(content.len());
  let mut copied = start;
  let mut index = start;
  let invalid = || "Invalid hexadecimal escape sequence".to_string();

  while index < end {
    if bytes[index] != b'\\' {
      index += 1;
      continue;
    }
    text.copy(source, copied, index);
    let escape = index;
    index += 1;
    let Some(&kind) = bytes.get(index).filter(|_| index < end) else {
      return Err("Unexpected character \"EOF\"".to_string());
    };
    let character = match kind {
      b'n' => Some('\n'),
      b'r' => Some('\r'),
      b'v' => Some('\u{b}'),
      b't' => Some('\t'),
      b'b' => Some('\u{8}'),
      b'f' => Some('\u{c}'),
      b'u' => {
        index += 1;
        if bytes.get(index) == Some(&b'{') {
          let digits = index + 1;
          let close = source[digits..end]
            .find('}')
            .map(|offset| digits + offset)
            .ok_or_else(|| "Unexpected character \"EOF\"".to_string())?;
          index = close;
          Some(hex_character(&source[digits..close]).ok_or_else(invalid)?)
        } else {
          let digits_end = (index + 4).min(end);
          let character = hex_character(&source[index..digits_end]).ok_or_else(invalid)?;
          index = digits_end - 1;
          Some(character)
        }
      }
      b'x' => {
        let digits = index + 1;
        let digits_end = (digits + 2).min(end);
        let character = hex_character(&source[digits..digits_end]).ok_or_else(invalid)?;
        index = digits_end - 1;
        Some(character)
      }
      b'0'..=b'7' => {
        let mut value = 0u32;
        let mut length = 0;
        while length < 3 && index < end && (b'0'..=b'7').contains(&bytes[index]) {
          value = value * 8 + u32::from(bytes[index] - b'0');
          index += 1;
          length += 1;
        }
        index -= 1;
        Some(char::from_u32(value).unwrap_or('\u{fffd}'))
      }
      b'\n' | b'\r' => None,
      _ => source[index..].chars().next(),
    };

    match character {
      Some(character) => {
        let mut buffer = [0u8; 4];
        let width = source[index..].chars().next().map_or(1, char::len_utf8);
        index += width;
        text.replace(character.encode_utf8(&mut buffer), escape, index);
      }
      None => {
        // A line continuation: nothing, and the next character stands for both.
        index += 1;
        match source[index..end].chars().next() {
          Some(next) => {
            let mut buffer = [0u8; 4];
            index += next.len_utf8();
            text.replace(next.encode_utf8(&mut buffer), escape, index);
          }
          None => text.replace("", escape, index),
        }
      }
    }
    copied = index;
  }
  text.copy(source, copied, end);

  Ok(text.finish(start as u32))
}

/// The character of hexadecimal digits, as `parseInt(hex, 16)` reads them: their leading digits.
fn hex_character(hex: &str) -> Option<char> {
  let digits = hex
    .bytes()
    .position(|byte| !byte.is_ascii_hexdigit())
    .unwrap_or(hex.len());
  if digits == 0 || digits > 8 {
    return None;
  }
  let code = u32::from_str_radix(&hex[..digits], 16).ok()?;
  Some(char::from_u32(code).unwrap_or('\u{fffd}'))
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn escapes_are_mapped_to_their_range() {
    let source = r#"x = '<p title=\"a\">{{ m.b(\'c\') }}</p>';"#;
    let start = source.find('<').unwrap_or(0);
    let end = source.rfind('\'').unwrap_or(0);
    let text = unescape(source, start, end).ok();
    let text = text.as_ref().map(|text| text.text.as_ref());
    assert_eq!(text, Some(r#"<p title="a">{{ m.b('c') }}</p>"#));

    let mapped = unescape(source, start, end).ok();
    let Some(mapped) = mapped else { return };
    let call = mapped.text.find("m.b").unwrap_or(0) as u32;
    assert_eq!(mapped.outer(call) as usize, source.find("m.b").unwrap_or(0));
    let mut pieces = Vec::new();
    mapped.pieces(call, call + 8, |piece| pieces.push(piece));
    let quote = source.find(r"\'c").unwrap_or(0) as u32;
    assert_eq!(
      pieces,
      vec![
        Piece::Copy(quote - 4, quote),
        Piece::Replaced {
          start: quote,
          end: quote + 2,
          at: call + 4,
          length: 1
        },
        Piece::Copy(quote + 2, quote + 3),
        Piece::Replaced {
          start: quote + 3,
          end: quote + 5,
          at: call + 6,
          length: 1
        },
        Piece::Copy(quote + 5, quote + 6),
      ]
    );
  }

  #[test]
  fn other_escapes() {
    let source = "'\\x41\\u0042\\u{43}\\101\\\nD\\q'";
    let mapped = unescape(source, 1, source.len() - 1).ok();
    assert_eq!(
      mapped.as_ref().map(|mapped| mapped.text.as_ref()),
      Some("ABCADq")
    );
    assert!(unescape("'\\xZZ'", 1, 5).is_err());
  }
}
