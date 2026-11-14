//! Finds a module's `<template>` tags as `content-tag` does: the exact text `<template>` outside
//! comments, strings, template literals' text and regular expressions opens one, and the first
//! `</template>` after it closes it. Tokens are read only as far as telling those apart needs, and
//! where a tag is: in a class body, a statement of its own, or a value.

use memchr::{memchr, memchr3, memmem};

/// Where a `<template>` tag is.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Placement {
  /// A member of a class body: the class's template.
  ClassMember,
  /// A statement of the module's top level: the module's default export.
  DefaultExport,
  /// A statement in a block.
  Statement,
  /// A value in an expression.
  Expression,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Tag {
  /// Where `<template>` starts.
  pub start: usize,
  /// The template, between the tags.
  pub content_start: usize,
  pub content_end: usize,
  /// Where `</template>` ends.
  pub end: usize,
  pub placement: Placement,
}

pub const OPEN: &[u8] = b"<template>";
pub const CLOSE: &[u8] = b"</template>";

/// The module's `<template>` tags, in order. Fails on one that is not closed.
pub fn find_templates(source: &str) -> Result<Vec<Tag>, String> {
  let bytes = source.as_bytes();
  // Most of a module is script: without a tag, there is nothing to tell apart.
  if memmem::find(bytes, OPEN).is_none() {
    return Ok(Vec::new());
  }

  let mut scanner = Scanner {
    bytes,
    pos: 0,
    prev: Prev::Statement,
    newline: false,
    stack: Vec::new(),
    class: None,
    tags: Vec::new(),
  };
  scanner.run()?;

  Ok(scanner.tags)
}

/// What the last token was, as far as what may follow it goes.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Prev {
  /// The module's start, `;`, or the `}` of a block: a statement may start.
  Statement,
  /// The `{` of a block or a class body.
  BlockOpen,
  /// An identifier, a literal, `]`, the `}` of an object literal: `/` divides.
  Operand,
  /// `)`: `/` divides, and a `{` opens a block.
  CloseParen,
  /// An operator, `(`, `[`, `,`, or a keyword that an expression follows: a regular expression may
  /// start.
  Operator,
  /// `else`, `do`, `try`, `finally`: a `{` opens a block.
  BlockKeyword,
  /// `.` or `?.`: a property name follows.
  Dot,
  /// `=>`: a `{` opens a block.
  Arrow,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Frame {
  Block,
  Object,
  ClassBody,
  Paren,
  Bracket,
  /// `${` in a template literal.
  Interpolation,
}

struct Scanner<'s> {
  bytes: &'s [u8],
  pos: usize,
  prev: Prev,
  /// Whether a line break separates `prev` from the next token.
  newline: bool,
  stack: Vec<Frame>,
  /// After `class`: the depth its body opens at, and how deep the heritage is in `<…>` type
  /// arguments, whose `{` are not the body's.
  class: Option<(usize, u32)>,
  tags: Vec<Tag>,
}

impl Scanner<'_> {
  fn run(&mut self) -> Result<(), String> {
    let bytes = self.bytes;
    let length = bytes.len();

    if bytes.starts_with(b"#!") {
      self.pos = memchr(b'\n', bytes).unwrap_or(length);
    }

    while self.pos < length {
      let byte = bytes[self.pos];
      match byte {
        b' ' | b'\t' | 0x0B | 0x0C => self.pos += 1,
        b'\n' | b'\r' => {
          self.newline = true;
          self.pos += 1;
        }
        b'/' => match bytes.get(self.pos + 1) {
          Some(b'/') => {
            self.pos = memchr(b'\n', &bytes[self.pos..]).map_or(length, |at| self.pos + at);
          }
          Some(b'*') => {
            let end = memmem::find(&bytes[self.pos + 2..], b"*/")
              .map_or(length, |at| self.pos + 2 + at + 2);
            if bytes[self.pos..end]
              .iter()
              .any(|&b| b == b'\n' || b == b'\r')
            {
              self.newline = true;
            }
            self.pos = end;
          }
          _ if self.regex_allowed() => self.regex(),
          _ => self.punctuator(1, Prev::Operator),
        },
        b'"' | b'\'' => self.string(byte),
        b'`' => {
          self.pos += 1;
          self.template_literal();
        }
        b'<' => {
          if bytes[self.pos..].starts_with(OPEN) {
            self.template_tag()?;
          } else {
            if let Some((depth, angle)) = &mut self.class {
              if *depth == self.stack.len() {
                *angle += 1;
              }
            }
            self.punctuator(1, Prev::Operator);
          }
        }
        b'>' => {
          if let Some((depth, angle)) = &mut self.class {
            if *depth == self.stack.len() {
              *angle = angle.saturating_sub(1);
            }
          }
          self.punctuator(1, Prev::Operator);
        }
        b'=' => {
          if bytes.get(self.pos + 1) == Some(&b'>') {
            self.punctuator(2, Prev::Arrow);
          } else {
            self.punctuator(1, Prev::Operator);
          }
        }
        b'{' => self.open_brace(),
        b'}' => self.close_brace(),
        b'(' => {
          self.stack.push(Frame::Paren);
          self.punctuator(1, Prev::Operator);
        }
        b'[' => {
          self.stack.push(Frame::Bracket);
          self.punctuator(1, Prev::Operator);
        }
        b')' => {
          self.pop(Frame::Paren);
          self.punctuator(1, Prev::CloseParen);
        }
        b']' => {
          self.pop(Frame::Bracket);
          self.punctuator(1, Prev::Operand);
        }
        b';' => {
          if self
            .class
            .is_some_and(|(depth, _)| depth == self.stack.len())
          {
            self.class = None;
          }
          self.punctuator(1, Prev::Statement);
        }
        b'.' => {
          if bytes.get(self.pos + 1).is_some_and(u8::is_ascii_digit) {
            self.number();
          } else if bytes[self.pos..].starts_with(b"...") {
            self.punctuator(3, Prev::Operator);
          } else {
            self.punctuator(1, Prev::Dot);
          }
        }
        b'?' => {
          let is_chain = bytes.get(self.pos + 1) == Some(&b'.')
            && !bytes.get(self.pos + 2).is_some_and(u8::is_ascii_digit);
          if is_chain {
            self.punctuator(2, Prev::Dot);
          } else {
            self.punctuator(1, Prev::Operator);
          }
        }
        b'+' | b'-' => {
          // `a++ / b` divides.
          if bytes.get(self.pos + 1) == Some(&byte) {
            self.punctuator(2, Prev::Operand);
          } else {
            self.punctuator(1, Prev::Operator);
          }
        }
        b'0'..=b'9' => self.number(),
        _ if is_word_start(byte) => self.word(),
        _ => self.punctuator(1, Prev::Operator),
      }
    }

    Ok(())
  }

  fn set(&mut self, prev: Prev) {
    self.prev = prev;
    self.newline = false;
  }

  fn punctuator(&mut self, length: usize, prev: Prev) {
    self.pos += length;
    self.set(prev);
  }

  fn pop(&mut self, frame: Frame) {
    if self.stack.last() == Some(&frame) {
      self.stack.pop();
    }
  }

  fn regex_allowed(&self) -> bool {
    !matches!(self.prev, Prev::Operand | Prev::CloseParen | Prev::Dot)
  }

  fn open_brace(&mut self) {
    let opens_class_body = self
      .class
      .is_some_and(|(depth, angle)| depth == self.stack.len() && angle == 0);
    let frame = if opens_class_body {
      self.class = None;
      Frame::ClassBody
    } else if matches!(
      self.prev,
      Prev::Statement
        | Prev::BlockOpen
        | Prev::CloseParen
        | Prev::Arrow
        | Prev::BlockKeyword
        | Prev::Operand
    ) {
      Frame::Block
    } else {
      Frame::Object
    };

    self.stack.push(frame);
    let prev = if frame == Frame::Object {
      Prev::Operator
    } else {
      Prev::BlockOpen
    };
    self.punctuator(1, prev);
  }

  fn close_brace(&mut self) {
    self.pos += 1;
    match self.stack.pop() {
      Some(Frame::Interpolation) => self.template_literal(),
      Some(Frame::Block | Frame::ClassBody) => self.set(Prev::Statement),
      _ => self.set(Prev::Operand),
    }
  }

  fn string(&mut self, quote: u8) {
    let bytes = self.bytes;
    let mut pos = self.pos + 1;
    loop {
      let Some(at) = memchr3(quote, b'\\', b'\n', bytes.get(pos..).unwrap_or_default()) else {
        pos = bytes.len();
        break;
      };
      let at = pos + at;
      match bytes[at] {
        b'\\' => pos = at + 2,
        // Not closed on its line.
        b'\n' => {
          pos = at;
          break;
        }
        _ => {
          pos = at + 1;
          break;
        }
      }
    }
    self.pos = pos.min(bytes.len());
    self.set(Prev::Operand);
  }

  /// Reads a template literal from `pos`, after its "`" or after the `}` of an interpolation, to
  /// its end or its next interpolation.
  fn template_literal(&mut self) {
    let bytes = self.bytes;
    loop {
      let Some(at) = memchr3(b'`', b'\\', b'$', bytes.get(self.pos..).unwrap_or_default()) else {
        self.pos = bytes.len();
        self.set(Prev::Operand);
        return;
      };
      let at = self.pos + at;
      match bytes[at] {
        b'\\' => self.pos = at + 2,
        b'`' => {
          self.pos = at + 1;
          self.set(Prev::Operand);
          return;
        }
        _ if bytes.get(at + 1) == Some(&b'{') => {
          self.stack.push(Frame::Interpolation);
          self.pos = at + 2;
          self.set(Prev::Operator);
          return;
        }
        _ => self.pos = at + 1,
      }
    }
  }

  fn regex(&mut self) {
    let bytes = self.bytes;
    let mut pos = self.pos + 1;
    let mut in_class = false;
    while pos < bytes.len() {
      match bytes[pos] {
        b'\\' => pos += 2,
        b'[' => {
          in_class = true;
          pos += 1;
        }
        b']' => {
          in_class = false;
          pos += 1;
        }
        b'/' if !in_class => {
          pos += 1;
          break;
        }
        b'\n' | b'\r' => break,
        _ => pos += 1,
      }
    }
    while pos < bytes.len() && is_word_byte(bytes[pos]) {
      pos += 1;
    }
    self.pos = pos.min(bytes.len());
    self.set(Prev::Operand);
  }

  fn number(&mut self) {
    let bytes = self.bytes;
    let start = self.pos;
    let is_hex = bytes[start] == b'0' && matches!(bytes.get(start + 1), Some(b'x' | b'X'));
    let mut pos = start + 1;
    while let Some(&byte) = bytes.get(pos) {
      let is_exponent_sign =
        matches!(byte, b'+' | b'-') && !is_hex && matches!(bytes[pos - 1], b'e' | b'E');
      if byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'.' || is_exponent_sign {
        pos += 1;
      } else {
        break;
      }
    }
    self.pos = pos;
    self.set(Prev::Operand);
  }

  fn word(&mut self) {
    let bytes = self.bytes;
    let start = self.pos;
    let mut pos = start + 1;
    while pos < bytes.len() && is_word_byte(bytes[pos]) {
      pos += 1;
    }
    self.pos = pos;

    if self.prev == Prev::Dot {
      self.set(Prev::Operand);
      return;
    }

    let prev = match &bytes[start..pos] {
      b"class" => {
        if !self.is_property_key() {
          self.class = Some((self.stack.len(), 0));
        }
        Prev::Operand
      }
      b"return" | b"typeof" | b"instanceof" | b"in" | b"of" | b"new" | b"delete" | b"void"
      | b"throw" | b"case" | b"yield" | b"await" | b"extends" | b"default" => Prev::Operator,
      b"else" | b"do" | b"try" | b"finally" => Prev::BlockKeyword,
      _ => Prev::Operand,
    };
    self.set(prev);
  }

  /// Whether the word just read names a property, e.g. `class` in `{ class: 1 }`.
  fn is_property_key(&self) -> bool {
    let next = self.bytes[self.pos..]
      .iter()
      .find(|byte| !byte.is_ascii_whitespace());
    matches!(
      next,
      Some(b':' | b'(' | b'=' | b',' | b'}' | b';' | b'?' | b')')
    )
  }

  fn template_tag(&mut self) -> Result<(), String> {
    let bytes = self.bytes;
    let start = self.pos;
    let content_start = start + OPEN.len();
    let Some(length) = memmem::find(&bytes[content_start..], CLOSE) else {
      return Err(format!(
        "content-tag: the <template> on line {} is not closed",
        line_of(bytes, start)
      ));
    };
    let content_end = content_start + length;
    let end = content_end + CLOSE.len();

    let in_class_body = self.stack.last() == Some(&Frame::ClassBody);
    let placement = if in_class_body
      && matches!(
        self.prev,
        Prev::Statement | Prev::BlockOpen | Prev::Operand | Prev::CloseParen
      ) {
      Placement::ClassMember
    } else if self.starts_statement() && self.ends_statement(end) {
      if self.stack.is_empty() {
        Placement::DefaultExport
      } else {
        Placement::Statement
      }
    } else {
      Placement::Expression
    };

    self.tags.push(Tag {
      start,
      content_start,
      content_end,
      end,
      placement,
    });
    self.pos = end;
    self.set(if placement == Placement::Expression {
      Prev::Operand
    } else {
      Prev::Statement
    });

    Ok(())
  }

  /// Whether a statement starts at the tag: after another, or on a new line after an operand,
  /// where a semicolon is inserted.
  fn starts_statement(&self) -> bool {
    let in_statements = matches!(self.stack.last(), None | Some(Frame::Block));
    in_statements
      && match self.prev {
        Prev::Statement | Prev::BlockOpen => true,
        Prev::Operand | Prev::CloseParen => self.newline,
        _ => false,
      }
  }

  /// Whether the statement ends at `end`, as the tag's own: before `;`, `}`, a line break, the end
  /// of the module or `satisfies`.
  fn ends_statement(&self, end: usize) -> bool {
    let bytes = self.bytes;
    let mut pos = end;
    while pos < bytes.len() {
      match bytes[pos] {
        b' ' | b'\t' | 0x0B | 0x0C => pos += 1,
        b'\n' | b'\r' => return true,
        b'/' if bytes.get(pos + 1) == Some(&b'/') => return true,
        b'/' if bytes.get(pos + 1) == Some(&b'*') => {
          let Some(at) = memmem::find(&bytes[pos + 2..], b"*/") else {
            return true;
          };
          if bytes[pos..pos + 2 + at].contains(&b'\n') {
            return true;
          }
          pos += 2 + at + 2;
        }
        b';' | b'}' => return true,
        _ => {
          let rest = &bytes[pos..];
          return rest.starts_with(b"satisfies")
            && !rest.get(9).is_some_and(|&byte| is_word_byte(byte));
        }
      }
    }
    true
  }
}

fn is_word_start(byte: u8) -> bool {
  byte.is_ascii_alphabetic() || matches!(byte, b'_' | b'$' | b'#' | b'\\') || byte >= 0x80
}

fn is_word_byte(byte: u8) -> bool {
  byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'$' | b'\\') || byte >= 0x80
}

/// The 1-based line of the UTF-8 offset `at`.
pub fn line_of(bytes: &[u8], at: usize) -> usize {
  memchr::memchr_iter(b'\n', &bytes[..at.min(bytes.len())]).count() + 1
}

#[cfg(test)]
mod tests {
  use super::*;

  fn placements(source: &str) -> Vec<(&str, Placement)> {
    find_templates(source)
      .unwrap_or_default()
      .into_iter()
      .map(|tag| (&source[tag.content_start..tag.content_end], tag.placement))
      .collect()
  }

  #[test]
  fn tags_outside_strings_comments_and_regular_expressions() {
    let source = r#"
const a = "<template>x</template>";
const b = '<template>';
const c = `<template>${<template>in</template>}`;
// <template>
/* <template> */
const r = /<template>/;
const d = x / 2; const e = y / <template>after</template>;
"#;
    assert_eq!(
      placements(source),
      vec![
        ("in", Placement::Expression),
        ("after", Placement::Expression)
      ]
    );
  }

  #[test]
  fn class_members_statements_and_values() {
    let source = r#"import Component from "@glimmer/component";
const Row = <template>row</template>;
export default class A extends Component<{ Args: { a: { b: 1 } } }> {
  label = m.label
  <template>member</template>
  get x() { return 1; } <template>second</template>
  field = <template>value</template>;
  method() { return <template>returned</template>; }
}
<template>top</template>
function f() {}
<template>after block</template>
"#;
    assert_eq!(
      placements(source),
      vec![
        ("row", Placement::Expression),
        ("member", Placement::ClassMember),
        ("second", Placement::ClassMember),
        ("value", Placement::Expression),
        ("returned", Placement::Expression),
        ("top", Placement::DefaultExport),
        ("after block", Placement::DefaultExport),
      ]
    );
  }

  #[test]
  fn a_new_line_after_an_operand_starts_a_statement() {
    assert_eq!(
      placements("const label = m.label\n<template>{{label}}</template>\n"),
      vec![("{{label}}", Placement::DefaultExport)]
    );
    assert_eq!(
      placements("<template>x</template> satisfies TOC<{}>;"),
      vec![("x", Placement::DefaultExport)]
    );
    assert_eq!(
      placements("export default <template>x</template>;"),
      vec![("x", Placement::Expression)]
    );
  }

  #[test]
  fn class_as_a_property_name_has_no_body() {
    let source = "const o = { class: 1 };\nfoo.class;\nclass B { <template>b</template> }";
    assert_eq!(placements(source), vec![("b", Placement::ClassMember)]);
  }

  #[test]
  fn a_tag_closes_at_the_first_close_tag() {
    assert_eq!(
      placements("<template><template>inner</template>"),
      vec![("<template>inner", Placement::DefaultExport)]
    );
    assert!(find_templates("<template>x").is_err());
  }
}
