//! A component file's inline templates: of each `@Component({ template: "…" })` (or
//! `@ns.Component(…)`) on a top-level class, the content of the template's string literal, and the
//! class's name. A scan of the file's tokens, as much of JavaScript's syntax as finds them.

/// An inline template: the content of its string literal, `source[start..end]`.
#[derive(Debug, PartialEq, Eq)]
pub struct InlineTemplate<'s> {
  pub start: usize,
  pub end: usize,
  pub class_name: Option<&'s str>,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum Token {
  Identifier(usize, usize),
  /// A string literal, or a template literal without substitutions: its content's range.
  String(usize, usize),
  /// Any other template literal part, a number or a regular expression.
  Value,
  Punctuator(u8),
  /// `...`, `=>`, `?.` and other operators of several characters.
  Operator,
  End,
}

struct Scanner<'s> {
  source: &'s str,
  bytes: &'s [u8],
  pos: usize,
  /// The open `(`, `[`, `{`, and `$` for a template literal's `${`.
  stack: Vec<u8>,
  /// Whether a `/` would divide: the previous token ends an expression.
  divides: bool,
  /// A token read and given back.
  back: Option<Token>,
}

fn is_identifier_byte(byte: u8) -> bool {
  byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'$' || byte >= 0x80
}

impl<'s> Scanner<'s> {
  fn word(&self, start: usize, end: usize) -> &'s str {
    &self.source[start..end]
  }

  fn depth(&self) -> usize {
    self.stack.len()
  }

  fn skip_trivia(&mut self) {
    let bytes = self.bytes;
    while self.pos < bytes.len() {
      match bytes[self.pos] {
        b' ' | b'\t' | b'\n' | b'\r' | 0x0b | 0x0c => self.pos += 1,
        b'/' if bytes.get(self.pos + 1) == Some(&b'/') => {
          self.pos = memchr::memchr2(b'\n', b'\r', &bytes[self.pos..])
            .map_or(bytes.len(), |offset| self.pos + offset);
        }
        b'/' if bytes.get(self.pos + 1) == Some(&b'*') => {
          self.pos = memchr::memmem::find(&bytes[self.pos + 2..], b"*/")
            .map_or(bytes.len(), |offset| self.pos + 2 + offset + 2);
        }
        0xc2 if bytes.get(self.pos + 1) == Some(&0xa0) => self.pos += 2,
        0xef if bytes[self.pos..].starts_with("\u{feff}".as_bytes()) => self.pos += 3,
        0xe2
          if bytes[self.pos..].starts_with("\u{2028}".as_bytes())
            || bytes[self.pos..].starts_with("\u{2029}".as_bytes()) =>
        {
          self.pos += 3
        }
        _ => return,
      }
    }
  }

  fn give_back(&mut self, token: Token) {
    self.back = Some(token);
  }

  fn next(&mut self) -> Token {
    if let Some(token) = self.back.take() {
      return token;
    }
    self.skip_trivia();
    let bytes = self.bytes;
    let Some(&byte) = bytes.get(self.pos) else {
      return Token::End;
    };
    let start = self.pos;
    let token = match byte {
      b'\'' | b'"' => {
        let end = self.string_end(start + 1, byte);
        self.pos = (end + 1).min(bytes.len());
        Token::String(start + 1, end)
      }
      b'`' => self.template(start + 1, true),
      b'0'..=b'9' => {
        self.pos += 1;
        while self.pos < bytes.len()
          && (is_identifier_byte(bytes[self.pos]) || bytes[self.pos] == b'.')
        {
          self.pos += 1;
        }
        Token::Value
      }
      b'.' if bytes.get(start + 1).is_some_and(u8::is_ascii_digit) => {
        self.pos += 1;
        while self.pos < bytes.len() && is_identifier_byte(bytes[self.pos]) {
          self.pos += 1;
        }
        Token::Value
      }
      b'#' if start == 0 && bytes.get(1) == Some(&b'!') => {
        self.pos = memchr::memchr(b'\n', bytes).unwrap_or(bytes.len());
        return self.next();
      }
      _ if is_identifier_byte(byte) || byte == b'#' || byte == b'\\' => {
        self.pos += 1;
        while self.pos < bytes.len()
          && (is_identifier_byte(bytes[self.pos]) || bytes[self.pos] == b'\\')
        {
          self.pos += 1;
        }
        Token::Identifier(start, self.pos)
      }
      b'/' if !self.divides => {
        self.regex(start);
        Token::Value
      }
      b'(' | b'[' | b'{' => {
        self.stack.push(byte);
        self.pos += 1;
        Token::Punctuator(byte)
      }
      b'}' if self.stack.last() == Some(&b'$') => {
        self.stack.pop();
        self.template(start + 1, false)
      }
      b')' | b']' | b'}' => {
        self.stack.pop();
        self.pos += 1;
        Token::Punctuator(byte)
      }
      b'.' if bytes[start..].starts_with(b"...") => {
        self.pos += 3;
        Token::Operator
      }
      b'=' if bytes.get(start + 1) == Some(&b'>') => {
        self.pos += 2;
        Token::Operator
      }
      _ => {
        self.pos += 1;
        Token::Punctuator(byte)
      }
    };
    self.divides = match token {
      Token::Identifier(start, end) => !matches!(
        self.word(start, end),
        "return"
          | "typeof"
          | "case"
          | "do"
          | "else"
          | "in"
          | "instanceof"
          | "new"
          | "delete"
          | "void"
          | "throw"
          | "yield"
          | "await"
          | "of"
      ),
      Token::String(..) | Token::Value => true,
      Token::Punctuator(byte) => matches!(byte, b')' | b']'),
      Token::Operator | Token::End => false,
    };
    token
  }

  fn string_end(&self, from: usize, quote: u8) -> usize {
    let bytes = self.bytes;
    let mut index = from;
    while index < bytes.len() {
      match bytes[index] {
        b'\\' => index += 2,
        byte if byte == quote => return index,
        b'\n' | b'\r' => return index,
        _ => index += 1,
      }
    }
    bytes.len()
  }

  /// A template literal's part from `from`, up to its end or its next `${`.
  fn template(&mut self, from: usize, is_head: bool) -> Token {
    let bytes = self.bytes;
    let mut index = from;
    while index < bytes.len() {
      match bytes[index] {
        b'\\' => index += 2,
        b'`' => {
          self.pos = index + 1;
          return if is_head {
            Token::String(from, index)
          } else {
            Token::Value
          };
        }
        b'$' if bytes.get(index + 1) == Some(&b'{') => {
          self.stack.push(b'$');
          self.pos = index + 2;
          return Token::Value;
        }
        _ => index += 1,
      }
    }
    self.pos = bytes.len();
    Token::Value
  }

  fn regex(&mut self, start: usize) {
    let bytes = self.bytes;
    let mut index = start + 1;
    let mut in_class = false;
    while index < bytes.len() {
      match bytes[index] {
        b'\\' => index += 1,
        b'[' => in_class = true,
        b']' => in_class = false,
        b'/' if !in_class => {
          index += 1;
          break;
        }
        b'\n' | b'\r' => break,
        _ => {}
      }
      index += 1;
    }
    while index < bytes.len() && is_identifier_byte(bytes[index]) {
      index += 1;
    }
    self.pos = index.min(bytes.len());
  }
}

/// The inline templates of `source`'s top-level classes, in order.
pub fn inline_templates(source: &str) -> Vec<InlineTemplate<'_>> {
  let mut scanner = Scanner {
    source,
    bytes: source.as_bytes(),
    pos: 0,
    stack: Vec::new(),
    divides: false,
    back: None,
  };
  let mut templates = Vec::new();
  // The templates of the decorators read since the last statement, waiting for their class.
  let mut pending: Vec<(usize, usize)> = Vec::new();
  let mut at_statement_start = true;

  loop {
    let token = scanner.next();
    if token == Token::End {
      break;
    }
    if scanner.depth() > 0 {
      // A block or expression of the top level: skip it.
      let ending = skip_block(&mut scanner);
      at_statement_start = ending == Token::Punctuator(b'}');
      pending.clear();
      continue;
    }
    match token {
      Token::Punctuator(b'@') if at_statement_start => {
        pending.extend(decorator(&mut scanner));
        at_statement_start = true;
      }
      Token::Identifier(start, end) => match scanner.word(start, end) {
        "export" | "default" | "abstract" | "declare" => {}
        "class" => {
          let mut class_name = None;
          let next = scanner.next();
          if let Token::Identifier(start, end) = next {
            let name = scanner.word(start, end);
            if !matches!(name, "extends" | "implements") {
              class_name = Some(name);
            }
          }
          templates.extend(pending.drain(..).map(|(start, end)| InlineTemplate {
            start,
            end,
            class_name,
          }));
          at_statement_start = false;
          if scanner.depth() > 0 {
            let ending = skip_block(&mut scanner);
            at_statement_start = ending == Token::Punctuator(b'}');
          }
        }
        _ => {
          pending.clear();
          at_statement_start = false;
        }
      },
      Token::Punctuator(b';') | Token::Punctuator(b'}') => {
        pending.clear();
        at_statement_start = true;
      }
      _ => {
        pending.clear();
        at_statement_start = false;
      }
    }
  }
  templates
}

/// Reads tokens until the top level again; the last one read.
fn skip_block(scanner: &mut Scanner) -> Token {
  loop {
    let token = scanner.next();
    if token == Token::End || scanner.depth() == 0 {
      return token;
    }
  }
}

/// Reads a decorator after its `@`: of `@Component({ template: "…" })`, the template's content.
fn decorator(scanner: &mut Scanner) -> Option<(usize, usize)> {
  let mut last_name = None;
  let mut token = scanner.next();
  while let Token::Identifier(start, end) = token {
    last_name = Some(scanner.word(start, end));
    token = scanner.next();
    if token != Token::Punctuator(b'.') {
      break;
    }
    token = scanner.next();
  }
  if token != Token::Punctuator(b'(') {
    // `@Decorator` without a call: what follows is not its.
    scanner.give_back(token);
    return None;
  }
  let mut template = None;
  if last_name == Some("Component") {
    let first = scanner.next();
    if first == Token::Punctuator(b'{') {
      template = object_template(scanner);
    }
  }
  if scanner.depth() > 0 {
    skip_block(scanner);
  }
  template
}

/// Reads an object literal after its `{`, through its `}`: the first `template` property that is a
/// string, if one is.
fn object_template(scanner: &mut Scanner) -> Option<(usize, usize)> {
  let depth = scanner.depth();
  let mut template = None;
  loop {
    let token = scanner.next();
    if token == Token::End || scanner.depth() < depth {
      return template;
    }
    if token == Token::Punctuator(b',') {
      continue;
    }
    let mut last = token;
    let key = match token {
      Token::Identifier(start, end) | Token::String(start, end) => Some(scanner.word(start, end)),
      Token::Punctuator(b'[') => match scanner.next() {
        Token::String(start, end) => {
          last = scanner.next();
          (last == Token::Punctuator(b']')).then(|| scanner.word(start, end))
        }
        other => {
          last = other;
          None
        }
      },
      _ => None,
    };
    if let Some(key) = key {
      last = scanner.next();
      if last == Token::Punctuator(b':') {
        last = scanner.next();
        if let Token::String(start, end) = last {
          last = scanner.next();
          let ends_property = last == Token::End
            || scanner.depth() < depth
            || (scanner.depth() == depth && last == Token::Punctuator(b','));
          if ends_property && key == "template" && template.is_none() {
            template = Some((start, end));
          }
        }
      }
    }
    if !rest_of_property(scanner, depth, last) {
      return template;
    }
  }
}

/// Reads to the end of an object's property, `last` the last token read: false if the object
/// ended.
fn rest_of_property(scanner: &mut Scanner, depth: usize, last: Token) -> bool {
  let mut last = last;
  loop {
    if last == Token::End || scanner.depth() < depth {
      return false;
    }
    if scanner.depth() == depth && last == Token::Punctuator(b',') {
      return true;
    }
    last = scanner.next();
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  fn found(source: &str) -> Vec<(&str, Option<&str>)> {
    inline_templates(source)
      .iter()
      .map(|template| (&source[template.start..template.end], template.class_name))
      .collect()
  }

  #[test]
  fn finds_inline_templates_of_top_level_classes() {
    let source = r#"
import { Component } from "@angular/core";
const re = /`@Component(/g, x = a / b / c;
// @Component({ template: "commented" }) class C {}
@Component({
  selector: "app-a",
  template: `<p>{{ a }}</p>`,
  styles: [`p { color: red }`],
})
export class A { method() { return { template: "no" }; } }

@Injectable()
@ng.Component({ 'template': '<b></b>', providers: [{ provide: X, useValue: { template: 'no' } }] })
export default class B {}

@Component({ template: `${dynamic}` }) class C {}
@Component({ template: "a" + "b", other: 1 }) class D {}
@Component({ template: get(), template: "second" }) class E {}
function f() { @Component({ template: "nested" }) class F {} }
"#;
    assert_eq!(
      found(source),
      [
        ("<p>{{ a }}</p>", Some("A")),
        ("<b></b>", Some("B")),
        ("second", Some("E")),
      ]
    );
  }

  #[test]
  fn other_decorators_regexes_and_templates() {
    let source = r#"const quote = /['"`{]/g;
const nested = `a ${`b ${ { c: "}" }.c }`} d`;
@Component({ template: '<p>a</p>' })
@Sealed
export class A {}
export @Component({ template: "<p>b</p>" }) class B {}
const C = @Component({ template: "<p>no</p>" }) class {};
"#;
    assert_eq!(
      found(source),
      [("<p>a</p>", Some("A")), ("<p>b</p>", Some("B"))]
    );
  }

  #[test]
  fn anonymous_and_several_components() {
    let source = r#"@Component({ template: '<i></i>' }) export default class {}
@Component({ selector: "x", template: "<p>{{ label() }}</p>" }) export class First { label = m.first; }"#;
    assert_eq!(
      found(source),
      [("<i></i>", None), ("<p>{{ label() }}</p>", Some("First"))]
    );
  }
}
