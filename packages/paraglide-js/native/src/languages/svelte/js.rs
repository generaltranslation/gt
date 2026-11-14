//! Just enough of JavaScript's lexical grammar to find where a template expression ends, and which
//! names an instance script declares with `export let`: strings, template literals, comments and
//! regular expressions are skipped, so that a bracket in them does not count.

/// How deep template literals may nest in each other's `${…}`.
const MAX_NESTING: u32 = 64;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Tok {
  Ident,
  /// One byte of punctuation, e.g. `(` or the `=` of `=>`.
  Punct,
  /// A string, number, template literal or regular expression.
  Literal,
  /// The end of the text, or a comment or template literal that does not end.
  End,
}

#[derive(Clone, Copy, Debug)]
pub struct Token {
  pub tok: Tok,
  pub start: usize,
  pub end: usize,
  /// A line break comes between it and the token before.
  pub newline_before: bool,
}

impl Token {
  fn end_of(position: usize) -> Self {
    Token {
      tok: Tok::End,
      start: position,
      end: position,
      newline_before: false,
    }
  }

  pub fn is_punct(&self, source: &[u8], byte: u8) -> bool {
    self.tok == Tok::Punct && source[self.start] == byte
  }

  pub fn is_word(&self, source: &[u8], word: &[u8]) -> bool {
    self.tok == Tok::Ident && &source[self.start..self.end] == word
  }

  /// An identifier, literal or closing bracket: what may end an operand.
  fn ends_operand(&self, source: &[u8]) -> bool {
    match self.tok {
      Tok::Ident => !is_keyword_before_expression(&source[self.start..self.end]),
      Tok::Literal => true,
      Tok::Punct => matches!(source[self.start], b')' | b']' | b'}'),
      Tok::End => false,
    }
  }
}

pub struct Lexer<'s> {
  source: &'s [u8],
  pub position: usize,
  /// Whether a `/` here starts a regular expression rather than a division.
  regex_allowed: bool,
  nesting: u32,
}

impl<'s> Lexer<'s> {
  /// Reads `source` from `position`; the text ends where `source` does.
  pub fn new(source: &'s [u8], position: usize) -> Self {
    Lexer {
      source,
      position,
      regex_allowed: true,
      nesting: 0,
    }
  }

  pub fn next_token(&mut self) -> Token {
    let source = self.source;
    let mut newline_before = false;

    loop {
      let Some(&byte) = source.get(self.position) else {
        return Token::end_of(source.len());
      };

      match byte {
        b'\n' | b'\r' => {
          newline_before = true;
          self.position += 1;
        }
        b' ' | b'\t' | 0x0b | 0x0c => self.position += 1,
        b'/' if source.get(self.position + 1) == Some(&b'/') => {
          self.position = memchr::memchr2(b'\n', b'\r', &source[self.position..])
            .map_or(source.len(), |at| self.position + at);
        }
        b'/' if source.get(self.position + 1) == Some(&b'*') => {
          let body = self.position + 2;
          let Some(at) = memchr::memmem::find(&source[body..], b"*/") else {
            return Token::end_of(source.len());
          };
          newline_before |= memchr::memchr3(b'\n', b'\r', 0xe2, &source[body..body + at]).is_some();
          self.position = body + at + 2;
        }
        0x80.. => match whitespace_at(source, self.position) {
          Some((length, is_newline)) => {
            newline_before |= is_newline;
            self.position += length;
          }
          None => break,
        },
        _ => break,
      }
    }

    let start = self.position;
    let byte = source[start];
    let tok = if is_identifier_byte(byte) && !byte.is_ascii_digit() {
      self.position = identifier_end(source, start);
      self.regex_allowed = is_keyword_before_expression(&source[start..self.position]);
      Tok::Ident
    } else if byte.is_ascii_digit()
      || (byte == b'.' && source.get(start + 1).is_some_and(u8::is_ascii_digit))
    {
      self.position = number_end(source, start);
      self.regex_allowed = false;
      Tok::Literal
    } else if byte == b'\'' || byte == b'"' {
      self.position = string_end(source, start);
      self.regex_allowed = false;
      Tok::Literal
    } else if byte == b'`' {
      match self.template_end(start) {
        Some(end) => self.position = end,
        None => return Token::end_of(source.len()),
      }
      self.regex_allowed = false;
      Tok::Literal
    } else if byte == b'/' && self.regex_allowed {
      match regex_end(source, start) {
        Some(end) => {
          self.position = end;
          self.regex_allowed = false;
          Tok::Literal
        }
        None => {
          self.position = start + 1;
          Tok::Punct
        }
      }
    } else {
      self.position = start + 1;
      self.regex_allowed = !matches!(byte, b')' | b']' | b'}');
      Tok::Punct
    };

    Token {
      tok,
      start,
      end: self.position,
      newline_before,
    }
  }

  /// The end of the template literal at `start`, past its closing backtick.
  fn template_end(&self, start: usize) -> Option<usize> {
    let source = self.source;
    let mut position = start + 1;

    loop {
      let at = memchr::memchr3(b'\\', b'`', b'$', &source[position..])? + position;
      match source[at] {
        b'\\' => position = at + 2,
        b'`' => return Some(at + 1),
        _ if source.get(at + 1) == Some(&b'{') => {
          if self.nesting >= MAX_NESTING {
            return None;
          }
          let mut inner = Lexer {
            source,
            position: at + 2,
            regex_allowed: true,
            nesting: self.nesting + 1,
          };
          position = inner.skip_to_close(b'{', b'}')?.end;
        }
        _ => position = at + 1,
      }
      if position > source.len() {
        return None;
      }
    }
  }

  /// Reads up to the `close` that ends what an `open` before the position opened.
  fn skip_to_close(&mut self, open: u8, close: u8) -> Option<Token> {
    let mut count = 1u32;

    loop {
      let token = self.next_token();
      match token.tok {
        Tok::End => return None,
        Tok::Punct => {
          let byte = self.source[token.start];
          if byte == open {
            count += 1;
          } else if byte == close {
            count -= 1;
            if count == 0 {
              return Some(token);
            }
          }
        }
        _ => {}
      }
    }
  }
}

/// Where the construct that an `open` bracket right before `from` opened is closed.
pub struct Closing {
  /// The offset of the closing bracket.
  pub at: usize,
  /// A comma outside any bracket: the text is a sequence, `a, b`.
  pub has_comma: bool,
}

/// From `from`, the `close` bracket that ends what an `open` just before it opened, as Svelte finds
/// it: only `open` and `close` count, so that an expression with other brackets unbalanced (one
/// being edited) still ends.
pub fn closing(source: &[u8], from: usize, open: u8, close: u8) -> Option<Closing> {
  closing_visiting(source, from, open, close, |_, _, _| {})
}

/// As `closing`, showing `visit` each token with its depth in brackets of any kind, and the token
/// before it.
pub fn closing_visiting(
  source: &[u8],
  from: usize,
  open: u8,
  close: u8,
  mut visit: impl FnMut(&Token, u32, Option<&Token>),
) -> Option<Closing> {
  let mut lexer = Lexer::new(source, from);
  let mut count = 1u32;
  let mut depth = 0u32;
  let mut has_comma = false;
  let mut previous: Option<Token> = None;

  loop {
    let token = lexer.next_token();
    if token.tok == Tok::End {
      return None;
    }

    if token.tok == Tok::Punct {
      let byte = source[token.start];
      if byte == close {
        count -= 1;
        if count == 0 {
          return Some(Closing {
            at: token.start,
            has_comma,
          });
        }
      } else if byte == open {
        count += 1;
      }
    }

    visit(&token, depth, previous.as_ref());

    if token.tok == Tok::Punct {
      match source[token.start] {
        b'(' | b'[' | b'{' => depth += 1,
        b')' | b']' | b'}' => depth = depth.saturating_sub(1),
        b',' if depth == 0 => has_comma = true,
        _ => {}
      }
    }
    previous = Some(token);
  }
}

/// What the instance script tells about the component, from one reading of its tokens.
#[derive(Default, Debug, PartialEq, Eq)]
pub struct InstanceScript {
  /// The offsets of the names it declares at its top level with `export let` or `export var`:
  /// Svelte 4's props. Destructured declarations declare no prop, as for Svelte. An offset that is
  /// no declared name, as a type's in `export let a: Map<K, V>`, is harmless: only declarations are
  /// looked up.
  pub exported: Vec<usize>,
  /// The offsets right after the `=` of its top-level reactive assignments, `$: name = …` and
  /// `$: ({ a } = …)`, whose value Svelte computes again whenever what it reads changes.
  pub reactive_assignments: Vec<usize>,
}

/// Reads the instance script `source[start..end)`.
pub fn instance_script(source: &[u8], start: usize, end: usize) -> InstanceScript {
  #[derive(Clone, Copy)]
  enum State {
    Idle,
    AfterExport,
    Declarators {
      expects_name: bool,
    },
    /// `$` where a statement starts.
    Dollar,
    /// `$:`
    Label,
    /// `$: name`
    Target,
    /// `$: (`
    Parenthesized,
    /// `$: ({ a`, until the pattern ends.
    Pattern,
    /// `$: ({ a }`
    AfterPattern,
    /// `$: name =`, unless it is `==` or `=>`: the offset after it.
    Assigns(usize),
  }

  let source = &source[..end];
  let mut script = InstanceScript::default();
  let mut lexer = Lexer::new(source, start);
  let mut depth = 0u32;
  let mut previous: Option<Token> = None;
  let mut state = State::Idle;

  loop {
    let token = lexer.next_token();
    if token.tok == Tok::End {
      return script;
    }

    let starts_statement = depth == 0
      && match previous {
        None => true,
        Some(previous) => {
          previous.is_punct(source, b';')
            || previous.is_punct(source, b'}')
            || (token.newline_before && previous.ends_operand(source))
        }
      };

    // A line break ends the declarations where it would end the statement.
    let ends_declarations = matches!(state, State::Declarators { .. })
      && depth == 0
      && token.newline_before
      && matches!(token.tok, Tok::Ident | Tok::Literal)
      && previous.is_some_and(|previous| previous.ends_operand(source));
    if ends_declarations {
      state = State::Idle;
    }

    state = match state {
      State::Idle => {
        let after_dot = previous.is_some_and(|previous| previous.is_punct(source, b'.'));
        if depth == 0 && token.is_word(source, b"export") && !after_dot {
          State::AfterExport
        } else if starts_statement && token.is_word(source, b"$") {
          State::Dollar
        } else {
          State::Idle
        }
      }
      State::AfterExport => {
        if token.is_word(source, b"let") || token.is_word(source, b"var") {
          State::Declarators { expects_name: true }
        } else {
          State::Idle
        }
      }
      State::Declarators { expects_name } => {
        if expects_name && token.tok == Tok::Ident {
          script.exported.push(token.start);
        }
        if depth == 0 && token.is_punct(source, b';') {
          State::Idle
        } else {
          State::Declarators {
            expects_name: depth == 0 && token.is_punct(source, b','),
          }
        }
      }
      State::Dollar if token.is_punct(source, b':') => State::Label,
      State::Label if token.tok == Tok::Ident => State::Target,
      State::Label if token.is_punct(source, b'(') => State::Parenthesized,
      State::Target | State::AfterPattern if token.is_punct(source, b'=') => {
        State::Assigns(token.end)
      }
      State::Parenthesized if token.is_punct(source, b'{') || token.is_punct(source, b'[') => {
        State::Pattern
      }
      State::Pattern => State::Pattern,
      State::Assigns(after) => {
        let is_operator =
          token.start == after && (token.is_punct(source, b'=') || token.is_punct(source, b'>'));
        if !is_operator {
          script.reactive_assignments.push(after);
        }
        State::Idle
      }
      _ => State::Idle,
    };

    if token.tok == Tok::Punct {
      match source[token.start] {
        b'(' | b'[' | b'{' => depth += 1,
        b')' | b']' | b'}' => {
          depth = depth.saturating_sub(1);
          // `$: ({ a }`: the pattern ends where its bracket does, in the parenthesis.
          if matches!(state, State::Pattern) && depth == 1 {
            state = State::AfterPattern;
          }
        }
        _ => {}
      }
    }
    previous = Some(token);
  }
}

/// Words after which an expression starts, so that a `/` begins a regular expression.
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
      | b"await"
      | b"yield"
      | b"extends"
  )
}

/// A byte that may be in an identifier; any byte of a non-ASCII character is taken to be.
pub fn is_identifier_byte(byte: u8) -> bool {
  byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'$' || byte == b'\\' || byte >= 0x80
}

fn identifier_end(source: &[u8], start: usize) -> usize {
  let mut position = start;
  while let Some(&byte) = source.get(position) {
    if byte == b'\\' {
      position += 2;
    } else if is_identifier_byte(byte) {
      position += 1;
    } else {
      break;
    }
  }
  position.min(source.len())
}

fn number_end(source: &[u8], start: usize) -> usize {
  let mut position = start + 1;
  while let Some(&byte) = source.get(position) {
    let is_exponent_sign = (byte == b'+' || byte == b'-')
      && matches!(source[position - 1], b'e' | b'E')
      && !source[start..position].starts_with(b"0x")
      && !source[start..position].starts_with(b"0X");
    if byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'.' || is_exponent_sign {
      position += 1;
    } else {
      break;
    }
  }
  position
}

/// Past the closing quote; a string that does not end ends before its line break.
fn string_end(source: &[u8], start: usize) -> usize {
  let quote = source[start];
  let mut position = start + 1;
  loop {
    match source.get(position) {
      None => return source.len(),
      Some(b'\\') if source.get(position + 1..position + 3) == Some(b"\r\n") => position += 3,
      Some(b'\\') => position += 2,
      Some(&byte) if byte == quote => return position + 1,
      Some(b'\n' | b'\r') => return position,
      Some(_) => position += 1,
    }
  }
}

/// Past the flags of the regular expression at `start`; none if it does not end on its line.
fn regex_end(source: &[u8], start: usize) -> Option<usize> {
  let mut position = start + 1;
  let mut in_class = false;
  loop {
    match *source.get(position)? {
      b'\n' | b'\r' => return None,
      b'\\' => position += 2,
      b'[' => {
        in_class = true;
        position += 1;
      }
      b']' => {
        in_class = false;
        position += 1;
      }
      b'/' if !in_class => break,
      _ => position += 1,
    }
  }
  position += 1;
  while source
    .get(position)
    .is_some_and(|&byte| byte.is_ascii_alphanumeric())
  {
    position += 1;
  }
  Some(position)
}

/// The length of the non-ASCII whitespace character at `position`, and whether it ends a line.
pub fn whitespace_at(source: &[u8], position: usize) -> Option<(usize, bool)> {
  let (character, length) = char_at(source, position)?;
  match character {
    '\u{2028}' | '\u{2029}' => Some((length, true)),
    '\u{feff}' => Some((length, false)),
    _ if character.is_whitespace() && character != '\u{85}' => Some((length, false)),
    _ => None,
  }
}

/// The character at the UTF-8 offset `position`, which starts one, and its length.
pub fn char_at(source: &[u8], position: usize) -> Option<(char, usize)> {
  let first = *source.get(position)?;
  let length = match first {
    0x00..=0x7f => return Some((first as char, 1)),
    0xc0..=0xdf => 2,
    0xe0..=0xef => 3,
    _ => 4,
  };
  let bytes = source.get(position..position + length)?;
  let character = std::str::from_utf8(bytes).ok()?.chars().next()?;
  Some((character, length))
}
