//! Marko's parser, `htmljs-parser` 5.20, as a port of its state machine over the file's bytes, and
//! the tree `@marko/language-tools` builds from its events. Every character it looks for is ASCII,
//! so reading UTF-8 bytes rather than UTF-16 units finds the same ranges, in UTF-8 offsets.
//!
//! As with the language tools, a syntax error ends the parse silently: the tree holds what was read
//! before it.

use memchr::memmem;

/// What reading past the end gives: no character compares equal to it, as `NaN` in JavaScript.
const EOF: u32 = 0x1_0000;

/// A tag that does not exist, e.g. the parent of a node at the template's top level.
pub const NONE: u32 = u32::MAX;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Default)]
pub struct Span {
  pub start: u32,
  pub end: u32,
}

impl Span {
  fn new(start: usize, end: usize) -> Span {
    Span {
      start: start as u32,
      end: end as u32,
    }
  }

  pub fn is_empty(self) -> bool {
    self.end <= self.start
  }

  pub fn len(self) -> usize {
    self.end.saturating_sub(self.start) as usize
  }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum StaticKind {
  Import,
  Export,
  Class,
  /// `static`, `server` and `client` statements.
  Static,
  /// `style { … }`
  Style,
}

/// A statement of the template's module: `import …`, `static …`, `class { … }`.
#[derive(Clone, Copy, Debug)]
pub struct Static {
  pub kind: StaticKind,
  /// From the keyword to the end of the statement.
  pub span: Span,
}

#[derive(Clone, Copy, Debug)]
pub enum ChildKind {
  Tag(u32),
  Text(Span),
  /// `${value}` or `$!{value}`
  Placeholder(Span),
  /// `$ value` or `$ { value }`
  Scriptlet(Span),
}

#[derive(Clone, Copy, Debug)]
pub struct Child {
  pub kind: ChildKind,
  pub next: u32,
}

#[derive(Clone, Copy, Debug)]
pub enum AttrValue {
  None,
  /// `name=value`, `name:=value`
  Expression(Span),
  /// `name(params) { body }`: `params` with its parentheses, `body` with its braces.
  Method {
    is_async: bool,
    type_params: Option<Span>,
    params: Span,
    body: Span,
  },
}

#[derive(Clone, Copy, Debug)]
pub enum Attr {
  Named {
    /// Empty for the default attribute, `<if=x>`.
    name: Span,
    /// The value of `name(args)`.
    args: Option<Span>,
    value: AttrValue,
  },
  /// The value of `...value`.
  Spread(Span),
}

/// An interpolation in a tag name or its shorthand id or classes: `<${tag}>`, `<div.a-${b}>`.
#[derive(Clone, Copy, Debug)]
pub struct TagExpression {
  /// With `${` and `}`.
  pub span: Span,
  pub value: Span,
}

#[derive(Clone, Debug)]
pub struct Tag {
  pub parent: u32,
  /// The name, with its interpolations: empty for `div`.
  pub name: Span,
  /// The tag names that are not interpolated, without the `@` of an attribute tag.
  pub name_text: Option<Span>,
  pub is_attr_tag: bool,
  /// The name's interpolations, then its shorthands'.
  pub expressions: Vec<TagExpression>,
  pub name_expressions: u32,
  pub var: Option<Span>,
  pub args: Option<Span>,
  pub params: Option<Span>,
  pub first_attr: u32,
  pub last_attr: u32,
  pub first_child: u32,
  pub last_child: u32,
  /// Whether every child is text.
  pub only_text: bool,
}

impl Tag {
  pub fn has_body(&self) -> bool {
    self.first_child != NONE
  }
}

#[derive(Default, Debug)]
pub struct Tree {
  pub statics: Vec<Static>,
  pub tags: Vec<Tag>,
  pub children: Vec<Child>,
  /// Each tag's attributes, linked: a tag closed in its open tag (`</>` in a comment of a
  /// `<script>`'s attribute) leaves the rest to its parent.
  pub attrs: Vec<(Attr, u32)>,
  pub first_child: u32,
  pub last_child: u32,
  /// The first syntax error, where the parse stopped.
  pub error: Option<(u32, String)>,
}

impl Tree {
  pub fn tag(&self, tag: u32) -> &Tag {
    &self.tags[tag as usize]
  }

  /// The children of `parent`, a tag or `NONE` for the template.
  pub fn children(&self, parent: u32) -> Children<'_> {
    let first = if parent == NONE {
      self.first_child
    } else {
      self.tags[parent as usize].first_child
    };

    Children {
      tree: self,
      next: first,
    }
  }

  pub fn attrs(&self, tag: &Tag) -> Attrs<'_> {
    Attrs {
      tree: self,
      next: tag.first_attr,
    }
  }
}

pub struct Attrs<'t> {
  tree: &'t Tree,
  next: u32,
}

impl Iterator for Attrs<'_> {
  type Item = Attr;

  fn next(&mut self) -> Option<Attr> {
    let (attr, next) = *self.tree.attrs.get(self.next as usize)?;
    self.next = next;
    Some(attr)
  }
}

pub struct Children<'t> {
  tree: &'t Tree,
  next: u32,
}

impl Iterator for Children<'_> {
  type Item = ChildKind;

  fn next(&mut self) -> Option<ChildKind> {
    let child = self.tree.children.get(self.next as usize)?;
    self.next = child.next;
    Some(child.kind)
  }
}

pub fn parse(source: &str) -> Tree {
  let mut parser = Parser::new(source);
  parser.run();
  parser.tree
}

// ---------------------------------------------------------------- characters

#[inline]
fn is_whitespace(code: u32) -> bool {
  code <= 32
}

#[inline]
fn is_indent(code: u32) -> bool {
  code == 9 || code == 32
}

#[inline]
fn is_line(code: u32) -> bool {
  code == 10 || code == 13
}

#[inline]
fn is_word(code: u32) -> bool {
  matches!(code, 65..=90 | 97..=122 | 48..=57 | 36 | 95)
}

fn is_word_or_period(code: u32) -> bool {
  code == 46 || is_word(code)
}

fn is_operand_end(code: u32) -> bool {
  code == 41 || code == 93 || is_word(code)
}

fn can_follow_division(code: u32) -> bool {
  is_word(code) || matches!(code, 96 | 39 | 34 | 37 | 41 | 46 | 60 | 93 | 125)
}

fn is_special_html_content(code: u8) -> bool {
  matches!(code, 10 | 13 | 60 | 36 | 47 | 92)
}

fn is_special_parsed_text(code: u8) -> bool {
  matches!(code, 10 | 13 | 60 | 47 | 96 | 34 | 39 | 36 | 92)
}

const UNARY_KEYWORDS: [&[u8]; 8] = [
  b"async",
  b"await",
  b"class",
  b"function",
  b"new",
  b"typeof",
  b"delete",
  b"void",
];
const TS_UNARY_KEYWORDS: [&[u8]; 12] = [
  b"async",
  b"await",
  b"class",
  b"function",
  b"new",
  b"typeof",
  b"asserts",
  b"infer",
  b"is",
  b"keyof",
  b"readonly",
  b"unique",
];
// `instanceof` before `in`.
const BINARY_KEYWORDS: [&[u8]; 5] = [b"as", b"extends", b"instanceof", b"in", b"satisfies"];
const RELATIONAL_KEYWORDS: [&[u8]; 2] = [b"in", b"instanceof"];
const TYPE_KEYWORDS: [&[u8]; 3] = [b"declare", b"interface", b"type"];

// Tag types.
const HTML: u8 = 0;
const TEXT: u8 = 1;
const VOID: u8 = 2;
const STATEMENT: u8 = 3;

// ---------------------------------------------------------------- states

/// What ends an expression, besides its groups closing.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum Terminator {
  Never,
  HtmlAttrName,
  HtmlAttrValue,
  ConciseAttrName,
  ConciseAttrValue,
  ConciseGroupedAttrName,
  ConciseGroupedAttrValue,
  CloseParen,
  CloseAngleBracket,
  CloseCurlyBrace,
  Pipe,
  ConciseTagVar,
  HtmlTagVar,
}

#[derive(Clone, Copy, Debug)]
struct Expression {
  /// Where its groups start in `Parser::groups`.
  groups: u32,
  terminator: Terminator,
  operators: bool,
  was_comment: bool,
  in_type: bool,
  force_type: bool,
  ternary_depth: u32,
  terminated_by_eol: bool,
  terminated_by_whitespace: bool,
  consume_indented_content: bool,
}

#[derive(Clone, Copy, Debug)]
struct Content {
  indent: Span,
  single_line: bool,
  /// The number of `-` of a delimited block, `--`.
  delimiter: u32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Args {
  None,
  /// `name(args)`, reported.
  Reported,
  /// `name(args) {`: a method's parameters.
  Method(Span),
}

#[derive(Clone, Copy, Debug)]
struct Attribute {
  stage: u8,
  name: Option<Span>,
  args: Args,
  type_params: Option<Span>,
  bound: bool,
  spread: bool,
  pending_async: Option<Span>,
  async_method: Option<Span>,
  value_start: usize,
}

#[derive(Clone, Copy, Debug)]
enum State {
  ConciseHtmlContent,
  HtmlContent(Content),
  ParsedTextContent(Content),
  BeginDelimitedHtmlBlock {
    indent: Span,
    delimiter: u32,
  },
  OpenTag(u32),
  /// `shorthand`: `.` or `#` for a shorthand class or id, else 0.
  TagName {
    shorthand: u8,
  },
  Attribute(Attribute),
  Expression(Expression),
  String {
    quote: u8,
  },
  TemplateString,
  ParsedString {
    quote: u8,
  },
  RegularExpression {
    in_char_set: bool,
  },
  JsCommentLine,
  JsCommentBlock,
  HtmlComment,
  Cdata,
  Dtd,
  Declaration,
  CloseTag,
  InlineScript {
    block: bool,
    value: Span,
  },
  Placeholder {
    escape: bool,
  },
}

#[derive(Clone, Copy, Debug)]
struct Frame {
  state: State,
  start: usize,
  end: usize,
}

/// An open tag as the parser knows it, which stays the active tag while its body is read.
#[derive(Clone, Copy, Debug)]
struct OpenTag {
  kind: u8,
  stage: u8,
  parent: u32,
  nested_indent: Option<Span>,
  indent: Span,
  has_shorthand_id: bool,
  has_args: bool,
  has_attrs: bool,
  has_params: bool,
  type_params: Option<(Span, Span)>,
  self_closed: bool,
  shorthand_end: isize,
  name: Option<Span>,
  concise: bool,
  begin_mixed_mode: bool,
}

// Open tag stages.
const STAGE_VAR: u8 = 1;
const STAGE_ARGS: u8 = 2;
const STAGE_TYPES: u8 = 3;
const STAGE_PARAMS: u8 = 4;
const STAGE_ATTR_GROUP: u8 = 5;

// Attribute stages.
const ATTR_UNKNOWN: u8 = 0;
const ATTR_NAME: u8 = 1;
const ATTR_VALUE: u8 = 2;
const ATTR_ARGS: u8 = 3;
const ATTR_TYPE_PARAMS: u8 = 4;
const ATTR_BLOCK: u8 = 5;

/// What a missing frame reads as: the root state, which never exits.
static ROOT: Frame = Frame {
  state: State::ConciseHtmlContent,
  start: 0,
  end: 0,
};

struct Parser<'a> {
  data: &'a [u8],
  pos: usize,
  max_pos: usize,
  indent: Span,
  text_pos: Option<usize>,
  is_concise: bool,
  begin_mixed_mode: bool,
  ending_mixed_mode_at_eol: bool,
  stack: Vec<Frame>,
  /// The open groups of the expressions being read, innermost last.
  groups: Vec<u8>,
  open_tags: Vec<OpenTag>,
  active_tag: u32,
  /// The interpolations of the tag name being read.
  name_expressions: Vec<TagExpression>,
  tree: Tree,
  // What the tree builder keeps.
  /// The tag new nodes go in, or `NONE` for the template.
  parent_node: u32,
  is_static_open: bool,
  attr_node: Option<usize>,
}

impl<'a> Parser<'a> {
  fn new(source: &'a str) -> Self {
    let data = source.as_bytes();

    Parser {
      data,
      pos: 0,
      max_pos: data.len(),
      indent: Span::default(),
      text_pos: None,
      is_concise: true,
      begin_mixed_mode: false,
      ending_mixed_mode_at_eol: false,
      stack: Vec::with_capacity(16),
      groups: Vec::with_capacity(16),
      open_tags: Vec::new(),
      active_tag: NONE,
      name_expressions: Vec::new(),
      tree: Tree {
        tags: Vec::with_capacity(data.len() / 64),
        children: Vec::with_capacity(data.len() / 32),
        attrs: Vec::with_capacity(data.len() / 128),
        first_child: NONE,
        last_child: NONE,
        ..Tree::default()
      },
      parent_node: NONE,
      is_static_open: false,
      attr_node: None,
    }
  }

  fn run(&mut self) {
    self.pos = if self.data.starts_with(&[0xEF, 0xBB, 0xBF]) {
      3
    } else {
      0
    };
    self.enter(State::ConciseHtmlContent);

    while self.pos <= self.max_pos {
      let Some(frame) = self.stack.last() else {
        return;
      };

      match frame.state {
        State::ConciseHtmlContent => self.parse_concise_html_content(),
        State::HtmlContent(content) => self.parse_html_content(content),
        State::ParsedTextContent(content) => self.parse_parsed_text_content(content),
        State::BeginDelimitedHtmlBlock { .. } => self.parse_begin_delimited_html_block(),
        State::OpenTag(tag) => self.parse_open_tag(tag),
        State::TagName { .. } => self.parse_tag_name(),
        State::Attribute(_) => self.parse_attribute(),
        State::Expression(_) => self.parse_expression(),
        State::String { quote } => self.parse_string(quote),
        State::TemplateString => self.parse_template_string(),
        State::ParsedString { quote } => self.parse_parsed_string(quote),
        State::RegularExpression { .. } => self.parse_regular_expression(),
        State::JsCommentLine => self.parse_js_comment_line(),
        State::JsCommentBlock => self.parse_until(b"*/", 2),
        State::HtmlComment => self.parse_until(b"->", 2),
        State::Cdata => self.parse_until(b"]]>", 3),
        State::Dtd | State::CloseTag => self.parse_until(b">", 1),
        State::Declaration => self.parse_declaration(),
        State::InlineScript { .. } => self.parse_inline_script(),
        // Never active: the expression it starts is.
        State::Placeholder { .. } => return,
      }
    }
  }

  // ---------------------------------------------------------------- reading

  #[inline]
  fn code(&self, index: usize) -> u32 {
    self.data.get(index).map_or(EOF, |&code| u32::from(code))
  }

  #[inline]
  fn code_at(&self, index: isize) -> u32 {
    if index < 0 {
      EOF
    } else {
      self.code(index as usize)
    }
  }

  /// `lookAheadFor(text, start)`: whether `text` is at `start`, all of it before the end.
  fn looks_at(&self, text: &[u8], start: usize) -> bool {
    start + text.len() <= self.max_pos && &self.data[start..start + text.len()] == text
  }

  fn span_text(&self, span: Span) -> &'a [u8] {
    let end = (span.end as usize).min(self.data.len());
    let start = (span.start as usize).min(end);
    &self.data[start..end]
  }

  fn find(&self, needle: &[u8], from: usize) -> Option<usize> {
    let haystack = self.data.get(from..)?;
    let index = match needle {
      [byte] => memchr::memchr(*byte, haystack),
      _ => memmem::find(haystack, needle),
    };
    index.map(|index| from + index)
  }

  fn previous_non_whitespace(&self) -> u32 {
    let mut behind = self.pos as isize - 1;
    while is_whitespace(self.code_at(behind)) {
      behind -= 1;
    }
    self.code_at(behind)
  }

  fn consume_whitespace_if_before(&mut self, text: &[u8]) -> bool {
    let mut current = self.pos;
    while is_whitespace(self.code(current)) {
      current += 1;
    }
    if self.looks_at(text, current) {
      self.pos = current;
      true
    } else {
      false
    }
  }

  fn only_whitespace_remains_on_line(&self, start: usize) -> bool {
    let max_offset = self.max_pos.saturating_sub(self.pos);
    let mut ahead = start;

    while ahead < max_offset {
      let code = self.code(self.pos + ahead);
      if !is_whitespace(code) {
        return false;
      }
      if is_line(code) {
        return true;
      }
      ahead += 1;
    }
    true
  }

  fn consume_whitespace_on_line(&mut self, start: usize) -> bool {
    let max_offset = self.max_pos.saturating_sub(self.pos);
    let mut ahead = start;

    while ahead < max_offset {
      let code = self.code(self.pos + ahead);
      if !is_whitespace(code) {
        self.pos += ahead;
        return false;
      }
      if is_line(code) {
        self.pos += ahead;
        return true;
      }
      ahead += 1;
    }
    self.pos = self.max_pos;
    true
  }

  fn consume_whitespace(&mut self) {
    while self.pos < self.max_pos && is_whitespace(self.code(self.pos)) {
      self.pos += 1;
    }
  }

  fn newline_length(&self, code: u32) -> usize {
    if code == 13 && self.code(self.pos + 1) == 10 {
      2
    } else {
      1
    }
  }

  // ---------------------------------------------------------------- the state stack

  fn frame(&self) -> &Frame {
    self.stack.last().unwrap_or(&ROOT)
  }

  fn state_mut(&mut self) -> Option<&mut State> {
    self.stack.last_mut().map(|frame| &mut frame.state)
  }

  fn with_expression(&mut self, change: impl FnOnce(&mut Expression)) {
    if let Some(State::Expression(expression)) = self.state_mut() {
      change(expression);
    }
  }

  fn with_attribute(&mut self, change: impl FnOnce(&mut Attribute)) {
    if let Some(State::Attribute(attribute)) = self.state_mut() {
      change(attribute);
    }
  }

  fn open_tag(&self, tag: u32) -> &OpenTag {
    &self.open_tags[tag as usize]
  }

  fn open_tag_mut(&mut self, tag: u32) -> &mut OpenTag {
    &mut self.open_tags[tag as usize]
  }

  fn active_open_tag(&self) -> Option<&OpenTag> {
    self.open_tags.get(self.active_tag as usize)
  }

  fn enter(&mut self, state: State) {
    let start = self.pos;

    match state {
      State::ConciseHtmlContent => {
        self.is_concise = true;
        self.indent = Span::default();
      }
      State::HtmlContent(_) => self.is_concise = false,
      State::CloseTag
      | State::Declaration
      | State::Dtd
      | State::HtmlComment
      | State::InlineScript { .. } => self.end_text(),
      _ => {}
    }

    self.stack.push(Frame {
      state,
      start,
      end: start,
    });
  }

  fn enter_expression(&mut self, terminator: Terminator) {
    let expression = Expression {
      groups: self.groups.len() as u32,
      terminator,
      operators: false,
      was_comment: false,
      in_type: false,
      force_type: false,
      ternary_depth: 0,
      terminated_by_eol: false,
      terminated_by_whitespace: false,
      consume_indented_content: false,
    };
    self.enter(State::Expression(expression));
  }

  fn enter_open_tag(&mut self) {
    let tag = OpenTag {
      kind: HTML,
      stage: 0,
      parent: self.active_tag,
      nested_indent: None,
      indent: self.indent,
      has_shorthand_id: false,
      has_args: false,
      has_attrs: false,
      has_params: false,
      type_params: None,
      self_closed: false,
      shorthand_end: -1,
      name: None,
      concise: self.is_concise,
      begin_mixed_mode: self.begin_mixed_mode || self.ending_mixed_mode_at_eol,
    };
    let index = self.open_tags.len() as u32;
    self.open_tags.push(tag);
    self.active_tag = index;
    self.enter(State::OpenTag(index));
    self.begin_mixed_mode = false;
    self.ending_mixed_mode_at_eol = false;
    self.end_text();
  }

  fn exit(&mut self) {
    // The root state never exits.
    if self.stack.len() < 2 {
      self.pos = self.max_pos + 1;
      return;
    }
    let Some(mut child) = self.stack.pop() else {
      return;
    };
    child.end = self.pos;
    let depth = self.stack.len();

    self.on_exit(&child);

    if self.stack.len() != depth {
      // The state that exited entered another: JavaScript gives that one the return.
      if matches!(self.frame().state, State::ConciseHtmlContent) {
        self.indent = Span::default();
        self.is_concise = true;
      }
      return;
    }
    if depth > 0 {
      self.on_return(child);
    }
  }

  fn emit_error(&mut self, at: usize, message: &str) {
    if self.tree.error.is_none() {
      self.tree.error = Some((at as u32, message.to_string()));
    }
    self.pos = self.max_pos + 1;
  }

  fn start_text(&mut self) {
    if self.text_pos.is_none() {
      self.text_pos = Some(self.pos);
    }
  }

  fn end_text(&mut self) {
    if let Some(start) = self.text_pos.take() {
      if start != self.pos {
        self.on_text(Span::new(start, self.pos));
      }
    }
  }

  fn begin_html_block(&mut self, delimiter: u32, single_line: bool) {
    let content = Content {
      indent: self.indent,
      single_line,
      delimiter,
    };
    let is_text = self.active_open_tag().is_some_and(|tag| tag.kind == TEXT);
    self.enter(if is_text {
      State::ParsedTextContent(content)
    } else {
      State::HtmlContent(content)
    });
  }

  fn close_tag_end(&mut self, end: usize) {
    let Some(&tag) = self.active_open_tag() else {
      return;
    };
    if tag.begin_mixed_mode {
      self.ending_mixed_mode_at_eol = true;
    }
    self.active_tag = tag.parent;
    self.on_close_tag_end(end);
  }

  // ---------------------------------------------------------------- exits and returns

  fn on_exit(&mut self, frame: &Frame) {
    match frame.state {
      State::Attribute(attribute) => self.flush_pending_async(&attribute),
      State::OpenTag(tag) => self.exit_open_tag(tag),
      State::TagName { shorthand } => self.exit_tag_name(frame, shorthand),
      State::InlineScript { value, .. } => self.on_scriptlet(value),
      State::Placeholder { escape } => {
        let start = frame.start + if escape { 2 } else { 3 };
        let end = frame.end.saturating_sub(1).max(start);
        self.on_placeholder(Span::new(start, end));
      }
      _ => {}
    }
  }

  fn on_return(&mut self, child: Frame) {
    match self.frame().state {
      State::ConciseHtmlContent => {
        self.indent = Span::default();
        self.is_concise = true;
        match child.state {
          State::JsCommentBlock => {
            if !self.consume_whitespace_on_line(0) {
              self.emit_error(
                self.pos,
                "In concise mode a javascript comment block can only be followed by whitespace characters and a newline.",
              );
            }
          }
          State::HtmlComment => self.end_concise_line(),
          _ => {}
        }
      }
      State::Expression(_) => {
        if matches!(child.state, State::JsCommentLine) {
          self.with_expression(|expression| expression.was_comment = true);
        }
      }
      State::InlineScript { block, .. } => {
        if block {
          self.pos += 1;
          if self.code(self.pos) == 59 || self.consume_whitespace_if_before(b";") {
            self.pos += 1;
          }
        }
        if let Some(State::InlineScript { value, .. }) = self.state_mut() {
          *value = Span::new(child.start, child.end);
        }
        self.exit();
      }
      State::Placeholder { .. } => {
        if child.start == child.end {
          self.emit_error(
            child.start,
            "Invalid placeholder, the expression cannot be missing",
          );
          return;
        }
        self.pos += 1;
        self.exit();
      }
      State::TemplateString => {
        if child.start == child.end {
          self.emit_error(
            child.start,
            "Invalid placeholder, the expression cannot be missing",
          );
        }
        self.pos += 1;
      }
      State::TagName { .. } => {
        if child.start == child.end {
          self.emit_error(
            child.start,
            "Invalid placeholder, the expression cannot be missing",
          );
        }
        let start = child.start - 2;
        self.pos += 1;
        let end = self.pos;
        self.name_expressions.push(TagExpression {
          span: Span::new(start, end),
          value: Span::new(child.start, child.end),
        });
      }
      State::OpenTag(tag) => self.return_to_open_tag(tag, child),
      State::Attribute(_) => self.return_to_attribute(child),
      _ => {}
    }
  }

  // ---------------------------------------------------------------- CONCISE_HTML_CONTENT

  fn parse_concise_html_content(&mut self) {
    if self.pos == self.max_pos {
      self.html_eof();
      self.pos += 1;
      return;
    }

    while self.pos < self.max_pos {
      let code = self.code(self.pos);

      if is_line(code) {
        self.indent = Span::default();
        self.pos += self.newline_length(code);
        continue;
      }

      if is_whitespace(code) {
        let start = self.pos;
        loop {
          self.pos += 1;
          if self.pos >= self.max_pos {
            break;
          }
          let next = self.code(self.pos);
          if !is_whitespace(next) || is_line(next) {
            break;
          }
        }
        self.indent = if self.indent.is_empty() {
          Span::new(start, self.pos)
        } else {
          Span::new(self.indent.start as usize, self.pos)
        };
        continue;
      }

      let current_indent = self.indent.len();
      let indent_start = self.pos.saturating_sub(current_indent + 1);
      let mut parent = self.active_tag;
      while let Some(tag) = self.open_tags.get(parent as usize) {
        if tag.indent.len() < current_indent {
          break;
        }
        self.close_tag_end(indent_start);
        parent = self.active_tag;
      }

      if parent == NONE && current_indent > 0 && code != 47 {
        self.emit_error(self.pos, "Line has extra indentation at the beginning");
        return;
      }

      let parent_kind = self.open_tags.get(parent as usize).map(|tag| tag.kind);
      if parent != NONE {
        if parent_kind == Some(TEXT) && code != 45 {
          self.emit_error(
            self.pos,
            "A line within a tag that only allows text content must begin with a \"-\" character",
          );
          return;
        }

        let indent = self.indent;
        match self.open_tag(parent).nested_indent {
          None => self.open_tag_mut(parent).nested_indent = Some(indent),
          Some(nested) => {
            if self.span_text(nested) != self.span_text(indent) {
              self.emit_error(
                self.pos,
                "Line indentation does match indentation of previous line",
              );
              return;
            }
          }
        }
      }

      match code {
        59 => {
          self.pos += 1;
          self.end_concise_line();
          return;
        }
        60 => {
          self.begin_mixed_mode = true;
          self.begin_html_block(0, false);
          return;
        }
        36 => {
          if is_whitespace(self.code(self.pos + 1)) {
            self.enter(State::InlineScript {
              block: false,
              value: Span::default(),
            });
            self.pos += 1;
            return;
          }
        }
        45 => {
          if self.code(self.pos + 1) == 45 {
            let indent = self.indent;
            self.enter(State::BeginDelimitedHtmlBlock {
              indent,
              delimiter: 0,
            });
            return;
          }
          if !(parent_kind != Some(TEXT) && is_word(self.code(self.pos + 1))) {
            self.emit_error(
              self.pos,
              "A line in concise mode cannot start with a single hyphen. Use \"--\" instead.",
            );
            return;
          }
        }
        47 => {
          match self.code(self.pos + 1) {
            47 => {
              self.enter(State::JsCommentLine);
              self.pos += 2;
            }
            42 => {
              self.enter(State::JsCommentBlock);
              self.pos += 2;
            }
            _ => self.emit_error(
              self.pos,
              "A line in concise mode cannot start with \"/\" unless it starts a \"//\" or \"/*\" comment",
            ),
          }
          return;
        }
        _ => {}
      }

      self.enter_open_tag();
      return;
    }
  }

  fn end_concise_line(&mut self) {
    if self.consume_whitespace_on_line(0) {
      return;
    }

    match self.code(self.pos) {
      47 => match self.code(self.pos + 1) {
        47 => {
          self.enter(State::JsCommentLine);
          self.pos += 2;
          return;
        }
        42 => {
          self.enter(State::JsCommentBlock);
          self.pos += 2;
          return;
        }
        _ => {}
      },
      60 if self.looks_at(b"!--", self.pos + 1) => {
        self.enter(State::HtmlComment);
        self.pos += 4;
        return;
      }
      _ => {}
    }

    self.emit_error(
      self.pos,
      "A semicolon indicates the end of a line. Only comments may follow it.",
    );
  }

  // ---------------------------------------------------------------- BEGIN_DELIMITED_HTML_BLOCK

  fn parse_begin_delimited_html_block(&mut self) {
    if self.pos == self.max_pos {
      self.html_eof();
      self.pos += 1;
      return;
    }

    while self.pos < self.max_pos {
      let code = self.code(self.pos);

      if is_line(code) {
        let length = self.newline_length(code);
        let previous = self.pos;
        let State::BeginDelimitedHtmlBlock { indent, delimiter } = self.frame().state else {
          return;
        };
        self.begin_html_block(delimiter, false);
        self.handle_delimited_block_eol(true, length, indent, delimiter);
        if self.pos == previous {
          self.pos += length;
        }
        return;
      }

      if code == 45 {
        if let Some(State::BeginDelimitedHtmlBlock { delimiter, .. }) = self.state_mut() {
          *delimiter += 1;
        }
        self.pos += 1;
        continue;
      }

      let start = self.pos;
      if !self.consume_whitespace_on_line(1) {
        self.pos = start + 1;
        self.begin_html_block(0, true);
        return;
      }
    }
  }

  /// Returns whether it handled the end of line.
  fn handle_delimited_eol(&mut self, newline_length: usize, content: Content) -> bool {
    if content.single_line {
      self.end_text();
      self.exit();
      self.exit();
      return true;
    }
    if content.delimiter > 0 {
      self.handle_delimited_block_eol(false, newline_length, content.indent, content.delimiter);
      return true;
    }
    false
  }

  fn handle_delimited_block_eol(
    &mut self,
    first: bool,
    newline_length: usize,
    indent: Span,
    delimiter: u32,
  ) {
    let indent_text = self.span_text(indent);
    let after_newline = self.pos + newline_length;
    let dashes = after_newline + indent_text.len();
    let ends_block = self.looks_at(indent_text, after_newline)
      && dashes + delimiter as usize <= self.max_pos
      && self.data[dashes..dashes + delimiter as usize]
        .iter()
        .all(|&code| code == b'-');

    if ends_block {
      self.end_text();
      self.pos += newline_length + indent_text.len() + delimiter as usize;
      if self.consume_whitespace_on_line(0) {
        self.exit();
        self.exit();
      } else {
        self.emit_error(
          self.pos,
          "A concise mode closing block delimiter can only be followed by whitespace.",
        );
      }
    } else if !indent_text.is_empty() && self.looks_at(indent_text, after_newline) {
      if !first {
        self.start_text();
      }
      self.pos += newline_length;
      self.end_text();
      self.pos += indent_text.len();
      self.start_text();
    } else if !indent_text.is_empty() && !self.only_whitespace_remains_on_line(newline_length) {
      let position = self.pos;
      let mut current = self.pos;
      while current > 0 && is_line(self.code(current - 1)) {
        current -= 1;
      }
      self.pos = current;
      self.end_text();
      self.pos = position;
      self.exit();
      self.exit();
    } else if !first && after_newline != self.max_pos {
      self.start_text();
    }
  }

  // ---------------------------------------------------------------- HTML_CONTENT

  fn parse_html_content(&mut self, content: Content) {
    if self.pos == self.max_pos {
      self.html_eof();
      self.pos += 1;
      return;
    }

    while self.pos < self.max_pos {
      let code = self.code(self.pos);

      if is_line(code) {
        let length = self.newline_length(code);
        if self.begin_mixed_mode {
          self.begin_mixed_mode = false;
          self.end_text();
          self.exit();
          return;
        }
        if self.ending_mixed_mode_at_eol {
          self.ending_mixed_mode_at_eol = false;
          self.end_text();
          self.exit();
          return;
        }

        let depth = self.stack.len();
        let previous = self.pos;
        if self.handle_delimited_eol(length, content) {
          if self.stack.len() != depth {
            return;
          }
          if self.pos == previous {
            self.pos += length;
          }
          continue;
        }
        self.start_text();
        self.pos += length;
        continue;
      }

      if code == 60 {
        if self.check_for_cdata() {
          return;
        }
        let next = self.code(self.pos + 1);
        if next == 33 {
          if self.code(self.pos + 2) == 45 && self.code(self.pos + 3) == 45 {
            self.enter(State::HtmlComment);
            self.pos += 4;
          } else {
            self.enter(State::Dtd);
            self.pos += 2;
          }
        } else if next == 63 {
          self.enter(State::Declaration);
          self.pos += 2;
        } else if next == 47 {
          self.enter(State::CloseTag);
          self.pos += 2;
        } else if next == 62 || next == 60 || is_whitespace(next) {
          self.start_text();
          self.pos += 1;
          continue;
        } else {
          self.enter_open_tag();
          self.pos += 1;
        }
        return;
      }

      if code == 36 && is_whitespace(self.code(self.pos + 1)) && self.is_beginning_of_line() {
        self.end_text();
        self.enter(State::InlineScript {
          block: false,
          value: Span::default(),
        });
        self.pos += 2;
        return;
      }

      if code == 47 && is_whitespace(self.code_at(self.pos as isize - 1)) {
        match self.code(self.pos + 1) {
          47 => {
            self.end_text();
            self.enter(State::JsCommentLine);
            self.pos += 2;
            return;
          }
          42 => {
            self.end_text();
            self.enter(State::JsCommentBlock);
            self.pos += 2;
            return;
          }
          _ => {
            self.start_text();
            self.pos += 1;
            continue;
          }
        }
      }

      if (code == 36 || code == 92) && self.check_for_placeholder(code) {
        return;
      }

      self.start_text();
      self.pos += 1;
      while self.pos < self.max_pos && !is_special_html_content(self.data[self.pos]) {
        self.pos += 1;
      }
    }
  }

  fn is_beginning_of_line(&self) -> bool {
    let mut pos = self.pos;
    loop {
      if pos == 0 {
        return false;
      }
      pos -= 1;
      let code = self.code(pos);
      if !is_whitespace(code) {
        return false;
      }
      if code == 10 {
        return true;
      }
      if pos == 0 {
        return true;
      }
    }
  }

  fn check_for_cdata(&mut self) -> bool {
    if !self.looks_at(b"![CDATA[", self.pos + 1) {
      return false;
    }
    self.end_text();
    self.enter(State::Cdata);
    self.pos += 9;
    true
  }

  fn html_eof(&mut self) {
    let in_concise = self.active_open_tag().is_none_or(|tag| tag.concise);
    if in_concise {
      let position = self.pos;
      let mut current = self.pos;
      while current > 0 && is_line(self.code(current - 1)) {
        current -= 1;
      }
      self.pos = current;
      self.end_text();
      self.pos = position;
    } else {
      self.end_text();
    }

    while let Some(&tag) = self.active_open_tag() {
      if tag.concise {
        self.close_tag_end(self.pos);
      } else {
        self.emit_error(self.pos, "Missing ending tag");
        return;
      }
    }
  }

  // ---------------------------------------------------------------- PARSED_TEXT_CONTENT

  fn parse_parsed_text_content(&mut self, content: Content) {
    if self.pos == self.max_pos {
      self.html_eof();
      self.pos += 1;
      return;
    }

    while self.pos < self.max_pos {
      let code = self.code(self.pos);

      if is_line(code) {
        let length = self.newline_length(code);
        let depth = self.stack.len();
        let previous = self.pos;
        if self.handle_delimited_eol(length, content) {
          if self.stack.len() != depth {
            return;
          }
          if self.pos == previous {
            self.pos += length;
          }
          continue;
        }
        self.start_text();
        self.pos += length;
        continue;
      }

      match code {
        60 => {
          if self.is_concise || !self.check_for_closing_tag() {
            self.start_text();
            self.pos += 1;
            continue;
          }
          return;
        }
        47 => {
          self.start_text();
          match self.code(self.pos + 1) {
            42 => {
              self.enter(State::JsCommentBlock);
              self.pos += 2;
              return;
            }
            47 => {
              self.enter(State::JsCommentLine);
              self.pos += 2;
              return;
            }
            _ => {}
          }
          self.pos += 1;
          continue;
        }
        96 => {
          self.start_text();
          self.enter(State::TemplateString);
          self.pos += 1;
          return;
        }
        34 | 39 => {
          self.start_text();
          self.enter(State::ParsedString { quote: code as u8 });
          self.pos += 1;
          return;
        }
        _ => {
          if (code == 36 || code == 92) && self.check_for_placeholder(code) {
            return;
          }
          self.start_text();
          self.pos += 1;
          while self.pos < self.max_pos && !is_special_parsed_text(self.data[self.pos]) {
            self.pos += 1;
          }
          continue;
        }
      }
    }
  }

  fn check_for_closing_tag(&mut self) -> bool {
    let current = self.pos + 1;
    let mut matches = self.looks_at(b"/>", self.pos + 1);
    let mut skip = 3;

    if !matches {
      let Some(name) = self.active_open_tag().and_then(|tag| tag.name) else {
        return false;
      };
      let length = name.len();
      skip += length;
      matches = self.looks_at(b"/", current)
        && self.looks_at(b">", 1 + current + length)
        && self.span_text(name) == self.span_text(Span::new(1 + current, 1 + current + length));
    }

    if !matches {
      return false;
    }

    self.end_text();
    let start = self.pos;
    self.pos += skip;
    self.ensure_expected_close_tag(start, self.pos);
    self.exit();
    true
  }

  fn ensure_expected_close_tag(&mut self, start: usize, end: usize) -> bool {
    let Some(&tag) = self.active_open_tag() else {
      self.emit_error(start, "The closing tag was not expected");
      return false;
    };

    let name_start = start + 2;
    let name_end = end.saturating_sub(1);
    if name_start < name_end {
      let close_name = self.span_text(Span::new(name_start, name_end));
      let open_name = match tag.name {
        Some(name) if !name.is_empty() => self.span_text(name),
        _ => b"div".as_slice(),
      };
      let matches_shorthand = match tag.name {
        Some(name) if tag.shorthand_end >= 0 => {
          close_name == self.span_text(Span::new(name.start as usize, tag.shorthand_end as usize))
        }
        _ => false,
      };

      if close_name != open_name && !matches_shorthand {
        self.emit_error(
          start,
          "The closing tag does not match the corresponding opening tag",
        );
        return false;
      }
    }

    self.close_tag_end(end);
    true
  }

  // ---------------------------------------------------------------- simple states

  /// CDATA, comments, DTDs and close tags: up to the text that ends them.
  fn parse_until(&mut self, end: &[u8], length: usize) {
    let Some(index) = self.find(end, self.pos) else {
      let start = self.frame().start;
      self.emit_error(start, "EOF reached");
      return;
    };
    self.pos = index + length;

    let frame = *self.frame();
    self.exit();
    if matches!(frame.state, State::CloseTag) {
      self.ensure_expected_close_tag(frame.start, self.pos);
    }
  }

  fn parse_declaration(&mut self) {
    let Some(index) = self.find(b">", self.pos) else {
      let start = self.frame().start;
      self.emit_error(start, "EOF reached while parsing declaration");
      return;
    };

    // `>` or `?>`
    self.pos = index + 1;
    self.exit();
  }

  fn parse_js_comment_line(&mut self) {
    while self.pos < self.max_pos {
      let code = self.code(self.pos);
      if is_line(code) {
        self.exit();
        return;
      }
      let in_text_tag = self.active_open_tag().is_some_and(|tag| tag.kind == TEXT);
      if !self.is_concise && code == 60 && in_text_tag && self.check_for_closing_tag() {
        self.exit();
        return;
      }
      self.pos += 1;
    }
    self.exit();
  }

  fn parse_string(&mut self, quote: u8) {
    while self.pos < self.max_pos {
      let code = self.data[self.pos];
      if code == 92 {
        self.pos += 2;
      } else if code == quote {
        self.pos += 1;
        self.exit();
        return;
      } else {
        self.pos += 1;
      }
    }
    let start = self.frame().start;
    self.emit_error(start, "EOF reached while parsing string expression");
  }

  fn parse_template_string(&mut self) {
    while self.pos < self.max_pos {
      match self.data[self.pos] {
        36 => {
          if self.code(self.pos + 1) == 123 {
            self.pos += 2;
            self.enter_expression(Terminator::CloseCurlyBrace);
            return;
          }
          self.pos += 1;
        }
        92 => self.pos += 2,
        96 => {
          self.pos += 1;
          self.exit();
          return;
        }
        _ => self.pos += 1,
      }
    }
    let start = self.frame().start;
    self.emit_error(
      start,
      "EOF reached while parsing template string expression",
    );
  }

  fn parse_parsed_string(&mut self, quote: u8) {
    while self.pos < self.max_pos {
      let code = self.data[self.pos];
      if code == quote {
        self.start_text();
        self.pos += 1;
        self.exit();
        return;
      }
      if (code == 36 || code == 92) && self.check_for_placeholder(u32::from(code)) {
        return;
      }
      self.start_text();
      loop {
        self.pos += 1;
        if self.pos >= self.max_pos {
          break;
        }
        let next = self.data[self.pos];
        if next == quote || next == 36 || next == 92 {
          break;
        }
      }
    }
    let start = self.frame().start;
    self.emit_error(start, "EOF reached while parsing string expression");
  }

  fn parse_regular_expression(&mut self) {
    while self.pos < self.max_pos {
      match self.data[self.pos] {
        92 => {
          let escaped = self.code(self.pos + 1);
          if !is_line(escaped) {
            self.pos += 2;
            continue;
          }
          let start = self.frame().start;
          self.emit_error(start, "EOL reached while parsing regular expression");
          return;
        }
        10 | 13 => {
          let start = self.frame().start;
          self.emit_error(start, "EOL reached while parsing regular expression");
          return;
        }
        91 => {
          self.set_in_char_set(true);
          self.pos += 1;
        }
        93 => {
          self.set_in_char_set(false);
          self.pos += 1;
        }
        47 => {
          let in_char_set = matches!(
            self.frame().state,
            State::RegularExpression { in_char_set: true }
          );
          self.pos += 1;
          if !in_char_set {
            self.exit();
            return;
          }
        }
        _ => self.pos += 1,
      }
    }
    let start = self.frame().start;
    self.emit_error(start, "EOF reached while parsing regular expression");
  }

  fn set_in_char_set(&mut self, value: bool) {
    if let Some(State::RegularExpression { in_char_set }) = self.state_mut() {
      *in_char_set = value;
    }
  }

  // ---------------------------------------------------------------- INLINE_SCRIPT and placeholders

  fn parse_inline_script(&mut self) {
    self.consume_whitespace();
    if self.code(self.pos) == 123 {
      if let Some(State::InlineScript { block, .. }) = self.state_mut() {
        *block = true;
      }
      self.pos += 1;
      self.enter_expression(Terminator::CloseCurlyBrace);
    } else {
      self.enter_expression(Terminator::Never);
      self.prepare_scriptlet(self.pos);
    }
  }

  fn prepare_scriptlet(&mut self, mut pos: usize) {
    self.with_expression(|expression| {
      expression.operators = true;
      expression.terminated_by_eol = true;
    });

    while is_indent(self.code(pos)) {
      pos += 1;
    }

    for keyword in TYPE_KEYWORDS {
      if !self.looks_at(keyword, pos) {
        continue;
      }
      let mut name_pos = pos + keyword.len();
      if !is_indent(self.code(name_pos)) {
        return;
      }
      while is_indent(self.code(name_pos)) {
        name_pos += 1;
      }
      if self.starts_type_name(name_pos, keyword == b"type") {
        self.with_expression(|expression| {
          expression.in_type = true;
          expression.force_type = true;
        });
        self.pos = name_pos;
      }
      return;
    }
  }

  fn prepare_statement(&mut self, pos: usize) {
    self.with_expression(|expression| expression.consume_indented_content = true);
    self.prepare_scriptlet(pos);
  }

  fn starts_type_name(&self, pos: usize, allow_group: bool) -> bool {
    let code = self.code(pos);
    if code == 123 || code == 42 {
      return allow_group;
    }
    if !is_word(code) || (48..=57).contains(&code) {
      return false;
    }
    for keyword in BINARY_KEYWORDS {
      if self.looks_at(keyword, pos) && !is_word(self.code(pos + keyword.len())) {
        return false;
      }
    }
    true
  }

  fn check_for_placeholder(&mut self, code: u32) -> bool {
    let mut ahead = 0;
    let mut current = code;
    while current == 92 {
      ahead += 1;
      current = self.code(self.pos + ahead);
    }

    if current != 36 {
      return false;
    }

    let mut escape = true;
    current = self.code(self.pos + ahead + 1);
    if current == 33 {
      escape = false;
      current = self.code(self.pos + ahead + 2);
    }
    if current != 123 {
      return false;
    }

    if ahead > 0 {
      let remainder = ahead % 2;
      let extra = (ahead + remainder) / 2;
      if remainder > 0 {
        self.end_text();
        self.pos += extra;
        self.start_text();
        self.pos += ahead - extra + if escape { 2 } else { 3 };
        return true;
      }
      self.start_text();
      self.pos += extra;
      self.end_text();
      self.pos += extra;
    }

    self.end_text();
    self.enter(State::Placeholder { escape });
    self.pos += if escape { 2 } else { 3 };
    self.enter_expression(Terminator::CloseCurlyBrace);
    true
  }

  // ---------------------------------------------------------------- EXPRESSION

  fn group_count(&self, expression: &Expression) -> usize {
    self.groups.len() - expression.groups as usize
  }

  fn exit_expression(&mut self) {
    if let State::Expression(expression) = self.frame().state {
      self.groups.truncate(expression.groups as usize);
    }
    self.exit();
  }

  fn should_terminate(&self, expression: &Expression, start: usize, code: u32, pos: usize) -> bool {
    let next = || self.code(pos + 1);

    match expression.terminator {
      Terminator::Never => false,
      Terminator::HtmlAttrName => match code {
        44 | 61 | 40 | 62 | 60 => true,
        58 => next() == 61,
        47 => next() == 62,
        _ => false,
      },
      Terminator::HtmlAttrValue => match code {
        44 => true,
        47 => next() == 62,
        62 => {
          if pos == start {
            true
          } else if self.code_at(pos as isize - 1) == 61 {
            false
          } else {
            !(is_whitespace(self.code_at(pos as isize - 1)) && next() == 61)
          }
        }
        _ => false,
      },
      Terminator::ConciseAttrName => match code {
        44 | 61 | 40 | 59 | 60 => true,
        58 => next() == 61,
        45 => next() == 45 && is_whitespace(self.code_at(pos as isize - 1)),
        _ => false,
      },
      Terminator::ConciseAttrValue => match code {
        44 | 59 => true,
        45 => next() == 45 && is_whitespace(self.code_at(pos as isize - 1)),
        _ => false,
      },
      Terminator::ConciseGroupedAttrName => match code {
        44 | 61 | 40 | 93 | 60 => true,
        58 => next() == 61,
        _ => false,
      },
      Terminator::ConciseGroupedAttrValue => code == 44 || code == 93,
      Terminator::CloseParen => code == 41,
      Terminator::CloseAngleBracket => code == 62,
      Terminator::CloseCurlyBrace => code == 125,
      Terminator::Pipe => code == 124,
      Terminator::ConciseTagVar => match code {
        44 | 61 | 124 | 40 | 59 => true,
        60 => !expression.in_type,
        45 => next() == 45,
        58 => next() == 61,
        _ => false,
      },
      Terminator::HtmlTagVar => match code {
        124 | 44 | 61 | 40 | 62 => true,
        60 => !expression.in_type,
        58 => next() == 61,
        47 => next() == 62,
        _ => false,
      },
    }
  }

  fn parse_expression(&mut self) {
    let start = self.frame().start;

    while self.pos < self.max_pos {
      let code = u32::from(self.data[self.pos]);
      // Most of an expression is names.
      if is_word(code) {
        self.pos += 1;
        continue;
      }
      let State::Expression(expression) = self.frame().state else {
        return;
      };
      let groups = self.group_count(&expression);

      if is_line(code) {
        let length = self.newline_length(code);
        let previous = self.pos;
        if groups == 0
          && (expression.terminated_by_eol || expression.terminated_by_whitespace)
          && (expression.was_comment || !self.check_for_operators(true))
          && !(expression.consume_indented_content && is_indent(self.code(previous + length)))
        {
          self.exit_expression();
          return;
        }
        self.with_expression(|expression| expression.was_comment = false);
        if self.pos == previous {
          self.pos += length;
        }
        continue;
      }

      if groups == 0 {
        if expression.terminated_by_whitespace && is_whitespace(code) {
          if !self.check_for_operators(false) {
            self.exit_expression();
            return;
          }
          continue;
        }

        if self.should_terminate(&expression, start, code, self.pos) {
          let mut was_expression = false;
          if expression.operators {
            let previous = self.look_behind_while_whitespace(self.pos as isize - 1);
            if previous > start as isize {
              was_expression = self.look_behind_for_operator(&expression, start, previous) != -1;
            }
          }
          if !was_expression {
            self.exit_expression();
            return;
          }
        }
      }

      match code {
        34 | 39 => {
          self.enter(State::String { quote: code as u8 });
          self.pos += 1;
          return;
        }
        96 => {
          self.enter(State::TemplateString);
          self.pos += 1;
          return;
        }
        63 => {
          if expression.operators && groups == 0 {
            self.with_expression(|expression| expression.ternary_depth += 1);
            self.pos += 1;
            self.consume_whitespace();
            continue;
          }
          self.pos += 1;
        }
        58 => {
          if expression.operators && groups == 0 {
            self.with_expression(|expression| {
              if expression.ternary_depth > 0 {
                expression.ternary_depth -= 1;
              } else {
                expression.in_type = true;
              }
            });
            self.pos += 1;
            self.consume_whitespace();
            continue;
          }
          self.pos += 1;
        }
        61 => {
          if expression.operators {
            if self.code(self.pos + 1) == 62 {
              if expression.in_type
                && !expression.force_type
                && self.previous_non_whitespace() != 41
              {
                self.with_expression(|expression| expression.in_type = false);
              }
              self.pos += 1;
            } else if !(expression.force_type || groups > 0) {
              self.with_expression(|expression| expression.in_type = false);
            }
            self.pos += 1;
            self.consume_whitespace();
            continue;
          }
          self.pos += 1;
        }
        47 => match self.code(self.pos + 1) {
          47 => {
            self.enter(State::JsCommentLine);
            self.pos += 2;
            return;
          }
          42 => {
            self.enter(State::JsCommentBlock);
            self.pos += 2;
            return;
          }
          _ => {
            if can_follow_division(self.previous_non_whitespace()) {
              self.pos += 1;
              self.consume_whitespace();
              continue;
            }
            self.enter(State::RegularExpression { in_char_set: false });
            self.pos += 1;
            return;
          }
        },
        40 => {
          self.groups.push(41);
          self.pos += 1;
        }
        91 => {
          self.groups.push(93);
          self.pos += 1;
        }
        123 => {
          if expression.in_type && !expression.force_type {
            let previous = self.look_behind_while_whitespace(self.pos as isize - 1);
            if self.look_behind_for_operator(&expression, start, previous) == -1 {
              self.with_expression(|expression| expression.in_type = false);
            }
          }
          self.groups.push(125);
          self.pos += 1;
        }
        60 => {
          if expression.in_type {
            self.groups.push(62);
            self.pos += 1;
          } else if expression.operators && groups == 0 {
            self.pos += 1;
            self.consume_whitespace();
            continue;
          } else {
            self.pos += 1;
          }
        }
        41 | 93 | 125 | 62 => {
          if code == 62 && (!expression.in_type || self.code_at(self.pos as isize - 1) == 61) {
            self.pos += 1;
            continue;
          }
          if groups == 0 {
            self.emit_error(
              start,
              "Mismatched group. A closing character was found but it is not matched with a corresponding opening character.",
            );
            return;
          }
          let expected = self.groups.pop().map_or(EOF, u32::from);
          if expected != code {
            self.emit_error(start, "Mismatched group.");
            return;
          }
          self.pos += 1;
        }
        _ => self.pos += 1,
      }
    }

    let State::Expression(expression) = self.frame().state else {
      return;
    };
    if self.group_count(&expression) == 0 && (self.is_concise || expression.terminated_by_eol) {
      self.exit_expression();
      return;
    }

    self.emit_error(start, "EOF reached while parsing expression");
  }

  fn look_behind_while_whitespace(&self, pos: isize) -> isize {
    let mut index = pos;
    loop {
      if !is_whitespace(self.code_at(index)) {
        return index + 1;
      }
      if index <= 0 {
        return 0;
      }
      index -= 1;
    }
  }

  fn check_for_operators(&mut self, eol: bool) -> bool {
    let frame = *self.frame();
    let State::Expression(expression) = frame.state else {
      return false;
    };
    let start = frame.start;
    if !expression.operators {
      return false;
    }

    let pos = self.pos;
    if self.look_behind_for_operator(&expression, start, pos as isize) != -1 {
      self.consume_whitespace();
      return true;
    }

    let terminated_by_eol = expression.terminated_by_eol || self.is_concise;
    if !(terminated_by_eol && eol) {
      let mut next = pos + 1;
      while next < self.data.len() {
        let code = self.code(next);
        let skips = if terminated_by_eol {
          is_indent(code)
        } else {
          is_whitespace(code)
        };
        if !skips {
          break;
        }
        next += 1;
      }

      if self.code(next) == 60
        && ((!self.is_concise && self.code(next + 1) == 47) || self.looks_at(b"!--", next + 1))
      {
        return false;
      }

      if !self.should_terminate(&expression, start, self.code(next), next) {
        let ahead = self.look_ahead_for_operator(next);
        if ahead != -1 {
          self.pos = ahead as usize;
          return true;
        }
      }
    }

    false
  }

  fn look_behind_for_operator(&self, expression: &Expression, start: usize, pos: isize) -> isize {
    let current = pos - 1;
    let code = self.code_at(current);

    match code {
      38 | 42 | 94 | 58 | 61 | 60 | 37 | 124 | 63 | 126 => current,
      33 => {
        let mut operand_end = current - 1;
        while self.code_at(operand_end) == 33 {
          operand_end -= 1;
        }
        let operand = self.code_at(operand_end);
        match operand {
          41 | 93 | 34 | 39 | 96 => -1,
          _ => {
            if is_word(operand)
              && self.look_behind_for_operator(expression, start, operand_end + 1) == -1
              && self.look_behind_for_keyword(start, operand_end, &RELATIONAL_KEYWORDS) == -1
            {
              -1
            } else {
              current
            }
          }
        }
      }
      62 => {
        if self.code_at(current - 1) == 61 {
          current - 1
        } else if expression.in_type {
          -1
        } else {
          current
        }
      }
      46 => {
        let mut next = pos.max(0) as usize;
        while next < self.data.len() && is_whitespace(self.code(next)) {
          next += 1;
        }
        if is_word(self.code(next)) {
          next as isize
        } else {
          -1
        }
      }
      43 | 45 => {
        if self.code_at(current - 1) == code {
          let behind = self.look_behind_while_whitespace(current - 2);
          self.look_behind_for_operator(expression, start, behind)
        } else {
          current
        }
      }
      _ => {
        if code == EOF || !(97..=122).contains(&code) {
          -1
        } else if expression.in_type {
          self.look_behind_for_keyword(start, current, &TS_UNARY_KEYWORDS)
        } else {
          self.look_behind_for_keyword(start, current, &UNARY_KEYWORDS)
        }
      }
    }
  }

  fn look_behind_for_keyword(&self, start: usize, pos: isize, keywords: &[&[u8]]) -> isize {
    for keyword in keywords {
      let keyword_pos = pos - keyword.len() as isize + 1;
      if keyword_pos < 0 {
        continue;
      }
      let at = keyword_pos as usize;
      if at + keyword.len() > self.data.len() || &self.data[at..at + keyword.len()] != *keyword {
        continue;
      }

      let is_part_of_word =
        keyword_pos > start as isize && is_word_or_period(self.code_at(keyword_pos - 1));
      return if keyword_pos < start as isize || is_part_of_word {
        -1
      } else {
        keyword_pos
      };
    }
    -1
  }

  fn look_ahead_for_operator(&mut self, pos: usize) -> isize {
    match self.code(pos) {
      38 | 42 | 94 | 33 | 60 | 37 | 124 | 126 | 43 | 45 => pos as isize + 1,
      47 | 123 | 40 | 62 | 63 | 58 | 61 => pos as isize,
      46 => {
        let mut next = pos + 1;
        while next < self.data.len() && is_whitespace(self.code(next)) {
          next += 1;
        }
        if is_word(self.code(next)) {
          next as isize
        } else {
          -1
        }
      }
      code => {
        if !(97..=122).contains(&code) {
          return -1;
        }
        for keyword in BINARY_KEYWORDS {
          let end = pos + keyword.len();
          if end > self.data.len() || &self.data[pos..end] != keyword {
            continue;
          }
          let keyword_end = end - 1;
          if !is_whitespace(self.code(keyword_end + 1)) {
            break;
          }
          let mut next = keyword_end + 2;
          while next < self.data.len() && is_whitespace(self.code(next)) {
            next += 1;
          }
          if next == self.data.len() {
            break;
          }
          match self.code(next) {
            58 | 44 | 61 | 47 | 62 | 59 => break,
            _ => {
              let is_type_operator = keyword == b"as" || keyword == b"satisfies";
              let groups = self.groups.len();
              self.with_expression(|expression| {
                if !expression.in_type && is_type_operator {
                  expression.in_type = true;
                  let has_groups = groups > expression.groups as usize;
                  if expression.ternary_depth == 0 && !has_groups {
                    expression.force_type = true;
                  }
                }
              });
              return next as isize;
            }
          }
        }
        -1
      }
    }
  }

  // ---------------------------------------------------------------- OPEN_TAG

  fn parse_open_tag(&mut self, tag: u32) {
    while self.pos < self.max_pos {
      let code = self.code(self.pos);

      if is_line(code) {
        let length = self.newline_length(code);
        if self.is_concise && self.open_tag(tag).stage != STAGE_ATTR_GROUP {
          let mut current = self.pos;
          while current < self.max_pos {
            let peek = self.code(current);
            if is_whitespace(peek) {
              current += 1;
            } else if peek == 47 && self.code(current + 1) == 47 {
              current += 2;
              while current < self.max_pos && !is_line(self.code(current)) {
                current += 1;
              }
            } else if peek == 47 && self.code(current + 1) == 42 {
              match self.find(b"*/", current + 2) {
                Some(end) => current = end + 2,
                None => break,
              }
            } else {
              break;
            }
          }
          if self.code(current) == 44 {
            self.pos += length;
            continue;
          }
          self.exit();
          return;
        }
        self.pos += length;
        continue;
      }

      if self.is_concise {
        if code == 59 {
          self.pos += 1;
          self.exit();
          self.end_concise_line();
          return;
        }
        if code == 45 {
          if self.code(self.pos + 1) != 45 {
            if self.open_tag(tag).name.is_none() && is_word(self.code(self.pos + 1)) {
              self.enter(State::TagName { shorthand: 0 });
              return;
            }
            let start = self.frame().start;
            self.emit_error(
              start,
              "\"-\" not allowed as first character of attribute name",
            );
            return;
          }
          if self.open_tag(tag).stage == STAGE_ATTR_GROUP {
            self.emit_error(self.pos, "Attribute group was not properly ended");
            return;
          }
          self.exit();
          let mut current = self.pos + 1;
          loop {
            if current >= self.max_pos {
              break;
            }
            current += 1;
            if self.code(current) == 10 {
              break;
            }
          }
          current += 1;
          let indent_start = current;
          while current < self.max_pos && is_indent(self.code(current)) {
            current += 1;
          }
          if current - indent_start > self.indent.len() {
            self.indent = Span::new(indent_start, current.min(self.data.len()));
          }
          let indent = self.indent;
          self.enter(State::BeginDelimitedHtmlBlock {
            indent,
            delimiter: 0,
          });
          return;
        } else if code == 91 {
          if self.open_tag(tag).stage == STAGE_ATTR_GROUP {
            self.emit_error(self.pos, "Unexpected \"[\" character within open tag.");
            return;
          }
          if self.open_tag(tag).name.is_none() {
            self.enter(State::TagName { shorthand: 0 });
            return;
          }
          self.open_tag_mut(tag).stage = STAGE_ATTR_GROUP;
          self.pos += 1;
          continue;
        } else if code == 93 {
          if self.open_tag(tag).stage != STAGE_ATTR_GROUP {
            self.emit_error(self.pos, "Unexpected \"]\" character within open tag.");
            return;
          }
          self.open_tag_mut(tag).stage = 0;
          self.pos += 1;
          continue;
        }
      } else if code == 62 {
        self.pos += 1;
        self.exit();
        return;
      } else if code == 47 && self.code(self.pos + 1) == 62 {
        self.open_tag_mut(tag).self_closed = true;
        self.pos += 2;
        self.exit();
        return;
      }

      if code == 47 {
        match self.code(self.pos + 1) {
          47 => {
            self.enter(State::JsCommentLine);
            self.pos += 2;
            return;
          }
          42 => {
            self.enter(State::JsCommentBlock);
            self.pos += 2;
            return;
          }
          _ => {}
        }
      } else if code == 60 && self.looks_at(b"!--", self.pos + 1) {
        self.emit_error(
          self.pos,
          "An html comment cannot be used within an open tag. Use a JavaScript comment (// or /* */) instead.",
        );
        return;
      }

      if is_whitespace(code) {
        self.pos += 1;
        continue;
      }
      if code == 44 {
        self.pos += 1;
        self.consume_whitespace();
        continue;
      }
      if self.open_tag(tag).has_attrs {
        self.enter_attribute();
        return;
      }
      if self.open_tag(tag).name.is_some() {
        match code {
          47 => {
            self.open_tag_mut(tag).stage = STAGE_VAR;
            self.pos += 1;
            if is_whitespace(self.code(self.pos)) {
              self.emit_error(
                self.pos,
                "A slash was found that was not followed by a variable name or lhs expression",
              );
              return;
            }
            let terminator = if self.is_concise {
              Terminator::ConciseTagVar
            } else {
              Terminator::HtmlTagVar
            };
            self.enter_expression(terminator);
            self.with_expression(|expression| {
              expression.operators = true;
              expression.terminated_by_whitespace = true;
            });
            return;
          }
          40 => {
            if self.open_tag(tag).has_args {
              self.emit_error(self.pos, "A tag can only have one argument");
              return;
            }
            let open = self.open_tag_mut(tag);
            open.has_args = true;
            open.stage = STAGE_ARGS;
            self.pos += 1;
            self.enter_expression(Terminator::CloseParen);
            return;
          }
          124 => {
            if self.open_tag(tag).has_params {
              self.emit_error(self.pos, "A tag can only specify parameters once");
              return;
            }
            let open = self.open_tag_mut(tag);
            open.has_params = true;
            open.stage = STAGE_PARAMS;
            self.pos += 1;
            self.enter_expression(Terminator::Pipe);
            return;
          }
          60 => {
            self.open_tag_mut(tag).stage = STAGE_TYPES;
            self.pos += 1;
            self.enter_expression(Terminator::CloseAngleBracket);
            self.with_expression(|expression| {
              expression.in_type = true;
              expression.force_type = true;
            });
            return;
          }
          _ => {
            self.open_tag_mut(tag).has_attrs = true;
            self.enter_attribute();
            return;
          }
        }
      }

      self.enter(State::TagName { shorthand: 0 });
      return;
    }

    if self.is_concise {
      if self.open_tag(tag).stage == STAGE_ATTR_GROUP {
        let start = self.frame().start;
        self.emit_error(
          start,
          "EOF reached while within an attribute group (e.g. \"[ ... ]\").",
        );
        return;
      }
      self.exit();
    } else {
      let start = self.frame().start;
      self.emit_error(start, "EOF reached while parsing open tag");
    }
  }

  fn exit_open_tag(&mut self, tag: u32) {
    let self_closed = self.open_tag(tag).self_closed;
    let end_length = if self.is_concise {
      0
    } else if self_closed {
      2
    } else {
      1
    };
    let start = self.pos.saturating_sub(end_length);

    if self.open_tag(tag).name.is_none() {
      let name = Span::new(start, start);
      self.open_tag_mut(tag).name = Some(name);
      let kind = self.on_open_tag_name(name, start);
      if kind != HTML {
        self.open_tag_mut(tag).kind = kind;
      }
    }

    self.on_open_tag_end(self_closed);

    let open = *self.open_tag(tag);
    let kind = if self_closed { VOID } else { open.kind };
    match kind {
      VOID | STATEMENT => {
        if open.begin_mixed_mode {
          self.ending_mixed_mode_at_eol = true;
        }
        self.active_tag = open.parent;
      }
      TEXT => {
        if self.is_concise {
          self.enter(State::ConciseHtmlContent);
        } else {
          let content = Content {
            indent: Span::default(),
            single_line: false,
            delimiter: 0,
          };
          self.enter(State::ParsedTextContent(content));
        }
      }
      _ => {}
    }
  }

  fn return_to_open_tag(&mut self, tag: u32, child: Frame) {
    if !matches!(child.state, State::Expression(_)) {
      return;
    }

    match self.open_tag(tag).stage {
      STAGE_VAR => {
        if child.start == child.end {
          self.emit_error(
            child.start,
            "A slash was found that was not followed by a variable name or lhs expression",
          );
          return;
        }
        self.on_tag_var(Span::new(child.start, child.end));
      }
      STAGE_ARGS => {
        let start = child.start - 1;
        self.pos += 1;
        let end = self.pos;
        let value = Span::new(child.start, child.end);
        if self.consume_whitespace_if_before(b"{") {
          let type_params = self.open_tag(tag).type_params;
          self.enter_attribute();
          self.with_attribute(|attribute| {
            attribute.args = Args::Method(Span::new(start, end));
            attribute.type_params = type_params.map(|(span, _)| span);
          });
          let attribute_start = type_params.map_or(start, |(span, _)| span.start as usize);
          if let Some(frame) = self.stack.last_mut() {
            frame.start = attribute_start;
          }
          self.open_tag_mut(tag).has_attrs = true;
        } else {
          if self.open_tag(tag).type_params.is_some() {
            self.emit_error(child.start, "Unexpected types.");
            return;
          }
          self.on_tag_args(value);
        }
      }
      STAGE_TYPES => {
        let open = *self.open_tag(tag);
        self.pos += 1;
        let end = self.pos;
        let types = Span::new(child.start - 1, end);
        let value = Span::new(child.start, child.end);
        if open.name.is_some_and(|name| name.end == types.start) {
          return;
        }
        self.consume_whitespace();
        let next = self.code(self.pos);
        if next == 124 && !open.has_params {
          // Type parameters of the tag's parameters: types only.
        } else if next == 40 && !(open.type_params.is_some() || open.has_params || open.has_args) {
          self.open_tag_mut(tag).type_params = Some((types, value));
        } else {
          self.emit_error(child.start, "Unexpected types.");
        }
      }
      STAGE_PARAMS => {
        self.pos += 1;
        self.on_tag_params(Span::new(child.start, child.end));
      }
      _ => {}
    }
  }

  // ---------------------------------------------------------------- TAG_NAME

  fn parse_tag_name(&mut self) {
    while self.pos < self.max_pos {
      let code = self.code(self.pos);

      if is_line(code) {
        self.set_shorthand_end();
        self.exit();
        return;
      }

      if code == 36 && self.code(self.pos + 1) == 123 {
        self.pos += 2;
        self.enter_expression(Terminator::CloseCurlyBrace);
        return;
      }

      let ends = is_whitespace(code)
        || code == 61
        || (code == 58 && self.code(self.pos + 1) == 61)
        || code == 40
        || code == 47
        || code == 124
        || code == 60
        || code == 44
        || if self.is_concise {
          code == 59 || code == 91
        } else {
          code == 62
        };
      if ends {
        self.set_shorthand_end();
        self.exit();
        return;
      }

      if code == 46 || code == 35 {
        self.exit();
        self.enter(State::TagName {
          shorthand: code as u8,
        });
        self.pos += 1;
        // The shorthand's text starts after its `.` or `#`.
        return;
      }

      self.pos += 1;
    }
    self.exit();
  }

  fn set_shorthand_end(&mut self) {
    let pos = self.pos as isize;
    if let Some(tag) = self.open_tags.get_mut(self.active_tag as usize) {
      tag.shorthand_end = pos;
    }
  }

  fn exit_tag_name(&mut self, frame: &Frame, shorthand: u8) {
    let span = Span::new(frame.start, frame.end);

    match shorthand {
      35 => {
        let tag = self.active_tag;
        if self
          .open_tags
          .get(tag as usize)
          .is_some_and(|tag| tag.has_shorthand_id)
        {
          self.emit_error(
            frame.start,
            "Multiple shorthand ID parts are not allowed on the same tag",
          );
          return;
        }
        if let Some(tag) = self.open_tags.get_mut(tag as usize) {
          tag.has_shorthand_id = true;
        }
        self.on_shorthand();
      }
      46 => self.on_shorthand(),
      _ => {
        let tag = self.active_tag;
        let kind = self.on_open_tag_name(span, frame.end);
        let Some(open) = self.open_tags.get_mut(tag as usize) else {
          return;
        };
        open.name = Some(span);
        if kind != HTML {
          open.kind = kind;
        }
        if kind == STATEMENT {
          let open = *open;
          if !open.concise {
            self.emit_error(
              frame.start,
              "The tag is reserved and cannot be used as an HTML tag.",
            );
            return;
          }
          if open.parent != NONE {
            self.emit_error(
              frame.start,
              "The tag can only be used at the root of the template.",
            );
            return;
          }
          self.enter_expression(Terminator::Never);
          self.prepare_statement(self.pos + 1);
        }
      }
    }
  }

  // ---------------------------------------------------------------- ATTRIBUTE

  fn enter_attribute(&mut self) {
    let attribute = Attribute {
      stage: ATTR_UNKNOWN,
      name: None,
      args: Args::None,
      type_params: None,
      bound: false,
      spread: false,
      pending_async: None,
      async_method: None,
      value_start: self.pos,
    };
    self.enter(State::Attribute(attribute));
  }

  fn parse_attribute(&mut self) {
    while self.pos < self.max_pos {
      let code = self.code(self.pos);
      let State::Attribute(attribute) = self.frame().state else {
        return;
      };

      if is_line(code) {
        if self.is_concise {
          self.exit();
          return;
        }
        self.pos += self.newline_length(code);
        continue;
      }

      if is_whitespace(code) {
        self.pos += 1;
        continue;
      }

      if code == 60 && self.looks_at(b"!--", self.pos + 1) {
        self.exit();
        return;
      }

      if code == 61
        || (code == 58 && self.code(self.pos + 1) == 61)
        || (code == 46 && self.looks_at(b"..", self.pos + 1))
      {
        let value_start = self.pos;
        self.with_attribute(|attribute| attribute.value_start = value_start);
        self.flush_pending_async_of_active();
        if code == 58 {
          self.ensure_attr_name();
          self.with_attribute(|attribute| attribute.bound = true);
          self.pos += 2;
          self.consume_whitespace();
        } else if code == 46 {
          self.with_attribute(|attribute| attribute.spread = true);
          self.pos += 3;
        } else {
          self.ensure_attr_name();
          self.pos += 1;
          self.consume_whitespace();
        }
        self.with_attribute(|attribute| attribute.stage = ATTR_VALUE);

        let terminator = if self.is_concise {
          let in_group = self
            .active_open_tag()
            .is_some_and(|tag| tag.stage == STAGE_ATTR_GROUP);
          if in_group {
            Terminator::ConciseGroupedAttrValue
          } else {
            Terminator::ConciseAttrValue
          }
        } else {
          Terminator::HtmlAttrValue
        };
        self.enter_expression(terminator);
        self.with_expression(|expression| {
          expression.operators = true;
          expression.terminated_by_whitespace = true;
        });
        return;
      }

      if code == 40 {
        if attribute.pending_async.is_none() {
          self.ensure_attr_name();
        }
        self.with_attribute(|attribute| attribute.stage = ATTR_ARGS);
        self.pos += 1;
        self.enter_expression(Terminator::CloseParen);
        return;
      }

      if code == 60 && (attribute.stage == ATTR_NAME || attribute.pending_async.is_some()) {
        self.with_attribute(|attribute| attribute.stage = ATTR_TYPE_PARAMS);
        self.pos += 1;
        self.enter_expression(Terminator::CloseAngleBracket);
        self.with_expression(|expression| {
          expression.in_type = true;
          expression.force_type = true;
        });
        return;
      }

      if code == 123 && attribute.args != Args::None {
        self.ensure_attr_name();
        self.with_attribute(|attribute| attribute.stage = ATTR_BLOCK);
        self.pos += 1;
        self.enter_expression(Terminator::CloseCurlyBrace);
        return;
      }

      if attribute.stage == ATTR_UNKNOWN {
        if code == 60 {
          if self.code(self.pos + 1) == 47 {
            self.emit_error(
              self.pos,
              "A close tag was found before the open tag was closed.",
            );
          } else {
            self.emit_error(
              self.pos,
              "Invalid attribute name. Attribute name cannot begin with the \"<\" character.",
            );
          }
          return;
        }
        self.with_attribute(|attribute| attribute.stage = ATTR_NAME);
        let terminator = if self.is_concise {
          let in_group = self
            .active_open_tag()
            .is_some_and(|tag| tag.stage == STAGE_ATTR_GROUP);
          if in_group {
            Terminator::ConciseGroupedAttrName
          } else {
            Terminator::ConciseAttrName
          }
        } else {
          Terminator::HtmlAttrName
        };
        self.enter_expression(terminator);
        self.with_expression(|expression| expression.terminated_by_whitespace = true);
        return;
      }

      self.flush_pending_async_of_active();
      self.exit();
      return;
    }

    self.flush_pending_async_of_active();
    if self.is_concise {
      self.exit();
    } else {
      let start = self.frame().start;
      self.emit_error(start, "EOF reached while parsing attribute");
    }
  }

  fn return_to_attribute(&mut self, child: Frame) {
    let State::Attribute(attribute) = self.frame().state else {
      return;
    };
    let child_span = Span::new(child.start, child.end);

    match attribute.stage {
      ATTR_NAME => {
        if attribute.pending_async.is_none()
          && attribute.name.is_none()
          && self.is_async_method_prefix(child_span)
        {
          self.with_attribute(|attribute| {
            attribute.pending_async = Some(child_span);
            attribute.stage = ATTR_UNKNOWN;
          });
          return;
        }
        self.with_attribute(|attribute| attribute.name = Some(child_span));
        if attribute.pending_async.is_none() {
          self.on_attr_name(child_span);
        }
        if !self.is_concise {
          self.detect_ambiguous_close_angle_bracket(child);
        }
      }
      ATTR_ARGS => {
        if attribute.args != Args::None {
          self.emit_error(
            child.start,
            "An attribute can only have one set of arguments",
          );
          return;
        }
        let start = child.start - 1;
        self.pos += 1;
        let end = self.pos;
        if self.consume_whitespace_if_before(b"{") {
          if let Some(pending) = attribute.pending_async {
            if let Some(name) = attribute.name {
              self.on_attr_name(name);
            }
            self.with_attribute(|attribute| {
              attribute.async_method = Some(pending);
              attribute.pending_async = None;
            });
          }
          self.with_attribute(|attribute| attribute.args = Args::Method(Span::new(start, end)));
        } else if attribute.type_params.is_some() {
          self.flush_pending_async_of_active();
          self.emit_error(
            child.start,
            "An attribute cannot have both type parameters and arguments",
          );
        } else {
          self.flush_pending_async_of_active();
          self.with_attribute(|attribute| attribute.args = Args::Reported);
          self.on_attr_args(child_span);
        }
      }
      ATTR_BLOCK => {
        let Args::Method(params) = attribute.args else {
          return;
        };
        self.pos += 1;
        let end = self.pos;
        let body = Span::new(child.start - 1, end);
        let is_async = attribute.async_method.is_some();
        let type_params = attribute.type_params;
        self.on_attr_method(is_async, type_params, params, body);
        self.exit();
      }
      ATTR_TYPE_PARAMS => {
        let start = child.start - 1;
        self.pos += 1;
        let end = self.pos;
        if !self.consume_whitespace_if_before(b"(") {
          self.flush_pending_async_of_active();
          self.emit_error(
            child.start,
            "Attribute cannot contain type parameters unless it is a shorthand method",
          );
          return;
        }
        self.with_attribute(|attribute| attribute.type_params = Some(Span::new(start, end)));
      }
      ATTR_VALUE => {
        if child.start == child.end {
          self.emit_error(child.start, "Missing value for attribute");
          return;
        }
        if !self.is_concise && self.detect_ambiguous_close_angle_bracket(child) {
          return;
        }
        if attribute.spread {
          self.on_attr_spread(child_span);
        } else {
          self.on_attr_value(child_span);
        }
        self.exit();
      }
      _ => {}
    }
  }

  fn is_async_method_prefix(&self, name: Span) -> bool {
    if name.len() != 5 || self.span_text(name) != b"async" {
      return false;
    }

    let mut pos = self.pos;
    loop {
      let code = self.code(pos);
      let skips = if self.is_concise {
        is_indent(code)
      } else {
        is_whitespace(code)
      };
      if !skips {
        break;
      }
      pos += 1;
    }
    let code = self.code(pos);
    is_word(code) || code == 40 || (code == 60 && self.code(pos + 1) != 47)
  }

  fn flush_pending_async_of_active(&mut self) {
    let State::Attribute(attribute) = self.frame().state else {
      return;
    };
    self.flush_pending_async(&attribute);
    self.with_attribute(|attribute| attribute.pending_async = None);
  }

  fn flush_pending_async(&mut self, attribute: &Attribute) {
    let Some(pending) = attribute.pending_async else {
      return;
    };
    self.on_attr_name(pending);
    if let Some(name) = attribute.name {
      self.on_attr_name(name);
    }
  }

  fn ensure_attr_name(&mut self) {
    let frame = *self.frame();
    let State::Attribute(attribute) = frame.state else {
      return;
    };
    let (name, start) = (attribute.name, frame.start);
    if name.is_none() {
      self.on_attr_name(Span::new(start, start));
    }
  }

  fn detect_ambiguous_close_angle_bracket(&mut self, child: Frame) -> bool {
    let mut pos = self.pos;
    if !is_indent(self.code(pos)) {
      return false;
    }
    loop {
      pos += 1;
      if !is_indent(self.code(pos)) {
        break;
      }
    }
    if self.code(pos) != 62 {
      return false;
    }

    let mut saw_operand = false;
    let mut operator_pending = false;
    let mut group_depth = 0u32;
    let mut look = pos + 1;

    while look < self.max_pos {
      let code = self.code(look);
      if code == 62 && (group_depth > 0 || self.code(look + 1) == 61) {
        if self.code(look + 1) == 61 {
          look += 1;
        }
        operator_pending = false;
        look += 1;
        continue;
      }
      if group_depth == 0 && (code == 62 || (code == 47 && self.code(look + 1) == 62)) {
        let mut expression_end = look;
        while is_indent(self.code(expression_end - 1)) {
          expression_end -= 1;
        }
        if saw_operand && is_operand_end(self.code(expression_end - 1)) {
          self.emit_error(child.start, "Ambiguous \">\" in attribute.");
          return true;
        }
        return false;
      }
      if is_word(code) {
        if operator_pending {
          return false;
        }
        saw_operand = true;
        look += 1;
        continue;
      }
      if is_indent(code) {
        if saw_operand && is_operand_end(self.code(look - 1)) {
          operator_pending = true;
        }
        look += 1;
        continue;
      }
      match code {
        61 => {
          if self.code(look + 1) != 62 {
            return false;
          }
          look += 1;
          operator_pending = false;
        }
        47 => {
          let mut previous = look - 1;
          while is_indent(self.code(previous)) {
            previous -= 1;
          }
          if !is_operand_end(self.code(previous)) {
            return false;
          }
          operator_pending = false;
        }
        40 | 91 => {
          group_depth += 1;
          operator_pending = false;
        }
        41 | 93 => {
          if group_depth == 0 {
            return false;
          }
          group_depth -= 1;
          operator_pending = false;
        }
        38 | 42 | 94 | 58 | 33 | 45 | 37 | 46 | 124 | 43 | 63 | 126 => operator_pending = false,
        _ => return false,
      }
      look += 1;
    }
    false
  }

  // ---------------------------------------------------------------- the tree

  fn push_child(&mut self, kind: ChildKind) {
    let index = self.tree.children.len() as u32;
    self.tree.children.push(Child { kind, next: NONE });

    let parent = self.parent_node;
    let last = if parent == NONE {
      let last = self.tree.last_child;
      if last == NONE {
        self.tree.first_child = index;
      }
      self.tree.last_child = index;
      last
    } else {
      let tag = &mut self.tree.tags[parent as usize];
      let last = tag.last_child;
      if last == NONE {
        tag.first_child = index;
      }
      tag.last_child = index;
      if !matches!(kind, ChildKind::Text(_)) {
        tag.only_text = false;
      }
      last
    };

    if last != NONE {
      self.tree.children[last as usize].next = index;
    }
  }

  fn on_text(&mut self, span: Span) {
    // Only a tag's text is read, and only to know whether it is all text, as a `<script>`'s code.
    if self.parent_node != NONE {
      self.push_child(ChildKind::Text(span));
    }
  }

  fn on_placeholder(&mut self, value: Span) {
    self.push_child(ChildKind::Placeholder(value));
  }

  fn on_scriptlet(&mut self, value: Span) {
    self.push_child(ChildKind::Scriptlet(value));
  }

  /// Returns the tag's body type.
  fn on_open_tag_name(&mut self, span: Span, _end: usize) -> u8 {
    let expressions = std::mem::take(&mut self.name_expressions);
    let name = self.span_text(span);
    let mut body_type = HTML;
    let mut is_attr_tag = false;

    if expressions.is_empty() {
      let statement = match name {
        b"style" => {
          if self.matches_style_block(span.end as usize) {
            Some(StaticKind::Style)
          } else {
            body_type = TEXT;
            None
          }
        }
        b"class" => Some(StaticKind::Class),
        b"export" => Some(StaticKind::Export),
        b"import" => Some(StaticKind::Import),
        b"server" | b"client" | b"static" => Some(StaticKind::Static),
        b"area" | b"base" | b"br" | b"col" | b"embed" | b"hr" | b"img" | b"input" | b"link"
        | b"meta" | b"param" | b"source" | b"track" | b"wbr" | b"const" | b"debug" | b"id"
        | b"let" | b"lifecycle" | b"log" | b"return" => {
          body_type = VOID;
          None
        }
        b"html-comment" | b"html-script" | b"html-style" | b"script" | b"textarea" => {
          body_type = TEXT;
          None
        }
        _ => {
          is_attr_tag = name.first() == Some(&b'@');
          None
        }
      };

      if let Some(kind) = statement {
        // Unfinished until its open tag ends.
        self.tree.statics.push(Static {
          kind,
          span: Span::new(span.start as usize, self.data.len()),
        });
        self.is_static_open = true;
        return STATEMENT;
      }
    }

    let name_expressions = expressions.len() as u32;

    let name_text = if name_expressions > 0 {
      None
    } else if is_attr_tag {
      Some(Span {
        start: span.start + 1,
        end: span.end,
      })
    } else {
      Some(span)
    };

    let tag = Tag {
      parent: self.parent_node,
      name: span,
      name_text,
      is_attr_tag,
      expressions,
      name_expressions,
      var: None,
      args: None,
      params: None,
      first_attr: NONE,
      last_attr: NONE,
      first_child: NONE,
      last_child: NONE,
      only_text: true,
    };
    let index = self.tree.tags.len() as u32;
    self.tree.tags.push(tag);
    self.push_child(ChildKind::Tag(index));
    self.parent_node = index;
    self.attr_node = None;

    body_type
  }

  /// `style {` and `style.less {`: a block of styles, rather than a `<style>` tag.
  fn matches_style_block(&self, mut pos: usize) -> bool {
    let forbidden = |code: u32| {
      is_whitespace(code) || matches!(code, 92 | 47 | 58 | 42 | 63 | 34 | 60 | 62 | 124 | 40 | 123)
    };
    while self.code(pos) == 46 {
      let mut end = pos + 1;
      while end < self.data.len() && !forbidden(self.code(end)) {
        end += 1;
      }
      if end == pos + 1 {
        return false;
      }
      pos = end;
    }
    while matches!(self.code(pos), 9..=13 | 32) {
      pos += 1;
    }
    self.code(pos) == 123
  }

  fn on_shorthand(&mut self) {
    let expressions = std::mem::take(&mut self.name_expressions);
    if self.is_static_open {
      return;
    }
    if let Some(tag) = self.tree.tags.get_mut(self.parent_node as usize) {
      tag.expressions.extend(expressions);
    }
  }

  fn current_tag(&mut self) -> Option<&mut Tag> {
    if self.is_static_open {
      return None;
    }
    self.tree.tags.get_mut(self.parent_node as usize)
  }

  fn on_tag_var(&mut self, value: Span) {
    if let Some(tag) = self.current_tag() {
      tag.var = Some(value);
    }
  }

  fn on_tag_args(&mut self, value: Span) {
    if let Some(tag) = self.current_tag() {
      tag.args = Some(value);
    }
  }

  fn on_tag_params(&mut self, value: Span) {
    if let Some(tag) = self.current_tag() {
      tag.params = Some(value);
    }
  }

  fn push_attr(&mut self, attr: Attr) {
    if self.current_tag().is_none() {
      return;
    }
    let index = self.tree.attrs.len() as u32;
    self.tree.attrs.push((attr, NONE));
    let tag = &mut self.tree.tags[self.parent_node as usize];
    let last = tag.last_attr;
    if last == NONE {
      tag.first_attr = index;
    }
    tag.last_attr = index;
    if let Some((_, next)) = self.tree.attrs.get_mut(last as usize) {
      *next = index;
    }
  }

  fn on_attr_name(&mut self, name: Span) {
    self.push_attr(Attr::Named {
      name,
      args: None,
      value: AttrValue::None,
    });
    if self.current_tag().is_some() {
      self.attr_node = Some(self.tree.attrs.len() - 1);
    }
  }

  fn named_attr(&mut self) -> Option<&mut Attr> {
    let index = self.attr_node?;
    self.tree.attrs.get_mut(index).map(|(attr, _)| attr)
  }

  fn on_attr_args(&mut self, value: Span) {
    if let Some(Attr::Named { args, .. }) = self.named_attr() {
      *args = Some(value);
    }
  }

  fn on_attr_value(&mut self, expression: Span) {
    if let Some(Attr::Named { value, .. }) = self.named_attr() {
      *value = AttrValue::Expression(expression);
    }
  }

  fn on_attr_method(
    &mut self,
    is_async: bool,
    type_params: Option<Span>,
    params: Span,
    body: Span,
  ) {
    if let Some(Attr::Named { value, .. }) = self.named_attr() {
      *value = AttrValue::Method {
        is_async,
        type_params,
        params,
        body,
      };
    }
  }

  fn on_attr_spread(&mut self, value: Span) {
    self.push_attr(Attr::Spread(value));
  }

  fn on_open_tag_end(&mut self, self_closed: bool) {
    if self.is_static_open {
      let end = self.pos.min(self.data.len()) as u32;
      if let Some(statement) = self.tree.statics.last_mut() {
        statement.span.end = end;
      }
      self.is_static_open = false;
      return;
    }

    self.attr_node = None;
    let Some(tag) = self.tree.tags.get(self.parent_node as usize) else {
      return;
    };
    let is_void = self
      .open_tags
      .get(self.active_tag as usize)
      .is_some_and(|open| open.kind == VOID);
    if self_closed || is_void {
      self.parent_node = tag.parent;
    }
  }

  fn on_close_tag_end(&mut self, _end: usize) {
    if let Some(tag) = self.tree.tags.get(self.parent_node as usize) {
      self.parent_node = tag.parent;
    }
  }
}
