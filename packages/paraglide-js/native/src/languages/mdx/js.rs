//! A JavaScript lexer only as precise as finding where MDX's code ends: it knows strings, template
//! literals, comments, regular expressions and JSX, whose text may hold quotes and slashes.
//!
//! MDX ends an expression at the first `}` after which its code parses. For code that parses,
//! that is the `}` that closes the expression's braces outside strings, comments and the like.

/// What came before: whether an expression may start here, so that `/` is a regular expression and
/// `<` JSX, rather than division and less-than.
#[derive(Clone, Copy, PartialEq, Eq)]
enum Before {
  /// An operator or a keyword such as `return`: an expression may start.
  Operator,
  /// A name, a literal, `)` or `]`: an operator follows.
  Operand,
  /// `.`: a property name follows, even if it is a keyword.
  Dot,
}

/// Where an ESM block ends, and the default exports in it.
pub struct Esm {
  /// The end of the block's last line, before its line ending.
  pub end: usize,
  /// Where the next line starts.
  pub next: usize,
  /// Changes that make the block's default export a layout, so that the content stays the
  /// module's default export: `(start, end, text)` replaces `start..end` with `text`.
  pub edits: Vec<(usize, usize, &'static str)>,
  /// Whether it exports a layout as `export default …`, which is then `const MDXLayout = …`.
  pub has_layout: bool,
}

pub struct Lexer<'s> {
  src: &'s [u8],
  /// Whether an `await` was seen, which makes the content function async.
  pub awaits: bool,
  /// How deep code, template literals and JSX are nested where it reads.
  nesting: u32,
}

/// Deeper code is not read, rather than overflowing the stack: it does not end.
const MAX_NESTING: u32 = 1000;

impl<'s> Lexer<'s> {
  pub fn new(src: &'s str) -> Self {
    Lexer {
      src: src.as_bytes(),
      awaits: false,
      nesting: 0,
    }
  }

  fn nested<T>(&mut self, read: impl FnOnce(&mut Self) -> Option<T>) -> Option<T> {
    if self.nesting >= MAX_NESTING {
      return None;
    }
    self.nesting += 1;
    let result = read(self);
    self.nesting -= 1;
    result
  }

  /// The offset of the `}` that ends the expression whose code starts at `start`, just after its
  /// `{`; none if the file ends first.
  pub fn expression_end(&mut self, start: usize) -> Option<usize> {
    self.code(start)
  }

  /// Code until the `}` that closes it, whose offset is returned.
  fn code(&mut self, at: usize) -> Option<usize> {
    self.nested(|lexer| lexer.code_in(at))
  }

  fn code_in(&mut self, mut at: usize) -> Option<usize> {
    let src = self.src;
    let mut depth = 0u32;
    let mut before = Before::Operator;

    loop {
      let byte = *src.get(at)?;
      match byte {
        b' ' | b'\t' | b'\n' | b'\r' | 0x0b | 0x0c => at += 1,
        b'/' => match src.get(at + 1) {
          Some(b'/') => at = line_end(src, at),
          Some(b'*') => at = block_comment_end(src, at)?,
          _ if before == Before::Operator => {
            at = regex_end(src, at + 1);
            before = Before::Operand;
          }
          _ => {
            at += 1;
            before = Before::Operator;
          }
        },
        b'\'' | b'"' => {
          at = string_end(src, at)?;
          before = Before::Operand;
        }
        b'`' => {
          at = self.template_end(at + 1)?;
          before = Before::Operand;
        }
        b'{' => {
          depth += 1;
          at += 1;
          before = Before::Operator;
        }
        b'}' => {
          if depth == 0 {
            return Some(at);
          }
          depth -= 1;
          at += 1;
          before = Before::Operand;
        }
        b'(' | b'[' => {
          at += 1;
          before = Before::Operator;
        }
        b')' | b']' => {
          at += 1;
          before = Before::Operand;
        }
        b'<' if before == Before::Operator => {
          at = self.jsx_element(at)?;
          before = Before::Operand;
        }
        b'<' => {
          at = less_than_end(src, at);
          before = Before::Operator;
        }
        b'0'..=b'9' => {
          at = number_end(src, at);
          before = Before::Operand;
        }
        b'.' => {
          if src.get(at + 1).is_some_and(u8::is_ascii_digit) {
            at = number_end(src, at);
            before = Before::Operand;
          } else if src.get(at + 1) == Some(&b'.') && src.get(at + 2) == Some(&b'.') {
            at += 3;
            before = Before::Operator;
          } else {
            at += 1;
            before = Before::Dot;
          }
        }
        b'+' | b'-' if src.get(at + 1) == Some(&byte) => {
          // `a++ / 2` divides: the operand stays one.
          at += 2;
        }
        _ if is_word_byte(byte) => {
          let end = word_end(src, at);
          let word = &src[at..end];
          if word == b"await" {
            self.awaits = true;
          }
          before = if before != Before::Dot && is_keyword_before_expression(word) {
            Before::Operator
          } else {
            Before::Operand
          };
          at = end;
        }
        _ => {
          at += 1;
          before = Before::Operator;
        }
      }
    }
  }

  /// From after the opening backtick, the offset after the closing one.
  fn template_end(&mut self, mut at: usize) -> Option<usize> {
    let src = self.src;

    loop {
      match *src.get(at)? {
        b'\\' => at += 2,
        b'`' => return Some(at + 1),
        b'$' if src.get(at + 1) == Some(&b'{') => at = self.code(at + 2)? + 1,
        _ => at += 1,
      }
    }
  }

  /// A JSX element or fragment from its `<`, through its closing tag: the offset after it.
  fn jsx_element(&mut self, start: usize) -> Option<usize> {
    self.nested(|lexer| lexer.jsx_element_in(start))
  }

  fn jsx_element_in(&mut self, start: usize) -> Option<usize> {
    let src = self.src;
    let (mut at, is_self_closing) = self.jsx_tag(start + 1)?;
    if is_self_closing {
      return Some(at);
    }

    loop {
      // Text may hold any character but these two.
      at += memchr::memchr2(b'{', b'<', src.get(at..)?)?;
      if src[at] == b'{' {
        at = self.code(at + 1)? + 1;
        continue;
      }

      let after = skip_js_space(src, at + 1)?;
      if src[after] == b'/' {
        return Some(memchr::memchr(b'>', &src[after..])? + after + 1);
      }
      at = self.jsx_element(at)?;
    }
  }

  /// A tag from after its `<`: the offset after its `>`, and whether it closes itself.
  fn jsx_tag(&mut self, mut at: usize) -> Option<(usize, bool)> {
    let src = self.src;

    loop {
      match *src.get(at)? {
        b'/' if matches!(src.get(at + 1), Some(b'/' | b'*')) => {
          at = if src[at + 1] == b'/' {
            line_end(src, at)
          } else {
            block_comment_end(src, at)?
          };
        }
        b'/' => {
          let end = skip_js_space(src, at + 1)?;
          return (src[end] == b'>').then_some((end + 1, true));
        }
        b'>' => return Some((at + 1, false)),
        b'{' => at = self.code(at + 1)? + 1,
        quote @ (b'"' | b'\'') => at = memchr::memchr(quote, src.get(at + 1..)?)? + at + 2,
        b'<' => at = self.jsx_element(at)?,
        _ => at += 1,
      }
    }
  }

  /// The ESM block whose first line starts at `start`: it ends at a blank line, unless its code is
  /// incomplete there, e.g. an object that a blank line splits, as MDX reads it.
  pub fn esm(&mut self, start: usize) -> Result<Esm, String> {
    let src = self.src;
    let mut at = start;
    let mut depth = 0u32;
    let mut before = Before::Operator;
    let mut edits = Vec::new();
    let mut has_layout = false;
    // The previous word, when it is `export` at the top level, and where it starts.
    let mut export_at: Option<usize> = None;
    // In `export { … }`: the depth of its braces, and whether the previous word is `as`.
    let mut clause: Option<u32> = None;
    let mut after_as = false;

    let incomplete = || "MDX: Could not parse import/exports: unexpected end of file".to_string();

    loop {
      let Some(&byte) = src.get(at) else {
        if depth > 0 {
          return Err(incomplete());
        }
        return Ok(Esm {
          end: at,
          next: at,
          edits,
          has_layout,
        });
      };

      // A token other than a word ends what `export` starts.
      let is_comment = byte == b'/' && matches!(src.get(at + 1), Some(b'/' | b'*'));
      let is_space_or_comment = is_comment || is_space(byte) || byte == b'\n' || byte == b'\r';
      let export = if is_space_or_comment {
        None
      } else {
        export_at.take()
      };

      match byte {
        b'\n' | b'\r' => {
          let next = after_line_ending(src, at);
          if depth == 0 && is_blank_line(src, next) {
            return Ok(Esm {
              end: at,
              next,
              edits,
              has_layout,
            });
          }
          at = next;
        }
        b' ' | b'\t' | 0x0b | 0x0c => at += 1,
        b'/' => match src.get(at + 1) {
          Some(b'/') => at = line_end(src, at),
          Some(b'*') => at = block_comment_end(src, at).ok_or_else(incomplete)?,
          _ if before == Before::Operator => {
            at = regex_end(src, at + 1);
            before = Before::Operand;
          }
          _ => {
            at += 1;
            before = Before::Operator;
          }
        },
        b'\'' | b'"' => {
          at = string_end(src, at).ok_or_else(incomplete)?;
          before = Before::Operand;
        }
        b'`' => {
          at = self.template_end(at + 1).ok_or_else(incomplete)?;
          before = Before::Operand;
        }
        b'{' | b'(' | b'[' => {
          depth += 1;
          at += 1;
          before = Before::Operator;
          if byte == b'{' && export.is_some() {
            clause = Some(depth);
          }
        }
        b'}' | b')' | b']' => {
          if clause == Some(depth) {
            clause = None;
          }
          depth = depth.saturating_sub(1);
          at += 1;
          before = Before::Operand;
        }
        b'<' if before == Before::Operator => {
          at = self.jsx_element(at).ok_or_else(incomplete)?;
          before = Before::Operand;
        }
        b'<' => {
          at = less_than_end(src, at);
          before = Before::Operator;
        }
        b'0'..=b'9' => {
          at = number_end(src, at);
          before = Before::Operand;
        }
        b'.' => {
          if src.get(at + 1).is_some_and(u8::is_ascii_digit) {
            at = number_end(src, at);
            before = Before::Operand;
          } else {
            at += 1;
            before = Before::Dot;
          }
        }
        b'+' | b'-' if src.get(at + 1) == Some(&byte) => at += 2,
        _ if is_word_byte(byte) => {
          let end = word_end(src, at);
          let word = &src[at..end];

          if let Some(export) = export {
            if word == b"default" {
              // `export default a` → `const MDXLayout = a`.
              edits.push((export, end, "const MDXLayout ="));
              has_layout = true;
            }
          } else if depth == 0 && word == b"export" && before != Before::Dot {
            export_at = Some(at);
          } else if clause.is_some() && word == b"default" {
            // `export { x as default }`, `export { default } from "./layout.js"`: the content is
            // the default export, so the layout is exported by another name.
            let next = skip_js_space(src, end).unwrap_or(src.len());
            let is_exported_name = matches!(src.get(next), Some(b',' | b'}'));
            if is_exported_name && after_as {
              edits.push((at, end, "MDXLayout"));
            } else if is_exported_name {
              edits.push((end, end, " as MDXLayout"));
            }
          }

          after_as = clause.is_some() && word == b"as";
          before = if before != Before::Dot && is_keyword_before_expression(word) {
            Before::Operator
          } else {
            Before::Operand
          };
          at = end;
        }
        _ => {
          at += 1;
          before = Before::Operator;
        }
      }
    }
  }
}

pub fn is_space(byte: u8) -> bool {
  matches!(byte, b' ' | b'\t' | 0x0b | 0x0c)
}

/// Whether the line from `at` holds only spaces, or the file ends there.
pub fn is_blank_line(src: &[u8], at: usize) -> bool {
  let mut at = at;
  while let Some(&byte) = src.get(at) {
    match byte {
      b' ' | b'\t' => at += 1,
      b'\n' | b'\r' => return true,
      _ => return false,
    }
  }
  true
}

/// The offset of the line ending at or after `at`, or the end of the file.
pub fn line_end(src: &[u8], at: usize) -> usize {
  memchr::memchr2(b'\n', b'\r', &src[at.min(src.len())..]).map_or(src.len(), |end| at + end)
}

/// The offset after the line ending at `at`.
pub fn after_line_ending(src: &[u8], at: usize) -> usize {
  match src.get(at) {
    Some(b'\r') if src.get(at + 1) == Some(&b'\n') => at + 2,
    Some(b'\r' | b'\n') => at + 1,
    _ => at,
  }
}

/// Spaces, line endings and comments from `at`: the offset of what follows, none at the end.
fn skip_js_space(src: &[u8], mut at: usize) -> Option<usize> {
  loop {
    match *src.get(at)? {
      b' ' | b'\t' | b'\n' | b'\r' | 0x0b | 0x0c => at += 1,
      b'/' if src.get(at + 1) == Some(&b'/') => at = line_end(src, at),
      b'/' if src.get(at + 1) == Some(&b'*') => at = block_comment_end(src, at)?,
      _ => return Some(at),
    }
  }
}

/// From a `/*`, the offset after its `*/`.
fn block_comment_end(src: &[u8], at: usize) -> Option<usize> {
  memchr::memmem::find(&src[at + 2..], b"*/").map(|end| at + 2 + end + 2)
}

/// From a quote, the offset after the closing one. A line ending ends a string that does not
/// parse, which is then as long as its line.
fn string_end(src: &[u8], start: usize) -> Option<usize> {
  let quote = src[start];
  let mut at = start + 1;

  loop {
    match *src.get(at)? {
      b'\\' => at += 2,
      b'\n' | b'\r' => return Some(at),
      byte if byte == quote => return Some(at + 1),
      _ => at += 1,
    }
  }
}

/// From after the opening `/` of a regular expression, the offset after its flags. A line ending
/// ends one that does not parse.
fn regex_end(src: &[u8], mut at: usize) -> usize {
  let mut in_class = false;

  while let Some(&byte) = src.get(at) {
    match byte {
      b'\\' => at += 2,
      b'\n' | b'\r' => return at,
      b'[' => {
        in_class = true;
        at += 1;
      }
      b']' => {
        in_class = false;
        at += 1;
      }
      b'/' if !in_class => return word_end(src, at + 1),
      _ => at += 1,
    }
  }

  src.len()
}

fn number_end(src: &[u8], start: usize) -> usize {
  // `0x1e`, `0b1` and `0o7` have no exponent.
  let is_prefixed = src[start] == b'0' && src.get(start + 1).is_some_and(u8::is_ascii_alphabetic);
  let mut at = start;

  while let Some(&byte) = src.get(at) {
    match byte {
      b'0'..=b'9' | b'a'..=b'z' | b'A'..=b'Z' | b'_' | b'.' => at += 1,
      // An exponent's sign: `1e-7`.
      b'+' | b'-' if !is_prefixed && matches!(src[at - 1], b'e' | b'E') => at += 1,
      _ => break,
    }
  }
  at
}

/// `<`, `<=`, `<<` or `<<=` as an operator: the offset after it.
fn less_than_end(src: &[u8], at: usize) -> usize {
  let mut end = at + 1;
  if src.get(end) == Some(&b'<') {
    end += 1;
  }
  if src.get(end) == Some(&b'=') {
    end += 1;
  }
  end
}

/// Bytes of names: ASCII letters, digits, `$`, `_`, `#` of private names, `\` of escapes, and any
/// non-ASCII byte.
fn is_word_byte(byte: u8) -> bool {
  byte.is_ascii_alphanumeric() || matches!(byte, b'$' | b'_' | b'#' | b'\\') || byte >= 0x80
}

fn word_end(src: &[u8], mut at: usize) -> usize {
  while let Some(&byte) = src.get(at) {
    if byte == b'\\' {
      at += 2;
    } else if is_word_byte(byte) {
      at += 1;
    } else {
      break;
    }
  }
  at.min(src.len())
}

/// Keywords after which an expression starts, e.g. `return <p />` or `typeof /a/`.
fn is_keyword_before_expression(word: &[u8]) -> bool {
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
  )
}

#[cfg(test)]
mod tests {
  use super::*;

  /// The expression in `{…}` at the start of `source`.
  fn expression(source: &str) -> Option<&str> {
    let end = Lexer::new(source).expression_end(1)?;
    Some(&source[1..end])
  }

  #[test]
  fn an_expression_ends_at_its_closing_brace() {
    assert_eq!(expression("{m.a()} b}"), Some("m.a()"));
    assert_eq!(expression("{ {a: {b}} } c"), Some(" {a: {b}} "));
    assert_eq!(expression("{a"), None);
  }

  #[test]
  fn braces_in_strings_comments_templates_and_regexes_are_not_the_end() {
    assert_eq!(expression(r#"{"}" + '}'}"#), Some(r#""}" + '}'"#));
    assert_eq!(expression(r#"{"\"}"}"#), Some(r#""\"}""#));
    assert_eq!(expression("{/* } */ a}"), Some("/* } */ a"));
    assert_eq!(expression("{a // }\n}"), Some("a // }\n"));
    assert_eq!(expression("{`}${ {a: 1}.a }}`}"), Some("`}${ {a: 1}.a }}`"));
    assert_eq!(expression("{/}/.test(a)}"), Some("/}/.test(a)"));
    assert_eq!(expression("{/[/}]/.test(a)}"), Some("/[/}]/.test(a)"));
    assert_eq!(expression("{a / b / c}"), Some("a / b / c"));
    assert_eq!(expression("{(a) / 2}"), Some("(a) / 2"));
    assert_eq!(expression("{a.return / 2}"), Some("a.return / 2"));
  }

  #[test]
  fn jsx_text_may_hold_quotes_and_slashes() {
    assert_eq!(
      expression("{ok && <p title='}'>Don't see http://a.b {x}</p>}"),
      Some("ok && <p title='}'>Don't see http://a.b {x}</p>")
    );
    assert_eq!(
      expression("{[1].map((n) => <li key={n}><b>{n}</b>'</li>)}"),
      Some("[1].map((n) => <li key={n}><b>{n}</b>'</li>)")
    );
    assert_eq!(expression("{<>a'</>}"), Some("<>a'</>"));
    assert_eq!(expression("{<a b={<c />} />}"), Some("<a b={<c />} />"));
    assert_eq!(expression("{a < b ? 'x}' : c}"), Some("a < b ? 'x}' : c"));
    assert_eq!(expression("{a.length<3}"), Some("a.length<3"));
    assert_eq!(expression("{a << b <<= <c />}"), Some("a << b <<= <c />"));
    assert_eq!(expression("{1e-7 < 0x1e - 1}"), Some("1e-7 < 0x1e - 1"));
  }

  #[test]
  fn deep_nesting_does_not_end() {
    let source = format!("{{{}", "`${".repeat(5000));
    assert_eq!(Lexer::new(&source).expression_end(1), None);
    let source = format!("{{{}", "<a>".repeat(5000));
    assert_eq!(Lexer::new(&source).expression_end(1), None);
  }

  #[test]
  fn await_makes_the_content_async() {
    let mut lexer = Lexer::new("{await a} {wait}");
    lexer.expression_end(1);
    assert!(lexer.awaits);

    let mut lexer = Lexer::new("{wait} {a.await}");
    lexer.expression_end(1);
    assert!(!lexer.awaits);
  }

  fn esm(source: &str) -> Result<(String, Vec<String>, bool), String> {
    let esm = Lexer::new(source).esm(0)?;
    let edits = esm
      .edits
      .iter()
      .map(|(start, end, text)| format!("{:?}->{text}", &source[*start..*end]))
      .collect();
    Ok((source[..esm.end].to_string(), edits, esm.has_layout))
  }

  #[test]
  fn esm_ends_at_a_blank_line_unless_incomplete() {
    let (code, ..) = esm("import a from 'a'\nexport const b = 1\n\n# Title").unwrap_or_default();
    assert_eq!(code, "import a from 'a'\nexport const b = 1");

    let (code, ..) =
      esm("export const a = {\n  b: 1,\n\n  c: `\n\n`,\n}\n  \nText").unwrap_or_default();
    assert_eq!(code, "export const a = {\n  b: 1,\n\n  c: `\n\n`,\n}");

    let (code, ..) = esm("export const a = 1\r\n\r\nText").unwrap_or_default();
    assert_eq!(code, "export const a = 1");

    assert!(esm("export const a = {\n  b: 1,\n").is_err());
  }

  #[test]
  fn a_default_export_is_the_layout() {
    let (_, edits, has_layout) =
      esm("export default function Layout({ children }) { return children }").unwrap_or_default();
    assert_eq!(edits, vec![r#""export default"->const MDXLayout ="#]);
    assert!(has_layout);

    let (_, edits, has_layout) =
      esm("export /* a */ default {}\nexport const b = { default: 1 }").unwrap_or_default();
    assert_eq!(
      edits,
      vec![r#""export /* a */ default"->const MDXLayout ="#]
    );
    assert!(has_layout);

    let (_, edits, has_layout) =
      esm("export { default } from './a.js'\nexport { b as default, default as c } from './b.js'")
        .unwrap_or_default();
    assert_eq!(
      edits,
      vec![r#"""-> as MDXLayout"#, r#""default"->MDXLayout"#]
    );
    assert!(!has_layout);
  }
}
