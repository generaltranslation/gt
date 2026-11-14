//! Glimmer's curlies, `{{…}}`, as Handlebars' lexer and grammar read them: mustaches, blocks,
//! comments, and the expressions in them. Positions are UTF-8 offsets in the file.

use memchr::memmem;

/// A range of the file.
pub type Span = (usize, usize);

#[derive(Debug, PartialEq, Eq)]
pub struct SyntaxError {
  pub at: usize,
  pub message: String,
}

impl SyntaxError {
  pub fn new(at: usize, message: impl Into<String>) -> Self {
    SyntaxError {
      at,
      message: message.into(),
    }
  }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Head {
  /// `this`, `this.label`
  This,
  /// `@label`
  Arg,
  /// `label`, `m.title`: a block param, or a name of the module.
  Var,
}

/// A path: `span` is all of its text, with `@` for an argument.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Path {
  pub span: Span,
  pub head: Head,
  /// Its parts are separated by `/`, which Glimmer reads as one name.
  pub slashed: bool,
}

#[derive(Debug, PartialEq, Eq)]
pub enum Expr {
  Path(Path),
  /// With its quotes.
  String(Span),
  Number(Span),
  /// `true`, `false`, `null`, `undefined`.
  Keyword(Span),
  Sub(Box<Call>),
}

impl Expr {
  pub fn span(&self) -> Span {
    match self {
      Expr::Path(path) => path.span,
      Expr::String(span) | Expr::Number(span) | Expr::Keyword(span) => *span,
      Expr::Sub(call) => call.span,
    }
  }
}

/// `key=value`
#[derive(Debug, PartialEq, Eq)]
pub struct Pair {
  pub key: Span,
  pub value: Expr,
}

/// An invocation: `{{callee …}}`, `(callee …)`, `{{#callee …}}`.
#[derive(Debug, PartialEq, Eq)]
pub struct Call {
  /// The whole mustache or sub-expression.
  pub span: Span,
  pub callee: Expr,
  pub params: Vec<Expr>,
  pub hash: Vec<Pair>,
}

impl Call {
  pub fn has_arguments(&self) -> bool {
    !self.params.is_empty() || !self.hash.is_empty()
  }
}

#[derive(Debug, PartialEq, Eq)]
pub enum Curly {
  /// `{{…}}`, `{{{…}}}`
  Mustache(Call),
  /// `{{! … }}`, `{{!-- … --}}`: `value` is the text between the markers.
  Comment { value: Span },
  /// `{{#callee … as |params|}}`
  Open { call: Call, params: Vec<Span> },
  /// `{{else}}`, `{{^}}`
  Else,
  /// `{{else callee … as |params|}}`
  ElseChain { call: Call, params: Vec<Span> },
  /// `{{/callee}}`: the callee's text.
  Close { name: Span },
  /// `{{{{raw}}}} … {{{{/raw}}}}`, whose content is text.
  Raw,
}

/// Reads the curly at `start` (at `{{`), which ends by `end`; returns it and where it ends.
pub fn parse_curly(bytes: &[u8], start: usize, end: usize) -> Result<(Curly, usize), SyntaxError> {
  let at = |pos: usize| if pos < end { bytes[pos] } else { 0 };
  let mut pos = start + 2;

  if at(pos) == b'{' && at(pos + 1) == b'{' {
    return raw_block(bytes, start, end);
  }
  if at(pos) == b'~' {
    pos += 1;
  }

  let mut parser = Parser {
    lexer: Lexer { bytes, pos, end },
  };

  match at(pos) {
    b'!' => comment(bytes, start, pos, end),
    b'>' => Err(SyntaxError::new(
      start,
      "Handlebars partials are not supported",
    )),
    b'*' => Err(SyntaxError::new(
      start,
      "Handlebars decorators are not supported",
    )),
    b'#' => match at(pos + 1) {
      b'>' => Err(SyntaxError::new(
        start,
        "Handlebars partial blocks are not supported",
      )),
      b'*' => Err(SyntaxError::new(
        start,
        "Handlebars decorator blocks are not supported",
      )),
      _ => {
        parser.lexer.pos = pos + 1;
        let (call, params) = parser.invocation(start, Close::Normal, true)?;
        Ok((Curly::Open { call, params }, parser.lexer.pos))
      }
    },
    b'/' => {
      parser.lexer.pos = pos + 1;
      let callee = parser.expression()?;
      let name = callee.span();
      parser.close(Close::Normal)?;
      Ok((Curly::Close { name }, parser.lexer.pos))
    }
    b'^' => match inverse_end(bytes, pos + 1, end) {
      Some(after) => Ok((Curly::Else, after)),
      None => Err(SyntaxError::new(
        start,
        "Inverse sections (`{{^foo}}...{{/foo}}`) are not supported. Use `{{#unless foo}}...{{/unless}}` instead",
      )),
    },
    b'{' => {
      parser.lexer.pos = pos + 1;
      let (call, _) = parser.invocation(start, Close::Unescaped, false)?;
      Ok((Curly::Mustache(call), parser.lexer.pos))
    }
    b'&' => {
      parser.lexer.pos = pos + 1;
      let (call, _) = parser.invocation(start, Close::Normal, false)?;
      Ok((Curly::Mustache(call), parser.lexer.pos))
    }
    _ => {
      let mut word = pos;
      while is_space(at(word)) {
        word += 1;
      }
      if bytes[word.min(end)..end].starts_with(b"else") {
        if let Some(after) = inverse_end(bytes, word + 4, end) {
          return Ok((Curly::Else, after));
        }
        parser.lexer.pos = word + 4;
        let (call, params) = parser.invocation(start, Close::Normal, true)?;
        return Ok((Curly::ElseChain { call, params }, parser.lexer.pos));
      }

      let (call, _) = parser.invocation(start, Close::Normal, false)?;
      Ok((Curly::Mustache(call), parser.lexer.pos))
    }
  }
}

/// The end of `\s*~?}}` at `pos`, which closes `{{else}}` and `{{^}}`.
fn inverse_end(bytes: &[u8], mut pos: usize, end: usize) -> Option<usize> {
  while pos < end && is_space(bytes[pos]) {
    pos += 1;
  }
  if pos < end && bytes[pos] == b'~' {
    pos += 1;
  }
  bytes[pos.min(end)..end]
    .starts_with(b"}}")
    .then_some(pos + 2)
}

/// `{{!-- … --}}` or `{{! … }}`, whose `!` is at `bang`.
fn comment(
  bytes: &[u8],
  start: usize,
  bang: usize,
  end: usize,
) -> Result<(Curly, usize), SyntaxError> {
  let text = &bytes[..end];
  if text[bang..].starts_with(b"!--") {
    // The closing `--` may be the opening's own, as in `{{!--}}`.
    let mut from = start + 2;
    while let Some(dashes) = memmem::find(&text[from..], b"--") {
      let dashes = from + dashes;
      let rest = &text[dashes + 2..];
      let close = if rest.starts_with(b"}}") {
        Some(2)
      } else if rest.starts_with(b"~}}") {
        Some(3)
      } else {
        None
      };
      if let Some(close) = close {
        let value_start = (bang + 3).min(dashes);
        return Ok((
          Curly::Comment {
            value: (value_start, dashes),
          },
          dashes + 2 + close,
        ));
      }
      from = dashes + 1;
    }
    return Err(SyntaxError::new(start, "Parse error: unclosed comment"));
  }

  let Some(close) = memmem::find(&text[bang..], b"}}") else {
    return Err(SyntaxError::new(start, "Parse error: unclosed comment"));
  };
  let close = bang + close;
  let value_end = if close > bang + 1 && text[close - 1] == b'~' {
    close - 1
  } else {
    close
  };
  Ok((
    Curly::Comment {
      value: (bang + 1, value_end.max(bang + 1)),
    },
    close + 2,
  ))
}

/// `{{{{name …}}}} … {{{{/name}}}}`: its content is text.
fn raw_block(bytes: &[u8], start: usize, end: usize) -> Result<(Curly, usize), SyntaxError> {
  let text = &bytes[..end];
  let unclosed = || SyntaxError::new(start, "Parse error: unclosed raw block");
  let open_end = memmem::find(&text[start..], b"}}}}").ok_or_else(unclosed)? + start + 4;
  let close = memmem::find(&text[open_end..], b"{{{{/").ok_or_else(unclosed)? + open_end;
  let close_end = memmem::find(&text[close..], b"}}}}").ok_or_else(unclosed)? + close + 4;
  Ok((Curly::Raw, close_end))
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Kind {
  Id,
  Sep,
  Data,
  String,
  Number,
  Keyword,
  OpenSexpr,
  CloseSexpr,
  Equals,
  OpenBlockParams,
  CloseBlockParams,
  Close,
  CloseUnescaped,
  Invalid,
  Eof,
}

#[derive(Clone, Copy, Debug)]
struct Token {
  kind: Kind,
  start: usize,
  end: usize,
}

struct Lexer<'s> {
  bytes: &'s [u8],
  pos: usize,
  end: usize,
}

impl Lexer<'_> {
  fn at(&self, pos: usize) -> u8 {
    if pos < self.end {
      self.bytes[pos]
    } else {
      0
    }
  }

  fn next(&mut self) -> Token {
    while self.pos < self.end && is_space(self.bytes[self.pos]) {
      self.pos += 1;
    }
    let start = self.pos;
    if start >= self.end {
      return Token {
        kind: Kind::Eof,
        start,
        end: start,
      };
    }

    let (kind, end) = self.token(start);
    self.pos = end;
    Token { kind, start, end }
  }

  fn token(&self, start: usize) -> (Kind, usize) {
    let at = |pos| self.at(pos);
    match at(start) {
      b'(' => (Kind::OpenSexpr, start + 1),
      b')' => (Kind::CloseSexpr, start + 1),
      b'}' => {
        if at(start + 1) == b'}' && at(start + 2) == b'}' {
          (Kind::CloseUnescaped, start + 3)
        } else if at(start + 1) == b'~' && at(start + 2) == b'}' && at(start + 3) == b'}' {
          (Kind::CloseUnescaped, start + 4)
        } else if at(start + 1) == b'}' {
          (Kind::Close, start + 2)
        } else {
          (Kind::Invalid, start + 1)
        }
      }
      b'~' if at(start + 1) == b'}' && at(start + 2) == b'}' => (Kind::Close, start + 3),
      b'=' => (Kind::Equals, start + 1),
      b'.' if at(start + 1) == b'.' => (Kind::Id, start + 2),
      b'.' if is_lookahead(at(start + 1)) => (Kind::Id, start + 1),
      b'.' | b'/' => (Kind::Sep, start + 1),
      quote @ (b'"' | b'\'') => {
        let mut pos = start + 1;
        while pos < self.end {
          match self.bytes[pos] {
            b'\\' if at(pos + 1) == quote => pos += 2,
            byte if byte == quote => return (Kind::String, pos + 1),
            _ => pos += 1,
          }
        }
        (Kind::Invalid, start + 1)
      }
      b'@' => (Kind::Data, start + 1),
      b'|' => (Kind::CloseBlockParams, start + 1),
      b'[' => {
        let mut pos = start + 1;
        while pos < self.end {
          match self.bytes[pos] {
            b'\\' if matches!(at(pos + 1), b']' | b'\\') => pos += 2,
            b']' => return (Kind::Id, pos + 1),
            _ => pos += 1,
          }
        }
        (Kind::Invalid, start + 1)
      }
      _ => self.word(start),
    }
  }

  /// Literals, `as |`, and identifiers.
  fn word(&self, start: usize) -> (Kind, usize) {
    let rest = &self.bytes[start..self.end];
    for keyword in [&b"true"[..], b"false", b"undefined", b"null"] {
      if rest.starts_with(keyword) && is_literal_lookahead(self.at(start + keyword.len())) {
        return (Kind::Keyword, start + keyword.len());
      }
    }
    if let Some(end) = self.number(start) {
      return (Kind::Number, end);
    }
    if rest.starts_with(b"as") && is_space(self.at(start + 2)) {
      let mut pos = start + 2;
      while is_space(self.at(pos)) {
        pos += 1;
      }
      if self.at(pos) == b'|' {
        return (Kind::OpenBlockParams, pos + 1);
      }
    }

    let mut pos = start;
    while pos < self.end && is_id_byte(self.bytes[pos]) {
      pos += 1;
    }
    if pos > start && is_lookahead(self.at(pos)) {
      (Kind::Id, pos)
    } else {
      (Kind::Invalid, start + 1)
    }
  }

  /// `-?[0-9]+(\.[0-9]+)?` before a literal's lookahead.
  fn number(&self, start: usize) -> Option<usize> {
    let digits = |from: usize| {
      let mut pos = from;
      while self.at(pos).is_ascii_digit() {
        pos += 1;
      }
      (pos > from).then_some(pos)
    };
    let integer_start = start + usize::from(self.at(start) == b'-');
    let integer_end = digits(integer_start)?;
    if self.at(integer_end) == b'.' {
      if let Some(end) = digits(integer_end + 1) {
        if is_literal_lookahead(self.at(end)) {
          return Some(end);
        }
      }
    }
    is_literal_lookahead(self.at(integer_end)).then_some(integer_end)
  }
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Close {
  Normal,
  Unescaped,
}

struct Parser<'s> {
  lexer: Lexer<'s>,
}

impl Parser<'_> {
  fn peek(&mut self) -> Token {
    let pos = self.lexer.pos;
    let token = self.lexer.next();
    self.lexer.pos = pos;
    token
  }

  fn unexpected(&self, token: Token) -> SyntaxError {
    let what = match token.kind {
      Kind::Eof => "end of template".to_string(),
      _ => format!(
        "`{}`",
        String::from_utf8_lossy(&self.lexer.bytes[token.start..token.end])
      ),
    };
    SyntaxError::new(token.start, format!("Parse error: unexpected {what}"))
  }

  /// `callee params… key=value… as |params|` and its close; `start` is the curly's.
  fn invocation(
    &mut self,
    start: usize,
    close: Close,
    block_params: bool,
  ) -> Result<(Call, Vec<Span>), SyntaxError> {
    let callee = self.expression()?;
    let (params, hash) = self.arguments(Kind::Close)?;

    let mut names = Vec::new();
    if block_params && self.peek().kind == Kind::OpenBlockParams {
      self.lexer.next();
      loop {
        let token = self.lexer.next();
        match token.kind {
          Kind::Id => names.push((token.start, token.end)),
          Kind::CloseBlockParams if !names.is_empty() => break,
          _ => return Err(self.unexpected(token)),
        }
      }
    }

    self.close(close)?;
    let call = Call {
      span: (start, self.lexer.pos),
      callee,
      params,
      hash,
    };
    Ok((call, names))
  }

  fn close(&mut self, close: Close) -> Result<(), SyntaxError> {
    let token = self.lexer.next();
    let expected = match close {
      Close::Normal => Kind::Close,
      Close::Unescaped => Kind::CloseUnescaped,
    };
    if token.kind == expected {
      Ok(())
    } else {
      Err(self.unexpected(token))
    }
  }

  /// Positional arguments, then named ones, up to a token that ends them.
  fn arguments(&mut self, _until: Kind) -> Result<(Vec<Expr>, Vec<Pair>), SyntaxError> {
    let mut params = Vec::new();
    let mut hash = Vec::new();
    loop {
      let token = self.peek();
      match token.kind {
        Kind::Id if self.is_pair() => {
          self.lexer.next();
          self.lexer.next();
          let value = self.expression()?;
          hash.push(Pair {
            key: (token.start, token.end),
            value,
          });
        }
        Kind::Id | Kind::Data | Kind::String | Kind::Number | Kind::Keyword | Kind::OpenSexpr
          if hash.is_empty() =>
        {
          params.push(self.expression()?);
        }
        Kind::Close | Kind::CloseUnescaped | Kind::CloseSexpr | Kind::OpenBlockParams => {
          return Ok((params, hash));
        }
        _ => return Err(self.unexpected(token)),
      }
    }
  }

  /// Whether the next tokens are `key=`.
  fn is_pair(&mut self) -> bool {
    let pos = self.lexer.pos;
    self.lexer.next();
    let is_pair = self.lexer.next().kind == Kind::Equals;
    self.lexer.pos = pos;
    is_pair
  }

  /// A path, a literal or a sub-expression.
  fn expression(&mut self) -> Result<Expr, SyntaxError> {
    let token = self.lexer.next();
    match token.kind {
      Kind::Id => self.path(token.start, token.end, false),
      Kind::Data => {
        let name = self.lexer.next();
        if name.kind != Kind::Id {
          return Err(self.unexpected(name));
        }
        self.path(token.start, name.end, true)
      }
      Kind::String => Ok(Expr::String((token.start, token.end))),
      Kind::Number => Ok(Expr::Number((token.start, token.end))),
      Kind::Keyword => Ok(Expr::Keyword((token.start, token.end))),
      Kind::OpenSexpr => {
        let callee = self.expression()?;
        let (params, hash) = self.arguments(Kind::CloseSexpr)?;
        let close = self.lexer.next();
        if close.kind != Kind::CloseSexpr {
          return Err(self.unexpected(close));
        }
        if self.peek().kind == Kind::Sep {
          return Err(SyntaxError::new(
            token.start,
            "A path cannot start with a sub-expression. Use the `get` helper (`(get (foo) \"bar\")`) instead",
          ));
        }
        Ok(Expr::Sub(Box::new(Call {
          span: (token.start, close.end),
          callee,
          params,
          hash,
        })))
      }
      _ => Err(self.unexpected(token)),
    }
  }

  /// The path whose first segment is `start..end`, with the segments after it.
  fn path(&mut self, start: usize, mut end: usize, is_arg: bool) -> Result<Expr, SyntaxError> {
    let mut slashed = false;
    loop {
      let separator = self.peek();
      if separator.kind != Kind::Sep {
        break;
      }
      self.lexer.next();
      let segment = self.lexer.next();
      if segment.kind != Kind::Id {
        return Err(self.unexpected(segment));
      }
      slashed |= self.lexer.bytes[separator.start] == b'/';
      end = segment.end;
    }

    let bytes = self.lexer.bytes;
    let original = &bytes[start..end];
    // `@.`, `@..`: the name after `@` must be one.
    if is_arg && matches!(bytes.get(start + 1), Some(b'.')) {
      return Err(SyntaxError::new(
        start,
        "Attempted to parse a path expression, but it was not valid. Paths beginning with @ must start with a-z.",
      ));
    }
    if slashed || original.starts_with(b"..") || original.starts_with(b"./") {
      let message = if original.starts_with(b"./") {
        Some("Using \"./\" is not supported in Glimmer and unnecessary")
      } else if original.starts_with(b"..") {
        Some("Changing context using \"../\" is not supported in Glimmer")
      } else if original.contains(&b'.') {
        Some("Mixing '.' and '/' in paths is not supported in Glimmer; use only '.' to separate property paths")
      } else {
        None
      };
      if let Some(message) = message {
        return Err(SyntaxError::new(start, message));
      }
    } else if original == b"." {
      return Err(SyntaxError::new(
        start,
        "'.' is not a supported path in Glimmer; check for a path with a trailing '.'",
      ));
    }

    let head = if is_arg {
      Head::Arg
    } else if original == b"this" || original.starts_with(b"this.") {
      Head::This
    } else {
      Head::Var
    };

    Ok(Expr::Path(Path {
      span: (start, end),
      head,
      slashed,
    }))
  }
}

/// `\s` of Handlebars' lexer.
pub fn is_space(byte: u8) -> bool {
  matches!(byte, b' ' | b'\t' | b'\n' | b'\r' | 0x0B | 0x0C)
}

/// What may follow an identifier: `[=~}\s\/.)|]`.
fn is_lookahead(byte: u8) -> bool {
  matches!(byte, b'=' | b'~' | b'}' | b'/' | b'.' | b')' | b'|') || is_space(byte)
}

/// What may follow a literal: `[~}\s)]`.
fn is_literal_lookahead(byte: u8) -> bool {
  matches!(byte, b'~' | b'}' | b')') || is_space(byte)
}

/// `[^\s!"#%-,\.\/;->@\[-\^`\{-~]`: what an identifier is made of.
fn is_id_byte(byte: u8) -> bool {
  !(is_space(byte)
    || matches!(
      byte,
      b'!'
        | b'"'
        | b'#'
        | b'%'..=b','
        | b'.'
        | b'/'
        | b';'..=b'>'
        | b'@'
        | b'['..=b'^'
        | b'`'
        | b'{'..=b'~'
        | 0
    ))
}

/// The segments of a path's text: `(start, end, bracketed)`, without `[` `]`.
pub fn segments(bytes: &[u8], span: Span) -> impl Iterator<Item = (usize, usize, bool)> + '_ {
  let (start, end) = span;
  let mut pos = start;
  std::iter::from_fn(move || {
    if pos >= end {
      return None;
    }
    // Each call moves on, past a `.` at least.
    if bytes[pos] == b'.' {
      pos += 1;
    }
    let segment_start = pos;
    if bytes.get(pos) == Some(&b'[') {
      let mut close = pos + 1;
      while close < end && bytes[close] != b']' {
        close += if bytes[close] == b'\\' { 2 } else { 1 };
      }
      pos = (close + 1).min(end);
      return Some((segment_start + 1, close.min(end), true));
    }
    while pos < end && bytes[pos] != b'.' {
      pos += 1;
    }
    Some((segment_start, pos, false))
  })
}

#[cfg(test)]
mod tests {
  use super::*;

  fn parse(text: &str) -> Result<Curly, SyntaxError> {
    parse_curly(text.as_bytes(), 0, text.len()).map(|(curly, end)| {
      assert_eq!(end, text.len(), "{text}");
      curly
    })
  }

  fn text(source: &str, span: Span) -> &str {
    &source[span.0..span.1]
  }

  #[test]
  fn a_mustache_has_a_callee_positional_and_named_arguments() {
    let source = "{{m.items 1 \"two\" (sub @x) key=true other=this.y}}";
    let Ok(Curly::Mustache(call)) = parse(source) else {
      panic!()
    };
    assert_eq!(
      call.callee,
      Expr::Path(Path {
        span: (2, 9),
        head: Head::Var,
        slashed: false
      })
    );
    assert_eq!(call.params.len(), 3);
    assert_eq!(text(source, call.params[1].span()), "\"two\"");
    let Expr::Sub(sub) = &call.params[2] else {
      panic!()
    };
    assert_eq!(text(source, sub.span), "(sub @x)");
    assert!(matches!(
      sub.params[0],
      Expr::Path(Path {
        head: Head::Arg,
        ..
      })
    ));
    assert_eq!(text(source, call.hash[1].key), "other");
    assert!(matches!(
      call.hash[1].value,
      Expr::Path(Path {
        head: Head::This,
        ..
      })
    ));
  }

  #[test]
  fn blocks_else_and_close() {
    let source = "{{#each @list key=\"id\" as |item index|}}";
    let Ok(Curly::Open { call, params }) = parse(source) else {
      panic!()
    };
    assert_eq!(call.hash.len(), 1);
    assert_eq!(
      params
        .iter()
        .map(|&span| text(source, span))
        .collect::<Vec<_>>(),
      ["item", "index"]
    );
    assert_eq!(parse("{{else}}"), Ok(Curly::Else));
    assert_eq!(parse("{{~ else ~}}"), Ok(Curly::Else));
    assert_eq!(parse("{{^}}"), Ok(Curly::Else));
    assert!(matches!(
      parse("{{else if (m.x)}}"),
      Ok(Curly::ElseChain { .. })
    ));
    assert_eq!(parse("{{/each}}"), Ok(Curly::Close { name: (3, 7) }));
    assert_eq!(parse("{{~/this.x~}}"), Ok(Curly::Close { name: (4, 10) }));
  }

  #[test]
  fn comments_end_at_their_markers() {
    assert_eq!(parse("{{! {{m.x}}"), Ok(Curly::Comment { value: (3, 9) }));
    assert_eq!(
      parse("{{!-- {{m.x}} }} --}}"),
      Ok(Curly::Comment { value: (5, 17) })
    );
    assert_eq!(parse("{{!--}}"), Ok(Curly::Comment { value: (3, 3) }));
    assert!(parse("{{!-- open").is_err());
  }

  #[test]
  fn literals_need_their_lookahead() {
    let source = "{{f -1 2.5 true trueish null 1.x}}";
    let Ok(Curly::Mustache(call)) = parse(source) else {
      panic!()
    };
    let kinds: Vec<_> = call
      .params
      .iter()
      .map(|param| match param {
        Expr::Number(_) => "number",
        Expr::Keyword(_) => "keyword",
        Expr::Path(_) => "path",
        _ => "other",
      })
      .collect();
    assert_eq!(
      kinds,
      ["number", "number", "keyword", "path", "keyword", "path"]
    );
  }

  #[test]
  fn syntax_errors() {
    for source in [
      "{{m.broken (}}",
      "{{m.a",
      "{{\"open}}",
      "{{m.a key=}}",
      "{{m.a key=1 positional}}",
      "{{m.a as |x|}}",
      "{{> partial}}",
      "{{foo(bar)}}",
      "{{x}}}",
      "{{{x}}",
      "{{./x}}",
      "{{../x}}",
      "{{a.b/c}}",
      "{{@..}}",
      "{{@.}}",
      "{{f @..}}",
    ] {
      assert!(parse(source).is_err(), "{source}");
    }
  }

  #[test]
  fn segments_always_move_on() {
    for text in [&b".."[..], b".a", b"a..b", b"a.", b"[x].y"] {
      assert!(
        segments(text, (0, text.len())).count() <= text.len(),
        "{text:?}"
      );
    }
  }

  #[test]
  fn segments_of_a_path() {
    let source = b"m.foo-bar.[a b].c";
    let found: Vec<_> = segments(source, (0, source.len())).collect();
    assert_eq!(
      found,
      [
        (0, 1, false),
        (2, 9, false),
        (11, 14, true),
        (16, 17, false)
      ]
    );
  }
}
