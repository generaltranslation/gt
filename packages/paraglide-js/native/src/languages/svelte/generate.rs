//! Reads a component in one pass, as Svelte 5's parser does in its loose mode (the mode editors and
//! the JavaScript tooling used), and writes it as one TypeScript module:
//!
//! - each `<script>` copied where it is, at the top level of the module;
//! - each template expression copied as a statement, `(m.greeting());`, or where its construct
//!   needs it: `if (…) {`, `for (const item of …) {`, `const t = …;`, a component's props;
//! - blocks that declare names as blocks of code that declare them, so that they shadow what they
//!   shadow in Svelte: `{#each}`'s aliases, `{#await}`'s values, `{#snippet}`'s parameters
//!   (functions), `{@const}`, and Svelte 4's `let:` directives;
//! - components as calls of the imported component with their props: `Child({ label: m.x })`.
//!
//! Markup that Svelte rejects is an error, and the file is skipped with it.

use std::sync::Arc;

use super::{
  js::{self, char_at, closing, closing_visiting, Tok},
  names::{self, ElementKind},
};
use crate::{
  graph::{ComponentInstances, InstantiationSyntax, PropsReads},
  languages::{CodeBuilder, Generated, Skipped},
  load::GeneratedSource,
  lower::Lang,
};

pub fn generate(_file: &str, source: &str, skipped: &Skipped) -> Result<Generated, String> {
  // Elements open a block of their own only when one holds a declaration, which is rare.
  if let Some(generated) = Generator::new(source, skipped, false).run()? {
    return Ok(generated);
  }
  Generator::new(source, skipped, true)
    .run()?
    .ok_or_else(|| "svelte: blocks for elements were not written".to_string())
}

/// What an open element or block is.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum FrameKind {
  Element(ElementKind),
  If,
  Each,
  Await,
  Key,
  Snippet,
}

#[derive(Clone, Copy, Debug)]
struct Frame {
  kind: FrameKind,
  /// The element's name in the file.
  name: (usize, usize),
  /// What closes the code written for it, e.g. `}`.
  closer: &'static str,
  /// `{:else}` of an `{#if}` or `{#each}`, `{:then}` of an `{#await}`.
  has_else: bool,
  /// `{:catch}` of an `{#await}`.
  has_catch: bool,
}

/// A template expression's range in the file, without its braces.
#[derive(Clone, Copy, Debug)]
struct Expression {
  start: usize,
  end: usize,
  /// `a, b`: needs parentheses where a sequence is not allowed.
  has_comma: bool,
}

#[derive(Clone, Copy, Debug)]
enum Chunk {
  Text(usize, usize),
  Expression(Expression),
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum Directive {
  On,
  Bind,
  Class,
  Style,
  Use,
  Transition,
  Animate,
  Let,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum AttributeKind {
  /// `name`, `name="text"`, `name={value}`, `name="a {b}"`.
  Plain,
  /// `{name}`
  Shorthand,
  /// `{...value}`
  Spread,
  /// `{@attach value}`
  Attach,
  Directive(Directive),
}

#[derive(Clone, Copy, Debug)]
struct Attribute {
  kind: AttributeKind,
  start: usize,
  /// The name; for a directive, the part after the colon and before its modifiers.
  name: (usize, usize),
  /// The value's chunks in the element's list of chunks; none for a value-less attribute.
  value: Option<(u32, u32)>,
}

struct Generator<'s> {
  source: &'s str,
  bytes: &'s [u8],
  /// The end of the markup: Svelte reads the file without its trailing whitespace.
  end: usize,
  position: usize,
  code: CodeBuilder<'s>,
  stack: Vec<Frame>,
  /// Every element with content opens a block, for the declarations an element holds.
  element_blocks: bool,
  needs_element_blocks: bool,
  attributes: Vec<Attribute>,
  chunks: Vec<Chunk>,
  /// The special elements only the top level has, each once.
  root_only_tags: u8,
  has_instance: bool,
  has_module: bool,
  has_style: bool,
  props: Vec<i32>,
}

/// Svelte's error messages, from its parser's codes.
fn error(message: &str, at: usize) -> String {
  format!("svelte: {message} (at {at})")
}

type Read<T> = Result<T, String>;

/// A UTF-8 range of the file.
type Range = (usize, usize);

impl<'s> Generator<'s> {
  fn new(source: &'s str, skipped: &'s Skipped, element_blocks: bool) -> Self {
    let trimmed = source.trim_end_matches(|character: char| {
      (character.is_whitespace() && character != '\u{85}') || character == '\u{feff}'
    });

    Generator {
      source,
      bytes: source.as_bytes(),
      end: trimmed.len(),
      position: 0,
      code: CodeBuilder::new(source, skipped),
      stack: Vec::new(),
      element_blocks,
      needs_element_blocks: false,
      attributes: Vec::new(),
      chunks: Vec::new(),
      root_only_tags: 0,
      has_instance: false,
      has_module: false,
      has_style: false,
      props: Vec::new(),
    }
  }

  /// The module; none when an element holds a declaration and elements must open blocks.
  fn run(mut self) -> Read<Option<Generated>> {
    while self.position < self.end {
      match self.bytes[self.position] {
        b'<' => self.element()?,
        b'{' => self.tag()?,
        _ => self.text(),
      }
      if self.needs_element_blocks {
        return Ok(None);
      }
    }

    // Svelte's loose mode closes what is still open at the end.
    while let Some(frame) = self.stack.pop() {
      self.code.glue(frame.closer);
    }

    let built = self.code.finish(Lang::Ts);
    Ok(Some(Generated {
      source: GeneratedSource {
        main: built.code,
        scripts: Vec::new(),
        language: "svelte".to_string(),
        component_fields: Vec::new(),
        scope_objects: Vec::new(),
        props: Some(PropsReads {
          calls: vec!["$props".to_string()],
          members: Vec::new(),
          variables: self.props,
          undeclared: false,
        }),
        // `Child({ label: m.x })`
        component_instances: Some(ComponentInstances {
          via: InstantiationSyntax::Call,
          path: Vec::<Arc<str>>::new(),
        }),
      },
      expressions: built.expressions,
    }))
  }

  // ---------------------------------------------------------------- reading

  fn peek(&self) -> Option<u8> {
    self.bytes[..self.end].get(self.position).copied()
  }

  fn matches(&self, text: &str) -> bool {
    self.bytes[..self.end]
      .get(self.position..)
      .is_some_and(|rest| rest.starts_with(text.as_bytes()))
  }

  fn eat(&mut self, text: &str) -> bool {
    let matched = self.matches(text);
    if matched {
      self.position += text.len();
    }
    matched
  }

  fn expect(&mut self, text: &str) -> Read<()> {
    if self.eat(text) {
      Ok(())
    } else {
      Err(error(&format!("expected token {text}"), self.position))
    }
  }

  /// The length of the whitespace character at `position`, if one is there.
  fn whitespace_at(&self, position: usize) -> Option<usize> {
    let byte = *self.bytes[..self.end].get(position)?;
    match byte {
      b' ' | b'\t' | b'\n' | 0x0b | 0x0c | b'\r' => Some(1),
      0x80.. => js::whitespace_at(&self.bytes[..self.end], position).map(|(length, _)| length),
      _ => None,
    }
  }

  fn allow_whitespace(&mut self) {
    while let Some(length) = self.whitespace_at(self.position) {
      self.position += length;
    }
  }

  fn require_whitespace(&mut self) -> Read<()> {
    if self.whitespace_at(self.position).is_none() {
      return Err(error("expected whitespace", self.position));
    }
    self.allow_whitespace();
    Ok(())
  }

  /// A word that is not followed by a word character, as `/word\b/`.
  fn matches_word(&self, word: &str) -> bool {
    self.matches(word)
      && !self
        .bytes
        .get(self.position + word.len())
        .is_some_and(|&byte| byte.is_ascii_alphanumeric() || byte == b'_')
  }

  /// An identifier, as Svelte reads one; empty if none is here. A reserved word is an error.
  fn read_identifier(&mut self) -> Read<(usize, usize)> {
    let start = self.position;
    let is_start = |character: char| character.is_alphabetic() || matches!(character, '_' | '$');
    let is_part = |character: char| {
      character.is_alphanumeric() || matches!(character, '_' | '$' | '\u{200c}' | '\u{200d}')
    };

    let bytes = &self.bytes[..self.end];
    match char_at(bytes, self.position) {
      Some((character, length)) if is_start(character) => self.position += length,
      _ => return Ok((start, start)),
    }
    while let Some((character, length)) = char_at(bytes, self.position) {
      if !is_part(character) {
        break;
      }
      self.position += length;
    }

    if names::is_reserved(&self.bytes[start..self.position]) {
      return Err(error("unexpected reserved word", start));
    }
    Ok((start, self.position))
  }

  /// A tag or attribute name: up to whitespace, `/` or `>`, and in an attribute `"`, `'` or `=`.
  fn read_tag_name(&mut self, attribute: bool) -> (usize, usize) {
    let start = self.position;
    while self.position < self.end {
      let byte = self.bytes[self.position];
      let ends = matches!(byte, b'/' | b'>')
        || (attribute && matches!(byte, b'"' | b'\'' | b'='))
        || self.whitespace_at(self.position).is_some();
      if ends {
        break;
      }
      self.position += 1;
    }
    (start, self.position)
  }

  /// The expression that starts here and ends at the `close` matching an `open` before it; reads
  /// past the `close`.
  fn read_expression_to(&mut self, open: u8, close: u8) -> Read<Expression> {
    let start = self.position;
    let Some(closing) = closing(&self.bytes[..self.end], start, open, close) else {
      return Err(error(&format!("expected token {}", close as char), start));
    };
    self.position = closing.at + 1;

    Ok(Expression {
      start,
      end: closing.at,
      has_comma: closing.has_comma,
    })
  }

  fn read_expression(&mut self) -> Read<Expression> {
    self.read_expression_to(b'{', b'}')
  }

  fn is_blank(&self, start: usize, end: usize) -> bool {
    let mut position = start;
    while position < end {
      match self.whitespace_at(position) {
        Some(length) => position += length,
        None => return false,
      }
    }
    true
  }

  fn text(&mut self) {
    self.position = memchr::memchr2(b'<', b'{', &self.bytes[self.position..self.end])
      .map_or(self.end, |at| self.position + at);
  }

  // ---------------------------------------------------------------- writing

  /// `(expression);`
  fn statement(&mut self, expression: Expression) {
    if self.is_blank(expression.start, expression.end) {
      return;
    }
    self.code.glue("(");
    self.code.expression(expression.start, expression.end);
    self.code.glue(");");
  }

  /// The expression as a value, e.g. a prop's; `0` for an empty one.
  fn value(&mut self, expression: Expression) {
    if self.is_blank(expression.start, expression.end) {
      self.code.glue("0");
    } else if expression.has_comma {
      self.code.glue("(");
      self.code.expression(expression.start, expression.end);
      self.code.glue(")");
    } else {
      self.code.expression(expression.start, expression.end);
    }
  }

  fn push(&mut self, kind: FrameKind, name: (usize, usize), closer: &'static str) {
    self.stack.push(Frame {
      kind,
      name,
      closer,
      has_else: false,
      has_catch: false,
    });
  }

  fn pop(&mut self) {
    if let Some(frame) = self.stack.pop() {
      self.code.glue(frame.closer);
    }
  }

  /// A declaration in the current fragment: an element there must scope it with a block.
  fn declares(&mut self) {
    let in_unscoped_element = self
      .stack
      .last()
      .is_some_and(|frame| matches!(frame.kind, FrameKind::Element(_)) && frame.closer.is_empty());
    if in_unscoped_element && !self.element_blocks {
      self.needs_element_blocks = true;
    }
  }

  // ---------------------------------------------------------------- elements

  fn element(&mut self) -> Read<()> {
    let start = self.position;
    self.position += 1;

    if self.eat("!--") {
      let Some(at) = memchr::memmem::find(&self.bytes[self.position..self.end], b"-->") else {
        return Err(error("expected token -->", self.end));
      };
      self.position += at + 3;
      return Ok(());
    }

    if self.eat("/") {
      return self.closing_tag(start);
    }

    let name = self.read_tag_name(false);
    let name_text = &self.bytes[name.0..name.1];

    let special = if name_text.starts_with(b"svelte:") {
      match ElementKind::special(name_text) {
        Some(kind) => Some(kind),
        None => return Err(error("invalid special element", name.0)),
      }
    } else {
      None
    };

    let is_component_name = names::is_component_name(name_text);
    let is_loose_component = name_text.ends_with(b".");
    if !names::is_valid_element_name(name_text) && !is_component_name && !is_loose_component {
      return Err(error("invalid tag name", name.0));
    }

    let parent = self.stack.last().copied();
    let kind = match special {
      Some(kind) => kind,
      None if is_component_name || is_loose_component => ElementKind::Component,
      None if name_text == b"title" && self.parent_is_head() => ElementKind::Title,
      None if name_text == b"slot" => ElementKind::Slot,
      None => ElementKind::Regular,
    };

    let root_only = kind.root_only_bit();
    if root_only != 0 {
      if self.root_only_tags & root_only != 0 {
        return Err(error("duplicate special element", start));
      }
      if parent.is_some() {
        return Err(error("special element must be at the top level", start));
      }
      self.root_only_tags |= root_only;
    }

    self.allow_whitespace();

    if let Some(parent) = parent {
      let closes_parent = parent.kind == FrameKind::Element(ElementKind::Regular)
        && names::closing_tag_omitted(&self.bytes[parent.name.0..parent.name.1], name_text);
      if closes_parent {
        self.pop();
      }
    }

    let is_top_level_script_or_style =
      self.stack.is_empty() && matches!(name_text, b"script" | b"style");
    if is_top_level_script_or_style {
      return self.top_level_script_or_style(start, name);
    }

    self.attributes.clear();
    self.chunks.clear();
    while let Some(attribute) = self.read_attribute()? {
      self.attributes.push(attribute);
      self.allow_whitespace();
    }
    self.check_unique_attributes()?;

    let this = self.this_attribute(kind, start)?;

    let self_closing = self.eat("/") || names::is_void(name_text);
    let closed = self.eat(">");
    if !closed {
      self.recover_unclosed_tag();
    }
    let has_content = !self_closing && closed;

    match name_text {
      b"textarea" if has_content => {
        self.write_element_start(kind, name, this, false);
        return self.textarea();
      }
      b"script" | b"style" if has_content => {
        self.write_element_start(kind, name, this, false);
        let close: &[u8] = if name_text == b"script" {
          b"</script>"
        } else {
          b"</style>"
        };
        let Some(at) = memchr::memmem::find(&self.bytes[self.position..self.end], close) else {
          return Err(error("expected closing tag", self.end));
        };
        self.position += at + close.len();
        return Ok(());
      }
      _ => {}
    }

    let closer = self.write_element_start(kind, name, this, has_content);
    if has_content {
      self.push(FrameKind::Element(kind), name, closer);
    }
    Ok(())
  }

  /// Whether a `<title>` here is the document's: in `<svelte:head>`, outside other elements.
  fn parent_is_head(&self) -> bool {
    for frame in self.stack.iter().rev() {
      match frame.kind {
        FrameKind::Element(ElementKind::SvelteHead) => return true,
        FrameKind::Element(ElementKind::Regular | ElementKind::Component) => return false,
        _ => {}
      }
    }
    false
  }

  /// As Svelte when a tag does not end with `>`: it may have read the start of what follows.
  fn recover_unclosed_tag(&mut self) {
    let last = self.attributes.last().copied();
    if let Some(attribute) = last {
      if attribute.kind == AttributeKind::Plain
        && &self.bytes[attribute.name.0..attribute.name.1] == b"<"
      {
        self.position = attribute.start;
        self.attributes.pop();
        return;
      }
    }

    let previous = |back: usize| self.position.checked_sub(back).map(|at| self.bytes[at]);
    if previous(2) == Some(b'{') && previous(1) == Some(b'/') {
      self.position -= 2;
    } else if previous(1) == Some(b'{') && matches!(self.peek(), Some(b'#' | b'@' | b':')) {
      self.position -= 1;
    } else {
      self.allow_whitespace();
    }
  }

  /// `</name>`: closes the element, and what is still open in it.
  fn closing_tag(&mut self, start: usize) -> Read<()> {
    let name = self.read_tag_name(false);
    self.allow_whitespace();
    self.expect(">")?;

    let name_text = &self.bytes[name.0..name.1];
    if names::is_void(name_text) {
      return Err(error("void elements have no closing tag", start));
    }

    loop {
      let Some(frame) = self.stack.last().copied() else {
        return Err(error("unexpected closing tag", start));
      };
      let is_closed = matches!(frame.kind, FrameKind::Element(_))
        && &self.bytes[frame.name.0..frame.name.1] == name_text;
      // In the loose mode, an element or block not closed before is.
      self.pop();
      if is_closed {
        return Ok(());
      }
    }
  }

  fn check_unique_attributes(&self) -> Read<()> {
    // `bind:value` and `value` are the same; `class:x` and `x` are not.
    let key = |attribute: &Attribute| -> Option<u8> {
      match attribute.kind {
        AttributeKind::Plain
        | AttributeKind::Shorthand
        | AttributeKind::Directive(Directive::Bind) => Some(0),
        AttributeKind::Directive(Directive::Style) => Some(1),
        AttributeKind::Directive(Directive::Class) => Some(2),
        _ => None,
      }
    };

    for (index, attribute) in self.attributes.iter().enumerate() {
      let Some(kind) = key(attribute) else { continue };
      let name = &self.bytes[attribute.name.0..attribute.name.1];
      let repeats = self.attributes[..index].iter().any(|earlier| {
        key(earlier) == Some(kind)
          && &self.bytes[earlier.name.0..earlier.name.1] == name
          && name != b"this"
      });
      if repeats {
        return Err(error("attributes need to be unique", attribute.start));
      }
    }
    Ok(())
  }

  /// The expression of `this` that `<svelte:component>` and `<svelte:element>` require.
  fn this_attribute(&mut self, kind: ElementKind, start: usize) -> Read<Option<Expression>> {
    if !matches!(
      kind,
      ElementKind::SvelteComponent | ElementKind::SvelteElement
    ) {
      return Ok(None);
    }

    let index = self.attributes.iter().position(|attribute| {
      attribute.kind == AttributeKind::Plain
        && &self.bytes[attribute.name.0..attribute.name.1] == b"this"
    });
    let Some(index) = index else {
      return Err(error("expected a `this` attribute", start));
    };
    let attribute = self.attributes.remove(index);
    let expression = self.single_expression(&attribute);

    match (kind, attribute.value) {
      (ElementKind::SvelteComponent, _) if expression.is_none() => Err(error(
        "invalid `this` of <svelte:component>",
        attribute.start,
      )),
      (ElementKind::SvelteElement, None) => {
        Err(error("expected a `this` attribute", attribute.start))
      }
      _ => Ok(expression),
    }
  }

  /// The value of an attribute that is one expression: `{x}` or `"{x}"`.
  fn single_expression(&self, attribute: &Attribute) -> Option<Expression> {
    let (start, end) = attribute.value?;
    match &self.chunks[start as usize..end as usize] {
      [Chunk::Expression(expression)] => Some(*expression),
      _ => None,
    }
  }

  /// Writes an element's attributes, or a component's call, and opens the block of its content.
  /// Returns what closes that block.
  fn write_element_start(
    &mut self,
    kind: ElementKind,
    name: (usize, usize),
    this: Option<Expression>,
    has_content: bool,
  ) -> &'static str {
    match kind {
      ElementKind::Component | ElementKind::SvelteComponent => {
        self.write_component_call(name, this);
      }
      ElementKind::SvelteOptions => {}
      _ => {
        if let Some(this) = this {
          self.statement(this);
        }
        for index in 0..self.attributes.len() {
          let attribute = self.attributes[index];
          self.write_attribute_statements(attribute);
        }
      }
    }

    if !has_content {
      return "";
    }

    let has_let = self
      .attributes
      .iter()
      .any(|attribute| attribute.kind == AttributeKind::Directive(Directive::Let));
    let is_scope = matches!(
      kind,
      ElementKind::Component
        | ElementKind::SvelteComponent
        | ElementKind::SvelteSelf
        | ElementKind::SvelteFragment
        | ElementKind::SvelteBoundary
    );
    if !(is_scope || has_let || self.element_blocks) {
      return "";
    }

    self.code.glue("{");
    if has_let {
      self.write_let_directives();
    }
    "}"
  }

  /// Svelte 4's `let:item={pattern}` declare the slot's props for the element's content:
  /// `const { item: pattern } = $$_slot;`.
  fn write_let_directives(&mut self) {
    // Each slot prop's name, and the pattern it is declared with, if any.
    let mut declared: Vec<(Range, Option<Range>)> = Vec::new();
    for attribute in &self.attributes {
      if attribute.kind != AttributeKind::Directive(Directive::Let)
        || !names::is_identifier(&self.bytes[attribute.name.0..attribute.name.1])
      {
        continue;
      }
      let pattern = self
        .single_expression(attribute)
        .filter(|pattern| !self.is_blank(pattern.start, pattern.end))
        .map(|pattern| (pattern.start, pattern.end));
      declared.push((attribute.name, pattern));
    }

    let source = self.source;
    self.code.skippable("", |code| {
      code.glue("const {");
      for (name, pattern) in declared {
        match pattern {
          Some(pattern) => {
            code.glue(&source[name.0..name.1]);
            code.glue(":");
            code.copy(pattern.0, pattern.1);
          }
          None => code.copy(name.0, name.1),
        }
        code.glue(",");
      }
      code.glue("} = $$_slot;");
    });
  }

  fn slice(&self, (start, end): (usize, usize)) -> &'s str {
    &self.source[start..end]
  }

  /// An element's attribute, as the statements that evaluate its expressions.
  fn write_attribute_statements(&mut self, attribute: Attribute) {
    let name = &self.bytes[attribute.name.0..attribute.name.1];
    match attribute.kind {
      AttributeKind::Shorthand => {
        if names::is_identifier(name) {
          self.code.copy(attribute.name.0, attribute.name.1);
          self.code.glue(";");
        }
      }
      AttributeKind::Directive(Directive::Let) => {}
      AttributeKind::Directive(
        directive @ (Directive::Use | Directive::Transition | Directive::Animate),
      ) if names::is_member_chain(name) => {
        // As Svelte calls it: `tooltip(element, parameter)`; an animation also gets the move.
        self.code.copy(attribute.name.0, attribute.name.1);
        self.code.glue(if directive == Directive::Animate {
          "($$_element, $$_element"
        } else {
          "($$_element"
        });
        if let Some(expression) = self.single_expression(&attribute) {
          self.code.glue(", ");
          self.value(expression);
        }
        self.code.glue(");");
      }
      AttributeKind::Directive(Directive::Bind | Directive::Class | Directive::Style)
        if attribute.value.is_none() =>
      {
        // `class:active` reads `active`.
        if names::is_identifier(name) {
          self.code.copy(attribute.name.0, attribute.name.1);
          self.code.glue(";");
        }
      }
      _ => {
        let Some((start, end)) = attribute.value else {
          return;
        };
        for index in start..end {
          if let Chunk::Expression(expression) = self.chunks[index as usize] {
            self.statement(expression);
          }
        }
      }
    }
  }

  /// `Child({ label: m.x, kind: "x", ...rest });`, then the statements of its other directives.
  fn write_component_call(&mut self, name: (usize, usize), this: Option<Expression>) {
    match this {
      Some(this) => {
        self.code.glue("(");
        self.value(this);
        self.code.glue(")");
      }
      None if names::is_member_chain(&self.bytes[name.0..name.1]) => {
        self.code.copy(name.0, name.1);
      }
      None => self.code.glue("$$_component"),
    }
    self.code.glue("({");

    for index in 0..self.attributes.len() {
      let attribute = self.attributes[index];
      match attribute.kind {
        AttributeKind::Plain | AttributeKind::Directive(Directive::Bind) => {
          let name = &self.bytes[attribute.name.0..attribute.name.1];
          if attribute.kind == AttributeKind::Directive(Directive::Bind) && name == b"this" {
            continue;
          }
          if attribute.value.is_none()
            && attribute.kind == AttributeKind::Directive(Directive::Bind)
          {
            // `bind:value` passes `value`.
            if names::is_identifier(name) {
              self.code.copy(attribute.name.0, attribute.name.1);
              self.code.glue(",");
            }
            continue;
          }
          self.write_key(attribute.name);
          self.code.glue(":");
          self.write_prop_value(attribute);
          self.code.glue(",");
        }
        AttributeKind::Shorthand => {
          if names::is_identifier(&self.bytes[attribute.name.0..attribute.name.1]) {
            self.code.copy(attribute.name.0, attribute.name.1);
            self.code.glue(",");
          }
        }
        AttributeKind::Spread => {
          if let Some(expression) = self.single_expression(&attribute) {
            self.code.glue("...");
            self.value(expression);
            self.code.glue(",");
          }
        }
        _ => {}
      }
    }
    self.code.glue("});");

    for index in 0..self.attributes.len() {
      let attribute = self.attributes[index];
      let is_prop = matches!(
        attribute.kind,
        AttributeKind::Plain | AttributeKind::Shorthand | AttributeKind::Spread
      ) || (attribute.kind == AttributeKind::Directive(Directive::Bind)
        && &self.bytes[attribute.name.0..attribute.name.1] != b"this");
      if !is_prop {
        self.write_attribute_statements(attribute);
      }
    }
  }

  fn write_key(&mut self, name: (usize, usize)) {
    let text = self.slice(name);
    if names::is_identifier(text.as_bytes()) {
      self.code.glue(text);
    } else {
      self.write_string(text);
    }
  }

  /// `true`, `"text"`, the expression, or `` `a ${b}` ``.
  fn write_prop_value(&mut self, attribute: Attribute) {
    let Some((start, end)) = attribute.value else {
      self.code.glue("true");
      return;
    };
    let chunks = start as usize..end as usize;

    match self.chunks[chunks.clone()] {
      [] => self.code.glue("\"\""),
      [Chunk::Expression(expression)] => self.value(expression),
      [Chunk::Text(start, end)] => self.write_string(&self.source[start..end]),
      _ => {
        self.code.glue("`");
        for index in chunks {
          match self.chunks[index] {
            Chunk::Text(start, end) => self.write_template_text(&self.source[start..end]),
            Chunk::Expression(expression) => {
              self.code.glue("${");
              self.value(expression);
              self.code.glue("}");
            }
          }
        }
        self.code.glue("`");
      }
    }
  }

  fn write_string(&mut self, text: &str) {
    let needs_escape = text
      .bytes()
      .any(|byte| matches!(byte, b'"' | b'\\' | b'\n' | b'\r' | 0xe2));
    if !needs_escape {
      self.code.glue("\"");
      self.code.glue(text);
      self.code.glue("\"");
      return;
    }

    let mut escaped = String::with_capacity(text.len() + 8);
    escaped.push('"');
    for character in text.chars() {
      match character {
        '"' => escaped.push_str("\\\""),
        '\\' => escaped.push_str("\\\\"),
        '\n' => escaped.push_str("\\n"),
        '\r' => escaped.push_str("\\r"),
        '\u{2028}' => escaped.push_str("\\u2028"),
        '\u{2029}' => escaped.push_str("\\u2029"),
        _ => escaped.push(character),
      }
    }
    escaped.push('"');
    self.code.glue(&escaped);
  }

  fn write_template_text(&mut self, text: &str) {
    if !text.bytes().any(|byte| matches!(byte, b'`' | b'\\' | b'$')) {
      self.code.glue(text);
      return;
    }
    let mut escaped = String::with_capacity(text.len() + 8);
    for character in text.chars() {
      if matches!(character, '`' | '\\' | '$') {
        escaped.push('\\');
      }
      escaped.push(character);
    }
    self.code.glue(&escaped);
  }

  // ---------------------------------------------------------------- attributes

  fn read_attribute(&mut self) -> Read<Option<Attribute>> {
    // Svelte 5 allows JavaScript comments between attributes.
    loop {
      if self.matches("//") {
        self.position = memchr::memchr(b'\n', &self.bytes[self.position..self.end])
          .map_or(self.end, |at| self.position + at);
      } else if self.eat("/*") {
        self.position = memchr::memmem::find(&self.bytes[self.position..self.end], b"*/")
          .map_or(self.end, |at| self.position + at + 2);
      } else {
        break;
      }
      self.allow_whitespace();
    }

    let start = self.position;

    if self.eat("{") {
      self.allow_whitespace();

      if self.eat("@attach") {
        self.require_whitespace()?;
        let expression = self.read_expression()?;
        return Ok(Some(self.expression_attribute(
          AttributeKind::Attach,
          start,
          (start, start),
          expression,
        )));
      }

      if self.eat("...") {
        let expression = self.read_expression()?;
        return Ok(Some(self.expression_attribute(
          AttributeKind::Spread,
          start,
          (start, start),
          expression,
        )));
      }

      let name = self.read_identifier()?;
      if name.0 == name.1 {
        match self.peek() {
          // Likely an opening tag that does not end, before a block.
          Some(b'#' | b'/' | b'@' | b':') => return Ok(None),
          // Being typed.
          Some(b'}') => {}
          _ => return Err(error("attribute shorthand cannot be empty", start)),
        }
      }
      self.allow_whitespace();
      self.expect("}")?;

      return Ok(Some(Attribute {
        kind: AttributeKind::Shorthand,
        start,
        name,
        value: None,
      }));
    }

    let name = self.read_tag_name(true);
    if name.0 == name.1 {
      return Ok(None);
    }
    self.allow_whitespace();

    let name_text = &self.bytes[name.0..name.1];
    let colon = name_text.iter().position(|&byte| byte == b':');
    let directive = colon.and_then(|colon| directive_of(&name_text[..colon]));

    let mut value = None;
    if self.eat("=") {
      self.allow_whitespace();
      if self.matches("/>") {
        let chunk = self.chunks.len() as u32;
        self
          .chunks
          .push(Chunk::Text(self.position, self.position + 1));
        self.position += 1;
        value = Some((chunk, chunk + 1));
      } else {
        value = Some(self.read_attribute_value()?);
      }
    } else if matches!(self.peek(), Some(b'"' | b'\'')) {
      return Err(error("expected token =", self.position));
    }

    let (Some(directive), Some(colon)) = (directive, colon) else {
      return Ok(Some(Attribute {
        kind: AttributeKind::Plain,
        start,
        name,
        value,
      }));
    };

    let after_colon = name.0 + colon + 1;
    let directive_end = self.bytes[after_colon..name.1]
      .iter()
      .position(|&byte| byte == b'|')
      .map_or(name.1, |at| after_colon + at);
    if directive_end == after_colon {
      return Err(error("directive is missing a name", start));
    }

    if directive != Directive::Style {
      if let Some((first, end)) = value {
        let is_one_expression =
          end == first + 1 && matches!(self.chunks[first as usize], Chunk::Expression(_));
        if !is_one_expression {
          return Err(error("directive value must be an expression", start));
        }
      }
    }

    Ok(Some(Attribute {
      kind: AttributeKind::Directive(directive),
      start,
      name: (after_colon, directive_end),
      value,
    }))
  }

  fn expression_attribute(
    &mut self,
    kind: AttributeKind,
    start: usize,
    name: (usize, usize),
    expression: Expression,
  ) -> Attribute {
    let chunk = self.chunks.len() as u32;
    self.chunks.push(Chunk::Expression(expression));
    Attribute {
      kind,
      start,
      name,
      value: Some((chunk, chunk + 1)),
    }
  }

  /// `"text {expression} text"`, `'…'` or unquoted; the range of its chunks.
  fn read_attribute_value(&mut self) -> Read<(u32, u32)> {
    let quote = match self.peek() {
      Some(quote @ (b'"' | b'\'')) => {
        self.position += 1;
        Some(quote)
      }
      _ => None,
    };
    let first = self.chunks.len() as u32;

    if let Some(quote) = quote {
      if self.peek() == Some(quote) {
        self.position += 1;
        self
          .chunks
          .push(Chunk::Text(self.position - 1, self.position - 1));
        return Ok((first, first + 1));
      }
    }

    self.read_sequence(|generator| match quote {
      Some(quote) => generator.peek() == Some(quote),
      None => {
        generator.matches("/>")
          || matches!(
            generator.peek(),
            Some(b'"' | b'\'' | b'=' | b'<' | b'>' | b'`')
          )
          || generator.whitespace_at(generator.position).is_some()
      }
    })?;

    let last = self.chunks.len() as u32;
    if last == first && quote.is_none() {
      return Err(error("expected attribute value", self.position));
    }
    if quote.is_some() {
      self.position = (self.position + 1).min(self.end);
    }
    Ok((first, last))
  }

  /// Text and `{expressions}` until `done`, into `chunks`. A block or tag there is an error.
  fn read_sequence(&mut self, done: impl Fn(&Self) -> bool) -> Read<()> {
    let mut text_start = self.position;

    while self.position < self.end {
      if done(self) {
        break;
      }
      if self.peek() != Some(b'{') {
        self.position += 1;
        continue;
      }

      if matches!(self.bytes.get(self.position + 1), Some(b'#' | b'@')) {
        return Err(error("blocks and tags are not allowed here", self.position));
      }
      if self.position > text_start {
        self.chunks.push(Chunk::Text(text_start, self.position));
      }
      self.position += 1;
      self.allow_whitespace();
      let expression = self.read_expression()?;
      self.chunks.push(Chunk::Expression(expression));
      text_start = self.position;
    }

    if self.position > text_start {
      self.chunks.push(Chunk::Text(text_start, self.position));
    }
    Ok(())
  }

  /// A `<textarea>`'s content is its value: text and expressions up to `</textarea>`.
  fn textarea(&mut self) -> Read<()> {
    self.chunks.clear();
    self.read_sequence(|generator| generator.closing_textarea_length().is_some())?;
    for index in 0..self.chunks.len() {
      if let Chunk::Expression(expression) = self.chunks[index] {
        self.statement(expression);
      }
    }
    if let Some(length) = self.closing_textarea_length() {
      self.position += length;
    }
    Ok(())
  }

  /// `/<\/textarea(\s[^>]*)?>/i` here.
  fn closing_textarea_length(&self) -> Option<usize> {
    let rest = &self.bytes[self.position..self.end];
    if rest.len() < 10 || !rest[..10].eq_ignore_ascii_case(b"</textarea") {
      return None;
    }
    match rest.get(10)? {
      b'>' => Some(11),
      _ if self.whitespace_at(self.position + 10).is_some() => {
        let close = memchr::memchr(b'>', &rest[10..])?;
        Some(10 + close + 1)
      }
      _ => None,
    }
  }

  // ---------------------------------------------------------------- scripts

  fn top_level_script_or_style(&mut self, start: usize, name: (usize, usize)) -> Read<()> {
    let is_script = &self.bytes[name.0..name.1] == b"script";

    self.attributes.clear();
    self.chunks.clear();
    while let Some(attribute) = self.read_static_attribute()? {
      self.attributes.push(attribute);
      self.allow_whitespace();
    }
    self.check_unique_attributes()?;
    self.expect(">")?;

    if !is_script {
      let Some(at) = memchr::memmem::find(&self.bytes[self.position..self.end], b"</style") else {
        return Err(error("expected token </style", self.end));
      };
      self.position += at + "</style".len();
      self.allow_whitespace();
      self.eat(">");
      if self.has_style {
        return Err(error(
          "a component can have a single top-level <style>",
          start,
        ));
      }
      self.has_style = true;
      return Ok(());
    }

    let content = self.position;
    let Some((content_end, tag_end)) = self.closing_script_tag(content) else {
      return Err(error("<script> was left open", self.end));
    };
    self.position = tag_end;

    let is_module = self.script_context()?;
    let already = if is_module {
      &mut self.has_module
    } else {
      &mut self.has_instance
    };
    if *already {
      return Err(error(
        "a component can have a single top-level <script> of each kind",
        start,
      ));
    }
    *already = true;

    let text = &self.bytes[content..content_end];
    let needs_reading = !is_module
      && (memchr::memmem::find(text, b"export").is_some()
        || memchr::memmem::find(text, b"$:").is_some());
    if !needs_reading {
      self.code.copy(content, content_end);
      self.code.glue("\n;\n");
      return Ok(());
    }

    let script = js::instance_script(self.bytes, content, content_end);
    for offset in script.exported {
      let offset = self.code.source_offset(offset);
      self.props.push(offset);
    }

    // `$: label = m.greeting` as svelte2tsx writes it: what the value reads is used there, as the
    // name holds a value computed again, not an alias. `$: label = $$_reactive, m.greeting`.
    let mut copied = content;
    for at in script.reactive_assignments {
      self.code.copy(copied, at);
      self.code.glue(" $$_reactive,");
      copied = at;
    }
    self.code.copy(copied, content_end);
    self.code.glue("\n;\n");
    Ok(())
  }

  /// `/<\/script\s*>/` from `from`: where it starts, and where it ends.
  fn closing_script_tag(&self, from: usize) -> Option<(usize, usize)> {
    let mut search = from;
    loop {
      let at = search + memchr::memmem::find(&self.bytes[search..self.end], b"</script")?;
      let mut end = at + "</script".len();
      while let Some(length) = self.whitespace_at(end) {
        end += length;
      }
      if self.bytes[..self.end].get(end) == Some(&b'>') {
        return Some((at, end + 1));
      }
      search = at + 1;
    }
  }

  /// Whether the script is the module script, from its attributes.
  fn script_context(&self) -> Read<bool> {
    let mut is_module = false;

    for attribute in &self.attributes {
      let name = &self.bytes[attribute.name.0..attribute.name.1];
      if matches!(
        name,
        b"server" | b"client" | b"worker" | b"test" | b"default"
      ) {
        return Err(error("reserved attribute of <script>", attribute.start));
      }
      match name {
        b"module" => {
          if attribute.value.is_some() {
            return Err(error("invalid value of `module`", attribute.start));
          }
          is_module = true;
        }
        b"context" => {
          let value = attribute
            .value
            .and_then(|(start, _)| match self.chunks[start as usize] {
              Chunk::Text(start, end) => Some(&self.bytes[start..end]),
              Chunk::Expression(_) => None,
            });
          if value != Some(b"module") {
            return Err(error("invalid `context` of <script>", attribute.start));
          }
          is_module = true;
        }
        _ => {}
      }
    }

    Ok(is_module)
  }

  /// An attribute of a top-level `<script>` or `<style>`, whose value is text.
  fn read_static_attribute(&mut self) -> Read<Option<Attribute>> {
    let start = self.position;
    let name = self.read_tag_name(true);
    if name.0 == name.1 {
      return Ok(None);
    }

    let mut value = None;
    if self.eat("=") {
      self.allow_whitespace();
      let (text_start, text_end, length) = match self.peek() {
        Some(quote @ (b'"' | b'\'')) => {
          let body = self.position + 1;
          let Some(close) = memchr::memchr(quote, &self.bytes[body..self.end]) else {
            return Err(error("expected attribute value", self.position));
          };
          (body, body + close, close + 2)
        }
        _ => {
          let mut end = self.position;
          while end < self.end && self.bytes[end] != b'>' && self.whitespace_at(end).is_none() {
            end += 1;
          }
          if end == self.position {
            return Err(error("expected attribute value", self.position));
          }
          (self.position, end, end - self.position)
        }
      };
      self.position += length;
      let chunk = self.chunks.len() as u32;
      self.chunks.push(Chunk::Text(text_start, text_end));
      value = Some((chunk, chunk + 1));
    }

    if matches!(self.peek(), Some(b'"' | b'\'')) {
      return Err(error("expected token =", self.position));
    }

    Ok(Some(Attribute {
      kind: AttributeKind::Plain,
      start,
      name,
      value,
    }))
  }

  // ---------------------------------------------------------------- tags and blocks

  fn tag(&mut self) -> Read<()> {
    let start = self.position;
    self.position += 1;
    self.allow_whitespace();

    if self.eat("#") {
      return self.open_block(start);
    }
    if self.eat(":") {
      return self.continue_block(start);
    }
    if self.eat("@") {
      return self.special_tag(start);
    }
    if self.matches("/") && !self.matches("/*") && !self.matches("//") {
      self.position += 1;
      return self.close_block(start);
    }

    if self.matches_word("var") || self.matches_word("interface") || self.matches_word("enum") {
      return Err(error(
        "declaration tags declare with `let` or `const`",
        self.position,
      ));
    }
    if self.matches_word("let") || self.matches_word("const") {
      // `{let count = 0}`
      self.declares();
      let declaration = self.read_expression()?;
      self.code.skippable("", |code| {
        code.copy(declaration.start, declaration.end);
        code.glue(";");
      });
      return Ok(());
    }

    let expression = self.read_expression()?;
    self.statement(expression);
    Ok(())
  }

  fn open_block(&mut self, start: usize) -> Read<()> {
    if self.eat("if") {
      self.require_whitespace()?;
      let test = self.read_expression()?;
      self.code.glue("if (");
      self.value(test);
      self.code.glue(") {");
      self.push(FrameKind::If, (start, start), "}");
      return Ok(());
    }

    if self.eat("each") {
      self.require_whitespace()?;
      return self.each_block(start);
    }

    if self.eat("await") {
      self.require_whitespace()?;
      return self.await_block(start);
    }

    if self.eat("key") {
      self.require_whitespace()?;
      let key = self.read_expression()?;
      self.statement(key);
      self.code.glue("{");
      self.push(FrameKind::Key, (start, start), "}");
      return Ok(());
    }

    if self.eat("snippet") {
      self.require_whitespace()?;
      return self.snippet_block(start);
    }

    Err(error(
      "expected `if`, `each`, `await`, `key` or `snippet`",
      self.position,
    ))
  }

  /// `{#each list as pattern, index (key)}`: `for (const pattern of list) { let index; (key);`.
  fn each_block(&mut self, start: usize) -> Read<()> {
    let head = self.position;
    let bytes = &self.bytes[..self.end];

    // The last `as` outside brackets: the list may hold a TypeScript `as`.
    let mut last_as = None;
    let mut first_comma = None;
    let Some(close) = closing_visiting(bytes, head, b'{', b'}', |token, depth, previous| {
      if depth != 0 {
        return;
      }
      let after_dot = previous.is_some_and(|previous| previous.is_punct(bytes, b'.'));
      if token.is_word(bytes, b"as") && !after_dot {
        last_as = Some(token.start);
      } else if token.is_punct(bytes, b',') && first_comma.is_none() {
        first_comma = Some(token.start);
      }
    }) else {
      return Err(error("expected token }", head));
    };
    let close = close.at;

    let (list_end, mut position) = match last_as {
      Some(at) => (at, at),
      None => {
        let end = first_comma.filter(|&comma| comma < close).unwrap_or(close);
        (end, end)
      }
    };
    let list = Expression {
      start: head,
      end: list_end,
      has_comma: false,
    };

    let mut pattern = None;
    if last_as.is_some() {
      self.position = position + 2;
      self.require_whitespace()?;
      let pattern_start = self.position;
      let identifier = self.read_identifier()?;
      if identifier.0 == identifier.1 {
        let open = self.peek();
        let close_bracket = match open {
          Some(b'{') => b'}',
          Some(b'[') => b']',
          _ => {
            return Err(error(
              "expected an identifier or destructuring pattern",
              self.position,
            ))
          }
        };
        let Some(end) = closing(
          bytes,
          self.position + 1,
          open.unwrap_or(b'{'),
          close_bracket,
        ) else {
          return Err(error("expected the end of the pattern", self.position));
        };
        self.position = end.at + 1;
      }
      pattern = Some((pattern_start, self.position));
      self.skip_type_annotation(close);
      position = self.position;
    }

    self.position = position;
    self.allow_whitespace();
    let mut index = None;
    if self.eat(",") {
      self.allow_whitespace();
      let identifier = self.read_identifier()?;
      if identifier.0 == identifier.1 {
        return Err(error("expected an identifier", self.position));
      }
      index = Some(identifier);
      self.allow_whitespace();
    }

    let mut key = None;
    if self.eat("(") {
      self.allow_whitespace();
      key = Some(self.read_expression_to(b'(', b')')?);
      self.allow_whitespace();
    }

    if self.position != close {
      return Err(error("expected token }", self.position));
    }
    self.position = close + 1;

    match pattern {
      Some(pattern) => {
        self.code.glue("for (const ");
        self
          .code
          .skippable("$$_", |code| code.copy(pattern.0, pattern.1));
        self.code.glue(" of ");
        self.value(list);
        self.code.glue(") {");
      }
      None => {
        self.code.glue("{");
        self.statement(list);
      }
    }
    if let Some(index) = index {
      self.code.glue("let ");
      self.code.copy(index.0, index.1);
      self.code.glue(";");
    }
    if let Some(key) = key {
      self.statement(key);
    }

    self.push(FrameKind::Each, (start, start), "}");
    Ok(())
  }

  /// A pattern's `: Type`, which a `for…of` declaration cannot have: skipped up to the index, the
  /// key or the end of the tag.
  fn skip_type_annotation(&mut self, close: usize) {
    let mark = self.position;
    self.allow_whitespace();
    if !self.eat(":") {
      self.position = mark;
      return;
    }

    let bytes = &self.bytes[..close];
    let mut lexer = js::Lexer::new(bytes, self.position);
    let mut depth = 0u32;
    loop {
      let token = lexer.next_token();
      if token.tok == Tok::End {
        self.position = close;
        return;
      }
      if token.tok != Tok::Punct {
        continue;
      }
      match bytes[token.start] {
        b',' | b'(' if depth == 0 => {
          self.position = token.start;
          return;
        }
        b'(' | b'[' | b'{' | b'<' => depth += 1,
        b')' | b']' | b'}' | b'>' => depth = depth.saturating_sub(1),
        _ => {}
      }
    }
  }

  /// `{#await promise then value}`: `{ const $$_await = await (promise); { const value = $$_await;`.
  fn await_block(&mut self, start: usize) -> Read<()> {
    let head = self.position;
    let bytes = &self.bytes[..self.end];

    let mut branch: Option<(usize, bool)> = None;
    let Some(close) = closing_visiting(bytes, head, b'{', b'}', |token, depth, previous| {
      if depth != 0 || branch.is_some() || previous.is_none() {
        return;
      }
      if previous.is_some_and(|previous| previous.is_punct(bytes, b'.')) {
        return;
      }
      if token.is_word(bytes, b"then") {
        branch = Some((token.start, true));
      } else if token.is_word(bytes, b"catch") {
        branch = Some((token.start, false));
      }
    }) else {
      return Err(error("expected token }", head));
    };
    let close = close.at;

    let promise = Expression {
      start: head,
      end: branch.map_or(close, |(at, _)| at),
      has_comma: false,
    };
    self.code.glue("{const $$_await = await (");
    self.value(promise);
    self.code.glue(");{");

    let mut frame = Frame {
      kind: FrameKind::Await,
      name: (start, start),
      closer: "}}",
      has_else: false,
      has_catch: false,
    };

    if let Some((at, is_then)) = branch {
      self.position = at + if is_then { 4 } else { 5 };
      let pattern = (self.position, close);
      if !self.is_blank(pattern.0, pattern.1) {
        self.require_whitespace()?;
        self.write_branch_value((self.position, close), is_then);
      }
      if is_then {
        frame.has_else = true;
      } else {
        frame.has_catch = true;
      }
    }

    self.position = close + 1;
    self.stack.push(frame);
    Ok(())
  }

  /// `const value = $$_await;` or `const error = $$_error;`
  fn write_branch_value(&mut self, (start, end): (usize, usize), is_then: bool) {
    self.code.skippable("", |code| {
      code.glue("const ");
      code.copy(start, end);
      code.glue(if is_then {
        " = $$_await;"
      } else {
        " = $$_error;"
      });
    });
  }

  /// `{#snippet name<T>(parameters)}`: `async function name<T>(parameters) {`.
  fn snippet_block(&mut self, start: usize) -> Read<()> {
    self.declares();
    let name = self.read_identifier()?;
    self.allow_whitespace();

    if self.peek() == Some(b'<') {
      let mut depth = 0u32;
      while let Some(byte) = self.peek() {
        self.position += 1;
        match byte {
          b'<' => depth += 1,
          b'>' => {
            depth -= 1;
            if depth == 0 {
              break;
            }
          }
          _ => {}
        }
      }
      self.allow_whitespace();
    }

    let mut head_end = self.position;
    let has_parameters = self.eat("(");
    if has_parameters {
      let parameters = self.read_expression_to(b'(', b')')?;
      head_end = parameters.end + 1;
    }
    self.allow_whitespace();
    self.expect("}")?;

    if name.0 == name.1 {
      self.code.glue("{");
    } else {
      self.code.glue("async function ");
      self.code.skippable("$$_snippet()", |code| {
        code.copy(name.0, head_end);
        if !has_parameters {
          code.glue("()");
        }
      });
      self.code.glue(" {");
    }
    self.push(FrameKind::Snippet, (start, start), "}");
    Ok(())
  }

  /// `{:else}`, `{:else if …}`, `{:then …}`, `{:catch …}`.
  fn continue_block(&mut self, start: usize) -> Read<()> {
    let Some(frame) = self.stack.last().copied() else {
      return Err(error("block continuation outside a block", start));
    };

    match frame.kind {
      FrameKind::If => {
        if !self.eat("else") {
          return Err(error("expected token {:else} or {:else if}", start));
        }
        if self.matches("if") {
          return Err(error("expected `{:else if …}`, not `{:elseif …}`", start));
        }
        if frame.has_else {
          return Err(error("duplicate {:else}", start));
        }
        self.allow_whitespace();
        if self.eat("if") {
          self.require_whitespace()?;
          let test = self.read_expression()?;
          self.code.glue("} else if (");
          self.value(test);
          self.code.glue(") {");
        } else {
          self.allow_whitespace();
          self.expect("}")?;
          self.code.glue("} else {");
          self.set_top(|frame| frame.has_else = true);
        }
        Ok(())
      }

      FrameKind::Each => {
        if !self.eat("else") {
          return Err(error("expected token {:else}", start));
        }
        if frame.has_else {
          return Err(error("duplicate {:else}", start));
        }
        self.allow_whitespace();
        self.expect("}")?;
        self.code.glue("} {");
        self.set_top(|frame| frame.has_else = true);
        Ok(())
      }

      FrameKind::Await => {
        let is_then = if self.eat("then") {
          if frame.has_else {
            return Err(error("duplicate {:then}", start));
          }
          true
        } else if self.eat("catch") {
          if frame.has_catch {
            return Err(error("duplicate {:catch}", start));
          }
          false
        } else {
          return Err(error("expected token {:then …} or {:catch …}", start));
        };

        self.code.glue("} {");
        if !self.eat("}") {
          self.require_whitespace()?;
          let value = self.read_expression()?;
          if !self.is_blank(value.start, value.end) {
            self.write_branch_value((value.start, value.end), is_then);
          }
        }
        self.set_top(|frame| {
          if is_then {
            frame.has_else = true;
          } else {
            frame.has_catch = true;
          }
        });
        Ok(())
      }

      _ => Err(error("block continuation in the wrong place", start)),
    }
  }

  fn set_top(&mut self, change: impl FnOnce(&mut Frame)) {
    if let Some(frame) = self.stack.last_mut() {
      change(frame);
    }
  }

  /// `{/if}` and the like: closes the block, and in the loose mode what is left open in it.
  fn close_block(&mut self, start: usize) -> Read<()> {
    loop {
      let Some(frame) = self.stack.last().copied() else {
        return Err(error("unexpected block closing tag", start));
      };
      let name = match frame.kind {
        FrameKind::If => "if",
        FrameKind::Each => "each",
        FrameKind::Key => "key",
        FrameKind::Await => "await",
        FrameKind::Snippet => "snippet",
        FrameKind::Element(ElementKind::Regular) => {
          self.pop();
          continue;
        }
        FrameKind::Element(_) => return Err(error("unexpected block closing tag", start)),
      };

      if self.eat(name) {
        self.allow_whitespace();
        self.expect("}")?;
        self.pop();
        return Ok(());
      }
      self.pop();
    }
  }

  fn special_tag(&mut self, start: usize) -> Read<()> {
    if self.eat("html") || self.eat("render") {
      self.require_whitespace()?;
      let expression = self.read_expression()?;
      self.statement(expression);
      return Ok(());
    }

    if self.eat("debug") {
      let expression = self.read_expression()?;
      self.statement(expression);
      return Ok(());
    }

    if self.eat("const") {
      // `{@const t = m}`: `const t = m;`
      self.require_whitespace()?;
      self.declares();
      let declaration = self.read_expression()?;
      self.code.skippable("", |code| {
        code.glue("const ");
        code.copy(declaration.start, declaration.end);
        code.glue(";");
      });
      return Ok(());
    }

    Err(error(
      "expected `html`, `render`, `const` or `debug`",
      start,
    ))
  }
}

fn directive_of(prefix: &[u8]) -> Option<Directive> {
  Some(match prefix {
    b"on" => Directive::On,
    b"bind" => Directive::Bind,
    b"class" => Directive::Class,
    b"style" => Directive::Style,
    b"use" => Directive::Use,
    b"in" | b"out" | b"transition" => Directive::Transition,
    b"animate" => Directive::Animate,
    b"let" => Directive::Let,
    _ => return None,
  })
}
