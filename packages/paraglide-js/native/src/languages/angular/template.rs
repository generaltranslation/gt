//! An Angular template's expressions, written as statements: `;(expression\n);`, or, when it reads
//! template variables (`let-x`, `@for (x of …)`, `as x`, `#ref`, a `@let` before it), an arrow of
//! them, `;((x) => (expression\n));`, so that they shadow the component's fields. Of an expression
//! with pipes, each part without one is written: of `value | pipe:argument`, the value and the
//! argument.
//!
//! Which parts of the template are expressions, and which names they see, follows Angular's own
//! compiler: `htmlAstToRender3Ast`, `BindingParser` and `R3TargetBinder`.

use std::borrow::Cow;

use super::expr::{comment_start, is_quote, ExprParser, Key, Mode, NodeKind, TemplateBindings};
use super::lexer::{self, Kind, Token};
use super::tags::{named_entity, numeric_entity};
use super::text::{write_mapped, Mapped, MappedBuilder};
use super::tree::{self, Attr, Data, Name, Tree, NONE};
use crate::languages::CodeBuilder;

/// Writes the expressions of the template `template` (its text mapped to the file) to `code`.
/// Fails when Angular rejects its markup, e.g. an unclosed block.
pub fn write_template(code: &mut CodeBuilder, template: &Mapped) -> Result<(), String> {
  let text: &str = &template.text;
  let reject = |message: String| format!("Angular rejected the template: {message}");
  let tokens = lexer::tokenize(text).map_err(reject)?;
  let tree = tree::build(text, &tokens).map_err(reject)?;

  // Angular makes nothing of a template whose i18n attributes it rejects.
  if has_forbidden_i18n_attribute(text, &tree) {
    return Ok(());
  }

  let mut walker = Walker {
    text,
    tokens: &tokens,
    tree: &tree,
    parser: ExprParser::default(),
    roots: Vec::new(),
    scope_parents: vec![NONE],
    declarations: Vec::new(),
    units: Vec::new(),
    copies: Vec::new(),
    reads: Vec::new(),
  };
  walker.walk_children(NONE, ROOT);
  walker.write(code, template);
  Ok(())
}

const ROOT: u32 = 0;

/// A name a scope declares: a template variable, a reference, or a `@let` (with where it starts).
struct Declaration<'a> {
  scope: u32,
  name: Cow<'a, str>,
  let_start: Option<u32>,
}

/// An expression of the template, or several (an interpolation's, a chain's).
struct Unit<'a> {
  scope: u32,
  /// The text its offsets are in: a decoded value, or the template's own text.
  text: Option<Mapped<'a>>,
  /// Its parts to write, `copies[start..end]`.
  copies: (u32, u32),
}

/// A part of an expression to write, and the names it reads, `reads[start..end]`.
struct Copy {
  start: u32,
  end: u32,
  reads: (u32, u32),
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum UnitMode {
  /// `[prop]="…"`, `@if (…)`: Angular's `parseBinding`.
  Binding,
  /// `(event)="…"`: `parseAction`.
  Action,
  /// Text or an attribute value with `{{ }}`: `parseInterpolation`.
  Interpolation,
  /// An ICU expansion's switch value: `parseInterpolationExpression`.
  Expression,
}

struct Walker<'a> {
  text: &'a str,
  tokens: &'a [Token],
  tree: &'a Tree<'a>,
  parser: ExprParser,
  roots: Vec<u32>,
  scope_parents: Vec<u32>,
  declarations: Vec<Declaration<'a>>,
  units: Vec<Unit<'a>>,
  copies: Vec<Copy>,
  reads: Vec<(u32, u32)>,
}

impl<'a> Walker<'a> {
  fn new_scope(&mut self, parent: u32) -> u32 {
    self.scope_parents.push(parent);
    self.scope_parents.len() as u32 - 1
  }

  fn declare(&mut self, scope: u32, name: Cow<'a, str>) {
    self.declarations.push(Declaration {
      scope,
      name,
      let_start: None,
    });
  }

  fn slice(&self, range: (u32, u32)) -> &'a str {
    &self.text[range.0 as usize..range.1 as usize]
  }

  fn walk_children(&mut self, parent: u32, scope: u32) {
    let mut next = self.tree.children(parent).next().unwrap_or(NONE);
    while next != NONE {
      let node = next;
      next = self.tree.nodes[node as usize].next;
      match self.tree.nodes[node as usize].data {
        Data::Text { .. } => {
          let value = self.text_value(node);
          let length = value.text.len() as u32;
          self.add_unit(scope, Some(value), 0, length, UnitMode::Interpolation);
        }
        Data::Element { name, attrs, .. } => self.walk_element(node, name, attrs, scope),
        Data::Block { .. } => next = self.walk_block(node, scope),
        Data::Let { name, value } => {
          let token = self.tokens[value as usize];
          self.add_unit(scope, None, token.start, token.end, UnitMode::Binding);
          let start = self.tree.nodes[node as usize].start;
          self.declarations.push(Declaration {
            scope,
            name: Cow::Borrowed(self.slice(name)),
            let_start: Some(start),
          });
        }
        Data::Expansion { .. } => self.walk_expansion(node, scope),
        Data::Comment | Data::ExpansionCase => {}
      }
    }
  }

  // Elements.

  fn walk_element(&mut self, node: u32, name: Name<'a>, attrs: (u32, u32), scope: u32) {
    let tree = self.tree;
    let attrs = tree.element_attrs(attrs);

    let local = name.local;
    let is_style = name.prefix.is_none() && local.eq_ignore_ascii_case("style");
    let is_script = local.eq_ignore_ascii_case("script");
    if is_style || is_script || self.is_stylesheet(name, attrs) {
      return;
    }
    let is_content = local.eq_ignore_ascii_case("ng-content");
    let is_template = local == "ng-template";
    let non_bindable = attrs
      .iter()
      .any(|attr| attr.prefix.is_none() && attr.name == "ngNonBindable");

    let is_wrapped = attrs
      .iter()
      .any(|attr| attr.prefix.is_none() && attr.name.starts_with('*'));
    let element_scope = if is_wrapped {
      self.new_scope(scope)
    } else {
      scope
    };

    // `*directive="…"`: its expressions are the outer scope's, its variables the template's.
    for attr in attrs {
      if attr.prefix.is_none() && attr.name.starts_with('*') {
        self.template_bindings(attr, scope, element_scope);
      }
    }

    let template_scope = if is_template {
      Some(self.new_scope(element_scope))
    } else {
      None
    };
    for attr in attrs {
      if attr.prefix.is_some() {
        if !is_content {
          self.attribute_interpolation(attr, element_scope);
        }
        continue;
      }
      let attr_name = attr.name;
      if attr_name.starts_with('*') || attr_name == "i18n" || attr_name.starts_with("i18n-") {
        continue;
      }
      self.attribute(attr, element_scope, template_scope, is_content);
    }

    if non_bindable {
      return;
    }
    let children_scope = match template_scope {
      Some(template_scope) => template_scope,
      None if is_content => self.new_scope(element_scope),
      None => element_scope,
    };
    self.walk_children(node, children_scope);
  }

  /// `<link rel="stylesheet" href="…">`, which Angular leaves out.
  fn is_stylesheet(&self, name: Name, attrs: &[Attr]) -> bool {
    if name.prefix.is_some() || !name.local.eq_ignore_ascii_case("link") {
      return false;
    }
    let value_of = |wanted: &str| {
      attrs
        .iter()
        .find(|attr| attr.prefix.is_none() && attr.name.eq_ignore_ascii_case(wanted))
        .map(|attr| self.attr_value(attr).text.into_owned())
    };
    if value_of("rel").as_deref() != Some("stylesheet") {
      return false;
    }
    match value_of("href") {
      None => false,
      Some(href) if href.is_empty() || href.starts_with('/') => false,
      Some(href) => {
        let scheme_end = href.find([':', '/', '?', '#']);
        match scheme_end {
          Some(end) if end > 0 && href.as_bytes()[end] == b':' => {
            matches!(&href[..end], "package" | "asset")
          }
          _ => true,
        }
      }
    }
  }

  fn attribute(
    &mut self,
    attr: &Attr<'a>,
    scope: u32,
    template_scope: Option<u32>,
    is_content: bool,
  ) {
    let name = attr.name;
    enum Binding {
      Property,
      Event,
      TwoWay,
      Animation,
    }
    let binding = if name.starts_with("bind-") {
      Some(Binding::Property)
    } else if let Some(variable) = name.strip_prefix("let-") {
      if let Some(template_scope) = template_scope {
        self.declare(template_scope, Cow::Borrowed(variable));
      }
      None
    } else if let Some(reference) = name.strip_prefix("ref-").or_else(|| name.strip_prefix('#')) {
      if !is_content {
        self.declare(scope, Cow::Borrowed(reference));
      }
      None
    } else if name.starts_with("on-") {
      Some(Binding::Event)
    } else if name.starts_with("bindon-") {
      Some(Binding::TwoWay)
    } else if name.starts_with('@') {
      Some(Binding::Animation)
    } else if name.starts_with("[(") && name.ends_with(")]") && name.len() > 4 {
      Some(Binding::TwoWay)
    } else if name.starts_with('[') && name.ends_with(']') && name.len() > 2 {
      let property = &name[1..name.len() - 1];
      if property.starts_with('@') || property.starts_with("animate-") {
        Some(Binding::Animation)
      } else {
        Some(Binding::Property)
      }
    } else if name.starts_with('(') && name.ends_with(')') && name.len() > 2 {
      Some(Binding::Event)
    } else {
      if !is_content {
        self.attribute_interpolation(attr, scope);
      }
      return;
    };

    let Some(binding) = binding else {
      return;
    };
    // `<ng-content>` keeps none of its bindings.
    if is_content {
      return;
    }
    let value = self.attr_value(attr);
    let length = value.text.len() as u32;
    match binding {
      Binding::Property => self.add_unit(scope, Some(value), 0, length, UnitMode::Binding),
      Binding::Event => self.add_unit(scope, Some(value), 0, length, UnitMode::Action),
      Binding::TwoWay => {
        let event = self.attr_value(attr);
        self.add_unit(scope, Some(value), 0, length, UnitMode::Binding);
        self.add_unit(scope, Some(event), 0, length, UnitMode::Action);
      }
      // Without a value, Angular binds the text `undefined`, which is not in the template.
      Binding::Animation if length > 0 => {
        self.add_unit(scope, Some(value), 0, length, UnitMode::Binding)
      }
      Binding::Animation => {}
    }
  }

  fn attribute_interpolation(&mut self, attr: &Attr<'a>, scope: u32) {
    let value = self.attr_value(attr);
    if value.text.contains("{{") {
      let length = value.text.len() as u32;
      self.add_unit(scope, Some(value), 0, length, UnitMode::Interpolation);
    }
  }

  fn template_bindings(&mut self, attr: &Attr<'a>, outer: u32, template: u32) {
    let value = self.attr_value(attr);
    let text: &str = &value.text;
    let mut bindings = TemplateBindings::default();
    self.parser.reset();
    let parsed = self
      .parser
      .parse_template_bindings(text, 0, text.len(), &mut bindings);

    for key in bindings.variables {
      let name = match key {
        Key::Range(start, end) => match value.text {
          Cow::Borrowed(text) => Cow::Borrowed(&text[start as usize..end as usize]),
          Cow::Owned(ref text) => Cow::Owned(text[start as usize..end as usize].to_string()),
        },
        Key::Owned(name) => Cow::Owned(name),
      };
      self.declare(template, name);
    }

    let start = self.copies.len() as u32;
    if parsed.is_ok() {
      for &root in &bindings.values {
        self.collect(root);
      }
    }
    let end = self.copies.len() as u32;
    self.units.push(Unit {
      scope: outer,
      text: Some(value),
      copies: (start, end),
    });
  }

  // Blocks.

  fn parameters(&self, node: u32) -> &'a [Token] {
    match self.tree.nodes[node as usize].data {
      Data::Block { parameters, .. } => {
        &self.tokens[parameters.0 as usize..(parameters.0 + parameters.1) as usize]
      }
      _ => &[],
    }
  }

  fn block_name(&self, node: u32) -> &'a str {
    match self.tree.nodes[node as usize].data {
      Data::Block { name, .. } => name,
      _ => "",
    }
  }

  /// The blocks after `primary` that `accepts` connects to it (whitespace and comments between),
  /// and the node to go on from.
  fn connected_blocks(&self, primary: u32, accepts: fn(&str) -> bool) -> (Vec<u32>, u32) {
    let mut connected = Vec::new();
    let mut cursor = self.tree.nodes[primary as usize].next;
    let mut resume = cursor;
    while cursor != NONE {
      let node = &self.tree.nodes[cursor as usize];
      match node.data {
        Data::Comment => {}
        Data::Text { .. } if self.is_blank(cursor) => {}
        Data::Block { name, .. } if accepts(name) => {
          connected.push(cursor);
          resume = node.next;
        }
        _ => break,
      }
      cursor = node.next;
    }
    (connected, resume)
  }

  fn walk_block(&mut self, node: u32, scope: u32) -> u32 {
    let next = self.tree.nodes[node as usize].next;
    match self.block_name(node) {
      "if" => {
        let (connected, resume) =
          self.connected_blocks(node, |name| name == "else" || name == "else if");
        self.conditional_branch(node, scope);
        for block in connected {
          if self.block_name(block) == "else if" {
            self.conditional_branch(block, scope);
          } else {
            let branch = self.new_scope(scope);
            self.walk_children(block, branch);
          }
        }
        resume
      }
      "for" => {
        let (connected, resume) = self.connected_blocks(node, |name| name == "empty");
        if self.for_loop(node, scope) {
          if let Some(&empty) = connected
            .iter()
            .find(|&&block| self.parameters(block).is_empty())
          {
            let empty_scope = self.new_scope(scope);
            self.walk_children(empty, empty_scope);
          }
        }
        resume
      }
      "switch" => {
        self.switch(node, scope);
        next
      }
      "defer" => {
        let (connected, resume) = self.connected_blocks(node, |name| {
          matches!(name, "placeholder" | "loading" | "error")
        });
        self.defer(node, &connected, scope);
        resume
      }
      "boundary" => {
        let (connected, resume) = self.connected_blocks(node, |name| name == "error");
        let boundary = self.new_scope(scope);
        self.walk_children(node, boundary);
        for block in connected {
          self.boundary_error(block, scope);
        }
        resume
      }
      "content" => {
        if self.is_valid_content_block(node) {
          let content = self.new_scope(scope);
          self.walk_children(node, content);
        }
        next
      }
      // Unknown blocks, and connected ones out of place: Angular keeps none of their content.
      _ => next,
    }
  }

  /// A parameter's expression, `parameter[start..]`, as a binding.
  fn parameter_unit(&mut self, parameter: Token, start: usize, end: usize, scope: u32) {
    self.add_unit(
      scope,
      None,
      parameter.start + start as u32,
      parameter.start + end as u32,
      UnitMode::Binding,
    );
  }

  fn parameter_text(&self, parameter: Token) -> &'a str {
    self.slice((parameter.start, parameter.end))
  }

  /// `@if (condition; as alias)` and `@else if (…)`.
  fn conditional_branch(&mut self, node: u32, scope: u32) {
    let parameters = self.parameters(node);
    let Some(&condition) = parameters.first() else {
      return;
    };
    let text = self.parameter_text(condition);
    self.parameter_unit(condition, 0, text.len(), scope);

    let branch = self.new_scope(scope);
    for &parameter in &parameters[1..] {
      let text = self.parameter_text(parameter);
      let Some(rest) = text.strip_prefix("as") else {
        continue;
      };
      if !rest.starts_with(is_js_space) {
        continue;
      }
      let rest = rest.trim_start_matches(is_js_space);
      let alias = rest
        .split(['\n', '\r', '\u{2028}', '\u{2029}'])
        .next()
        .unwrap_or("");
      let alias = alias.trim();
      if is_identifier(alias) {
        self.declare(branch, Cow::Borrowed(alias));
        break;
      }
    }
    self.walk_children(node, branch);
  }

  /// `@for (item of items; track item.id; let i = $index)`: whether Angular keeps it.
  fn for_loop(&mut self, node: u32, scope: u32) -> bool {
    let parameters = self.parameters(node);
    let Some(&expression) = parameters.first() else {
      return false;
    };
    let text = self.parameter_text(expression);
    let Some(stripped) = strip_optional_parentheses(text) else {
      return false;
    };
    let Some((item, raw)) = for_loop_expression(stripped) else {
      return false;
    };
    if raw.trim().is_empty() {
      return false;
    }
    let raw_start = text.rfind(raw).unwrap_or(0);
    self.parameter_unit(expression, raw_start, raw_start + raw.len(), scope);

    let loop_scope = self.new_scope(scope);
    self.declare(loop_scope, Cow::Borrowed(item));
    for name in ["$index", "$first", "$last", "$even", "$odd", "$count"] {
      self.declare(loop_scope, Cow::Borrowed(name));
    }
    let mut has_track = false;
    for &parameter in &parameters[1..] {
      let text = self.parameter_text(parameter);
      if let Some(variables) = let_parameters(text) {
        for (name, _) in let_assignments(variables, "") {
          self.declare(loop_scope, Cow::Borrowed(name));
        }
        continue;
      }
      if let Some(rest) = text.strip_prefix("track") {
        if rest.starts_with(is_js_space) {
          if !has_track {
            has_track = true;
            let track = rest.trim_start_matches(is_js_space);
            let start = text.rfind(track).unwrap_or(0);
            self.parameter_unit(parameter, start, start + track.len(), loop_scope);
          }
          continue;
        }
      }
    }
    self.walk_children(node, loop_scope);
    true
  }

  fn switch(&mut self, node: u32, scope: u32) {
    if let Some(&expression) = self.parameters(node).first() {
      let text = self.parameter_text(expression);
      self.parameter_unit(expression, 0, text.len(), scope);
    }

    let mut child = self.tree.nodes[node as usize].first_child;
    while child != NONE {
      let current = child;
      child = self.tree.nodes[current as usize].next;
      let Data::Block { name, close, .. } = self.tree.nodes[current as usize].data else {
        continue;
      };
      let parameters = self.parameters(current);
      match name {
        "case" if !parameters.is_empty() => {
          let parameter = parameters[0];
          let text = self.parameter_text(parameter);
          self.parameter_unit(parameter, 0, text.len(), scope);
        }
        "default" => {}
        "default never" => {
          if let Some(&parameter) = parameters.first() {
            let text = self.parameter_text(parameter);
            self.parameter_unit(parameter, 0, text.len(), scope);
          }
          continue;
        }
        _ => continue,
      }
      let has_no_body = self.tree.nodes[current as usize].first_child == NONE
        && close.is_some_and(|(start, end)| start == end);
      if !has_no_body {
        let group = self.new_scope(scope);
        self.walk_children(current, group);
      }
    }
  }

  fn defer(&mut self, node: u32, connected: &[u32], scope: u32) {
    let deferred = self.new_scope(scope);
    self.walk_children(node, deferred);

    // `when`, `prefetch when` and `hydrate when`: the first of each.
    let mut seen = [false; 3];
    for &parameter in self.parameters(node) {
      let text = self.parameter_text(parameter);
      let kind = if starts_with_word(text, "when") {
        0
      } else if let Some(rest) = strip_word(text, "prefetch") {
        if !starts_with_word(rest, "when") {
          continue;
        }
        1
      } else if let Some(rest) = strip_word(text, "hydrate") {
        if !starts_with_word(rest, "when") {
          continue;
        }
        2
      } else {
        continue;
      };
      if std::mem::replace(&mut seen[kind], true) {
        continue;
      }
      let Some(when) = text.find("when") else {
        continue;
      };
      let start = match trigger_parameters_start(text, when + 1) {
        Some(start) => start,
        None => text.len().saturating_sub(1),
      };
      self.parameter_unit(parameter, start, text.len(), scope);
    }

    let mut seen_blocks: Vec<&str> = Vec::new();
    for &block in connected {
      let name = self.block_name(block);
      if seen_blocks.contains(&name) {
        continue;
      }
      if !self.is_valid_defer_block(block, name) {
        continue;
      }
      seen_blocks.push(name);
      let block_scope = self.new_scope(scope);
      self.walk_children(block, block_scope);
    }
  }

  fn is_valid_defer_block(&self, block: u32, name: &str) -> bool {
    let parameters = self.parameters(block);
    let mut seen: Vec<&str> = Vec::new();
    for &parameter in parameters {
      let text = self.parameter_text(parameter);
      let kind = match name {
        "placeholder" if starts_with_word(text, "minimum") => "minimum",
        "loading" if starts_with_word(text, "minimum") => "minimum",
        "loading" if starts_with_word(text, "after") => "after",
        _ => return false,
      };
      if seen.contains(&kind) {
        return false;
      }
      seen.push(kind);
      let time = match trigger_parameters_start(text, 0) {
        Some(start) => &text[start..],
        None => &text[text.len().saturating_sub(1)..],
      };
      if !is_deferred_time(time) {
        return false;
      }
    }
    true
  }

  /// `@error` of a `@boundary`: `$error`, `$reset` and its `let` aliases, and its `when`.
  fn boundary_error(&mut self, block: u32, scope: u32) {
    let error_scope = self.new_scope(scope);
    self.declare(error_scope, Cow::Borrowed("$error"));
    self.declare(error_scope, Cow::Borrowed("$reset"));
    let mut has_when = false;
    for &parameter in self.parameters(block) {
      let text = self.parameter_text(parameter);
      let variables = let_parameters(text).or_else(|| is_alias(text).then_some(text));
      if let Some(variables) = variables {
        for (name, _) in let_assignments(variables, "$error") {
          self.declare(error_scope, Cow::Borrowed(name));
        }
        continue;
      }
      if let Some(rest) = text.strip_prefix("when") {
        if rest.starts_with(is_js_space) && !has_when {
          has_when = true;
          let expression = rest.trim_start_matches(is_js_space);
          let expression = expression
            .split(['\n', '\r', '\u{2028}', '\u{2029}'])
            .next()
            .unwrap_or("");
          let start = text.find(expression).unwrap_or(0);
          self.parameter_unit(parameter, start, start + expression.len(), error_scope);
        }
      }
    }
    self.walk_children(block, error_scope);
  }

  fn is_valid_content_block(&self, node: u32) -> bool {
    let parameters = self.parameters(node);
    if parameters.is_empty() || parameters.len() > 2 {
      return false;
    }
    let name = self.parameter_text(parameters[0]).trim();
    if name.contains(',') || !is_identifier(name) {
      return false;
    }
    match parameters.get(1) {
      Some(&variables) => let_parameters(self.parameter_text(variables).trim()).is_some(),
      None => true,
    }
  }

  // ICU expansions.

  fn walk_expansion(&mut self, node: u32, scope: u32) {
    let mut placeholders: Vec<(String, (u32, u32))> = Vec::new();
    let mut variables: Vec<(u32, u32)> = Vec::new();
    self.icu(node, &mut placeholders, &mut variables);
    for (start, end) in variables {
      self.add_unit(scope, None, start, end, UnitMode::Expression);
    }
    for (_, (start, end)) in placeholders {
      let text = self.slice((start, end));
      if text.contains("{{") {
        let value = Mapped::verbatim(text, start);
        let length = value.text.len() as u32;
        self.add_unit(scope, Some(value), 0, length, UnitMode::Interpolation);
      }
    }
  }

  /// The placeholders of an ICU expansion, as Angular's i18n visitor names them: each one's
  /// text, the last for a name.
  fn icu(
    &self,
    expansion: u32,
    placeholders: &mut Vec<(String, (u32, u32))>,
    variables: &mut Vec<(u32, u32)>,
  ) {
    for case in self.tree.children(expansion) {
      for child in self.tree.children(case) {
        self.i18n_placeholders(child, placeholders, variables);
      }
    }
    if let Data::Expansion { switch_value } = self.tree.nodes[expansion as usize].data {
      let token = self.tokens[switch_value as usize];
      variables.push((token.start, token.end));
    }
  }

  fn i18n_placeholders(
    &self,
    node: u32,
    placeholders: &mut Vec<(String, (u32, u32))>,
    variables: &mut Vec<(u32, u32)>,
  ) {
    match self.tree.nodes[node as usize].data {
      Data::Text { first, last, .. } if first != last => {
        for token in &self.tokens[first as usize..=last as usize] {
          if token.kind == Kind::Interpolation {
            let key = format!("PH {}", self.slice(token.part0));
            add_placeholder(placeholders, key, (token.start, token.end));
          }
        }
      }
      Data::Element {
        name,
        attrs,
        start_tag_end,
      } => {
        for child in self.tree.children(node) {
          self.i18n_placeholders(child, placeholders, variables);
        }
        let mut signature: Vec<(&str, String)> = self
          .tree
          .element_attrs(attrs)
          .iter()
          .map(|attr| {
            let value = attr.value.map_or(String::new(), |(first, last)| {
              let start = self.tokens[first as usize].start;
              let end = self.tokens[last as usize].end;
              self.slice((start, end)).to_string()
            });
            (attr.name, value)
          })
          .collect();
        signature.sort();
        let key = format!("TAG {:?} {:?} {:?}", name.prefix, name.local, signature);
        let start = self.tree.nodes[node as usize].start;
        add_placeholder(placeholders, key, (start, start_tag_end));
      }
      Data::Block {
        name, start_end, ..
      } => {
        for child in self.tree.children(node) {
          self.i18n_placeholders(child, placeholders, variables);
        }
        if name != "switch" {
          let mut parameters: Vec<&str> = self
            .parameters(node)
            .iter()
            .map(|parameter| self.parameter_text(*parameter))
            .collect();
          parameters.sort_unstable();
          let key = format!("BLOCK {name} {parameters:?}");
          let start = self.tree.nodes[node as usize].start;
          add_placeholder(placeholders, key, (start, start_end));
        }
      }
      Data::Expansion { .. } => self.icu(node, placeholders, variables),
      _ => {}
    }
  }

  // Values.

  fn is_blank(&self, node: u32) -> bool {
    let Data::Text { first, last, .. } = self.tree.nodes[node as usize].data else {
      return false;
    };
    let start = self.tokens[first as usize].start as usize;
    let end = self.tokens[last as usize].end as usize;
    let raw = &self.text[start..end];
    if !raw.contains('&') {
      return raw.trim().is_empty();
    }
    self.text_value(node).text.trim().is_empty()
  }

  /// A text node's value, as Angular decodes it: its character references resolved.
  fn text_value(&self, node: u32) -> Mapped<'a> {
    let Data::Text {
      first,
      last,
      skips_line_break,
    } = self.tree.nodes[node as usize].data
    else {
      return Mapped::verbatim("", 0);
    };
    let start = self.tokens[first as usize].start + u32::from(skips_line_break);
    let end = self.tokens[last as usize].end;
    self.decoded(first, last, start, end)
  }

  fn attr_value(&self, attr: &Attr<'a>) -> Mapped<'a> {
    match attr.value {
      None => Mapped::verbatim("", 0),
      Some((first, last)) => {
        let start = self.tokens[first as usize].start;
        let end = self.tokens[last as usize].end;
        self.decoded(first, last, start, end)
      }
    }
  }

  /// `text[start..end]`, the tokens `first..=last`, with character references decoded: those the
  /// lexer read, and those in interpolations (`&([^;]+);`).
  fn decoded(&self, first: u32, last: u32, start: u32, end: u32) -> Mapped<'a> {
    let raw = &self.text[start as usize..end as usize];
    if !raw.contains('&') {
      return Mapped::verbatim(raw, start);
    }

    let mut builder = MappedBuilder::new(raw.len());
    for token in &self.tokens[first as usize..=last as usize] {
      let token_start = token.start.max(start) as usize;
      let token_end = token.end as usize;
      match token.kind {
        Kind::EncodedEntity => {
          let reference = &self.text[token_start..token_end];
          let decoded = decode_entity_token(reference).unwrap_or_default();
          builder.replace(&decoded, token_start, token_end);
        }
        Kind::Interpolation | Kind::AttrValueInterpolation => {
          let mut copied = token_start;
          let mut index = token_start;
          while let Some(offset) = self.text[index..token_end].find('&') {
            let ampersand = index + offset;
            let Some(semicolon) = self.text[ampersand + 1..token_end]
              .find(';')
              .map(|offset| ampersand + 1 + offset)
            else {
              break;
            };
            if semicolon == ampersand + 1 {
              index = ampersand + 1;
              continue;
            }
            let reference = &self.text[ampersand..=semicolon];
            if let Some(decoded) = decode_reference(reference) {
              builder.copy(self.text, copied, ampersand);
              builder.replace(&decoded, ampersand, semicolon + 1);
              copied = semicolon + 1;
            }
            index = semicolon + 1;
          }
          builder.copy(self.text, copied, token_end);
        }
        _ => builder.copy(self.text, token_start, token_end),
      }
    }
    builder.finish(start)
  }

  // Expressions.

  /// Parses `text[start..end]` (the unit's text, or the template's) in `mode`, and keeps its parts
  /// to write, if Angular accepts it.
  fn add_unit(
    &mut self,
    scope: u32,
    text: Option<Mapped<'a>>,
    start: u32,
    end: u32,
    mode: UnitMode,
  ) {
    let copies_start = self.copies.len() as u32;
    let source: &str = text.as_ref().map_or(self.text, |text| &text.text);
    if self.parse_unit(source, start as usize, end as usize, mode) {
      let roots = std::mem::take(&mut self.roots);
      for &root in &roots {
        self.collect(root);
      }
      self.roots = roots;
    }
    let copies_end = self.copies.len() as u32;
    if copies_end > copies_start {
      self.units.push(Unit {
        scope,
        text,
        copies: (copies_start, copies_end),
      });
    }
  }

  /// Whether the expression has no error, with its roots in `roots`.
  fn parse_unit(&mut self, source: &str, start: usize, end: usize, mode: UnitMode) -> bool {
    self.parser.reset();
    self.roots.clear();
    let input = &source[start..end];
    match mode {
      UnitMode::Binding | UnitMode::Action => {
        if input.starts_with("{{") && interpolation_end(input.as_bytes(), 1).is_some() {
          return false;
        }
        let parser_mode = if mode == UnitMode::Action {
          Mode::Action
        } else {
          Mode::Binding
        };
        let parsed = self
          .parser
          .parse(source, start, end, parser_mode, &mut self.roots);
        // An empty handler is an error, which Angular writes as garbage.
        parsed.is_ok() && !(mode == UnitMode::Action && self.roots.is_empty())
      }
      UnitMode::Expression => self
        .parser
        .parse(source, start, end, Mode::Binding, &mut self.roots)
        .is_ok(),
      UnitMode::Interpolation => {
        let bytes = input.as_bytes();
        let mut index = 0;
        while let Some(offset) = memchr::memmem::find(&bytes[index..], b"{{") {
          let expression_start = index + offset + 2;
          let Some(expression_end) = interpolation_end(bytes, expression_start) else {
            break;
          };
          let expression = &input[expression_start..expression_end];
          if expression.trim().is_empty() {
            return false;
          }
          if let Some(comment) = comment_start(expression.as_bytes()) {
            if expression[..comment].trim().is_empty() {
              return false;
            }
          }
          let parsed = self.parser.parse(
            source,
            start + expression_start,
            start + expression_end,
            Mode::Binding,
            &mut self.roots,
          );
          if parsed.is_err() {
            return false;
          }
          index = expression_end + 2;
        }
        true
      }
    }
  }

  /// Keeps the parts of `node` to write: the node, or, if it has a pipe, those of its children.
  fn collect(&mut self, node: u32) {
    let current = self.parser.nodes[node as usize];
    if current.kind == NodeKind::TemplateElement {
      return;
    }
    if !current.has_pipe {
      if current.end > current.start {
        let reads_start = self.reads.len() as u32;
        for id in current.first..=node {
          let read = self.parser.nodes[id as usize];
          if read.kind == NodeKind::Read {
            self.reads.push((read.start, read.end));
          }
        }
        self.copies.push(Copy {
          start: current.start,
          end: current.end,
          reads: (reads_start, self.reads.len() as u32),
        });
      }
      return;
    }
    let kids = self.parser.kids(node).len();
    for index in 0..kids {
      let kid = self.parser.kids(node)[index];
      self.collect(kid);
    }
  }

  // Writing.

  fn write(&self, code: &mut CodeBuilder, template: &Mapped) {
    // The declarations of each scope, in the order Angular declares them.
    let scopes = self.scope_parents.len();
    let mut starts = vec![0u32; scopes + 1];
    for declaration in &self.declarations {
      starts[declaration.scope as usize + 1] += 1;
    }
    for index in 1..=scopes {
      starts[index] += starts[index - 1];
    }
    let mut filled = starts.clone();
    let mut ordered = vec![0u32; self.declarations.len()];
    for (index, declaration) in self.declarations.iter().enumerate() {
      let slot = &mut filled[declaration.scope as usize];
      ordered[*slot as usize] = index as u32;
      *slot += 1;
    }

    let lookup = |scope: u32, name: &str, at: u32| -> bool {
      let mut scope = scope;
      while scope != NONE {
        let range = starts[scope as usize] as usize..starts[scope as usize + 1] as usize;
        let found = ordered[range]
          .iter()
          .map(|&index| &self.declarations[index as usize])
          .find(|declaration| declaration.name == name);
        if let Some(declaration) = found {
          return declaration.let_start.is_none_or(|start| start < at);
        }
        scope = self.scope_parents[scope as usize];
      }
      false
    };

    let mut variables: Vec<&str> = Vec::new();
    for unit in &self.units {
      let source: &str = unit.text.as_ref().map_or(self.text, |text| &text.text);
      for copy in &self.copies[unit.copies.0 as usize..unit.copies.1 as usize] {
        variables.clear();
        for &(start, end) in &self.reads[copy.reads.0 as usize..copy.reads.1 as usize] {
          let name = &source[start as usize..end as usize];
          if variables.contains(&name) || is_reserved(name) {
            continue;
          }
          let at = unit.text.as_ref().map_or(start, |text| text.outer(start));
          if lookup(unit.scope, name, at) {
            variables.push(name);
          }
        }

        if variables.is_empty() {
          code.glue(";(");
        } else {
          code.glue(";((");
          for (index, variable) in variables.iter().enumerate() {
            if index > 0 {
              code.glue(", ");
            }
            code.glue(variable);
          }
          code.glue(") => (");
        }
        code.skippable("0", |code| {
          write_mapped(code, template, unit.text.as_ref(), copy.start, copy.end)
        });
        code.glue(if variables.is_empty() {
          "\n);\n"
        } else {
          "\n));\n"
        });
      }
    }
  }
}

/// Adds a placeholder, or gives the one of its key this range: the last one of a key counts.
fn add_placeholder(placeholders: &mut Vec<(String, (u32, u32))>, key: String, range: (u32, u32)) {
  match placeholders
    .iter_mut()
    .find(|(existing, _)| *existing == key)
  {
    Some(placeholder) => placeholder.1 = range,
    None => placeholders.push((key, range)),
  }
}

/// The text of a character reference the lexer read, as it decodes it.
fn decode_entity_token(reference: &str) -> Option<String> {
  let inner = reference.strip_prefix('&')?.strip_suffix(';')?;
  let text = match inner.strip_prefix('#') {
    Some(numeric) => match numeric.strip_prefix(['x', 'X']) {
      Some(hex) => numeric_entity(hex, true)?.to_string(),
      None => numeric_entity(numeric, false)?.to_string(),
    },
    None => named_entity(inner)?.to_string(),
  };
  Some(if text == "\u{e500}" {
    " ".to_string()
  } else {
    text
  })
}

/// The text of a character reference in an interpolation, `&amp;`, `&#64;` or `&#x40;`, as the
/// tree builder decodes it.
fn decode_reference(reference: &str) -> Option<String> {
  let inner = reference.strip_prefix('&')?.strip_suffix(';')?;
  if let Some(numeric) = inner.strip_prefix('#') {
    let (digits, hex) = match numeric.strip_prefix(['x', 'X']) {
      Some(hex) => (hex, true),
      None => (numeric, false),
    };
    let valid = if hex {
      !digits.is_empty() && digits.bytes().all(|byte| byte.is_ascii_hexdigit())
    } else {
      !digits.is_empty() && digits.bytes().all(|byte| byte.is_ascii_digit())
    };
    if !valid {
      return None;
    }
    return numeric_entity(digits, hex).map(String::from);
  }
  let text = named_entity(inner)?;
  // `&ngsp;` is Angular's own space.
  Some(if text == "\u{e500}" {
    " ".to_string()
  } else {
    text.to_string()
  })
}

/// Where `}}` ends the interpolation from `start`, outside quotes (`_getInterpolationEndIndex`).
fn interpolation_end(input: &[u8], start: usize) -> Option<usize> {
  let mut quote: Option<u8> = None;
  let mut escapes = 0;
  let mut index = start;
  while index < input.len() {
    let character = input[index];
    if is_quote(character) && (quote.is_none() || quote == Some(character)) && escapes % 2 == 0 {
      quote = if quote.is_none() {
        Some(character)
      } else {
        None
      };
    } else if quote.is_none() {
      if input[index..].starts_with(b"}}") {
        return Some(index);
      }
      if input[index..].starts_with(b"//") {
        return memchr::memmem::find(&input[index..], b"}}").map(|offset| index + offset);
      }
    }
    escapes = if character == b'\\' { escapes + 1 } else { 0 };
    index += 1;
  }
  None
}

/// JavaScript's `\s`.
fn is_js_space(character: char) -> bool {
  character.is_whitespace() || character == '\u{feff}'
}

/// `/^[$A-Z_][0-9A-Z_$]*$/i`.
fn is_identifier(name: &str) -> bool {
  let mut bytes = name.bytes();
  bytes
    .next()
    .is_some_and(|first| first.is_ascii_alphabetic() || first == b'_' || first == b'$')
    && bytes.all(|byte| byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'$')
}

/// `/^word\s/`.
fn starts_with_word(text: &str, word: &str) -> bool {
  text
    .strip_prefix(word)
    .is_some_and(|rest| rest.starts_with(is_js_space))
}

/// `text` without `/^word\s+/`.
fn strip_word<'t>(text: &'t str, word: &str) -> Option<&'t str> {
  let rest = text.strip_prefix(word)?;
  rest
    .starts_with(is_js_space)
    .then(|| rest.trim_start_matches(is_js_space))
}

/// `let a = b, c` → `a = b, c`: `/^let\s+([\S\s]*)/`.
fn let_parameters(text: &str) -> Option<&str> {
  strip_word(text, "let")
}

/// `/^\s*[$A-Z_][0-9A-Z_$]*\s*=/i`.
fn is_alias(text: &str) -> bool {
  let rest = text.trim_start_matches(is_js_space);
  let name_end = rest
    .find(|character: char| !(character.is_ascii_alphanumeric() || matches!(character, '_' | '$')))
    .unwrap_or(rest.len());
  let name = &rest[..name_end];
  is_identifier(name)
    && rest[name_end..]
      .trim_start_matches(is_js_space)
      .starts_with('=')
}

/// The variables of `a = b, c = d` (`parseLetParameters`): each name, and the variable it is.
fn let_assignments<'t>(text: &'t str, implicit: &'t str) -> Vec<(&'t str, &'t str)> {
  let mut variables = Vec::new();
  for part in text.split(',') {
    let sides: Vec<&str> = part.split('=').collect();
    let name = sides[0].trim();
    let variable = if sides.len() == 2 {
      sides[1].trim()
    } else {
      implicit
    };
    if name.is_empty() || variable.is_empty() || !is_identifier(name) {
      continue;
    }
    variables.push((name, variable));
  }
  variables
}

/// `@for ((item of items))` → `item of items`; none if the parentheses are unbalanced.
fn strip_optional_parentheses(text: &str) -> Option<&str> {
  let bytes = text.as_bytes();
  let mut open = 0;
  let mut start = 0;
  for (index, &byte) in bytes.iter().enumerate() {
    if byte == b'(' {
      start = index + 1;
      open += 1;
    } else if !byte.is_ascii_whitespace() {
      break;
    }
  }
  if open == 0 {
    return Some(text);
  }
  let mut end = bytes.len().saturating_sub(1);
  for index in (0..bytes.len()).rev() {
    let byte = bytes[index];
    if byte == b')' {
      end = index;
      open -= 1;
      if open == 0 {
        break;
      }
    } else if !byte.is_ascii_whitespace() {
      break;
    }
  }
  if open != 0 || end < start {
    return None;
  }
  Some(&text[start..end])
}

/// `/^\s*([0-9A-Za-z_$]*)\s+of\s+([\S\s]*)/`: the item, and the expression.
fn for_loop_expression(text: &str) -> Option<(&str, &str)> {
  let after_space = text.trim_start_matches(is_js_space);
  let leading = text.len() - after_space.len();
  let item_end = after_space
    .find(|character: char| !(character.is_ascii_alphanumeric() || matches!(character, '_' | '$')))
    .unwrap_or(after_space.len());
  let matched =
    of_expression(&after_space[item_end..]).map(|rest| (&after_space[..item_end], rest));
  // Else, as the regular expression backtracks: no item, the last leading space before `of`.
  matched.or_else(|| {
    let space = text[..leading].char_indices().last()?.0;
    of_expression(&text[space..]).map(|rest| ("", rest))
  })
}

/// The expression after `/\s+of\s+/` at the start of `text`.
fn of_expression(text: &str) -> Option<&str> {
  let of = text.trim_start_matches(is_js_space);
  if of.len() == text.len() {
    return None;
  }
  let expression = of.strip_prefix("of")?;
  let trimmed = expression.trim_start_matches(is_js_space);
  (trimmed.len() < expression.len()).then_some(trimmed)
}

/// The start of a trigger's parameters: the first character after a space, from `from` on.
fn trigger_parameters_start(text: &str, from: usize) -> Option<usize> {
  let mut found_space = false;
  for (index, character) in text.char_indices() {
    if index < from {
      continue;
    }
    if is_js_space(character) {
      found_space = true;
    } else if found_space {
      return Some(index);
    }
  }
  None
}

/// `/^\d+\.?\d*(ms|s)?$/`.
fn is_deferred_time(text: &str) -> bool {
  let digits = text.bytes().take_while(u8::is_ascii_digit).count();
  if digits == 0 {
    return false;
  }
  let mut rest = &text[digits..];
  if let Some(after) = rest.strip_prefix('.') {
    rest = after.trim_start_matches(|character: char| character.is_ascii_digit());
  }
  matches!(rest, "" | "ms" | "s")
}

/// Words a parameter cannot be named in a module.
fn is_reserved(name: &str) -> bool {
  matches!(
    name,
    "break"
      | "case"
      | "catch"
      | "class"
      | "const"
      | "continue"
      | "debugger"
      | "default"
      | "delete"
      | "do"
      | "else"
      | "enum"
      | "export"
      | "extends"
      | "false"
      | "finally"
      | "for"
      | "function"
      | "if"
      | "import"
      | "in"
      | "instanceof"
      | "new"
      | "null"
      | "return"
      | "super"
      | "switch"
      | "this"
      | "throw"
      | "true"
      | "try"
      | "typeof"
      | "var"
      | "void"
      | "while"
      | "with"
      | "yield"
      | "let"
      | "static"
      | "implements"
      | "interface"
      | "package"
      | "private"
      | "protected"
      | "public"
      | "await"
      | "arguments"
      | "eval"
  )
}

/// Whether an element has an `i18n-…` attribute Angular forbids (an event handler, or a
/// Trusted Types sink), which makes it keep nothing of the template.
fn has_forbidden_i18n_attribute(text: &str, tree: &Tree) -> bool {
  if memchr::memmem::find(text.as_bytes(), b"i18n-").is_none() {
    return false;
  }
  fn visit(tree: &Tree, node: u32) -> bool {
    for child in tree.children(node) {
      match tree.nodes[child as usize].data {
        Data::Element { name, attrs, .. } => {
          let element = match name.prefix {
            Some(prefix) => format!(":{prefix}:{}", name.local),
            None => name.local.to_string(),
          }
          .to_ascii_lowercase();
          for attr in tree.element_attrs(attrs) {
            let Some(property) = attr
              .name
              .strip_prefix("i18n-")
              .filter(|_| attr.prefix.is_none())
            else {
              continue;
            };
            let property = property.to_ascii_lowercase();
            let is_event_handler =
              property.len() > 2 && property != "only" && property.starts_with("on");
            let is_sink = matches!(property.as_str(), "innerhtml" | "outerhtml")
              || matches!(
                (element.as_str(), property.as_str()),
                ("iframe", "srcdoc")
                  | ("embed", "src")
                  | ("iframe", "src")
                  | ("object", "codebase")
                  | ("object", "data")
              );
            if is_event_handler || is_sink {
              return true;
            }
          }
          if visit(tree, child) {
            return true;
          }
        }
        Data::Block { .. } if visit(tree, child) => return true,
        _ => {}
      }
    }
    false
  }
  visit(tree, NONE)
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::languages::Skipped;
  use crate::lower::Lang;

  /// The statements written for `template`.
  fn written(template: &str) -> Result<Vec<String>, String> {
    let skipped = Skipped::default();
    let mut code = CodeBuilder::new(template, &skipped);
    write_template(&mut code, &Mapped::verbatim(template, 0))?;
    let code = code.finish(Lang::Ts).code.code;
    Ok(
      code
        .split(";\n")
        .map(|statement| statement.replace('\n', ""))
        .filter(|statement| !statement.is_empty())
        .collect(),
    )
  }

  fn statements(template: &str) -> Vec<String> {
    written(template).unwrap_or_else(|error| vec![format!("error: {error}")])
  }

  #[test]
  fn bindings_events_and_interpolations() {
    let mut written = statements(
      r#"<h1 [title]="m.a()" title="x {{ m.b() }}" (click)="n = n + 1; m.c()">{{ m.d() }} {{ e }}</h1>"#,
    );
    written.sort();
    assert_eq!(
      written,
      [
        ";(e)",
        ";(m.a())",
        ";(m.b())",
        ";(m.c())",
        ";(m.d())",
        ";(n = n + 1)"
      ]
    );
  }

  #[test]
  fn pipes_write_their_value_and_arguments() {
    assert_eq!(
      statements("{{ m.price() | currency:m.currency():'symbol' }}"),
      [";(m.price())", ";(m.currency())", ";('symbol')"]
    );
    assert_eq!(
      statements("{{ (m.paren() | async) ?? m.fallback() }}"),
      [";(m.paren())", ";(m.fallback())"]
    );
  }

  #[test]
  fn template_variables_are_parameters() {
    assert_eq!(
      statements("@for (item of items; track item.id; let i = $index) { {{ m.row(item, i) }} }"),
      [
        ";(items)",
        ";((item) => (item.id))",
        ";((item, i) => (m.row(item, i)))"
      ]
    );
    assert_eq!(
      statements("@if (m.cond(); as m) { {{ m.x() }} } @else { {{ m.y() }} }"),
      [";(m.cond())", ";((m) => (m.x()))", ";(m.y())"]
    );
    assert_eq!(
      statements("<li *ngFor=\"let m of items; index as i\" [title]=\"m.t\">{{ i }}</li>"),
      [";(items)", ";((m) => (m.t))", ";((i) => (i))"]
    );
    assert_eq!(
      statements("{{ x }} @let x = 1; {{ x }} <p #ref>{{ ref }}</p>"),
      [";(x)", ";(1)", ";((x) => (x))", ";((ref) => (ref))"]
    );
    assert_eq!(
      statements("<ng-template let-row=\"m\" #t>{{ row }} {{ m.a() }}</ng-template>{{ t }}"),
      [";((row) => (row))", ";(m.a())", ";((t) => (t))"]
    );
  }

  #[test]
  fn two_way_bindings_and_structural_aliases() {
    assert_eq!(
      statements("<input [(ngModel)]=\"m.value\" bindon-x=\"y\">"),
      [";(m.value)", ";(m.value)", ";(y)", ";(y)"]
    );
    assert_eq!(
      statements("<p *ngIf=\"m.load() | async as v; else t\">{{ v.a }}</p><ng-template #t>{{ $index }}</ng-template>"),
      [";(m.load())", ";((t) => (t))", ";((v) => (v.a))", ";($index)"]
    );
  }

  #[test]
  fn switch_cases_defer_and_loops() {
    assert_eq!(
      statements(
        "@switch (a) { @case (b) @case (c) { {{ d }} } @default { {{ e }} } <p>{{ ignored }}</p> }"
      ),
      [";(a)", ";(b)", ";(c)", ";(d)", ";(e)"]
    );
    assert_eq!(
      statements(
        "@defer (on idle; when w) { {{ a }} } @placeholder (fast) { {{ b }} } @loading { {{ c }} }"
      ),
      [";(a)", ";(w)", ";(c)"]
    );
    assert_eq!(
      statements("@for (x of xs; track $index) { {{ $index + $count }} } @empty { {{ x }} }"),
      [
        ";(xs)",
        ";(($index) => ($index))",
        ";(($index, $count) => ($index + $count))",
        ";(x)"
      ]
    );
  }

  #[test]
  fn icu_placeholders_of_the_same_text_are_one() {
    assert_eq!(
      statements("{n, plural, =1 {{{ m.a() }}} other {{{ m.a() }} {{ m.b() }}}}"),
      [";(n)", ";(m.a())", ";(m.b())"]
    );
  }

  #[test]
  fn what_angular_leaves_out() {
    assert_eq!(
      statements("<!-- {{ m.a() }} --><script>{{ m.b() }}</script><style>{{ m.c() }}</style><p ngNonBindable>{{ m.d() }}</p><p [x]=\"m.(\">{{ m.e() }}</p>@format { {{ m.f() }} }"),
      [";(m.e())"]
    );
  }

  #[test]
  fn icu_expansions() {
    assert_eq!(
      statements("<span i18n>{count, plural, =0 {none} other {<b title=\"{{ t }}\">{{ m.icu() }}</b>}}</span>"),
      [";(count)", ";(m.icu())", ";(t)"]
    );
  }

  #[test]
  fn entities_are_decoded_and_mapped() {
    assert_eq!(
      statements("<p [title]=\"a &amp;&amp; b\"></p>"),
      [";(a && b)"]
    );
    assert_eq!(statements("<p>me&#64;if.com {{ m.x() }}</p>"), [";(m.x())"]);
  }

  #[test]
  fn rejected_markup() {
    assert_eq!(
      written("@if (x) { <p>"),
      Err("Angular rejected the template: Unclosed block \"if\"".to_string())
    );
  }

  #[test]
  fn helpers() {
    assert_eq!(
      for_loop_expression("item of items"),
      Some(("item", "items"))
    );
    assert_eq!(for_loop_expression(" of xs"), Some(("", "xs")));
    assert_eq!(for_loop_expression("item offset"), None);
    assert_eq!(strip_optional_parentheses("((a of b))"), Some("a of b"));
    assert_eq!(strip_optional_parentheses("((a of b)"), None);
    assert!(is_deferred_time("500ms"));
    assert!(is_deferred_time("1.5s"));
    assert!(!is_deferred_time("fast"));
    assert_eq!(
      let_assignments("i = $index, e = $even", ""),
      [("i", "$index"), ("e", "$even")]
    );
    assert_eq!(let_assignments("e", "$error"), [("e", "$error")]);
    assert_eq!(interpolation_end(b"{{ '}}' }}", 2), Some(8));
  }
}
