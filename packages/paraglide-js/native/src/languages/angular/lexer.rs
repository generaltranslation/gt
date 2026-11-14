//! Angular's template lexer (`_Tokenizer` of `@angular/compiler`, with expansion forms, blocks and
//! `@let` on, and line endings preserved): the template's tokens, or the first error Angular
//! reports, which rejects the template.

use super::tags::{named_entity, numeric_entity, tag_definition, Content};

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Kind {
  TagOpenStart,
  TagOpenEnd,
  TagOpenEndVoid,
  TagClose,
  IncompleteTagOpen,
  Text,
  EscapableRawText,
  RawText,
  Interpolation,
  EncodedEntity,
  CommentStart,
  CommentEnd,
  /// A `//` or `/* */` comment in a start tag.
  TagComment,
  CdataStart,
  CdataEnd,
  AttrName,
  AttrQuote,
  AttrValueText,
  AttrValueInterpolation,
  DocType,
  ExpansionFormStart,
  ExpansionCaseValue,
  ExpansionCaseExpStart,
  ExpansionCaseExpEnd,
  ExpansionFormEnd,
  BlockOpenStart,
  BlockOpenEnd,
  BlockClose,
  BlockParameter,
  IncompleteBlockOpen,
  LetStart,
  LetValue,
  LetEnd,
  IncompleteLet,
  ProcessingInstruction,
  Eof,
}

/// A token: its kind, its range, and its parts as ranges of the text. Tags and attributes have
/// a prefix (`part0`, empty for none) and a name (`part1`); an interpolation has its expression
/// in `part0` and in `part1` its `}}`, if it has one; a block its name in `part0`.
#[derive(Clone, Copy, Debug)]
pub struct Token {
  pub kind: Kind,
  pub start: u32,
  pub end: u32,
  pub part0: (u32, u32),
  pub part1: (u32, u32),
}

impl Token {
  fn new(kind: Kind, start: usize, end: usize) -> Self {
    Token {
      kind,
      start: start as u32,
      end: end as u32,
      part0: (start as u32, end as u32),
      part1: (end as u32, end as u32),
    }
  }
}

pub type Tokens = Vec<Token>;

/// `$EOF` is 0 in Angular, as a NUL character is.
const EOF: u32 = 0;

const SUPPORTED_BLOCKS: [&str; 13] = [
  "@if",
  "@else",
  "@for",
  "@switch",
  "@case",
  "@default",
  "@empty",
  "@defer",
  "@placeholder",
  "@loading",
  "@boundary",
  "@error",
  "@content",
];

enum Error {
  /// A `ParseError`: the start tag that it is in is incomplete, not an error.
  Parse(String),
  /// A `CursorError`, from reading past the end.
  Cursor,
}

type Lexed<T = ()> = Result<T, Error>;

#[derive(Clone, Copy, PartialEq, Eq)]
enum Expansion {
  Form,
  Case,
}

struct Lexer<'t> {
  text: &'t str,
  bytes: &'t [u8],
  pos: usize,
  tokens: Tokens,
  expansions: Vec<Expansion>,
}

/// The tokens of `text`, or the message of the first error Angular reports.
pub fn tokenize(text: &str) -> Result<Tokens, String> {
  let mut lexer = Lexer {
    text,
    bytes: text.as_bytes(),
    pos: 0,
    tokens: Vec::with_capacity(text.len() / 16),
    expansions: Vec::new(),
  };
  lexer.run()?;
  Ok(lexer.tokens)
}

fn unexpected(code: u32) -> String {
  if code == EOF {
    "Unexpected character \"EOF\"".to_string()
  } else {
    format!(
      "Unexpected character \"{}\"",
      char::from_u32(code).unwrap_or('\u{fffd}')
    )
  }
}

fn is_whitespace(code: u32) -> bool {
  (9..=32).contains(&code) || code == 0xa0
}

fn is_not_whitespace(code: u32) -> bool {
  !is_whitespace(code) || code == EOF
}

fn is_ascii_letter(code: u32) -> bool {
  (u32::from(b'a')..=u32::from(b'z')).contains(&code)
    || (u32::from(b'A')..=u32::from(b'Z')).contains(&code)
}

fn is_digit(code: u32) -> bool {
  (u32::from(b'0')..=u32::from(b'9')).contains(&code)
}

fn is_name_end(code: u32) -> bool {
  is_whitespace(code) || matches!(code, 0x3e | 0x3c | 0x2f | 0x27 | 0x22 | 0x3d) || code == EOF
}

fn is_prefix_end(code: u32) -> bool {
  !is_ascii_letter(code) && !is_digit(code)
}

fn is_quote(code: u32) -> bool {
  matches!(code, 0x27 | 0x22 | 0x60)
}

fn is_new_line(code: u32) -> bool {
  code == 0x0a || code == 0x0d
}

fn is_attribute_terminator(code: u32) -> bool {
  matches!(code, 0x2f | 0x3e | 0x3c) || code == EOF
}

fn is_block_name_char(code: u32) -> bool {
  is_ascii_letter(code) || is_digit(code) || code == u32::from(b'_')
}

fn is_block_parameter_char(code: u32) -> bool {
  code != u32::from(b';') && is_not_whitespace(code)
}

const fn c(byte: u8) -> u32 {
  byte as u32
}

impl<'t> Lexer<'t> {
  fn peek(&self) -> u32 {
    self.code_at(self.pos)
  }

  fn code_at(&self, pos: usize) -> u32 {
    match self.bytes.get(pos) {
      None => EOF,
      Some(&byte) if byte < 0x80 => u32::from(byte),
      Some(_) => self.text[pos..]
        .chars()
        .next()
        .map_or(EOF, |character| character as u32),
    }
  }

  fn at_end(&self) -> bool {
    self.pos >= self.bytes.len()
  }

  fn advance(&mut self) -> Lexed {
    match self.bytes.get(self.pos) {
      None => Err(Error::Cursor),
      Some(&byte) => {
        self.pos += match byte {
          0..=0x7f => 1,
          0xc0..=0xdf => 2,
          0xe0..=0xef => 3,
          _ => 4,
        };
        Ok(())
      }
    }
  }

  fn attempt(&mut self, code: u8) -> bool {
    if self.peek() == u32::from(code) && !self.at_end() {
      self.pos += 1;
      true
    } else {
      false
    }
  }

  fn require(&mut self, code: u8) -> Lexed {
    if self.attempt(code) {
      Ok(())
    } else {
      Err(self.parse_error(unexpected(self.peek())))
    }
  }

  fn peek_str(&self, text: &str) -> bool {
    self.bytes[self.pos..].starts_with(text.as_bytes())
  }

  fn attempt_str(&mut self, text: &str) -> bool {
    let found = self.peek_str(text);
    if found {
      self.pos += text.len();
    }
    found
  }

  fn require_str(&mut self, text: &str) -> Lexed {
    if self.attempt_str(text) {
      return Ok(());
    }
    Err(self.parse_error(unexpected(self.peek())))
  }

  fn attempt_until(&mut self, stop: impl Fn(u32) -> bool) -> Lexed {
    while !stop(self.peek()) {
      self.advance()?;
    }
    Ok(())
  }

  fn skip_whitespace(&mut self) {
    while is_whitespace(self.peek()) && !self.at_end() {
      let _ = self.advance();
    }
  }

  fn parse_error(&self, message: String) -> Error {
    Error::Parse(self.with_hint(message))
  }

  fn with_hint(&self, message: String) -> String {
    if self.in_expansion_form() {
      format!("{message} (Do you have an unescaped \"{{\" in your template? Use \"{{{{ '{{' }}}}\") to escape it.)")
    } else {
      message
    }
  }

  fn push(&mut self, kind: Kind, start: usize) -> usize {
    self.push_token(Token::new(kind, start, self.pos))
  }

  /// Pushes a token, merged into the previous one if both are text, as `mergeTextTokens`.
  fn push_token(&mut self, token: Token) -> usize {
    if matches!(token.kind, Kind::Text | Kind::AttrValueText) {
      if let Some(last) = self.tokens.last_mut() {
        if last.kind == token.kind {
          last.end = token.end;
          last.part0.1 = token.part0.1;
          return self.tokens.len() - 1;
        }
      }
    }
    self.tokens.push(token);
    self.tokens.len() - 1
  }

  fn in_expansion_case(&self) -> bool {
    self.expansions.last() == Some(&Expansion::Case)
  }

  fn in_expansion_form(&self) -> bool {
    self.expansions.last() == Some(&Expansion::Form)
  }

  fn run(&mut self) -> Result<(), String> {
    while self.peek() != EOF {
      let start = self.pos;
      if let Err(error) = self.step(start) {
        return Err(match error {
          Error::Parse(message) => message,
          Error::Cursor => self.with_hint(unexpected(EOF)),
        });
      }
    }
    self.tokens.push(Token::new(Kind::Eof, self.pos, self.pos));
    Ok(())
  }

  fn step(&mut self, start: usize) -> Lexed {
    if self.attempt(b'<') {
      if self.attempt(b'!') {
        if self.attempt(b'[') {
          self.consume_cdata(start)
        } else if self.attempt(b'-') {
          self.consume_comment(start)
        } else {
          self.consume_doctype(start)
        }
      } else if self.attempt(b'/') {
        self.consume_tag_close(start)
      } else if self.attempt(b'?') {
        self.consume_processing_instruction(start)
      } else {
        self.consume_tag_open(start)
      }
    } else if self.peek() == c(b'@') && self.peek_str("@let") {
      self.consume_let(start)
    } else if self.is_block_start() {
      self.consume_block_start(start)
    } else if !self.in_expansion_case() && !self.in_expansion_form() && self.attempt(b'}') {
      self.push(Kind::BlockClose, start);
      Ok(())
    } else if self.tokenize_expansion_form()? {
      Ok(())
    } else {
      self.consume_with_interpolation(Kind::Text, Kind::Interpolation, Stop::TextEnd)
    }
  }

  fn is_block_start(&self) -> bool {
    self.peek() == c(b'@') && SUPPORTED_BLOCKS.iter().any(|name| self.peek_str(name))
  }

  fn is_tag_start(&self) -> bool {
    if self.peek() != c(b'<') {
      return false;
    }
    let next = self.code_at(self.pos + 1);
    is_ascii_letter(next) || matches!(next, 0x2f | 0x21 | 0x3f)
  }

  fn is_expansion_form_start(&self) -> bool {
    self.peek() == c(b'{') && !self.peek_str("{{")
  }

  fn is_text_end(&self) -> bool {
    if self.is_tag_start() || self.peek() == EOF {
      return true;
    }
    if self.is_expansion_form_start() || (self.peek() == c(b'}') && self.in_expansion_case()) {
      return true;
    }
    let in_expansion = self.in_expansion_case() || self.in_expansion_form();
    !in_expansion && (self.is_block_start() || self.peek_str("@let") || self.peek() == c(b'}'))
  }

  fn get_block_name(&mut self) -> (u32, u32) {
    let start = self.pos;
    let mut spaces_allowed = false;
    loop {
      let code = self.peek();
      let stop = if is_whitespace(code) {
        !spaces_allowed
      } else if is_block_name_char(code) {
        spaces_allowed = true;
        false
      } else {
        true
      };
      if stop || self.advance().is_err() {
        break;
      }
    }
    trim(self.text, start, self.pos)
  }

  fn consume_block_start(&mut self, start: usize) -> Lexed {
    self.require(b'@')?;
    let name = self.get_block_name();
    let name_text = &self.text[name.0 as usize..name.1 as usize];
    let is_default_never = block_name(name_text) == "default never";
    let is_case_or_default = matches!(block_name(name_text), "case" | "default");
    let mut token = Token::new(Kind::BlockOpenStart, start, self.pos);
    token.part0 = name;
    let index = self.push_token(token);

    if self.peek() == c(b'(') {
      self.advance()?;
      self.consume_block_parameters()?;
      self.attempt_until(is_not_whitespace)?;
      if self.attempt(b')') {
        self.attempt_until(is_not_whitespace)?;
      } else {
        self.tokens[index].kind = Kind::IncompleteBlockOpen;
        return Ok(());
      }
    }

    if is_default_never && self.attempt(b';') {
      self.push(Kind::BlockOpenEnd, self.pos);
      self.push(Kind::BlockClose, self.pos);
      return Ok(());
    }
    if self.attempt(b'{') {
      self.push(Kind::BlockOpenEnd, self.pos);
    } else if self.is_block_start() && is_case_or_default {
      self.push(Kind::BlockOpenEnd, self.pos);
      self.push(Kind::BlockClose, self.pos);
    } else {
      self.tokens[index].kind = Kind::IncompleteBlockOpen;
    }
    Ok(())
  }

  fn consume_block_parameters(&mut self) -> Lexed {
    self.attempt_until(is_block_parameter_char)?;
    while self.peek() != c(b')') && self.peek() != EOF {
      let start = self.pos;
      let mut in_quote: Option<u32> = None;
      let mut open_parens = 0u32;
      while (self.peek() != c(b';') && self.peek() != EOF) || in_quote.is_some() {
        let code = self.peek();
        if code == c(b'\\') {
          self.advance()?;
        } else if Some(code) == in_quote {
          in_quote = None;
        } else if in_quote.is_none() && is_quote(code) {
          in_quote = Some(code);
        } else if code == c(b'(') && in_quote.is_none() {
          open_parens += 1;
        } else if code == c(b')') && in_quote.is_none() {
          if open_parens == 0 {
            break;
          }
          open_parens -= 1;
        }
        self.advance()?;
      }
      self.push(Kind::BlockParameter, start);
      self.attempt_until(is_block_parameter_char)?;
    }
    Ok(())
  }

  fn consume_let(&mut self, start: usize) -> Lexed {
    self.require_str("@let")?;
    if !is_whitespace(self.peek()) {
      let mut token = Token::new(Kind::IncompleteLet, start, self.pos);
      token.part0 = (start as u32, self.pos as u32);
      self.push_token(token);
      return Ok(());
    }
    self.attempt_until(is_not_whitespace)?;

    let name_start = self.pos;
    let mut allow_digit = false;
    loop {
      let code = self.peek();
      let is_name = is_ascii_letter(code)
        || code == c(b'$')
        || code == c(b'_')
        || (allow_digit && is_digit(code));
      if !is_name {
        break;
      }
      allow_digit = true;
      self.advance()?;
    }
    let mut token = Token::new(Kind::LetStart, start, self.pos);
    token.part0 = trim(self.text, name_start, self.pos);
    let index = self.push_token(token);

    self.attempt_until(is_not_whitespace)?;
    if !self.attempt(b'=') {
      self.tokens[index].kind = Kind::IncompleteLet;
      return Ok(());
    }
    self.attempt_until(|code| is_not_whitespace(code) && !is_new_line(code))?;

    let value_start = self.pos;
    self.attempt_until_ignoring_quotes(|code| code == c(b';'))?;
    self.push(Kind::LetValue, value_start);

    if self.peek() == c(b';') {
      let end_start = self.pos;
      self.advance()?;
      self.push(Kind::LetEnd, end_start);
    } else {
      self.tokens[index].kind = Kind::IncompleteLet;
      self.tokens[index].end = self.pos as u32;
    }
    Ok(())
  }

  fn attempt_until_ignoring_quotes(&mut self, stop: impl Fn(u32) -> bool) -> Lexed {
    while self.peek() != EOF {
      let code = self.peek();
      if stop(code) {
        break;
      }
      if is_quote(code) {
        self.advance()?;
        loop {
          let inner = self.peek();
          if inner == c(b'\\') {
            self.advance()?;
          } else if inner == code {
            break;
          }
          self.advance()?;
        }
      }
      self.advance()?;
    }
    Ok(())
  }

  /// An ICU expansion's start, a case of one, or the end of either.
  fn tokenize_expansion_form(&mut self) -> Lexed<bool> {
    if self.is_expansion_form_start() {
      self.consume_expansion_form_start()?;
      return Ok(true);
    }
    if self.peek() != c(b'}') && self.in_expansion_form() {
      self.consume_expansion_case_start()?;
      return Ok(true);
    }
    if self.peek() == c(b'}') {
      if self.in_expansion_case() {
        let start = self.pos;
        self.require(b'}')?;
        self.push(Kind::ExpansionCaseExpEnd, start);
        self.skip_whitespace();
        self.expansions.pop();
        return Ok(true);
      }
      if self.in_expansion_form() {
        let start = self.pos;
        self.require(b'}')?;
        self.push(Kind::ExpansionFormEnd, start);
        self.expansions.pop();
        return Ok(true);
      }
    }
    Ok(false)
  }

  fn read_until(&mut self, code: u8) -> Lexed<(usize, usize)> {
    let start = self.pos;
    while self.peek() != u32::from(code) {
      self.advance()?;
    }
    Ok((start, self.pos))
  }

  fn consume_expansion_form_start(&mut self) -> Lexed {
    let start = self.pos;
    self.require(b'{')?;
    self.push(Kind::ExpansionFormStart, start);
    self.expansions.push(Expansion::Form);

    let (condition_start, _) = self.read_until(b',')?;
    self.push(Kind::RawText, condition_start);
    self.require(b',')?;
    self.skip_whitespace();

    let (type_start, _) = self.read_until(b',')?;
    self.push(Kind::RawText, type_start);
    self.require(b',')?;
    self.skip_whitespace();
    Ok(())
  }

  fn consume_expansion_case_start(&mut self) -> Lexed {
    let (start, end) = self.read_until(b'{')?;
    let mut token = Token::new(Kind::ExpansionCaseValue, start, end);
    token.part0 = trim(self.text, start, end);
    self.push_token(token);
    self.skip_whitespace();

    let brace = self.pos;
    self.require(b'{')?;
    self.push(Kind::ExpansionCaseExpStart, brace);
    self.skip_whitespace();
    self.expansions.push(Expansion::Case);
    Ok(())
  }

  fn consume_entity(&mut self, text_kind: Kind) -> Lexed {
    let start = self.pos;
    self.advance()?;
    if self.attempt(b'#') {
      let is_hex = self.attempt(b'x') || self.attempt(b'X');
      let code_start = self.pos;
      self.attempt_until(|code| {
        code == c(b';')
          || code == EOF
          || !char::from_u32(code).is_some_and(|c| c.is_ascii_hexdigit())
      })?;
      if self.peek() != c(b';') {
        self.advance()?;
        let kind = if is_hex { "hexadecimal" } else { "decimal" };
        return Err(self.parse_error(format!(
          "Unable to parse entity \"{}\" - {kind} character reference entities must end with \";\"",
          &self.text[start..self.pos]
        )));
      }
      let digits = &self.text[code_start..self.pos];
      self.advance()?;
      if numeric_entity(digits, is_hex).is_none() {
        return Err(self.parse_error(unknown_entity(&self.text[start..self.pos])));
      }
      self.push(Kind::EncodedEntity, start);
    } else {
      let name_start = self.pos;
      self.attempt_until(|code| {
        code == c(b';') || code == EOF || !(is_ascii_letter(code) || is_digit(code))
      })?;
      if self.peek() != c(b';') {
        self.pos = name_start;
        self.push(text_kind, start);
      } else {
        let name = &self.text[name_start..self.pos];
        self.advance()?;
        if named_entity(name).is_none() {
          return Err(self.parse_error(unknown_entity(name)));
        }
        self.push(Kind::EncodedEntity, start);
      }
    }
    Ok(())
  }

  /// Text up to `end` (whose characters it then leaves unread), with entities if `entities`.
  fn consume_raw_text(
    &mut self,
    entities: bool,
    first: u8,
    end: impl Fn(&mut Self) -> bool,
  ) -> Lexed {
    let kind = if entities {
      Kind::EscapableRawText
    } else {
      Kind::RawText
    };
    let mut start = self.pos;
    loop {
      let before = self.pos;
      let found = end(self);
      self.pos = before;
      if found {
        break;
      }
      if entities && self.peek() == c(b'&') {
        self.push(kind, start);
        self.consume_entity(Kind::EscapableRawText)?;
        start = self.pos;
      } else {
        self.advance()?;
        // Up to where the end may be.
        let rest = &self.bytes[self.pos..];
        let next = if entities {
          memchr::memchr2(first, b'&', rest)
        } else {
          memchr::memchr(first, rest)
        };
        match next {
          Some(offset) => self.pos += offset,
          None => {
            self.pos = self.bytes.len();
            return Err(Error::Cursor);
          }
        }
      }
    }
    self.push(kind, start);
    Ok(())
  }

  fn consume_comment(&mut self, start: usize) -> Lexed {
    self.require(b'-')?;
    self.push(Kind::CommentStart, start);
    self.consume_raw_text(false, b'-', |lexer| lexer.attempt_str("-->"))?;
    let end = self.pos;
    self.require_str("-->")?;
    self.push(Kind::CommentEnd, end);
    Ok(())
  }

  fn consume_cdata(&mut self, start: usize) -> Lexed {
    self.require_str("CDATA[")?;
    self.push(Kind::CdataStart, start);
    self.consume_raw_text(false, b']', |lexer| lexer.attempt_str("]]>"))?;
    let end = self.pos;
    self.require_str("]]>")?;
    self.push(Kind::CdataEnd, end);
    Ok(())
  }

  fn consume_doctype(&mut self, start: usize) -> Lexed {
    while self.peek() != c(b'>') {
      self.advance()?;
    }
    self.advance()?;
    self.push(Kind::DocType, start);
    Ok(())
  }

  fn consume_processing_instruction(&mut self, start: usize) -> Lexed {
    self.attempt_until_ignoring_quotes(|code| code == c(b'?') || code == c(b'>'))?;
    let end = self.peek();
    self.advance()?;
    if end == c(b'?') {
      self.require(b'>')?;
    }
    self.push(Kind::ProcessingInstruction, start);
    Ok(())
  }

  /// A prefix and a name, `prefix:name`, as ranges: the prefix is empty when there is none.
  fn consume_prefix_and_name(
    &mut self,
    name_end: &mut dyn FnMut(u32) -> bool,
  ) -> Lexed<((u32, u32), (u32, u32))> {
    let start = self.pos;
    while self.peek() != c(b':') && !is_prefix_end(self.peek()) {
      self.advance()?;
    }
    let (prefix, name_start) = if self.peek() == c(b':') {
      let prefix = (start as u32, self.pos as u32);
      self.advance()?;
      (prefix, self.pos)
    } else {
      ((start as u32, start as u32), start)
    };
    let required = if prefix.0 == prefix.1 { 0 } else { 1 };
    while !name_end(self.peek()) {
      self.advance()?;
    }
    if self.pos - name_start < required {
      return Err(self.parse_error(unexpected(self.peek())));
    }
    Ok((prefix, (name_start as u32, self.pos as u32)))
  }

  fn consume_tag_open(&mut self, start: usize) -> Lexed {
    if !is_ascii_letter(self.peek()) {
      // Not a tag: `<` is text.
      let mut token = Token::new(Kind::Text, start, start + 1);
      token.part0 = (start as u32, start as u32 + 1);
      self.push_token(token);
      return Ok(());
    }

    let (prefix, name) = match self.consume_prefix_and_name(&mut is_name_end) {
      Ok(parts) => parts,
      Err(Error::Parse(_)) => {
        let mut token = Token::new(Kind::Text, start, start + 1);
        token.part0 = (start as u32, start as u32 + 1);
        self.push_token(token);
        return Ok(());
      }
      Err(error) => return Err(error),
    };
    let mut token = Token::new(Kind::TagOpenStart, start, self.pos);
    token.part0 = prefix;
    token.part1 = name;
    let open = self.push_token(token);

    match self.consume_tag_open_rest() {
      Ok(()) => {}
      Err(Error::Parse(_)) => {
        self.tokens[open].kind = Kind::IncompleteTagOpen;
        return Ok(());
      }
      Err(Error::Cursor) => return Err(Error::Cursor),
    }

    let name_text = &self.text[name.0 as usize..name.1 as usize];
    let prefix_text = &self.text[prefix.0 as usize..prefix.1 as usize];
    match tag_definition(name_text).content(prefix_text) {
      Content::RawText => self.consume_raw_text_with_tag_close(prefix, name, false),
      Content::EscapableRawText => self.consume_raw_text_with_tag_close(prefix, name, true),
      _ => Ok(()),
    }
  }

  fn consume_tag_open_rest(&mut self) -> Lexed {
    self.attempt_until(is_not_whitespace)?;
    loop {
      let comment_start = self.pos;
      if self.attempt_str("//") {
        self.attempt_until(|code| is_new_line(code) || code == EOF)?;
        self.push(Kind::TagComment, comment_start);
        self.attempt_until(is_not_whitespace)?;
        continue;
      }
      if self.attempt_str("/*") {
        loop {
          let code = self.peek();
          if code == EOF || (code == c(b'*') && self.code_at(self.pos + 1) == c(b'/')) {
            break;
          }
          self.advance()?;
        }
        if self.attempt_str("*/") {
          self.push(Kind::TagComment, comment_start);
          self.attempt_until(is_not_whitespace)?;
        } else {
          self.push(Kind::TagComment, comment_start);
        }
        continue;
      }
      if is_attribute_terminator(self.peek()) {
        break;
      }
      self.consume_attribute()?;
    }

    let kind = if self.attempt(b'/') {
      Kind::TagOpenEndVoid
    } else {
      Kind::TagOpenEnd
    };
    let start = self.pos;
    self.require(b'>')?;
    self.push(kind, start);
    Ok(())
  }

  fn consume_raw_text_with_tag_close(
    &mut self,
    prefix: (u32, u32),
    name: (u32, u32),
    entities: bool,
  ) -> Lexed {
    let text = self.text;
    let tag_name = &text[name.0 as usize..name.1 as usize];
    self.consume_raw_text(entities, b'<', |lexer| {
      if !lexer.attempt(b'<') || !lexer.attempt(b'/') {
        return false;
      }
      lexer.skip_whitespace();
      let matches = lexer
        .bytes
        .get(lexer.pos..lexer.pos + tag_name.len())
        .is_some_and(|candidate| candidate.eq_ignore_ascii_case(tag_name.as_bytes()));
      if !matches {
        return false;
      }
      lexer.pos += tag_name.len();
      lexer.skip_whitespace();
      lexer.attempt(b'>')
    })?;

    let start = self.pos;
    while self.peek() != c(b'>') {
      self.advance()?;
    }
    if self.pos - start < 3 {
      return Err(self.parse_error(unexpected(self.peek())));
    }
    self.advance()?;
    let mut token = Token::new(Kind::TagClose, start, self.pos);
    token.part0 = prefix;
    token.part1 = name;
    self.push_token(token);
    Ok(())
  }

  fn consume_attribute(&mut self) -> Lexed {
    self.consume_attribute_name()?;
    self.attempt_until(is_not_whitespace)?;
    if self.attempt(b'=') {
      self.attempt_until(is_not_whitespace)?;
      self.consume_attribute_value()?;
    }
    self.attempt_until(is_not_whitespace)?;
    Ok(())
  }

  fn consume_attribute_name(&mut self) -> Lexed {
    let first = self.peek();
    if first == c(b'\'') || first == c(b'"') {
      return Err(self.parse_error(unexpected(first)));
    }
    let start = self.pos;
    let (prefix, name) = if first == c(b'[') {
      let mut open_brackets = 0i32;
      self.consume_prefix_and_name(&mut |code| {
        if code == c(b'[') {
          open_brackets += 1;
        } else if code == c(b']') {
          open_brackets -= 1;
        }
        if open_brackets <= 0 {
          is_name_end(code)
        } else {
          is_new_line(code)
        }
      })?
    } else {
      self.consume_prefix_and_name(&mut is_name_end)?
    };
    let mut token = Token::new(Kind::AttrName, start, self.pos);
    token.part0 = prefix;
    token.part1 = name;
    self.push_token(token);
    Ok(())
  }

  fn consume_attribute_value(&mut self) -> Lexed {
    let quote = self.peek();
    if quote == c(b'\'') || quote == c(b'"') {
      let start = self.pos;
      self.advance()?;
      self.push(Kind::AttrQuote, start);
      self.consume_with_interpolation(
        Kind::AttrValueText,
        Kind::AttrValueInterpolation,
        Stop::Quote(quote),
      )?;
      let start = self.pos;
      self.require(quote as u8)?;
      self.push(Kind::AttrQuote, start);
    } else {
      self.consume_with_interpolation(
        Kind::AttrValueText,
        Kind::AttrValueInterpolation,
        Stop::NameEnd,
      )?;
    }
    Ok(())
  }

  fn consume_tag_close(&mut self, start: usize) -> Lexed {
    self.attempt_until(is_not_whitespace)?;
    let (prefix, name) = self.consume_prefix_and_name(&mut is_name_end)?;
    self.attempt_until(is_not_whitespace)?;
    self.require(b'>')?;
    let mut token = Token::new(Kind::TagClose, start, self.pos);
    token.part0 = prefix;
    token.part1 = name;
    self.push_token(token);
    Ok(())
  }

  fn stops(&self, stop: Stop) -> bool {
    match stop {
      Stop::TextEnd => self.is_text_end(),
      Stop::Quote(quote) => self.peek() == quote,
      Stop::NameEnd => is_name_end(self.peek()),
    }
  }

  fn consume_with_interpolation(&mut self, text: Kind, interpolation: Kind, stop: Stop) -> Lexed {
    let mut start = self.pos;
    while !self.stops(stop) {
      let current = self.pos;
      if self.attempt_str("{{") {
        self.push_text(text, start, current);
        self.consume_interpolation(interpolation, current, stop)?;
        start = self.pos;
      } else if self.peek() == c(b'&') {
        self.push_text(text, start, self.pos);
        self.consume_entity(text)?;
        start = self.pos;
      } else {
        self.advance()?;
        self.skip_plain(stop);
      }
    }
    self.push_text(text, start, self.pos);
    Ok(())
  }

  /// Moves over characters that can neither end the text nor start anything in it.
  fn skip_plain(&mut self, stop: Stop) {
    let bytes = self.bytes;
    let mut pos = self.pos;
    match stop {
      Stop::TextEnd => {
        while pos < bytes.len() && !matches!(bytes[pos], b'<' | b'{' | b'}' | b'@' | b'&' | 0) {
          pos += 1;
        }
      }
      Stop::Quote(quote) => {
        while pos < bytes.len()
          && !matches!(bytes[pos], b'{' | b'&')
          && u32::from(bytes[pos]) != quote
        {
          pos += 1;
        }
      }
      Stop::NameEnd => {}
    }
    self.pos = pos;
  }

  fn push_text(&mut self, kind: Kind, start: usize, end: usize) {
    self.push_token(Token::new(kind, start, end));
  }

  fn consume_interpolation(&mut self, kind: Kind, start: usize, stop: Stop) -> Lexed {
    let expression_start = self.pos;
    let mut in_quote: Option<u32> = None;
    let mut in_comment = false;
    let premature = |lexer: &Self| match stop {
      Stop::TextEnd => lexer.is_tag_start(),
      _ => lexer.stops(stop),
    };
    while self.peek() != EOF && !premature(self) {
      let current = self.pos;
      if self.is_tag_start() {
        self.push_interpolation(kind, start, expression_start, current, None);
        return Ok(());
      }
      if in_quote.is_none() {
        if self.attempt_str("}}") {
          self.push_interpolation(kind, start, expression_start, current, Some(current));
          return Ok(());
        } else if self.attempt_str("//") {
          in_comment = true;
        }
      }
      let code = self.peek();
      self.advance()?;
      if code == c(b'\\') {
        self.advance()?;
      } else if Some(code) == in_quote {
        in_quote = None;
      } else if !in_comment && in_quote.is_none() && is_quote(code) {
        in_quote = Some(code);
      }
    }
    self.push_interpolation(kind, start, expression_start, self.pos, None);
    Ok(())
  }

  fn push_interpolation(
    &mut self,
    kind: Kind,
    start: usize,
    expression_start: usize,
    expression_end: usize,
    end_marker: Option<usize>,
  ) {
    let mut token = Token::new(kind, start, self.pos);
    token.part0 = (expression_start as u32, expression_end as u32);
    token.part1 = match end_marker {
      Some(at) => (at as u32, at as u32 + 2),
      None => (expression_end as u32, expression_end as u32),
    };
    self.push_token(token);
  }
}

#[derive(Clone, Copy)]
enum Stop {
  TextEnd,
  Quote(u32),
  NameEnd,
}

fn unknown_entity(name: &str) -> String {
  format!("Unknown entity \"{name}\" - use the \"&#<decimal>;\" or  \"&#x<hex>;\" syntax")
}

/// `text[start..end].trim()`, as a range.
fn trim(text: &str, start: usize, end: usize) -> (u32, u32) {
  let slice = &text[start..end];
  let trimmed_start = start + (slice.len() - slice.trim_start().len());
  let trimmed_end = start + slice.trim_end().len();
  (trimmed_start as u32, trimmed_end.max(trimmed_start) as u32)
}

/// A block's name as Angular reads it: `else if` and `default never` whatever spaces are between.
pub fn block_name(name: &str) -> &str {
  if let Some(rest) = name.strip_prefix("else") {
    if starts_with_inline_space_then(rest, "if") {
      return "else if";
    }
  }
  if let Some(rest) = name.strip_prefix("default") {
    if starts_with_inline_space_then(rest, "never") {
      return "default never";
    }
  }
  name
}

/// `/^[^\S\r\n]+word/`.
fn starts_with_inline_space_then(text: &str, word: &str) -> bool {
  let rest = text.trim_start_matches(|character: char| {
    character.is_whitespace() && character != '\r' && character != '\n'
  });
  rest.len() < text.len() && rest.starts_with(word)
}

#[cfg(test)]
mod tests {
  use super::*;

  fn kinds(text: &str) -> Vec<Kind> {
    tokenize(text)
      .unwrap_or_default()
      .iter()
      .map(|token| token.kind)
      .collect()
  }

  #[test]
  fn tags_text_and_interpolations() {
    assert_eq!(
      kinds("<p title=\"a {{ b }}\">x {{ y }}</p>"),
      vec![
        Kind::TagOpenStart,
        Kind::AttrName,
        Kind::AttrQuote,
        Kind::AttrValueText,
        Kind::AttrValueInterpolation,
        Kind::AttrValueText,
        Kind::AttrQuote,
        Kind::TagOpenEnd,
        Kind::Text,
        Kind::Interpolation,
        Kind::Text,
        Kind::TagClose,
        Kind::Eof
      ]
    );
  }

  #[test]
  fn blocks_lets_and_expansions() {
    assert_eq!(
      kinds("@if (a; as b) {x} @let c = d;{n, plural, =0 {none}}"),
      vec![
        Kind::BlockOpenStart,
        Kind::BlockParameter,
        Kind::BlockParameter,
        Kind::BlockOpenEnd,
        Kind::Text,
        Kind::BlockClose,
        Kind::Text,
        Kind::LetStart,
        Kind::LetValue,
        Kind::LetEnd,
        Kind::ExpansionFormStart,
        Kind::RawText,
        Kind::RawText,
        Kind::ExpansionCaseValue,
        Kind::ExpansionCaseExpStart,
        Kind::Text,
        Kind::ExpansionCaseExpEnd,
        Kind::ExpansionFormEnd,
        Kind::Eof
      ]
    );
    assert_eq!(block_name("else  if"), "else if");
    assert_eq!(block_name("default never"), "default never");
  }

  #[test]
  fn errors() {
    assert!(tokenize("<div title=\"a").is_err());
    assert!(tokenize("<!-- open").is_err());
    assert!(tokenize("&nope;").is_err());
    assert!(tokenize("a { b").is_err());
    assert!(tokenize("<script>{ }</script>").is_ok());
    assert!(tokenize("me&#64;if.com &lt; &#x41;").is_ok());
    assert!(tokenize("a < b").is_ok());
  }
}
