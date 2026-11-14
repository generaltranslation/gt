//! MDX's JSX tags, as `micromark-extension-mdx-jsx` reads them: a name (`a`, `a.b.c`, `a:b`),
//! attributes whose values are strings or `{…}` expressions, `{…spread}` attributes, and
//! whitespace, line endings included, between them. Anything else after `<` is an error.

use super::js::Lexer;

/// A tag from its `<` to after its `>`.
pub struct Tag {
  pub end: usize,
  pub is_closing: bool,
  pub is_self_closing: bool,
  /// From the first character of the name to the end of its last part; empty for fragments.
  pub name: (usize, usize),
  pub has_attributes: bool,
}

/// An attribute's `{…}`: a value, or a spread when `is_spread`.
pub struct Expression {
  pub start: usize,
  pub end: usize,
  pub is_spread: bool,
}

const NAME_START: &str = "a character that can start a name, such as a letter, `$`, or `_`";
const NAME: &str = "a name character such as letters, digits, `$`, or `_`; whitespace before attributes; or the end of the tag";
const ATTRIBUTE_START: &str = "a character that can start an attribute name, such as a letter, `$`, or `_`; whitespace before attributes; or the end of the tag";
const ATTRIBUTE_NAME: &str = "an attribute name character such as letters, digits, `$`, or `_`; `=` to initialize a value; whitespace before attributes; or the end of the tag";
const AFTER_ATTRIBUTE_NAME: &str = "a character that can start an attribute name, such as a letter, `$`, or `_`; `=` to initialize a value; or the end of the tag";
const LINK_NOTE: &str = " (note: to create a link in MDX, use `[text](url)`)";
const COMMENT_NOTE: &str = " (note: JS comments in JSX tags are not supported in MDX)";

struct Reader<'s, 'l> {
  src: &'s str,
  bytes: &'s [u8],
  lexer: &'l mut Lexer<'s>,
}

/// The tag at `start` (a `<`), its attribute expressions added to `expressions`; none when `<` is
/// followed by whitespace, which makes it text. Fails as MDX does.
pub fn tag<'s>(
  src: &'s str,
  start: usize,
  lexer: &mut Lexer<'s>,
  expressions: &mut Vec<Expression>,
) -> Result<Option<Tag>, String> {
  let mut reader = Reader {
    src,
    bytes: src.as_bytes(),
    lexer,
  };
  reader.tag(start, expressions)
}

impl<'s> Reader<'s, '_> {
  fn tag(
    &mut self,
    start: usize,
    expressions: &mut Vec<Expression>,
  ) -> Result<Option<Tag>, String> {
    let mut at = start + 1;
    match self.bytes.get(at) {
      None => return Err(self.crash(at, "before name", NAME_START.to_string())),
      Some(b' ' | b'\t' | b'\n' | b'\r') => return Ok(None),
      _ => {}
    }

    at = self.whitespace(at);
    let mut tag = Tag {
      end: 0,
      is_closing: false,
      is_self_closing: false,
      name: (at, at),
      has_attributes: false,
    };

    if self.byte(at) == Some(b'/') {
      tag.is_closing = true;
      at = self.whitespace(at + 1);
      tag.name = (at, at);
      if self.byte(at) == Some(b'>') {
        tag.end = at + 1;
        return Ok(Some(tag));
      }
      if !self.is_name_start(at) {
        let note = if matches!(self.byte(at), Some(b'*' | b'/')) {
          COMMENT_NOTE
        } else {
          ""
        };
        return Err(self.crash(at, "before name", format!("{NAME_START}{note}")));
      }
    } else if self.byte(at) == Some(b'>') {
      tag.end = at + 1;
      return Ok(Some(tag));
    } else if !self.is_name_start(at) {
      let note = if self.byte(at) == Some(b'!') {
        " (note: to create a comment in MDX, use `{/* text */}`)"
      } else {
        ""
      };
      return Err(self.crash(at, "before name", format!("{NAME_START}{note}")));
    }

    at = self.name(at, "in name", b"./:>{")?;
    tag.name.1 = at;
    at = self.whitespace(at);

    if self.byte(at) == Some(b'.') {
      while self.byte(at) == Some(b'.') {
        at = self.whitespace(at + 1);
        if !self.is_name_start(at) {
          return Err(self.crash(at, "before member name", ATTRIBUTE_START.to_string()));
        }
        at = self.name(at, "in member name", b"./>{")?;
        tag.name.1 = at;
        at = self.whitespace(at);
      }
      self.before_attributes(at, "after member name")?;
    } else if self.byte(at) == Some(b':') {
      at = self.whitespace(at + 1);
      if !self.is_name_start(at) {
        let note = if matches!(self.byte(at), Some(b'+' | b'/'..=b'9')) {
          LINK_NOTE
        } else {
          ""
        };
        return Err(self.crash(at, "before local name", format!("{NAME_START}{note}")));
      }
      at = self.name(at, "in local name", b"/>{")?;
      tag.name.1 = at;
      at = self.whitespace(at);
      self.before_attributes(at, "after local name")?;
    } else {
      self.before_attributes(at, "after name")?;
    }

    self.attributes(at, &mut tag, expressions)?;
    Ok(Some(tag))
  }

  /// From where attributes may start, to the end of the tag.
  fn attributes(
    &mut self,
    mut at: usize,
    tag: &mut Tag,
    expressions: &mut Vec<Expression>,
  ) -> Result<(), String> {
    loop {
      match self.byte(at) {
        Some(b'/') => {
          at = self.whitespace(at + 1);
          if self.byte(at) != Some(b'>') {
            let note = if matches!(self.byte(at), Some(b'*' | b'/')) {
              COMMENT_NOTE
            } else {
              ""
            };
            return Err(self.crash(
              at,
              "after self-closing slash",
              format!("`>` to end the tag{note}"),
            ));
          }
          tag.is_self_closing = true;
          tag.end = at + 1;
          return Ok(());
        }
        Some(b'>') => {
          tag.end = at + 1;
          return Ok(());
        }
        Some(b'{') => {
          let end = self.expression(at)?;
          expressions.push(Expression {
            start: at,
            end,
            is_spread: true,
          });
          tag.has_attributes = true;
          at = self.whitespace(end);
        }
        _ if self.is_name_start(at) => {
          tag.has_attributes = true;
          at = self.name(at, "in attribute name", b"/:=>{")?;
          at = self.whitespace(at);

          let mut is_local = false;
          if self.byte(at) == Some(b':') {
            at = self.whitespace(at + 1);
            if !self.is_name_start(at) {
              return Err(self.crash(
                at,
                "before local attribute name",
                AFTER_ATTRIBUTE_NAME.to_string(),
              ));
            }
            at = self.name(at, "in local attribute name", b"/=>{")?;
            at = self.whitespace(at);
            is_local = true;
          }

          if self.byte(at) == Some(b'=') {
            at = self.value(self.whitespace(at + 1), expressions)?;
          } else if !matches!(self.byte(at), Some(b'/' | b'>' | b'{')) && !self.is_name_start(at) {
            let at_name = if is_local {
              "after local attribute name"
            } else {
              "after attribute name"
            };
            return Err(self.crash(at, at_name, AFTER_ATTRIBUTE_NAME.to_string()));
          }
        }
        _ => {
          return Err(self.crash(at, "before attribute name", ATTRIBUTE_START.to_string()));
        }
      }
    }
  }

  /// An attribute's value at `at`: the offset after the whitespace that follows it.
  fn value(&mut self, at: usize, expressions: &mut Vec<Expression>) -> Result<usize, String> {
    match self.byte(at) {
      Some(quote @ (b'"' | b'\'')) => {
        let Some(length) = memchr::memchr(quote, &self.bytes[at + 1..]) else {
          let expected = format!("a corresponding closing quote `{}`", quote as char);
          return Err(self.crash(self.bytes.len(), "in attribute value", expected));
        };
        Ok(self.whitespace(at + 1 + length + 1))
      }
      Some(b'{') => {
        let end = self.expression(at)?;
        expressions.push(Expression {
          start: at,
          end,
          is_spread: false,
        });
        Ok(self.whitespace(end))
      }
      byte => {
        let note = if byte == Some(b'<') {
          " (note: to use an element or fragment as a prop value in MDX, use `{<element />}`)"
        } else {
          ""
        };
        Err(self.crash(
          at,
          "before attribute value",
          format!(
            "a character that can start an attribute value, such as `\"`, `'`, or `{{`{note}"
          ),
        ))
      }
    }
  }

  /// The `{…}` at `at`: the offset after its `}`.
  fn expression(&mut self, at: usize) -> Result<usize, String> {
    match self.lexer.expression_end(at + 1) {
      Some(end) => Ok(end + 1),
      None => Err(unclosed_expression()),
    }
  }

  /// After a tag's name, before its attributes: what may follow.
  fn before_attributes(&self, at: usize, at_name: &str) -> Result<(), String> {
    if matches!(self.byte(at), Some(b'/' | b'>' | b'{')) || self.is_name_start(at) {
      Ok(())
    } else {
      Err(self.crash(at, at_name, ATTRIBUTE_START.to_string()))
    }
  }

  /// A name from its first character, which may be followed by whitespace or one of `followers`.
  fn name(&self, mut at: usize, at_name: &str, followers: &[u8]) -> Result<usize, String> {
    while let Some(character) = self.character(at) {
      if !is_name_character(character) {
        break;
      }
      at += character.len_utf8();
    }

    match self.character(at) {
      Some(character) if character.is_whitespace() => Ok(at),
      Some(character) if character.is_ascii() && followers.contains(&(character as u8)) => Ok(at),
      character => {
        let note = if character == Some('@') && matches!(at_name, "in name" | "in member name") {
          LINK_NOTE
        } else {
          ""
        };
        let expected = match at_name {
          "in attribute name" | "in local attribute name" => ATTRIBUTE_NAME.to_string(),
          _ => format!("{NAME}{note}"),
        };
        Err(self.crash(at, at_name, expected))
      }
    }
  }

  /// Spaces, line endings and other Unicode whitespace from `at`.
  fn whitespace(&self, mut at: usize) -> usize {
    while let Some(&byte) = self.bytes.get(at) {
      if matches!(byte, b' ' | b'\t' | b'\n' | b'\r' | 0x0b | 0x0c) {
        at += 1;
      } else if byte >= 0x80 && self.character(at).is_some_and(char::is_whitespace) {
        at += self.character(at).map_or(1, char::len_utf8);
      } else {
        break;
      }
    }
    at
  }

  fn byte(&self, at: usize) -> Option<u8> {
    self.bytes.get(at).copied()
  }

  fn character(&self, at: usize) -> Option<char> {
    let byte = *self.bytes.get(at)?;
    if byte < 0x80 {
      return Some(byte as char);
    }
    self.src.get(at..)?.chars().next()
  }

  fn is_name_start(&self, at: usize) -> bool {
    self.character(at).is_some_and(|character| {
      character.is_ascii_alphabetic()
        || character == '$'
        || character == '_'
        || (!character.is_ascii() && character.is_alphabetic())
    })
  }

  fn crash(&self, at: usize, at_name: &str, expected: String) -> String {
    let found = match self.character(at) {
      None => "end of file".to_string(),
      Some('`') => "character `` ` `` (U+0060)".to_string(),
      Some(character) => format!("character `{character}` (U+{:04X})", character as u32),
    };
    format!(
      "MDX: Unexpected {found} {at_name}, expected {expected} ({})",
      place(self.src, at)
    )
  }
}

/// Letters, digits, `$`, `_` and, in JSX, `-`.
fn is_name_character(character: char) -> bool {
  character.is_ascii_alphanumeric()
    || matches!(character, '$' | '_' | '-' | '\u{200c}' | '\u{200d}')
    || (!character.is_ascii() && character.is_alphanumeric())
}

pub fn unclosed_expression() -> String {
  "MDX: Unexpected end of file in expression, expected a corresponding closing brace for `{`"
    .to_string()
}

/// `line:column` of a UTF-8 offset, both from 1, the column in characters.
pub fn place(src: &str, at: usize) -> String {
  let at = at.min(src.len());
  let before = &src.as_bytes()[..at];
  let line = memchr::memchr_iter(b'\n', before).count() + 1;
  let line_start = memchr::memrchr(b'\n', before).map_or(0, |newline| newline + 1);
  let column = src
    .get(line_start..at)
    .map_or(at - line_start, |text| text.chars().count())
    + 1;
  format!("{line}:{column}")
}

#[cfg(test)]
mod tests {
  use super::*;

  fn read(source: &str) -> Result<Option<(String, String, Vec<String>)>, String> {
    let mut lexer = Lexer::new(source);
    let mut expressions = Vec::new();
    let Some(tag) = tag(source, 0, &mut lexer, &mut expressions)? else {
      return Ok(None);
    };
    let flags = format!(
      "{}{}{}",
      if tag.is_closing { "closing " } else { "" },
      if tag.is_self_closing {
        "self-closing "
      } else {
        ""
      },
      &source[tag.name.0..tag.name.1],
    );
    let expressions = expressions
      .iter()
      .map(|expression| source[expression.start..expression.end].to_string())
      .collect();
    Ok(Some((flags, source[..tag.end].to_string(), expressions)))
  }

  #[test]
  fn reads_names_attributes_and_expressions() {
    let read = |source| read(source).ok().flatten();

    assert_eq!(
      read("<Note kind={m.kind()} big title=\"a > b\" {...rest}>text"),
      Some((
        "Note".to_string(),
        "<Note kind={m.kind()} big title=\"a > b\" {...rest}>".to_string(),
        vec!["{m.kind()}".to_string(), "{...rest}".to_string()]
      ))
    );
    assert_eq!(
      read("<a.b.c\n  d:e='{x}'\n/> after"),
      Some((
        "self-closing a.b.c".to_string(),
        "<a.b.c\n  d:e='{x}'\n/>".to_string(),
        vec![]
      ))
    );
    assert_eq!(
      read("<svg : rect / >"),
      Some((
        "self-closing svg : rect".to_string(),
        "<svg : rect / >".to_string(),
        vec![]
      ))
    );
    assert_eq!(
      read("</ Note >"),
      Some(("closing Note".to_string(), "</ Note >".to_string(), vec![]))
    );
    assert_eq!(read("<>"), Some((String::new(), "<>".to_string(), vec![])));
    assert_eq!(
      read("</>"),
      Some(("closing ".to_string(), "</>".to_string(), vec![]))
    );
    assert_eq!(
      read("<Grüße für-dich={1}/>"),
      Some((
        "self-closing Grüße".to_string(),
        "<Grüße für-dich={1}/>".to_string(),
        vec!["{1}".to_string()]
      ))
    );
  }

  #[test]
  fn less_than_and_whitespace_is_text() {
    assert!(matches!(read("< b"), Ok(None)));
    assert!(matches!(read("<\nb"), Ok(None)));
  }

  #[test]
  fn fails_as_mdx_does() {
    let error = |source| read(source).err().unwrap_or_default();

    assert_eq!(
      error("<https://example.com>"),
      "MDX: Unexpected character `/` (U+002F) before local name, expected a character that can start a name, such as a letter, `$`, or `_` (note: to create a link in MDX, use `[text](url)`) (1:8)"
    );
    assert!(error("<!-- a -->").contains("to create a comment in MDX, use `{/* text */}`"));
    assert!(error("<3").starts_with("MDX: Unexpected character `3` (U+0033) before name"));
    assert!(error("<a b=c>").contains("before attribute value"));
    assert!(error("<a b=\"c>").contains("expected a corresponding closing quote `\"`"));
    assert!(error("<a b={c>").contains("Unexpected end of file in expression"));
    assert!(error("<a / b>").contains("after self-closing slash"));
    assert!(error("<a").starts_with("MDX: Unexpected end of file in name"));
    assert!(error("<").starts_with("MDX: Unexpected end of file before name"));
    assert!(error("<a@b>").contains("in name"));
  }

  #[test]
  fn places_count_lines_and_characters() {
    assert_eq!(place("ab\ncdé f", 9), "2:6");
    assert_eq!(place("", 0), "1:1");
  }
}
