//! Writes a component as one module for the analysis: its scripts as they are, then its template as
//! code that reads like it, in a function (as `@vue/language-core` writes the template in a
//! function of its own):
//!
//! - `{{ e }}`, `:title="e"`, `v-show="e"`, custom directives: `(e);`
//! - `v-if="e"`, `v-else-if="e"`, `v-else`: `if (e) {` … `}` and `{` … `}` around the element
//! - `v-for="(item, i) in list"`: `(list); for (const [item, i] of []) {` … `}` around the element
//! - `#row="{ m }"`, `v-slot`: `(({ m }) => {` … `});` around the children
//! - `@click="a(); b()"`: `($event) => {` statements `};`
//! - `<Child :label="e" kind="x" />`: `Child({ label: (e), kind: "x" });`, so that the call sites of
//!   `Child` are its props (`componentInstances: { via: 'call', path: [] }`)
//!
//! Each expression is copied as it is, with `CodeBuilder::expression`, so it maps to its exact place
//! in the file.

use std::borrow::Cow;

use memchr::memmem;

use super::{
  names::{camelize, component_name, is_identifier, is_native_tag, push_string_literal, trim},
  sfc::Sfc,
  template::{AttributeName, NodeKind, Span, Template},
};
use crate::{
  languages::{BuiltCode, CodeBuilder, Skipped},
  lower::Lang,
};

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum Kind {
  /// A plain attribute.
  Attribute,
  Bind,
  On,
  Model,
  Slot,
  If,
  ElseIf,
  Else,
  For,
  Pre,
  /// `v-once`, `v-cloak`
  Ignored,
  /// `v-show`, `v-html`, `v-text`, `v-memo` and custom directives.
  Other,
}

#[derive(Clone, Copy, Debug)]
enum Argument {
  None,
  Static(Span),
  /// `:[key]`, without its brackets.
  Dynamic(Span),
}

#[derive(Clone, Copy, Debug)]
struct Directive {
  kind: Kind,
  /// A plain attribute's name.
  name: AttributeName,
  argument: Argument,
  value: Option<Span>,
}

pub struct Writer<'s, 'a> {
  code: CodeBuilder<'s>,
  source: &'s str,
  /// What a template's spans index: the file, or for Markdown, the file blanked where it is no
  /// template.
  text: &'a [u8],
  /// Where the scripts differ from the file (Markdown's code blanks), in order.
  script_blanks: &'a [Span],
  /// Where `text` differs from the file, in order.
  template_blanks: &'a [Span],
  /// The components the scripts import from `.vue` files.
  imported: &'a [&'a str],
  directives: Vec<Directive>,
  /// What to write when the walk reaches each index: the ends of blocks around elements.
  closers: Vec<(u32, &'static str)>,
  scratch: String,
}

impl<'s, 'a> Writer<'s, 'a> {
  pub fn new(
    source: &'s str,
    skipped: &'s Skipped,
    text: &'a [u8],
    script_blanks: &'a [Span],
    template_blanks: &'a [Span],
    imported: &'a [&'a str],
  ) -> Self {
    Writer {
      code: CodeBuilder::new(source, skipped),
      source,
      text,
      script_blanks,
      template_blanks,
      imported,
      directives: Vec::new(),
      closers: Vec::new(),
      scratch: String::new(),
    }
  }

  pub fn finish(self, lang: Lang) -> BuiltCode {
    self.code.finish(lang)
  }

  /// The scripts, in the file's order, as they are.
  pub fn scripts(&mut self, sfc: &Sfc) {
    // `<script src="./logic.ts">` is the component, and the other script is not read, as
    // `@vue/language-core` writes it: `import __VLS_src from './logic.js'; export default __VLS_src;`
    if let Some(src) = sfc.script.and_then(|script| script.src) {
      let src = String::from_utf8_lossy(&self.source.as_bytes()[src.range()]);
      let src = match src.strip_suffix(".ts").filter(|_| !src.ends_with(".d.ts")) {
        Some(stem) => Cow::Owned(format!("{stem}.js")),
        None => match src.strip_suffix(".tsx") {
          Some(stem) => Cow::Owned(format!("{stem}.jsx")),
          None => src,
        },
      };
      let mut statement = String::from("import __VLS_src from ");
      push_string_literal(&mut statement, &src);
      statement.push_str(";\nexport default __VLS_src;\n");
      self.code.glue(&statement);
      return;
    }

    for script in sfc.scripts() {
      self.copy_blanked(script.content, self.script_blanks);
      self.code.glue("\n;\n");
    }
  }

  /// Copies `span` of the file, with spaces where `blanks` are.
  fn copy_blanked(&mut self, span: Span, blanks: &[Span]) {
    const SPACES: &str = "                                ";
    let (start, end) = (span.start as usize, span.end as usize);
    let mut position = start;
    let first = blanks.partition_point(|blank| (blank.end as usize) <= start);

    for blank in &blanks[first..] {
      let blank_start = (blank.start as usize).max(start);
      if blank_start >= end {
        break;
      }
      let blank_end = (blank.end as usize).min(end);
      if blank_start > position {
        self.copy(position, blank_start);
      }
      let mut length = blank_end.saturating_sub(blank_start.max(position));
      while length > 0 {
        let chunk = length.min(SPACES.len());
        self.code.glue(&SPACES[..chunk]);
        length -= chunk;
      }
      position = position.max(blank_end);
    }
    if position < end {
      self.copy(position, end);
    }
  }

  fn copy(&mut self, start: usize, end: usize) {
    if self.source.is_char_boundary(start) && self.source.is_char_boundary(end) {
      self.code.copy(start, end);
    }
  }

  /// The template, in a function after the scripts.
  pub fn template(&mut self, template: &Template) {
    if template.is_empty() {
      return;
    }

    self.code.glue("(() => {\n");
    let nodes = &template.nodes;
    let mut index = 0;
    while index < nodes.len() {
      self.close_blocks(index as u32);
      let node = nodes[index];
      match node.kind {
        NodeKind::Interpolation => {
          self.statement(node.span);
          index += 1;
        }
        NodeKind::Element => index = self.element(template, index),
      }
    }
    self.close_blocks(u32::MAX);
    self.code.glue("});\n");
  }

  fn close_blocks(&mut self, index: u32) {
    while let Some(&(end, closer)) = self.closers.last() {
      if end > index {
        break;
      }
      self.code.glue(closer);
      self.closers.pop();
    }
  }

  /// Writes the element at `index`; returns the index to go on from.
  fn element(&mut self, template: &Template, index: usize) -> usize {
    let node = template.nodes[index];
    let text = self.text;
    self.directives.clear();
    for attribute in template.attributes_of(&node) {
      let directive = directive(text, attribute.name, attribute.value);
      self.directives.push(directive);
    }
    // `v-pre`: neither the element nor its children are compiled.
    if self
      .directives
      .iter()
      .any(|directive| directive.kind == Kind::Pre)
    {
      return node.end as usize;
    }

    let tag: &[u8] = if node.span.is_empty() {
      b"div"
    } else {
      &text[node.span.range()]
    };
    let end = node.end;

    let condition = self
      .directives
      .iter()
      .find(|directive| matches!(directive.kind, Kind::If | Kind::ElseIf | Kind::Else))
      .copied();
    if let Some(condition) = condition {
      match (condition.kind, self.trimmed(condition.value)) {
        (Kind::If | Kind::ElseIf, Some(value)) => {
          self.code.glue("if (");
          self.expression(value);
          self.code.glue(") {\n");
        }
        _ => self.code.glue("{\n"),
      }
      self.closers.push((end, "}\n"));
    }

    let each = self
      .directives
      .iter()
      .find(|directive| directive.kind == Kind::For)
      .and_then(|directive| self.trimmed(directive.value));
    if let Some(each) = each {
      self.for_block(each, end);
    }

    if tag != b"slot" && self.is_component(tag) {
      self.component(tag, node.span);
    } else {
      self.element_statements();
    }

    let slot = self
      .directives
      .iter()
      .find(|directive| directive.kind == Kind::Slot)
      .copied();
    if let Some(slot) = slot {
      if let Argument::Dynamic(name) = slot.argument {
        self.statement(name);
      }
      if let Some(parameters) = self.trimmed(slot.value) {
        self.code.glue("((");
        self.copy_skippable(parameters);
        self.code.glue(") => {\n");
        self.closers.push((end, "});\n"));
      }
    }

    index + 1
  }

  /// `isComponent` of `@vue/compiler-core` with the DOM's native tags.
  fn is_component(&self, tag: &[u8]) -> bool {
    if tag == b"component" || tag.first().is_some_and(u8::is_ascii_uppercase) || !is_native_tag(tag)
    {
      return true;
    }
    self.directives.iter().any(|directive| {
      directive.kind == Kind::Attribute
        && self.attribute_name(directive.name) == b"is"
        && directive
          .value
          .is_some_and(|value| self.text[value.range()].starts_with(b"vue:"))
    })
  }

  fn attribute_name(&self, name: AttributeName) -> &'a [u8] {
    match name {
      AttributeName::Written(name) => &self.text[name.range()],
      AttributeName::Class => b"class",
      AttributeName::Id => b"id",
    }
  }

  /// `(source); for (const [aliases] of []) {`, from Vue's `parseForExpression`. The source is
  /// read before the loop, outside the aliases' scope (`v-for="m in m.list()"` reads the outer
  /// `m`), as `@vue/language-core` reads it; what the aliases hold is not followed either way.
  fn for_block(&mut self, value: Span, end: u32) {
    let Some((aliases, source)) = parse_for(self.text, value) else {
      self.statement(value);
      return;
    };
    self.statement(source);
    self.code.glue("for (const [");
    if let Some(aliases) = aliases {
      self.copy_skippable(aliases);
    }
    self.code.glue("] of []) {\n");
    self.closers.push((end, "}\n"));
  }

  /// A native element's directives, as statements.
  fn element_statements(&mut self) {
    for index in 0..self.directives.len() {
      let directive = self.directives[index];
      let value = self.trimmed(directive.value);
      match directive.kind {
        Kind::Bind => match (directive.argument, directive.value) {
          (Argument::Static(name), None) => {
            self.code.glue("(");
            self.shorthand(name);
            self.code.glue(");\n");
          }
          (Argument::Dynamic(name), _) => {
            self.statement(name);
            self.optional_statement(value);
          }
          _ => self.optional_statement(value),
        },
        Kind::On | Kind::Model | Kind::Other => self.directive_statement(directive, value),
        _ => {}
      }
    }
  }

  /// Event handlers and the other directives that are no props.
  fn directive_statement(&mut self, directive: Directive, value: Option<Span>) {
    if let Argument::Dynamic(name) = directive.argument {
      self.statement(name);
    }
    match (directive.kind, directive.argument, value) {
      (Kind::On, Argument::Static(_) | Argument::Dynamic(_), Some(value)) => self.handler(value),
      (_, _, value) => self.optional_statement(value),
    }
  }

  /// `Name({ props });`, then the directives that are no props.
  fn component(&mut self, tag: &[u8], tag_span: Span) {
    let is_written = self.callee(tag, tag_span);
    self.code.glue(if is_written { "({\n" } else { "(({\n" });

    for index in 0..self.directives.len() {
      let directive = self.directives[index];
      let value = self.trimmed(directive.value);
      match directive.kind {
        Kind::Attribute => {
          let name = self.attribute_name(directive.name);
          self.key(name);
          if name == b"style" {
            self.code.glue(": {},\n");
          } else if let Some(value) = directive.value {
            self.code.glue(": ");
            self.string_literal(value);
            self.code.glue(",\n");
          } else {
            self.code.glue(": true,\n");
          }
        }
        Kind::Bind => match directive.argument {
          Argument::Static(name) => {
            let name_text = &self.text[name.range()];
            if tag == b"component" && name_text == b"is" {
              continue;
            }
            match (directive.value, value) {
              (None, _) => {
                self.key(name_text);
                self.code.glue(": ");
                self.shorthand(name);
                self.code.glue(",\n");
              }
              (Some(_), Some(value)) => {
                self.key(name_text);
                self.property_value(value);
              }
              (Some(_), None) => {}
            }
          }
          Argument::Dynamic(name) => {
            if let Some(value) = value {
              self.computed_key(name);
              self.property_value(value);
            }
          }
          Argument::None => {
            if let Some(value) = value {
              self.code.glue("...(");
              self.expression(value);
              self.code.glue(self.line_end(value));
              self.code.glue("),\n");
            }
          }
        },
        Kind::Model => {
          if let Some(value) = value {
            match directive.argument {
              Argument::Static(name) => self.key(&self.text[name.range()]),
              Argument::Dynamic(name) => self.computed_key(name),
              Argument::None => self.code.glue("modelValue"),
            }
            self.property_value(value);
          }
        }
        _ => {}
      }
    }

    self.code.glue(if is_written { "});\n" } else { "}));\n" });

    for index in 0..self.directives.len() {
      let directive = self.directives[index];
      if matches!(directive.kind, Kind::On | Kind::Other) {
        let value = self.trimmed(directive.value);
        self.directive_statement(directive, value);
      }
    }
  }

  /// Writes what a component tag renders; false when it is nothing the analysis can follow.
  fn callee(&mut self, tag: &[u8], tag_span: Span) -> bool {
    if tag == b"component" {
      let is = self.directives.iter().find(|directive| {
        directive.kind == Kind::Bind
          && matches!(directive.argument, Argument::Static(name) if &self.text[name.range()] == b"is")
      });
      if let Some(value) = is.and_then(|directive| self.trimmed(directive.value)) {
        self.code.glue("(");
        self.expression(value);
        self.code.glue(self.line_end(value));
        self.code.glue(")");
        return true;
      }
    }

    let Ok(tag_text) = std::str::from_utf8(tag) else {
      return false;
    };
    let is_clean = self.is_clean(tag_span);

    if tag.contains(&b'.') {
      let is_member = tag.split(|&byte| byte == b'.').all(is_identifier);
      if is_member && is_clean {
        self
          .code
          .copy(tag_span.start as usize, tag_span.end as usize);
        return true;
      }
      return false;
    }

    match component_name(tag_text, self.imported) {
      Some(name) if is_clean => {
        if name == tag_text {
          self
            .code
            .copy(tag_span.start as usize, tag_span.end as usize);
        } else {
          self
            .code
            .write_for(tag_span.start as usize, tag_span.end as usize, &name);
        }
        true
      }
      Some(name) => {
        self.code.glue(&name);
        true
      }
      None => false,
    }
  }

  /// A prop's name, camelized as `@vue/language-core` writes a component's props.
  fn key(&mut self, name: &[u8]) {
    let name = String::from_utf8_lossy(name);
    // `getShouldCamelize`: not `myProp` (no hyphenated name), nor `aria-*` (an HTML attribute).
    let should_camelize =
      !name.bytes().any(|byte| byte.is_ascii_uppercase()) && !name.starts_with("aria-");
    let key = if should_camelize {
      camelize(&name)
    } else {
      Cow::Borrowed(name.as_ref())
    };

    if is_identifier(key.as_bytes()) {
      self.code.glue(&key);
    } else {
      let mut literal = std::mem::take(&mut self.scratch);
      literal.clear();
      push_string_literal(&mut literal, &key);
      self.code.glue(&literal);
      self.scratch = literal;
    }
  }

  fn computed_key(&mut self, name: Span) {
    self.code.glue("[(");
    self.expression(name);
    self.code.glue(self.line_end(name));
    self.code.glue(")]");
  }

  /// `: (value),`
  fn property_value(&mut self, value: Span) {
    self.code.glue(": (");
    self.expression(value);
    self.code.glue(self.line_end(value));
    self.code.glue("),\n");
  }

  /// A static attribute's value as a string.
  fn string_literal(&mut self, value: Span) {
    let value = String::from_utf8_lossy(&self.text[value.range()]);
    let mut literal = std::mem::take(&mut self.scratch);
    literal.clear();
    push_string_literal(&mut literal, &value);
    self.code.glue(&literal);
    self.scratch = literal;
  }

  /// `:message` alone reads `message`.
  fn shorthand(&mut self, name: Span) {
    let text = String::from_utf8_lossy(&self.text[name.range()]);
    let variable = camelize(&text);
    let is_written = is_identifier(variable.as_bytes()) && self.is_clean(name);
    let (start, end) = (name.start as usize, name.end as usize);
    self.code.skippable("0", |code| {
      if is_written {
        code.write_for(start, end, &variable);
      } else {
        code.glue("0");
      }
    });
  }

  /// An event handler: a function as it is, else statements in a function of `$event`.
  fn handler(&mut self, value: Span) {
    let text = &self.text[value.range()];
    if is_function(text) {
      self.statement(value);
      return;
    }
    let has_await = memmem::find(text, b"await").is_some();
    self.code.glue(if has_await {
      "async ($event) => {\n"
    } else {
      "($event) => {\n"
    });
    self.expression(value);
    self.code.glue("\n};\n");
  }

  fn optional_statement(&mut self, value: Option<Span>) {
    if let Some(value) = value {
      self.statement(value);
    }
  }

  /// `(expression);`
  fn statement(&mut self, value: Span) {
    let Some(value) = self.trimmed(Some(value)) else {
      return;
    };
    self.code.glue("(");
    self.expression(value);
    self.code.glue(self.line_end(value));
    self.code.glue(");\n");
  }

  /// A line break after an expression that ends in a `//` comment.
  fn line_end(&self, value: Span) -> &'static str {
    if memmem::find(&self.text[value.range()], b"//").is_some() {
      "\n"
    } else {
      ""
    }
  }

  fn expression(&mut self, value: Span) {
    if self.is_clean(value) {
      self
        .code
        .expression(value.start as usize, value.end as usize);
    } else {
      self.code.skippable("0", |code| code.glue("0"));
    }
  }

  /// Copies aliases or parameters, left out when they do not parse.
  fn copy_skippable(&mut self, span: Span) {
    let is_clean = self.is_clean(span);
    let (start, end) = (span.start as usize, span.end as usize);
    self.code.skippable("", |code| {
      if is_clean {
        code.copy(start, end);
      }
    });
  }

  /// Whether the template's `span` is the file's text, which can be copied.
  fn is_clean(&self, span: Span) -> bool {
    if self.template_blanks.is_empty() {
      return true;
    }
    let (start, end) = (span.start as usize, span.end as usize);
    if !self.source.is_char_boundary(start) || !self.source.is_char_boundary(end) {
      return false;
    }
    let first = self
      .template_blanks
      .partition_point(|blank| blank.end <= span.start);
    first >= self.template_blanks.len() || self.template_blanks[first].start >= span.end
  }

  /// The value without the spaces around it; none if it is empty.
  fn trimmed(&self, value: Option<Span>) -> Option<Span> {
    let value = value?;
    let (start, end) = trim(self.text, value.start as usize, value.end as usize);
    (start < end).then(|| Span::new(start, end))
  }
}

/// What an attribute is, from its name, as Vue's tokenizer splits it: `v-name:argument.modifiers`,
/// or the shorthands `:`, `.` (`v-bind`), `@` (`v-on`) and `#` (`v-slot`).
fn directive(text: &[u8], name: AttributeName, value: Option<Span>) -> Directive {
  let attribute = Directive {
    kind: Kind::Attribute,
    name,
    argument: Argument::None,
    value,
  };
  let AttributeName::Written(span) = name else {
    return attribute;
  };
  let written = &text[span.range()];

  let (kind, argument_start) = if written.len() > 2 && written.starts_with(b"v-") {
    let name_end = written[2..]
      .iter()
      .position(|&byte| byte == b':' || byte == b'.')
      .map_or(written.len(), |position| position + 2);
    let kind = match &written[2..name_end] {
      b"" => return attribute,
      b"bind" => Kind::Bind,
      b"on" => Kind::On,
      b"model" => Kind::Model,
      b"slot" => Kind::Slot,
      b"if" => Kind::If,
      b"else-if" => Kind::ElseIf,
      b"else" => Kind::Else,
      b"for" => Kind::For,
      b"pre" => Kind::Pre,
      b"once" | b"cloak" => Kind::Ignored,
      _ => Kind::Other,
    };
    let has_argument = written.get(name_end) == Some(&b':');
    (kind, has_argument.then_some(name_end + 1))
  } else {
    let kind = match written.first() {
      Some(b':' | b'.') => Kind::Bind,
      Some(b'@') => Kind::On,
      Some(b'#') => Kind::Slot,
      _ => return attribute,
    };
    (kind, Some(1))
  };

  let argument = match argument_start {
    None => Argument::None,
    Some(offset) => {
      let start = span.start as usize + offset;
      let end = span.end as usize;
      if text.get(start) == Some(&b'[') {
        let close = text[start..end]
          .iter()
          .position(|&byte| byte == b']')
          .map_or(end, |position| start + position);
        Argument::Dynamic(Span::new(start + 1, close))
      } else {
        let argument_end = text[start..end]
          .iter()
          .position(|&byte| byte == b'.')
          .map_or(end, |position| start + position);
        if argument_end > start {
          Argument::Static(Span::new(start, argument_end))
        } else {
          Argument::None
        }
      }
    }
  };

  Directive {
    kind,
    name,
    argument,
    value,
  }
}

/// `parseForExpression` of `@vue/compiler-core`: `/([\s\S]*?)\s+(?:in|of)\s+(\S[\s\S]*)/`, the
/// aliases without the parentheses around them, and the source.
fn parse_for(text: &[u8], value: Span) -> Option<(Option<Span>, Span)> {
  let (start, end) = (value.start as usize, value.end as usize);
  let is_space = |byte: u8| super::names::is_html_space(byte) || byte == b'\x0b';
  let mut position = start;

  while position < end {
    if !is_space(text[position]) || (position > start && is_space(text[position - 1])) {
      position += 1;
      continue;
    }
    let mut keyword = position;
    while keyword < end && is_space(text[keyword]) {
      keyword += 1;
    }
    let is_keyword = text[keyword..end].starts_with(b"in") || text[keyword..end].starts_with(b"of");
    let after = keyword + 2;
    if is_keyword && after < end && is_space(text[after]) {
      let mut source_start = after;
      while source_start < end && is_space(text[source_start]) {
        source_start += 1;
      }
      if source_start < end {
        let (source_start, source_end) = trim(text, source_start, end);
        let (mut alias_start, mut alias_end) = trim(text, start, position);
        if alias_start < alias_end && text[alias_start] == b'(' {
          alias_start += 1;
        }
        if alias_end > alias_start && text[alias_end - 1] == b')' {
          alias_end -= 1;
        }
        let (alias_start, alias_end) = trim(text, alias_start, alias_end);
        let aliases = (alias_start < alias_end).then(|| Span::new(alias_start, alias_end));
        return Some((aliases, Span::new(source_start, source_end)));
      }
    }
    position = keyword.max(position + 1);
  }

  None
}

/// Whether a handler is a function expression, which is no statement: `function () {}`.
fn is_function(text: &[u8]) -> bool {
  let keyword_at = |text: &[u8], keyword: &[u8]| {
    text.starts_with(keyword)
      && text
        .get(keyword.len())
        .is_none_or(|&byte| !super::names::is_word_byte(byte) && byte != b'$')
  };
  if keyword_at(text, b"function") {
    return true;
  }
  if keyword_at(text, b"async") {
    let rest = &text[5..];
    let spaces = rest
      .iter()
      .take_while(|&&byte| super::names::is_html_space(byte))
      .count();
    return spaces > 0 && keyword_at(&rest[spaces..], b"function");
  }
  false
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn v_for_splits_aliases_and_source() {
    let cases = [
      ("item in items", Some("item"), "items"),
      ("(m, index) in lists", Some("m, index"), "lists"),
      (
        "{ a, b } of list.filter(x => x)",
        Some("{ a, b }"),
        "list.filter(x => x)",
      ),
      ("n in 10", Some("n"), "10"),
      (
        "  ( value , key )  of  object ",
        Some("value , key"),
        "object",
      ),
      ("index in inner in outer", Some("index"), "inner in outer"),
    ];
    for (value, aliases, source) in cases {
      let Some(parsed) = parse_for(value.as_bytes(), Span::new(0, value.len())) else {
        panic!("{value}");
      };
      assert_eq!(
        parsed.0.map(|span| &value[span.range()]),
        aliases,
        "{value}"
      );
      assert_eq!(&value[parsed.1.range()], source, "{value}");
    }
    assert!(parse_for(b"items", Span::new(0, 5)).is_none());
    assert!(parse_for(b"x inside", Span::new(0, 8)).is_none());
  }

  #[test]
  fn directives_split_their_names() {
    let text = b"v-on:click.stop @[event] :title.camel v-my-dir:[a.b].x #default v-bind v-";
    let mut attributes = Vec::new();
    super::super::html::attributes(text, 0, text.len(), false, &mut attributes);
    let described: Vec<String> = attributes
      .iter()
      .map(|attribute| {
        let directive = directive(text, attribute.name, attribute.value);
        let argument = match directive.argument {
          Argument::None => String::new(),
          Argument::Static(span) => String::from_utf8_lossy(&text[span.range()]).into_owned(),
          Argument::Dynamic(span) => {
            format!("[{}]", String::from_utf8_lossy(&text[span.range()]))
          }
        };
        format!("{:?} {argument}", directive.kind)
      })
      .collect();
    assert_eq!(
      described,
      [
        "On click",
        "On [event]",
        "Bind title",
        "Other [a.b]",
        "Slot default",
        "Bind ",
        "Attribute ",
      ]
    );
  }

  #[test]
  fn function_handlers_are_expressions() {
    assert!(is_function(b"function () {}"));
    assert!(is_function(b"async function named() {}"));
    assert!(!is_function(b"functionCall()"));
    assert!(!is_function(b"async () => {}"));
  }
}
