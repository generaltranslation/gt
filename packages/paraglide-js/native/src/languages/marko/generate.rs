//! A Marko template as one TypeScript module, written for the analysis rather than for the type
//! checker: its statements as they are, then the template in a function that holds its scopes.
//!
//! ```ts
//! import { m } from "./paraglide/messages.js";   // import, export, static: as written
//! (class { onCreate() { … } });                   // Marko 5's class
//! (() => {
//! const input = __marko_input();                 // the props
//! let tagVariable;                               // tag variables the template hoists
//! (m.title()\n);                                 // ${…}, attribute values, tag arguments
//! (items\n);((item\n) => {(item.label\n);});     // <for|item| of=items>…</for>
//! {let el\n= 0;{…}}                              // <div/el>…</div>, scoped to the rest of its body
//! Card({"title": (m.title\n),"content": (() => {…}),});  // <Card title=m.title>…</Card>
//! });
//! ```
//!
//! Each expression is copied from the file as it is, so its usages map to where they are. A tag
//! named as a variable (`<Card>`, `<${Card}>`) is a call of the component with its input, which the
//! component reads as `input`.

use super::{
  parser::{self, Attr, AttrValue, ChildKind, Span, StaticKind, Tag, Tree, NONE},
  patterns,
};
use crate::{
  graph::{ComponentInstances, InstantiationSyntax, PropsReads},
  languages::{CodeBuilder, Generated, Skipped},
  load::GeneratedSource,
  lower::Lang,
};

/// What the template's `input` is: the props each call site renders the component with.
pub const INPUT_CALL: &str = "__marko_input";

pub fn generate(_file: &str, source: &str, skipped: &Skipped) -> Result<Generated, String> {
  let tree = parser::parse(source);
  let mut writer = Writer {
    code: CodeBuilder::new(source, skipped),
    tree: &tree,
    source,
    work: Vec::new(),
  };
  writer.program();
  let built = writer.code.finish(Lang::Ts);

  Ok(Generated {
    source: GeneratedSource {
      main: built.code,
      scripts: Vec::new(),
      language: "marko".to_string(),
      component_fields: Vec::new(),
      scope_objects: Vec::new(),
      props: Some(PropsReads {
        calls: vec![INPUT_CALL.to_string()],
        ..PropsReads::default()
      }),
      component_instances: Some(ComponentInstances {
        via: InstantiationSyntax::Call,
        path: Vec::new(),
      }),
    },
    expressions: built.expressions,
  })
}

/// What is left to write, innermost last.
enum Work {
  Glue(&'static str),
  /// The children from `next` on, as statements; `pending` blocks of tag variables are open.
  Body {
    next: u32,
    pending: u32,
    /// Leaves out attribute tags, which are the input of the component the body is in.
    skip_attr_tags: bool,
  },
  /// A component's input: `{ "attr": (value), … }`.
  Input(u32),
  /// `"name": ` for an attribute tag.
  Key(Span),
  Params(Span),
}

struct Writer<'s, 't> {
  code: CodeBuilder<'s>,
  tree: &'t Tree,
  source: &'s str,
  work: Vec<Work>,
}

/// How a tag that renders a component is called.
enum Callee {
  /// `<Card>`
  Name(Span),
  /// `<${expression}>`
  Expression(Span),
}

impl<'s> Writer<'s, '_> {
  /// Whether `span` is a range of the file this can copy.
  fn is_valid(&self, span: Span) -> bool {
    let (start, end) = (span.start as usize, span.end as usize);
    start <= end
      && end <= self.source.len()
      && self.source.is_char_boundary(start)
      && self.source.is_char_boundary(end)
  }

  fn text(&self, span: Span) -> &'s str {
    if self.is_valid(span) {
      &self.source[span.start as usize..span.end as usize]
    } else {
      ""
    }
  }

  fn copy(&mut self, span: Span) {
    if self.is_valid(span) {
      self.code.copy(span.start as usize, span.end as usize);
    }
  }

  /// Whether `span` holds code: not only whitespace and comments, which do not parse in `( )`.
  fn has_code(&self, span: Span) -> bool {
    self.is_valid(span) && has_code(&self.source.as_bytes()[span.start as usize..span.end as usize])
  }

  /// `(expression\n);`: the line break ends a line comment the expression may end with.
  fn expression_statement(&mut self, span: Span) {
    if !self.has_code(span) {
      return;
    }
    self.code.glue("(");
    self.code.expression(span.start as usize, span.end as usize);
    self.code.glue("\n);");
  }

  /// `expression\n` in a group the caller writes.
  fn expression(&mut self, span: Span) {
    if !self.has_code(span) {
      self.code.glue("0");
      return;
    }
    self.code.expression(span.start as usize, span.end as usize);
    self.code.glue("\n");
  }

  /// Statements, left out if they do not parse.
  fn statements(&mut self, span: Span) {
    if !self.is_valid(span) {
      return;
    }
    let (start, end) = (span.start as usize, span.end as usize);
    self.code.skippable("", |code| code.copy(start, end));
    self.code.glue("\n;");
  }

  // ---------------------------------------------------------------- the module

  fn program(&mut self) {
    let tree = self.tree;
    for statement in &tree.statics {
      let span = statement.span;
      match statement.kind {
        StaticKind::Import | StaticKind::Export => self.statements(span),
        StaticKind::Static => self.static_statements(span),
        StaticKind::Class => {
          // `class { … }`: Marko 5's component, whose methods are the file's code.
          let body = Span {
            start: span.start + "class".len() as u32,
            end: span.end,
          };
          if body.start <= body.end && self.is_valid(body) {
            let (start, end) = (body.start as usize, body.end as usize);
            self.code.skippable("", |code| {
              code.glue("(class");
              code.copy(start, end);
              code.glue("\n);");
            });
          }
        }
        StaticKind::Style => {}
      }
    }

    self.code.glue("(() => {\nconst input = ");
    self.code.glue(INPUT_CALL);
    self.code.glue("();\n");
    self.hoisted_variables();
    self.work.push(Work::Body {
      next: self.tree.first_child,
      pending: 0,
      skip_attr_tags: false,
    });
    self.run();
    self.code.glue("\n});\n");
  }

  /// `static …`, `server …` and `client …`, without the keyword; a `static { … }` block's
  /// statements are the module's.
  fn static_statements(&mut self, span: Span) {
    let bytes = self.source.as_bytes();
    let mut start = span.start as usize + "static ".len();
    let mut end = span.end as usize;
    if start > end {
      return;
    }

    let mut at = start;
    while at < end && bytes[at].is_ascii_whitespace() {
      at += 1;
    }
    if at < end && bytes[at] == b'{' {
      start = at + 1;
      end = end.saturating_sub(1).max(start);
    }

    self.statements(Span {
      start: start as u32,
      end: end as u32,
    });
  }

  /// `let a, b;` for the tag variables the whole template sees: those of its top level, and those
  /// Marko hoists from a body because no scope around it has one of their names.
  fn hoisted_variables(&mut self) {
    let names = hoisted_names(self.tree, self.source);
    if names.is_empty() {
      return;
    }

    self.code.glue("let ");
    for (index, name) in names.iter().enumerate() {
      if index > 0 {
        self.code.glue(", ");
      }
      self.copy(*name);
    }
    self.code.glue(";\n");
  }

  // ---------------------------------------------------------------- the template

  fn run(&mut self) {
    while let Some(work) = self.work.pop() {
      match work {
        Work::Glue(text) => self.code.glue(text),
        Work::Body {
          next,
          pending,
          skip_attr_tags,
        } => self.body(next, pending, skip_attr_tags),
        Work::Input(tag) => self.input(tag),
        Work::Key(name) => self.key(name),
        Work::Params(params) => self.params(params),
      }
    }
  }

  fn body(&mut self, next: u32, mut pending: u32, skip_attr_tags: bool) {
    let Some(child) = self.tree.children.get(next as usize).copied() else {
      for _ in 0..pending {
        self.code.glue("}");
      }
      return;
    };

    match child.kind {
      ChildKind::Text(_) => {}
      ChildKind::Placeholder(value) => self.expression_statement(value),
      ChildKind::Scriptlet(value) => self.statements(value),
      ChildKind::Tag(index) => {
        let tag = self.tree.tag(index);
        if !(skip_attr_tags && tag.is_attr_tag) {
          if tag.var.is_some() {
            pending += 1;
          }
          // The rest of the body, after this tag.
          self.work.push(Work::Body {
            next: child.next,
            pending,
            skip_attr_tags,
          });
          self.tag(index);
          return;
        }
      }
    }

    self.work.push(Work::Body {
      next: child.next,
      pending,
      skip_attr_tags,
    });
  }

  fn tag(&mut self, index: u32) {
    let tree = self.tree;
    let tag = tree.tag(index);

    if let Some(var) = tag.var {
      // `{let x\n= 0;`, closed at the end of the body: the variable is the tag's, which only
      // Marko knows, from the tag on.
      self.code.glue("{let ");
      if self.is_valid(var) {
        let (start, end) = (var.start as usize, var.end as usize);
        self
          .code
          .skippable("__marko_var", |code| code.copy(start, end));
      } else {
        self.code.glue("__marko_var");
      }
      self.code.glue("\n= 0;");
    }

    let callee = callee_of(tag, self.source);
    let expressions = &tag.expressions;
    let shorthand_start = match callee {
      // A component's name is its callee: only its shorthands' interpolations are left.
      Some(_) => tag.name_expressions as usize,
      None => 0,
    };
    for expression in expressions.iter().skip(shorthand_start) {
      self.expression_statement(expression.value);
    }

    match callee {
      Some(callee) => {
        match callee {
          Callee::Name(name) => self.copy(name),
          Callee::Expression(value) => {
            self.code.glue("(");
            self.expression(value);
            self.code.glue(")");
          }
        }
        self.code.glue("(");
        self.work.push(Work::Glue(");"));
        self.work.push(Work::Input(index));
      }
      None => self.element(index),
    }
  }

  /// A tag that is not a component's: its expressions as statements, its body as a block.
  fn element(&mut self, index: u32) {
    let tree = self.tree;
    let tag = tree.tag(index);

    if let Some(args) = tag.args {
      self.expression_statement(args);
    }
    for attr in tree.attrs(tag) {
      match attr {
        Attr::Named { args, value, .. } => {
          if let Some(args) = args {
            self.expression_statement(args);
          }
          match value {
            AttrValue::None => {}
            AttrValue::Expression(value) => {
              if !is_string_literal(self.source.as_bytes(), value) {
                self.expression_statement(value);
              }
            }
            AttrValue::Method { .. } => {
              self.code.glue("(");
              self.method(value);
              self.code.glue(");");
            }
          }
        }
        Attr::Spread(value) => self.expression_statement(value),
      }
    }

    if let Some(script) = text_only_script(tree, tag, self.source) {
      // A `<script>` of text only is code.
      if self.is_valid(script) {
        let (start, end) = (script.start as usize, script.end as usize);
        self.code.skippable("", |code| {
          code.glue("(async function () {");
          code.copy(start, end);
          code.glue("\n});");
        });
      }
      return;
    }

    if let Some(params) = tag.params {
      self.code.glue("((");
      self.params(params);
      self.code.glue(") => {");
      self.work.push(Work::Glue("});"));
    } else if tag.has_body() && !tag.only_text {
      self.code.glue("{");
      self.work.push(Work::Glue("}"));
    } else {
      // Text is no code.
      return;
    }
    self.work.push(Work::Body {
      next: tag.first_child,
      pending: 0,
      skip_attr_tags: false,
    });
  }

  /// `function (params) { body }` of `name(params) { body }`.
  fn method(&mut self, value: AttrValue) {
    let AttrValue::Method {
      is_async,
      type_params,
      params,
      body,
    } = value
    else {
      return;
    };
    let spans_valid = self.is_valid(params)
      && self.is_valid(body)
      && type_params.is_none_or(|types| self.is_valid(types));
    if !spans_valid {
      self.code.glue("0");
      return;
    }

    self.code.skippable("0", |code| {
      code.glue(if is_async {
        "async function "
      } else {
        "function "
      });
      if let Some(types) = type_params {
        code.copy(types.start as usize, types.end as usize);
      }
      code.copy(params.start as usize, params.end as usize);
      code.copy(body.start as usize, body.end as usize);
    });
    self.code.glue("\n");
  }

  /// A parameter list, left empty if it does not parse.
  fn params(&mut self, params: Span) {
    if self.is_valid(params) {
      let (start, end) = (params.start as usize, params.end as usize);
      self.code.skippable("", |code| code.copy(start, end));
    }
    self.code.glue("\n");
  }

  /// A component's input: its attributes, its attribute tags, and its body as `content`.
  fn input(&mut self, index: u32) {
    let tree = self.tree;
    let tag = tree.tag(index);
    self.code.glue("{");

    if let Some(args) = tag.args {
      self.code.glue("\"value\": (");
      self.expression(args);
      self.code.glue("),");
    }

    for attr in tree.attrs(tag) {
      match attr {
        Attr::Named { name, args, value } => {
          let key = match value {
            AttrValue::Method { .. } => name,
            _ => without_modifier(self.source.as_bytes(), name),
          };
          match value {
            AttrValue::Expression(value) => {
              self.key(key);
              self.code.glue("(");
              self.expression(value);
              self.code.glue("),");
            }
            AttrValue::Method { .. } => {
              self.key(key);
              self.code.glue("(");
              self.method(value);
              self.code.glue("),");
            }
            AttrValue::None => {
              if let Some(args) = args {
                self.key(key);
                self.code.glue("(");
                self.expression(args);
                self.code.glue("),");
              }
            }
          }
        }
        Attr::Spread(value) => {
          self.code.glue("...(");
          self.expression(value);
          self.code.glue("),");
        }
      }
    }

    // Written in order, so pushed in reverse.
    let mut items: Vec<Work> = Vec::new();

    for (name, tags) in attr_tags_of(tree, index, self.source) {
      items.push(Work::Key(name));
      if let [only] = tags[..] {
        items.push(Work::Input(only));
      } else {
        items.push(Work::Glue("["));
        for attr_tag in tags {
          items.push(Work::Input(attr_tag));
          items.push(Work::Glue(","));
        }
        items.push(Work::Glue("]"));
      }
      items.push(Work::Glue(","));
    }

    let has_content = tree
      .children(index)
      .any(|child| !matches!(child, ChildKind::Tag(child) if tree.tag(child).is_attr_tag));
    if let Some(params) = tag.params {
      items.push(Work::Glue("\"content\": (("));
      items.push(Work::Params(params));
      items.push(Work::Glue(") => {"));
    } else if has_content {
      items.push(Work::Glue("\"content\": (() => {"));
    }
    if tag.params.is_some() || has_content {
      items.push(Work::Body {
        next: tag.first_child,
        pending: 0,
        skip_attr_tags: true,
      });
      items.push(Work::Glue("}),"));
    }
    items.push(Work::Glue("}"));

    self.work.extend(items.into_iter().rev());
  }

  /// `"name": `, the text of `name` as a string.
  fn key(&mut self, name: Span) {
    let text = self.text(name);
    let text = if text.is_empty() { "value" } else { text };

    let mut key = String::with_capacity(text.len() + 4);
    key.push('"');
    for character in text.chars() {
      match character {
        '"' => key.push_str("\\\""),
        '\\' => key.push_str("\\\\"),
        '\n' => key.push_str("\\n"),
        '\r' => key.push_str("\\r"),
        '\u{2028}' => key.push_str("\\u2028"),
        '\u{2029}' => key.push_str("\\u2029"),
        _ => key.push(character),
      }
    }
    key.push_str("\": ");
    self.code.glue(&key);
  }
}

/// Whether `text` holds more than whitespace and comments.
fn has_code(text: &[u8]) -> bool {
  let mut at = 0;
  while at < text.len() {
    match text[at] {
      code if code.is_ascii_whitespace() => at += 1,
      b'/' if text.get(at + 1) == Some(&b'/') => {
        while at < text.len() && text[at] != b'\n' {
          at += 1;
        }
      }
      b'/' if text.get(at + 1) == Some(&b'*') => {
        match memchr::memmem::find(&text[at + 2..], b"*/") {
          Some(end) => at += 2 + end + 2,
          None => return false,
        }
      }
      _ => return true,
    }
  }
  false
}

/// `<Card>` and `<${expression}>` render a component, which is called with the tag's input.
fn callee_of(tag: &Tag, source: &str) -> Option<Callee> {
  if tag.is_attr_tag {
    return None;
  }

  if tag.name_expressions == 1 {
    let expression = tag.expressions.first()?;
    let is_whole_name = expression.span == tag.name;
    return is_whole_name.then_some(Callee::Expression(expression.value));
  }

  let name = tag.name_text?;
  let text = source.get(name.start as usize..name.end as usize)?;
  is_component_name(text).then_some(Callee::Name(name))
}

/// As the language tools tell a tag that names a variable: `/^[A-Z][a-zA-Z0-9_$]+$/`.
fn is_component_name(name: &str) -> bool {
  let bytes = name.as_bytes();
  bytes.len() >= 2
    && bytes[0].is_ascii_uppercase()
    && bytes[1..]
      .iter()
      .all(|&code| code.is_ascii_alphanumeric() || code == b'_' || code == b'$')
}

/// The text of a `<script>` that has nothing but text, which is code.
fn text_only_script(tree: &Tree, tag: &Tag, source: &str) -> Option<Span> {
  let name = tag.name_text?;
  let is_script = !tag.is_attr_tag
    && source.get(name.start as usize..name.end as usize) == Some("script")
    && tag.args.is_none()
    && tag.first_attr == NONE
    && tag.has_body()
    && tag.only_text;
  if !is_script {
    return None;
  }

  let first = tree.children.get(tag.first_child as usize)?;
  let last = tree.children.get(tag.last_child as usize)?;
  match (first.kind, last.kind) {
    (ChildKind::Text(first), ChildKind::Text(last)) => Some(Span {
      start: first.start,
      end: last.end,
    }),
    _ => None,
  }
}

/// Whether `span` is one string literal, `"…"` or `'…'`, which holds no usage.
fn is_string_literal(source: &[u8], span: Span) -> bool {
  let Some(text) = source.get(span.start as usize..span.end as usize) else {
    return false;
  };
  let [quote @ (b'"' | b'\''), inner @ .., last] = text else {
    return false;
  };
  if last != quote {
    return false;
  }

  let mut escaped = false;
  for &code in inner {
    if escaped {
      escaped = false;
    } else if code == b'\\' {
      escaped = true;
    } else if code == *quote {
      return false;
    }
  }
  !escaped
}

/// `name` without its `:modifier`.
fn without_modifier(source: &[u8], name: Span) -> Span {
  let (start, end) = (name.start as usize, name.end as usize);
  let Some(text) = source.get(start..end) else {
    return name;
  };
  match text.iter().rposition(|&code| code == b':') {
    Some(colon) if colon > 0 => Span {
      start: name.start,
      end: name.start + colon as u32,
    },
    _ => name,
  }
}

/// The attribute tags that are `tag`'s children, by name in order: `<@item>` twice is a list.
fn attr_tags_of(tree: &Tree, tag: u32, source: &str) -> Vec<(Span, Vec<u32>)> {
  let mut groups: Vec<(Span, Vec<u32>)> = Vec::new();

  let mut next = tree.tag(tag).first_child;
  while let Some(child) = tree.children.get(next as usize) {
    next = child.next;
    let ChildKind::Tag(index) = child.kind else {
      continue;
    };
    let attr_tag = tree.tag(index);
    let Some(name) = attr_tag.name_text.filter(|_| attr_tag.is_attr_tag) else {
      continue;
    };

    let text = source.get(name.start as usize..name.end as usize);
    let group = groups
      .iter_mut()
      .find(|(other, _)| source.get(other.start as usize..other.end as usize) == text);
    match group {
      Some((_, tags)) => tags.push(index),
      None => groups.push((name, vec![index])),
    }
  }

  groups
}

// ---------------------------------------------------------------- hoisting

#[derive(Clone, Copy, PartialEq, Eq)]
enum Binding {
  Var,
  Param,
  Hoisted,
}

struct Scope {
  parent: usize,
  bindings: Vec<(Span, Binding)>,
}

const PROGRAM: usize = 0;

/// The names the template declares for all of it, as the language tools scope tag variables: those
/// of its top level, and a body's that no scope around it binds, which Marko hoists.
fn hoisted_names(tree: &Tree, source_text: &str) -> Vec<Span> {
  if !tree.tags.iter().any(|tag| tag.var.is_some()) {
    return Vec::new();
  }
  let source = source_text.as_bytes();

  let text = |span: Span| {
    source
      .get(span.start as usize..span.end as usize)
      .unwrap_or(&[])
  };
  let mut scopes = vec![Scope {
    parent: usize::MAX,
    // `input`, a parameter of the template.
    bindings: Vec::new(),
  }];
  let mut candidates: Vec<(usize, Span)> = Vec::new();
  let mut names = Vec::new();

  // Each body in order, with its scope.
  let mut bodies: Vec<(u32, usize)> = vec![(tree.first_child, PROGRAM)];
  while let Some((next, scope)) = bodies.pop() {
    let Some(child) = tree.children.get(next as usize) else {
      continue;
    };
    bodies.push((child.next, scope));
    let ChildKind::Tag(index) = child.kind else {
      continue;
    };
    let tag = tree.tag(index);

    if let Some(var) = tag.var {
      names.clear();
      patterns::pattern_names(source, var, &mut names);
      for &name in &names {
        bind(&mut scopes[scope], text(name), name, Binding::Var, source);
        candidates.push((scope, name));
      }
    }

    if tag.has_body() {
      let body_scope = scopes.len();
      scopes.push(Scope {
        parent: scope,
        bindings: Vec::new(),
      });
      if let Some(params) = tag.params {
        names.clear();
        patterns::param_names(source, params, &mut names);
        for &name in &names {
          bind(
            &mut scopes[body_scope],
            text(name),
            name,
            Binding::Param,
            source,
          );
        }
      }
      if text_only_script(tree, tag, source_text).is_none() {
        bodies.push((tag.first_child, body_scope));
      }
    }
  }

  for (scope, name) in candidates {
    let name_text = text(name);
    let mut current = scopes[scope].parent;

    while let Some(parent) = scopes.get(current) {
      let found = parent
        .bindings
        .iter()
        .find(|(other, _)| text(*other) == name_text)
        .map(|(_, binding)| *binding);
      if found.is_some() || name_text == b"input" && current == PROGRAM {
        // A hoisted name gathers the variables of that name; any other binding shadows them.
        break;
      }
      if current == PROGRAM {
        scopes[PROGRAM].bindings.push((name, Binding::Hoisted));
        break;
      }
      current = parent.parent;
    }
  }

  let program = &scopes[PROGRAM];
  program
    .bindings
    .iter()
    .filter(|(name, binding)| *binding != Binding::Param && text(*name) != b"input")
    .map(|(name, _)| *name)
    .collect()
}

/// Binds `name` in `scope`, replacing a binding of the same name.
fn bind(scope: &mut Scope, text: &[u8], name: Span, binding: Binding, source: &[u8]) {
  let existing = scope
    .bindings
    .iter_mut()
    .find(|(other, _)| source.get(other.start as usize..other.end as usize) == Some(text));
  match existing {
    Some(slot) => *slot = (name, binding),
    None => scope.bindings.push((name, binding)),
  }
}
