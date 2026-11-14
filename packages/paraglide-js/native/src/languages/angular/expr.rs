//! Angular's expression syntax, as `_Scanner` and `_ParseAST` of `@angular/compiler` read it: enough
//! to tell whether an expression is valid and which parts of it are written. Angular keeps an
//! expression with any error out of the template entirely, so the parser stops at the first one.
//!
//! Offsets are UTF-8 offsets in the text the expression is part of.

/// The parse failed: Angular reports an error for the expression.
pub type Invalid = ();
type Parsed<T> = Result<T, Invalid>;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum Kind {
  Char(u8),
  Identifier,
  PrivateIdentifier,
  Keyword,
  Operator(Op),
  Number,
  String(Quote),
  Error,
  RegexBody,
  RegexFlags,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum Quote {
  Plain,
  TemplatePart,
  TemplateEnd,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum Op {
  Spread,
  Plus,
  PlusEq,
  Minus,
  MinusEq,
  Slash,
  SlashEq,
  Percent,
  PercentEq,
  Caret,
  Star,
  StarStar,
  StarStarEq,
  StarEq,
  Question,
  Nullish,
  NullishEq,
  Optional,
  Lt,
  LtEq,
  Gt,
  GtEq,
  Bang,
  NotEq,
  NotEqStrict,
  Eq,
  EqEq,
  EqStrict,
  Arrow,
  Amp,
  AmpAmp,
  AmpAmpEq,
  AmpEq,
  Bar,
  BarBar,
  BarBarEq,
  BarEq,
  Interpolation,
}

impl Op {
  fn is_assignment(self) -> bool {
    matches!(
      self,
      Op::Eq
        | Op::PlusEq
        | Op::MinusEq
        | Op::StarEq
        | Op::SlashEq
        | Op::PercentEq
        | Op::StarStarEq
        | Op::AmpAmpEq
        | Op::BarBarEq
        | Op::NullishEq
    )
  }
}

#[derive(Clone, Copy, Debug)]
struct Token {
  kind: Kind,
  start: u32,
  end: u32,
}

const KEYWORDS: [&str; 14] = [
  "var",
  "let",
  "as",
  "null",
  "undefined",
  "true",
  "false",
  "if",
  "else",
  "this",
  "typeof",
  "void",
  "in",
  "instanceof",
];

/// `$EOF` in Angular is 0, as a NUL character is.
const EOF: u32 = 0;

struct Scanner<'t> {
  input: &'t [u8],
  text: &'t str,
  index: usize,
  peek: u32,
  tokens: &'t mut Vec<Token>,
  /// `true` for a template literal's `${`, `false` for an object's `{`.
  braces: Vec<bool>,
}

impl<'t> Scanner<'t> {
  fn char_at(&self, index: usize) -> u32 {
    match self.input.get(index) {
      None => EOF,
      Some(&byte) if byte < 0x80 => u32::from(byte),
      Some(_) => self.text[index..]
        .chars()
        .next()
        .map_or(EOF, |character| character as u32),
    }
  }

  fn advance(&mut self) {
    self.index += match self.input.get(self.index) {
      Some(&byte) => utf8_width(byte),
      None => 1,
    };
    self.peek = self.char_at(self.index);
  }

  fn push(&mut self, kind: Kind, start: usize) {
    self.tokens.push(Token {
      kind,
      start: start as u32,
      end: self.index as u32,
    });
  }

  fn error(&mut self, start: usize) {
    self.tokens.push(Token {
      kind: Kind::Error,
      start: start as u32,
      end: self.index as u32,
    });
  }

  fn scan(&mut self) {
    self.peek = self.char_at(0);
    while self.scan_token() {}
  }

  /// Scans one token (and any it pushes before it); false at the end.
  fn scan_token(&mut self) -> bool {
    while self.peek <= 32 {
      if self.index >= self.input.len() {
        break;
      }
      self.advance();
      if self.index >= self.input.len() {
        self.peek = EOF;
        break;
      }
    }
    if self.index >= self.input.len() {
      return false;
    }

    let start = self.index;
    let peek = self.peek;
    if is_identifier_start(peek) {
      self.advance();
      while is_identifier_part(self.peek) {
        self.advance();
      }
      let word = &self.text[start..self.index];
      let kind = if KEYWORDS.contains(&word) {
        Kind::Keyword
      } else {
        Kind::Identifier
      };
      self.push(kind, start);
      return true;
    }
    if is_digit(peek) {
      self.scan_number(start);
      return true;
    }

    match char::from_u32(peek).unwrap_or('\0') {
      '.' => {
        self.advance();
        if is_digit(self.peek) {
          self.scan_number(start);
        } else if self.peek != u32::from(b'.') {
          self.push(Kind::Char(b'.'), start);
        } else {
          self.advance();
          if self.peek == u32::from(b'.') {
            self.advance();
            self.push(Kind::Operator(Op::Spread), start);
          } else {
            self.error(start);
          }
        }
      }
      '(' | ')' | '[' | ']' | ',' | ':' | ';' => {
        self.advance();
        self.push(Kind::Char(peek as u8), start);
      }
      '{' => {
        self.braces.push(false);
        self.advance();
        self.push(Kind::Char(b'{'), start);
      }
      '}' => {
        self.advance();
        let is_interpolation = self.braces.pop() == Some(true);
        self.push(Kind::Char(b'}'), start);
        if is_interpolation {
          self.scan_template_part(self.index);
        }
      }
      '\'' | '"' => self.scan_string(start),
      '`' => {
        self.advance();
        self.scan_template_part(start);
      }
      '#' => {
        self.advance();
        if !is_identifier_start(self.peek) {
          self.error(start);
        } else {
          while is_identifier_part(self.peek) {
            self.advance();
          }
          self.push(Kind::PrivateIdentifier, start);
        }
      }
      '+' => self.scan_complex(start, Op::Plus, &[(b'=', Op::PlusEq)]),
      '-' => self.scan_complex(start, Op::Minus, &[(b'=', Op::MinusEq)]),
      '/' => {
        if self.is_start_of_regex() {
          self.scan_regex(start);
        } else {
          self.scan_complex(start, Op::Slash, &[(b'=', Op::SlashEq)]);
        }
      }
      '%' => self.scan_complex(start, Op::Percent, &[(b'=', Op::PercentEq)]),
      '^' => {
        self.advance();
        self.push(Kind::Operator(Op::Caret), start);
      }
      '*' => {
        self.advance();
        let op = if self.peek == u32::from(b'*') {
          self.advance();
          if self.peek == u32::from(b'=') {
            self.advance();
            Op::StarStarEq
          } else {
            Op::StarStar
          }
        } else if self.peek == u32::from(b'=') {
          self.advance();
          Op::StarEq
        } else {
          Op::Star
        };
        self.push(Kind::Operator(op), start);
      }
      '?' => {
        self.advance();
        let op = if self.peek == u32::from(b'?') {
          self.advance();
          if self.peek == u32::from(b'=') {
            self.advance();
            Op::NullishEq
          } else {
            Op::Nullish
          }
        } else if self.peek == u32::from(b'.') {
          self.advance();
          Op::Optional
        } else {
          Op::Question
        };
        self.push(Kind::Operator(op), start);
      }
      '<' => self.scan_complex(start, Op::Lt, &[(b'=', Op::LtEq)]),
      '>' => self.scan_complex(start, Op::Gt, &[(b'=', Op::GtEq)]),
      '!' => {
        self.advance();
        let mut op = Op::Bang;
        if self.peek == u32::from(b'=') {
          self.advance();
          op = Op::NotEq;
          if self.peek == u32::from(b'=') {
            self.advance();
            op = Op::NotEqStrict;
          }
        }
        self.push(Kind::Operator(op), start);
      }
      '=' => {
        self.advance();
        let mut op = Op::Eq;
        if self.peek == u32::from(b'=') {
          self.advance();
          op = Op::EqEq;
        } else if self.peek == u32::from(b'>') {
          self.advance();
          self.push(Kind::Operator(Op::Arrow), start);
          return true;
        }
        if self.peek == u32::from(b'=') {
          self.advance();
          op = if op == Op::EqEq {
            Op::EqStrict
          } else {
            Op::EqEq
          };
        }
        self.push(Kind::Operator(op), start);
      }
      '&' => self.scan_doubled(start, b'&', [Op::Amp, Op::AmpAmp, Op::AmpAmpEq, Op::AmpEq]),
      '|' => self.scan_doubled(start, b'|', [Op::Bar, Op::BarBar, Op::BarBarEq, Op::BarEq]),
      '\u{a0}' => {
        while is_whitespace(self.peek) {
          self.advance();
        }
        return self.scan_token();
      }
      _ => {
        self.advance();
        self.error(start);
      }
    }
    true
  }

  /// `one`, or `one` followed by one of `more`.
  fn scan_complex(&mut self, start: usize, one: Op, more: &[(u8, Op)]) {
    self.advance();
    let mut op = one;
    for &(code, longer) in more {
      if self.peek == u32::from(code) {
        self.advance();
        op = longer;
      }
    }
    self.push(Kind::Operator(op), start);
  }

  /// `&`, `&&`, `&&=` and `&=`; likewise for `|`.
  fn scan_doubled(&mut self, start: usize, code: u8, [one, two, three, one_eq]: [Op; 4]) {
    self.advance();
    let mut op = one;
    if self.peek == u32::from(code) {
      self.advance();
      op = two;
    }
    if self.peek == u32::from(b'=') {
      self.advance();
      op = if op == two { three } else { one_eq };
    }
    self.push(Kind::Operator(op), start);
  }

  fn scan_number(&mut self, start: usize) {
    self.advance();
    loop {
      let peek = self.peek;
      if peek == u32::from(b'_') {
        let before = self
          .index
          .checked_sub(1)
          .map_or(EOF, |index| self.char_at(index));
        if !is_digit(before) || !is_digit(self.char_at(self.index + 1)) {
          self.error(self.index);
          return;
        }
      } else if peek == u32::from(b'e') || peek == u32::from(b'E') {
        self.advance();
        if self.peek == u32::from(b'-') || self.peek == u32::from(b'+') {
          self.advance();
        }
        if !is_digit(self.peek) {
          self.error(self.index.saturating_sub(1));
          return;
        }
      } else if !is_digit(peek) && peek != u32::from(b'.') {
        break;
      }
      self.advance();
    }
    self.push(Kind::Number, start);
  }

  fn scan_string(&mut self, start: usize) {
    let quote = self.peek;
    self.advance();
    while self.peek != quote {
      if self.peek == u32::from(b'\\') {
        if !self.scan_backslash() {
          return;
        }
      } else if self.peek == EOF {
        self.error(self.index);
        return;
      } else {
        self.advance();
      }
    }
    self.advance();
    self.push(Kind::String(Quote::Plain), start);
  }

  fn scan_template_part(&mut self, start: usize) {
    while self.peek != u32::from(b'`') {
      if self.peek == u32::from(b'\\') {
        if !self.scan_backslash() {
          return;
        }
      } else if self.peek == u32::from(b'$') {
        let dollar = self.index;
        self.advance();
        if self.peek == u32::from(b'{') {
          self.braces.push(true);
          self.tokens.push(Token {
            kind: Kind::String(Quote::TemplatePart),
            start: start as u32,
            end: dollar as u32,
          });
          self.advance();
          self.push(Kind::Operator(Op::Interpolation), dollar);
          return;
        }
      } else if self.peek == EOF {
        self.error(self.index);
        return;
      } else {
        self.advance();
      }
    }
    self.advance();
    self.push(Kind::String(Quote::TemplateEnd), start);
  }

  /// A string's escape; false (and an error) for an invalid `\u`.
  fn scan_backslash(&mut self) -> bool {
    self.advance();
    if self.peek == u32::from(b'u') {
      let hex = self
        .input
        .get(self.index + 1..(self.index + 5).min(self.input.len()))
        .unwrap_or_default();
      if hex.is_empty() || !hex.iter().all(u8::is_ascii_hexdigit) {
        self.error(self.index);
        return false;
      }
      for _ in 0..5 {
        self.advance();
      }
    } else {
      self.advance();
    }
    true
  }

  fn is_start_of_regex(&self) -> bool {
    let Some(previous) = self.tokens.last() else {
      return true;
    };
    if previous.kind == Kind::Operator(Op::Bang) {
      let before = self
        .tokens
        .len()
        .checked_sub(2)
        .map(|index| self.tokens[index]);
      return match before {
        None => true,
        Some(before) => {
          before.kind != Kind::Identifier
            && before.kind != Kind::Char(b')')
            && before.kind != Kind::Char(b']')
        }
      };
    }
    matches!(
      previous.kind,
      Kind::Operator(_) | Kind::Char(b'(') | Kind::Char(b'[') | Kind::Char(b',') | Kind::Char(b':')
    )
  }

  fn scan_regex(&mut self, start: usize) {
    self.advance();
    let mut in_escape = false;
    let mut in_class = false;
    loop {
      let peek = self.peek;
      if peek == EOF {
        self.error(self.index);
        return;
      }
      if in_escape {
        in_escape = false;
      } else if peek == u32::from(b'\\') {
        in_escape = true;
      } else if peek == u32::from(b'[') {
        in_class = true;
      } else if peek == u32::from(b']') {
        in_class = false;
      } else if peek == u32::from(b'/') && !in_class {
        break;
      }
      self.advance();
    }
    self.advance();
    self.push(Kind::RegexBody, start);
    if is_ascii_letter(self.peek) {
      let flags = self.index;
      while is_ascii_letter(self.peek) {
        self.advance();
      }
      self.push(Kind::RegexFlags, flags);
    }
  }
}

fn utf8_width(byte: u8) -> usize {
  match byte {
    0..=0x7f => 1,
    0xc0..=0xdf => 2,
    0xe0..=0xef => 3,
    0xf0..=0xff => 4,
    _ => 1,
  }
}

fn is_identifier_start(code: u32) -> bool {
  is_ascii_letter(code) || code == u32::from(b'_') || code == u32::from(b'$')
}

fn is_identifier_part(code: u32) -> bool {
  is_identifier_start(code) || is_digit(code)
}

fn is_ascii_letter(code: u32) -> bool {
  (u32::from(b'a')..=u32::from(b'z')).contains(&code)
    || (u32::from(b'A')..=u32::from(b'Z')).contains(&code)
}

fn is_digit(code: u32) -> bool {
  (u32::from(b'0')..=u32::from(b'9')).contains(&code)
}

/// `isWhitespace` in Angular: tab to space, and the no-break space.
pub fn is_whitespace(code: u32) -> bool {
  (9..=32).contains(&code) || code == 0xa0
}

pub fn is_quote(code: u8) -> bool {
  matches!(code, b'\'' | b'"' | b'`')
}

/// A node of an expression.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum NodeKind {
  Receiver,
  /// A read of a name of the template's or the component's: `name`.
  Read,
  Member,
  Pipe,
  TemplateElement,
  Other,
}

#[derive(Clone, Copy, Debug)]
pub struct Node {
  pub kind: NodeKind,
  pub start: u32,
  pub end: u32,
  /// The first node of its subtree: nodes are made after their children.
  pub first: u32,
  kids: (u32, u32),
  pub has_pipe: bool,
}

/// What parses expressions, reused from one to the next.
#[derive(Default)]
pub struct ExprParser {
  tokens: Vec<Token>,
  pub nodes: Vec<Node>,
  kids: Vec<u32>,
  scratch: Vec<u32>,
}

/// A variable a microsyntax declares: its name, as the text's range or an owned name.
pub enum Key {
  Range(u32, u32),
  Owned(String),
}

/// The parts of `*ngFor="let item of items; trackBy: track"`.
#[derive(Default)]
pub struct TemplateBindings {
  /// The expressions bound, e.g. `items` and `track`.
  pub values: Vec<u32>,
  /// The variables declared, e.g. `item`.
  pub variables: Vec<Key>,
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Mode {
  /// A property binding, `@if (…)` and the like: no chains, no assignments.
  Binding,
  /// An event handler: chains and assignments, no pipes.
  Action,
}

impl ExprParser {
  /// Clears the nodes of the previous expressions.
  pub fn reset(&mut self) {
    self.nodes.clear();
    self.kids.clear();
  }

  pub fn kids(&self, node: u32) -> &[u32] {
    let (start, end) = self.nodes[node as usize].kids;
    &self.kids[start as usize..end as usize]
  }

  /// Parses `text[start..end]` as a chain of expressions, in `mode`, and pushes their roots to
  /// `roots`. Angular strips a `//` comment first.
  pub fn parse(
    &mut self,
    text: &str,
    start: usize,
    end: usize,
    mode: Mode,
    roots: &mut Vec<u32>,
  ) -> Parsed<()> {
    let end = start + comment_start(&text.as_bytes()[start..end]).unwrap_or(end - start);
    self.tokenize(text, start, end)?;
    let mut parser = Parser {
      text,
      tokens: &self.tokens,
      nodes: &mut self.nodes,
      kids: &mut self.kids,
      scratch: &mut self.scratch,
      index: 0,
      input_end: end as u32,
      action: mode == Mode::Action,
    };
    parser.parse_chain(roots)
  }

  /// Parses an `*ngFor="…"`-like microsyntax of the directive `key`.
  pub fn parse_template_bindings(
    &mut self,
    text: &str,
    start: usize,
    end: usize,
    bindings: &mut TemplateBindings,
  ) -> Parsed<()> {
    self.tokenize(text, start, end)?;
    let mut parser = Parser {
      text,
      tokens: &self.tokens,
      nodes: &mut self.nodes,
      kids: &mut self.kids,
      scratch: &mut self.scratch,
      index: 0,
      input_end: end as u32,
      action: false,
    };
    parser.parse_template_bindings(bindings)
  }

  /// Tokenizes, with tokens at offsets in `text`. Angular reports each token that does not
  /// tokenize, wherever it is.
  fn tokenize(&mut self, text: &str, start: usize, end: usize) -> Parsed<()> {
    self.tokens.clear();
    let mut scanner = Scanner {
      input: &text.as_bytes()[start..end],
      text: &text[start..end],
      index: 0,
      peek: EOF,
      tokens: &mut self.tokens,
      braces: Vec::new(),
    };
    scanner.scan();
    for token in &mut self.tokens {
      if token.kind == Kind::Error {
        return Err(());
      }
      token.start += start as u32;
      token.end += start as u32;
    }
    Ok(())
  }
}

/// Where a `//` comment starts outside quotes, as `_commentStart`.
pub fn comment_start(input: &[u8]) -> Option<usize> {
  let mut outer_quote: Option<u8> = None;
  let mut index = 0;
  while index + 1 < input.len() {
    let character = input[index];
    let next = input[index + 1];
    if character == b'\\' {
      index += 2;
      continue;
    }
    if character == b'/' && next == b'/' && outer_quote.is_none() {
      return Some(index);
    }
    if outer_quote == Some(character) {
      outer_quote = None;
    } else if outer_quote.is_none() && is_quote(character) {
      outer_quote = Some(character);
    }
    index += 1;
  }
  None
}

struct Parser<'p> {
  text: &'p str,
  tokens: &'p [Token],
  nodes: &'p mut Vec<Node>,
  kids: &'p mut Vec<u32>,
  scratch: &'p mut Vec<u32>,
  index: usize,
  /// The end of the input, for an empty one.
  input_end: u32,
  /// Arrow functions' bodies are actions too.
  action: bool,
}

const NONE: Token = Token {
  kind: Kind::Char(0),
  start: u32::MAX,
  end: u32::MAX,
};

impl Parser<'_> {
  fn next(&self) -> Token {
    self.tokens.get(self.index).copied().unwrap_or(NONE)
  }

  fn at_end(&self) -> bool {
    self.index >= self.tokens.len()
  }

  fn current_end(&self) -> u32 {
    if self.index > 0 {
      self.tokens[self.index - 1].end
    } else if let Some(first) = self.tokens.first() {
      first.start
    } else {
      self.input_end
    }
  }

  fn input_index(&self) -> u32 {
    if self.at_end() {
      self.current_end()
    } else {
      self.tokens[self.index].start
    }
  }

  fn word(&self, token: Token) -> &str {
    &self.text[token.start as usize..token.end as usize]
  }

  fn is_char(&self, code: u8) -> bool {
    !self.at_end() && self.next().kind == Kind::Char(code)
  }

  fn is_op(&self, op: Op) -> bool {
    !self.at_end() && self.next().kind == Kind::Operator(op)
  }

  fn is_keyword(&self, word: &str) -> bool {
    let next = self.next();
    !self.at_end() && next.kind == Kind::Keyword && self.word(next) == word
  }

  fn consume_char(&mut self, code: u8) -> bool {
    let found = self.is_char(code);
    if found {
      self.index += 1;
    }
    found
  }

  fn consume_op(&mut self, op: Op) -> bool {
    let found = self.is_op(op);
    if found {
      self.index += 1;
    }
    found
  }

  fn expect_char(&mut self, code: u8) -> Parsed<()> {
    if self.consume_char(code) {
      Ok(())
    } else {
      Err(())
    }
  }

  fn is_assignment_next(&self) -> bool {
    !self.at_end() && matches!(self.next().kind, Kind::Operator(op) if op.is_assignment())
  }

  fn node(&mut self, kind: NodeKind, start: u32, kids: &[u32]) -> u32 {
    let kids_start = self.kids.len();
    self.kids.extend_from_slice(kids);
    self.finish_node(kind, start, kids_start)
  }

  /// A node of the children `scratch[mark..]`, which are then dropped.
  fn node_of_scratch(&mut self, kind: NodeKind, start: u32, mark: usize) -> u32 {
    let kids_start = self.kids.len();
    self.kids.extend_from_slice(&self.scratch[mark..]);
    self.scratch.truncate(mark);
    self.finish_node(kind, start, kids_start)
  }

  /// A node from `start` to the end of the last token consumed, as `span` in Angular.
  fn finish_node(&mut self, kind: NodeKind, start: u32, kids_start: usize) -> u32 {
    let mut end = self.current_end();
    let mut start = start;
    if start > end {
      std::mem::swap(&mut start, &mut end);
    }
    self.finish_node_spanning(kind, start, end, kids_start)
  }

  fn finish_node_spanning(
    &mut self,
    kind: NodeKind,
    start: u32,
    end: u32,
    kids_start: usize,
  ) -> u32 {
    let id = self.nodes.len() as u32;
    let kids = &self.kids[kids_start..];
    let first = kids
      .iter()
      .map(|&kid| self.nodes[kid as usize].first)
      .min()
      .unwrap_or(id);
    let has_pipe =
      kind == NodeKind::Pipe || kids.iter().any(|&kid| self.nodes[kid as usize].has_pipe);
    self.nodes.push(Node {
      kind,
      start,
      end,
      first,
      kids: (kids_start as u32, self.kids.len() as u32),
      has_pipe,
    });
    id
  }

  fn leaf(&mut self, kind: NodeKind, start: u32, end: u32) -> u32 {
    let kids_start = self.kids.len();
    self.finish_node_spanning(kind, start, end, kids_start)
  }

  fn parse_chain(&mut self, roots: &mut Vec<u32>) -> Parsed<()> {
    while !self.at_end() {
      let expression = self.parse_pipe()?;
      roots.push(expression);
      if self.consume_char(b';') {
        if !self.action {
          return Err(());
        }
        while self.consume_char(b';') {}
      } else if !self.at_end() {
        return Err(());
      }
    }
    Ok(())
  }

  fn parse_pipe(&mut self) -> Parsed<u32> {
    let start = self.input_index();
    let mut result = self.parse_expression()?;
    if self.consume_op(Op::Bar) {
      if self.action {
        return Err(());
      }
      loop {
        self.expect_identifier_or_keyword()?;
        let mark = self.scratch.len();
        self.scratch.push(result);
        while self.consume_char(b':') {
          let argument = self.parse_expression()?;
          self.scratch.push(argument);
        }
        result = self.node_of_scratch(NodeKind::Pipe, start, mark);
        if !self.consume_op(Op::Bar) {
          break;
        }
      }
    }
    Ok(result)
  }

  fn parse_expression(&mut self) -> Parsed<u32> {
    self.parse_conditional()
  }

  fn parse_conditional(&mut self) -> Parsed<u32> {
    let start = self.input_index();
    let condition = self.parse_binary(0)?;
    if self.consume_op(Op::Question) {
      let yes = self.parse_pipe()?;
      self.expect_char(b':')?;
      let no = self.parse_pipe()?;
      return Ok(self.node(NodeKind::Other, start, &[condition, yes, no]));
    }
    Ok(condition)
  }

  /// `||`, `&&`, `??`, equality, relational, additive and multiplicative operators, by level.
  fn parse_binary(&mut self, level: usize) -> Parsed<u32> {
    if level == 7 {
      return self.parse_exponentiation();
    }
    let start = self.input_index();
    let mut result = self.parse_binary(level + 1)?;
    while self.binary_operator_at(level) {
      self.index += 1;
      let right = self.parse_binary(level + 1)?;
      result = self.node(NodeKind::Other, start, &[result, right]);
    }
    Ok(result)
  }

  fn binary_operator_at(&self, level: usize) -> bool {
    if self.at_end() {
      return false;
    }
    let next = self.next();
    let Kind::Operator(op) = next.kind else {
      return level == 4
        && next.kind == Kind::Keyword
        && matches!(self.word(next), "in" | "instanceof");
    };
    match level {
      0 => op == Op::BarBar,
      1 => op == Op::AmpAmp,
      2 => op == Op::Nullish,
      3 => matches!(op, Op::EqEq | Op::EqStrict | Op::NotEq | Op::NotEqStrict),
      4 => matches!(op, Op::Lt | Op::Gt | Op::LtEq | Op::GtEq),
      5 => matches!(op, Op::Plus | Op::Minus),
      6 => matches!(op, Op::Star | Op::Percent | Op::Slash),
      _ => false,
    }
  }

  fn parse_exponentiation(&mut self) -> Parsed<u32> {
    let start = self.input_index();
    let (mut result, is_unary) = self.parse_prefix()?;
    if self.is_op(Op::StarStar) {
      if is_unary {
        return Err(());
      }
      self.index += 1;
      let right = self.parse_exponentiation()?;
      result = self.node(NodeKind::Other, start, &[result, right]);
    }
    Ok(result)
  }

  /// The expression, and whether it is a unary operation.
  fn parse_prefix(&mut self) -> Parsed<(u32, bool)> {
    let start = self.input_index();
    let is_prefix = matches!(
      self.next().kind,
      Kind::Operator(Op::Plus | Op::Minus | Op::Bang)
    ) && !self.at_end()
      || self.is_keyword("typeof")
      || self.is_keyword("void");
    if is_prefix {
      self.index += 1;
      let (operand, _) = self.parse_prefix()?;
      return Ok((self.node(NodeKind::Other, start, &[operand]), true));
    }
    Ok((self.parse_call_chain()?, false))
  }

  fn parse_call_chain(&mut self) -> Parsed<u32> {
    let start = self.input_index();
    let mut result = self.parse_primary()?;
    loop {
      if self.consume_char(b'.') {
        result = self.parse_access_member(result, start, false)?;
      } else if self.consume_op(Op::Optional) {
        result = if self.consume_char(b'(') {
          self.parse_call(result, start)?
        } else if self.consume_char(b'[') {
          self.parse_keyed(result, start, true)?
        } else {
          self.parse_access_member(result, start, true)?
        };
      } else if self.consume_char(b'[') {
        result = self.parse_keyed(result, start, false)?;
      } else if self.consume_char(b'(') {
        result = self.parse_call(result, start)?;
      } else if self.consume_op(Op::Bang) {
        result = self.node(NodeKind::Other, start, &[result]);
      } else if !self.at_end()
        && matches!(
          self.next().kind,
          Kind::String(Quote::TemplateEnd | Quote::TemplatePart)
        )
      {
        let template = self.parse_template_literal()?;
        result = self.node(NodeKind::Other, start, &[result, template]);
      } else {
        return Ok(result);
      }
    }
  }

  fn parse_primary(&mut self) -> Parsed<u32> {
    let start = self.input_index();
    if self.at_end() {
      return Err(());
    }
    if self.is_arrow_function() {
      return self.parse_arrow_function(start);
    }
    if self.consume_char(b'(') {
      let inner = self.parse_pipe()?;
      self.expect_char(b')')?;
      return Ok(self.node(NodeKind::Other, start, &[inner]));
    }
    let next = self.next();
    match next.kind {
      Kind::Keyword => match self.word(next) {
        "null" | "undefined" | "true" | "false" => {
          self.index += 1;
          Ok(self.node(NodeKind::Other, start, &[]))
        }
        "this" => {
          self.index += 1;
          Ok(self.node(NodeKind::Receiver, start, &[]))
        }
        _ => Err(()),
      },
      Kind::Char(b'[') => {
        self.index += 1;
        self.parse_literal_array(start)
      }
      Kind::Char(b'{') => self.parse_literal_map(start),
      Kind::Identifier => {
        let receiver = self.leaf(NodeKind::Receiver, start, start);
        self.parse_access_member_of(receiver, start, false, true)
      }
      Kind::Number => {
        self.index += 1;
        Ok(self.node(NodeKind::Other, start, &[]))
      }
      Kind::String(Quote::Plain) => {
        self.index += 1;
        Ok(self.node(NodeKind::Other, start, &[]))
      }
      Kind::String(_) => self.parse_template_literal(),
      Kind::RegexBody => self.parse_regex(),
      _ => Err(()),
    }
  }

  fn parse_literal_array(&mut self, start: u32) -> Parsed<u32> {
    let mark = self.scratch.len();
    loop {
      if self.is_op(Op::Spread) {
        let spread = self.parse_spread()?;
        self.scratch.push(spread);
      } else if !self.is_char(b']') {
        let element = self.parse_pipe()?;
        self.scratch.push(element);
      } else {
        break;
      }
      if !self.consume_char(b',') {
        break;
      }
    }
    self.expect_char(b']')?;
    Ok(self.node_of_scratch(NodeKind::Other, start, mark))
  }

  fn parse_literal_map(&mut self, start: u32) -> Parsed<u32> {
    self.expect_char(b'{')?;
    let mark = self.scratch.len();
    if !self.consume_char(b'}') {
      loop {
        let key_start = self.input_index();
        if self.consume_op(Op::Spread) {
          let value = self.parse_pipe()?;
          self.scratch.push(value);
        } else {
          let quoted = matches!(self.next().kind, Kind::String(_)) && !self.at_end();
          let next = self.next();
          if self.at_end()
            || !matches!(
              next.kind,
              Kind::Identifier | Kind::Keyword | Kind::String(_)
            )
          {
            return Err(());
          }
          self.index += 1;
          if quoted {
            self.expect_char(b':')?;
            let value = self.parse_pipe()?;
            self.scratch.push(value);
          } else if self.consume_char(b':') {
            let value = self.parse_pipe()?;
            self.scratch.push(value);
          } else {
            // `{ item }`: a read of `item`.
            let key_end = self.current_end();
            let receiver = self.leaf(NodeKind::Receiver, key_start, key_end);
            let kids_start = self.kids.len();
            self.kids.push(receiver);
            let read = self.finish_node_spanning(NodeKind::Read, key_start, key_end, kids_start);
            self.scratch.push(read);
          }
        }
        if !(self.consume_char(b',') && !self.is_char(b'}')) {
          break;
        }
      }
      self.expect_char(b'}')?;
    }
    Ok(self.node_of_scratch(NodeKind::Other, start, mark))
  }

  fn parse_access_member(&mut self, receiver: u32, start: u32, safe: bool) -> Parsed<u32> {
    self.parse_access_member_of(receiver, start, safe, false)
  }

  fn parse_access_member_of(
    &mut self,
    receiver: u32,
    start: u32,
    safe: bool,
    implicit: bool,
  ) -> Parsed<u32> {
    self.expect_identifier_or_keyword()?;
    let kind = if implicit {
      NodeKind::Read
    } else {
      NodeKind::Member
    };
    if self.is_assignment_next() {
      if safe || !self.action {
        return Err(());
      }
      let target = self.node(kind, start, &[receiver]);
      self.index += 1;
      let value = self.parse_conditional()?;
      return Ok(self.node(NodeKind::Other, start, &[target, value]));
    }
    Ok(self.node(kind, start, &[receiver]))
  }

  fn parse_call(&mut self, receiver: u32, start: u32) -> Parsed<u32> {
    let mark = self.scratch.len();
    self.scratch.push(receiver);
    if !self.is_char(b')') {
      loop {
        let argument = if self.is_op(Op::Spread) {
          self.parse_spread()?
        } else {
          self.parse_pipe()?
        };
        self.scratch.push(argument);
        if !self.consume_char(b',') {
          break;
        }
      }
    }
    self.expect_char(b')')?;
    Ok(self.node_of_scratch(NodeKind::Other, start, mark))
  }

  fn parse_spread(&mut self) -> Parsed<u32> {
    let start = self.input_index();
    self.index += 1;
    let expression = self.parse_pipe()?;
    Ok(self.node(NodeKind::Other, start, &[expression]))
  }

  fn parse_keyed(&mut self, receiver: u32, start: u32, safe: bool) -> Parsed<u32> {
    let key = self.parse_pipe()?;
    self.expect_char(b']')?;
    if self.is_assignment_next() {
      if safe {
        return Err(());
      }
      let target = self.node(NodeKind::Other, start, &[receiver, key]);
      self.index += 1;
      let value = self.parse_conditional()?;
      return Ok(self.node(NodeKind::Other, start, &[target, value]));
    }
    Ok(self.node(NodeKind::Other, start, &[receiver, key]))
  }

  fn parse_template_literal(&mut self) -> Parsed<u32> {
    let start = self.input_index();
    let mark = self.scratch.len();
    while !self.at_end() {
      let token = self.next();
      match token.kind {
        Kind::String(Quote::TemplatePart | Quote::TemplateEnd) => {
          let part_start = self.input_index();
          self.index += 1;
          let element = self.node(NodeKind::TemplateElement, part_start, &[]);
          self.scratch.push(element);
          if token.kind == Kind::String(Quote::TemplateEnd) {
            break;
          }
        }
        Kind::Operator(Op::Interpolation) => {
          self.index += 1;
          let expression = self.parse_pipe()?;
          self.scratch.push(expression);
          self.expect_char(b'}')?;
        }
        Kind::Error => return Err(()),
        _ => self.index += 1,
      }
    }
    Ok(self.node_of_scratch(NodeKind::Other, start, mark))
  }

  fn parse_regex(&mut self) -> Parsed<u32> {
    let body = self.next();
    self.index += 1;
    let mut end = body.end;
    if !self.at_end() && self.next().kind == Kind::RegexFlags {
      let flags = self.next();
      self.index += 1;
      let mut seen = [false; 128];
      for &flag in self.word(flags).as_bytes() {
        if !b"dgimsuvy".contains(&flag) || seen[usize::from(flag & 0x7f)] {
          return Err(());
        }
        seen[usize::from(flag & 0x7f)] = true;
      }
      end = flags.end;
    }
    Ok(self.leaf(NodeKind::Other, body.start, end))
  }

  fn is_arrow_function(&self) -> bool {
    let start = self.index;
    if start + 2 > self.tokens.len() {
      return false;
    }
    let first = self.tokens[start];
    if first.kind == Kind::Identifier && self.tokens[start + 1].kind == Kind::Operator(Op::Arrow) {
      return true;
    }
    if first.kind == Kind::Char(b'(') {
      let mut index = start + 1;
      while index < self.tokens.len()
        && matches!(self.tokens[index].kind, Kind::Identifier | Kind::Char(b','))
      {
        index += 1;
      }
      return index + 1 < self.tokens.len()
        && self.tokens[index].kind == Kind::Char(b')')
        && self.tokens[index + 1].kind == Kind::Operator(Op::Arrow);
    }
    false
  }

  fn parse_arrow_function(&mut self, start: u32) -> Parsed<u32> {
    if self.next().kind == Kind::Identifier {
      self.index += 1;
    } else {
      self.index += 1; // `(`
      if !self.consume_char(b')') {
        while !self.at_end() {
          if self.next().kind != Kind::Identifier {
            return Err(());
          }
          self.index += 1;
          if self.consume_char(b')') {
            break;
          }
          self.expect_char(b',')?;
        }
      }
    }
    if !self.consume_op(Op::Arrow) || self.is_char(b'{') {
      return Err(());
    }
    let action = std::mem::replace(&mut self.action, true);
    let body = self.parse_expression();
    self.action = action;
    let body = body?;
    Ok(self.node(NodeKind::Other, start, &[body]))
  }

  fn expect_identifier_or_keyword(&mut self) -> Parsed<()> {
    if self.at_end() || !matches!(self.next().kind, Kind::Identifier | Kind::Keyword) {
      return Err(());
    }
    self.index += 1;
    Ok(())
  }

  /// `key` or `key-part`, as `expectTemplateBindingKey`.
  fn expect_template_binding_key(&mut self) -> Parsed<Key> {
    let mut parts: Vec<Token> = Vec::new();
    loop {
      let next = self.next();
      if self.at_end()
        || !matches!(
          next.kind,
          Kind::Identifier | Kind::Keyword | Kind::String(_)
        )
      {
        return Err(());
      }
      self.index += 1;
      parts.push(next);
      if !self.consume_op(Op::Minus) {
        break;
      }
    }
    if let [only] = parts[..] {
      if matches!(only.kind, Kind::Identifier | Kind::Keyword) {
        return Ok(Key::Range(only.start, only.end));
      }
    }
    let key = parts
      .iter()
      .map(|part| string_value(self.word(*part), part.kind))
      .collect::<Vec<_>>()
      .join("-");
    Ok(Key::Owned(key))
  }

  fn consume_statement_terminator(&mut self) {
    let _ = self.consume_char(b';') || self.consume_char(b',');
  }

  fn parse_template_bindings(&mut self, bindings: &mut TemplateBindings) -> Parsed<()> {
    self.parse_directive_keyword_bindings(bindings)?;
    while !self.at_end() {
      if self.is_keyword("let") {
        self.index += 1;
        let key = self.expect_template_binding_key()?;
        if self.consume_op(Op::Eq) {
          self.expect_template_binding_key()?;
        }
        self.consume_statement_terminator();
        bindings.variables.push(key);
      } else {
        self.expect_template_binding_key()?;
        if !self.parse_as_binding(bindings)? {
          self.parse_directive_keyword_bindings(bindings)?;
        }
      }
      self.consume_statement_terminator();
    }
    Ok(())
  }

  fn parse_directive_keyword_bindings(&mut self, bindings: &mut TemplateBindings) -> Parsed<()> {
    self.consume_char(b':');
    let has_value = !self.at_end() && !self.is_keyword("as") && !self.is_keyword("let");
    if has_value {
      let value = self.parse_pipe()?;
      bindings.values.push(value);
    }
    if !self.parse_as_binding(bindings)? {
      self.consume_statement_terminator();
    }
    Ok(())
  }

  fn parse_as_binding(&mut self, bindings: &mut TemplateBindings) -> Parsed<bool> {
    if !self.is_keyword("as") {
      return Ok(false);
    }
    self.index += 1;
    let key = self.expect_template_binding_key()?;
    self.consume_statement_terminator();
    bindings.variables.push(key);
    Ok(true)
  }
}

/// A string token's value, roughly: its text inside the quotes.
fn string_value(word: &str, kind: Kind) -> String {
  match kind {
    Kind::String(_) if word.len() >= 2 => word[1..word.len() - 1].to_string(),
    _ => word.to_string(),
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  fn parse(text: &str, mode: Mode) -> Option<Vec<(String, bool)>> {
    let mut parser = ExprParser::default();
    let mut roots = Vec::new();
    parser.parse(text, 0, text.len(), mode, &mut roots).ok()?;
    Some(
      roots
        .iter()
        .map(|&root| {
          let node = parser.nodes[root as usize];
          (
            text[node.start as usize..node.end as usize].to_string(),
            node.has_pipe,
          )
        })
        .collect(),
    )
  }

  #[test]
  fn valid_expressions() {
    for text in [
      "m.a()",
      "a?.b?.[c]?.(d)",
      "a!.b",
      "x ?? y",
      "cond ? a : b",
      "{ a: 1, 'b': 2, c, ...d }",
      "[1, ...rest]",
      "typeof a === 'string'",
      "a in b",
      "2 ** 3",
      "`a ${b} c`",
      "tag`a`",
      "(x, y) => x + y",
      "/ab+c/gi.test(s)",
      "1_000",
      "value | currency:'EUR':m.symbol()",
      "  spaced  ",
    ] {
      assert!(parse(text, Mode::Binding).is_some(), "{text}");
    }
  }

  #[test]
  fn invalid_expressions() {
    for (text, mode) in [
      ("m.broken(", Mode::Binding),
      ("a = 1", Mode::Binding),
      ("a; b", Mode::Binding),
      ("a | p", Mode::Action),
      ("-a ** 2", Mode::Binding),
      ("#private", Mode::Binding),
      ("'unterminated", Mode::Binding),
      ("a ? b", Mode::Binding),
      ("let", Mode::Binding),
      ("1e", Mode::Binding),
      ("/a/x", Mode::Binding),
      ("() => { a }", Mode::Binding),
      ("a?.b = 1", Mode::Action),
    ] {
      assert!(parse(text, mode).is_none(), "{text}");
    }
  }

  #[test]
  fn chains_assignments_and_comments() {
    assert_eq!(
      parse("count = count + 1; msgs.b()", Mode::Action),
      Some(vec![
        ("count = count + 1".to_string(), false),
        ("msgs.b()".to_string(), false)
      ])
    );
    assert_eq!(
      parse("a | p // a comment", Mode::Binding),
      Some(vec![("a | p".to_string(), true)])
    );
    assert_eq!(parse("", Mode::Binding), Some(vec![]));
  }
}
