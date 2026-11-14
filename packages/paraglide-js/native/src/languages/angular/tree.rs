//! Angular's HTML tree (`_TreeBuilder` of `@angular/compiler`): elements, text, blocks, `@let`
//! declarations and ICU expansions, from the lexer's tokens; or the first error Angular reports,
//! which rejects the template.

use super::lexer::{block_name, Kind, Token};
use super::tags::{tag_definition, TagDefinition};

pub const NONE: u32 = u32::MAX;

/// An element's name: a namespace prefix (as `:svg:path` in Angular), and the name.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct Name<'t> {
  pub prefix: Option<&'t str>,
  pub local: &'t str,
}

impl Name<'_> {
  fn full(&self) -> String {
    match self.prefix {
      Some(prefix) => format!(":{prefix}:{}", self.local),
      None => self.local.to_string(),
    }
  }

  /// Its definition: elements of a namespace have the default one.
  fn definition(&self) -> TagDefinition {
    match self.prefix {
      Some(_) => tag_definition(":"),
      None => tag_definition(self.local),
    }
  }
}

#[derive(Clone, Copy, Debug)]
pub struct Attr<'t> {
  /// Its full name: `name`, or `:prefix:name` with a prefix.
  pub prefix: Option<&'t str>,
  pub name: &'t str,
  /// The tokens of its value, if it has one.
  pub value: Option<(u32, u32)>,
}

#[derive(Clone, Copy, Debug)]
pub enum Data<'t> {
  Element {
    name: Name<'t>,
    /// Its attributes, `attrs[start..end]`.
    attrs: (u32, u32),
    /// Where its start tag ends.
    start_tag_end: u32,
  },
  /// The tokens `first..=last`, and whether the first line break is dropped.
  Text {
    first: u32,
    last: u32,
    skips_line_break: bool,
  },
  Comment,
  Block {
    name: &'t str,
    /// Its parameters' tokens, `first..first + count`.
    parameters: (u32, u32),
    /// Where its start (`@if (…) {`) ends.
    start_end: u32,
    /// Its closing brace's range, if it is closed.
    close: Option<(u32, u32)>,
  },
  Let {
    name: (u32, u32),
    /// The token of its value.
    value: u32,
  },
  /// An ICU expansion, whose children are its cases: the token of its switch value.
  Expansion {
    switch_value: u32,
  },
  ExpansionCase,
}

#[derive(Clone, Copy, Debug)]
pub struct Node<'t> {
  pub data: Data<'t>,
  pub start: u32,
  pub first_child: u32,
  last_child: u32,
  pub next: u32,
}

pub struct Tree<'t> {
  pub nodes: Vec<Node<'t>>,
  pub attrs: Vec<Attr<'t>>,
  pub first_root: u32,
}

impl<'t> Tree<'t> {
  /// `node`'s children, or the roots for `NONE`.
  pub fn children(&self, node: u32) -> Children<'_, 't> {
    let first = if node == NONE {
      self.first_root
    } else {
      self.nodes[node as usize].first_child
    };
    Children {
      tree: self,
      next: first,
    }
  }

  pub fn element_attrs(&self, attrs: (u32, u32)) -> &[Attr<'t>] {
    &self.attrs[attrs.0 as usize..attrs.1 as usize]
  }
}

pub struct Children<'a, 't> {
  tree: &'a Tree<'t>,
  next: u32,
}

impl Iterator for Children<'_, '_> {
  type Item = u32;

  fn next(&mut self) -> Option<u32> {
    if self.next == NONE {
      return None;
    }
    let current = self.next;
    self.next = self.tree.nodes[current as usize].next;
    Some(current)
  }
}

/// The tree of `tokens`, or the message of the first error Angular reports.
pub fn build<'t>(text: &'t str, tokens: &[Token]) -> Result<Tree<'t>, String> {
  let mut tree = Tree {
    nodes: Vec::with_capacity(tokens.len() / 2),
    attrs: Vec::new(),
    first_root: NONE,
  };
  // The tokens end with the end of the file.
  let end = tokens.len().saturating_sub(1);
  let roots = Builder {
    text,
    tokens,
    end,
    index: 0,
    containers: Vec::new(),
    tree: &mut tree,
    roots: (NONE, NONE),
  }
  .build()?;
  tree.first_root = roots.0;
  Ok(tree)
}

struct Builder<'b, 't> {
  text: &'t str,
  tokens: &'b [Token],
  /// The end of the tokens this builder reads: an expansion case's are some of the file's.
  end: usize,
  index: usize,
  containers: Vec<u32>,
  tree: &'b mut Tree<'t>,
  roots: (u32, u32),
}

const EOF_TOKEN: Token = Token {
  kind: Kind::Eof,
  start: 0,
  end: 0,
  part0: (0, 0),
  part1: (0, 0),
};

impl<'t> Builder<'_, 't> {
  fn peek(&self) -> Token {
    if self.index < self.end {
      self.tokens[self.index]
    } else {
      Token {
        start: self.tokens.get(self.end).map_or(0, |token| token.start),
        end: self.tokens.get(self.end).map_or(0, |token| token.end),
        ..EOF_TOKEN
      }
    }
  }

  fn peek_kind(&self) -> Kind {
    self.peek().kind
  }

  fn advance(&mut self) -> u32 {
    let current = self.index;
    if self.index < self.end {
      self.index += 1;
    }
    current as u32
  }

  fn slice(&self, range: (u32, u32)) -> &'t str {
    &self.text[range.0 as usize..range.1 as usize]
  }

  fn build(mut self) -> Result<(u32, u32), String> {
    loop {
      match self.peek_kind() {
        Kind::Eof => break,
        Kind::TagOpenStart | Kind::IncompleteTagOpen => {
          let token = self.advance();
          self.consume_element_start(token)?;
        }
        Kind::TagClose => {
          let token = self.advance();
          self.consume_element_end(token)?;
        }
        Kind::CdataStart => {
          self.close_void_element();
          self.advance();
          let text = self.advance();
          self.consume_text(text);
          if self.peek_kind() == Kind::CdataEnd {
            self.advance();
          }
        }
        Kind::CommentStart => {
          self.close_void_element();
          let start = self.tokens[self.advance() as usize].start;
          if self.peek_kind() == Kind::RawText {
            self.advance();
          }
          if self.peek_kind() == Kind::CommentEnd {
            self.advance();
          }
          self.add(Data::Comment, start);
        }
        Kind::Text | Kind::RawText | Kind::EscapableRawText => {
          self.close_void_element();
          let token = self.advance();
          self.consume_text(token);
        }
        Kind::ExpansionFormStart => {
          let token = self.advance();
          self.consume_expansion(token)?;
        }
        Kind::BlockOpenStart => {
          self.close_void_element();
          let token = self.advance();
          self.consume_block_open(token);
        }
        Kind::BlockClose => {
          self.close_void_element();
          self.advance();
          self.consume_block_close()?;
        }
        Kind::IncompleteBlockOpen => {
          self.close_void_element();
          let token = self.tokens[self.advance() as usize];
          return Err(format!(
            "Incomplete block \"{}\". If you meant to write the @ character, you should use the \"&#64;\" HTML entity instead.",
            self.block_name_of(token)
          ));
        }
        Kind::LetStart => {
          self.close_void_element();
          let token = self.advance();
          self.consume_let(token)?;
        }
        Kind::IncompleteLet => {
          self.close_void_element();
          let token = self.tokens[self.advance() as usize];
          let name = self.slice(token.part0);
          let name = if name.is_empty() {
            String::new()
          } else {
            format!(" \"{name}\"")
          };
          return Err(format!(
            "Incomplete @let declaration{name}. @let declarations must be written as `@let <name> = <value>;`"
          ));
        }
        _ => {
          self.advance();
        }
      }
    }

    for &container in &self.containers {
      if let Data::Block { name, .. } = self.tree.nodes[container as usize].data {
        return Err(format!("Unclosed block \"{name}\""));
      }
    }
    Ok(self.roots)
  }

  fn block_name_of(&self, token: Token) -> &'t str {
    block_name(self.slice(token.part0))
  }

  fn container(&self) -> u32 {
    self.containers.last().copied().unwrap_or(NONE)
  }

  fn definition_of(&self, node: u32) -> Option<TagDefinition> {
    match self.tree.nodes[node as usize].data {
      Data::Element { name, .. } => Some(name.definition()),
      _ => None,
    }
  }

  fn closest_element(&self) -> Option<Name<'t>> {
    self.containers.iter().rev().find_map(|&container| {
      match self.tree.nodes[container as usize].data {
        Data::Element { name, .. } => Some(name),
        _ => None,
      }
    })
  }

  fn close_void_element(&mut self) {
    let container = self.container();
    if container != NONE && self.definition_of(container).is_some_and(|tag| tag.is_void) {
      self.containers.pop();
    }
  }

  fn add(&mut self, data: Data<'t>, start: u32) -> u32 {
    let id = self.tree.nodes.len() as u32;
    self.tree.nodes.push(Node {
      data,
      start,
      first_child: NONE,
      last_child: NONE,
      next: NONE,
    });
    let parent = self.container();
    let last = if parent == NONE {
      let last = self.roots.1;
      if self.roots.0 == NONE {
        self.roots.0 = id;
      }
      self.roots.1 = id;
      last
    } else {
      let parent = &mut self.tree.nodes[parent as usize];
      let last = parent.last_child;
      if parent.first_child == NONE {
        parent.first_child = id;
      }
      parent.last_child = id;
      last
    };
    if last != NONE {
      self.tree.nodes[last as usize].next = id;
    }
    id
  }

  fn consume_text(&mut self, first: u32) {
    let token = self.tokens[first as usize];
    let mut length = token.part0.1 - token.part0.0;
    let mut skips_line_break = false;
    if self.text.as_bytes().get(token.part0.0 as usize) == Some(&b'\n') && length > 0 {
      let parent = self.container();
      if parent != NONE
        && self.tree.nodes[parent as usize].first_child == NONE
        && self
          .definition_of(parent)
          .is_some_and(|tag| tag.ignore_first_lf)
      {
        skips_line_break = true;
        length -= 1;
      }
    }
    let mut last = first;
    while matches!(
      self.peek_kind(),
      Kind::Interpolation | Kind::Text | Kind::EncodedEntity
    ) {
      last = self.advance();
      let token = self.tokens[last as usize];
      length += token.end - token.start;
    }
    if length > 0 {
      self.add(
        Data::Text {
          first,
          last,
          skips_line_break,
        },
        token.start,
      );
    }
  }

  fn consume_element_start(&mut self, start_token: u32) -> Result<(), String> {
    let token = self.tokens[start_token as usize];
    let attrs_start = self.tree.attrs.len() as u32;
    loop {
      match self.peek_kind() {
        Kind::AttrName => {
          let name = self.advance();
          self.consume_attr(name);
        }
        Kind::TagComment => {
          self.advance();
        }
        _ => break,
      }
    }
    let attrs = (attrs_start, self.tree.attrs.len() as u32);

    let parent_element = self.closest_element();
    let name = self.element_name(token, parent_element);
    let definition = name.definition();
    let mut self_closing = false;
    if self.peek_kind() == Kind::TagOpenEndVoid {
      self.advance();
      self_closing = true;
      if !(definition.can_self_close || name.prefix.is_some() || definition.is_void) {
        return Err(format!(
          "Only void, custom and foreign elements can be self closed \"{}\"",
          self.slice(token.part1)
        ));
      }
    } else if self.peek_kind() == Kind::TagOpenEnd {
      self.advance();
    }
    let start_tag_end = self.peek().start;

    let parent = self.container();
    let is_closed_by_child = parent != NONE
      && self.definition_of(parent).is_some_and(|tag| {
        tag.is_closed_by_child(name.local) && name.prefix.is_none() || tag.is_void
      });
    if is_closed_by_child {
      self.containers.pop();
    }
    let element = self.add(
      Data::Element {
        name,
        attrs,
        start_tag_end,
      },
      token.start,
    );
    self.containers.push(element);

    if self_closing {
      self.pop_container(Some(name));
    } else if token.kind == Kind::IncompleteTagOpen {
      self.pop_container(Some(name));
      return Err(format!("Opening tag \"{}\" not terminated.", name.full()));
    }
    Ok(())
  }

  fn consume_attr(&mut self, name_token: u32) {
    let token = self.tokens[name_token as usize];
    let prefix = Some(self.slice(token.part0)).filter(|prefix| !prefix.is_empty());
    let name = self.slice(token.part1);
    if self.peek_kind() == Kind::AttrQuote {
      self.advance();
    }
    let mut value = None;
    if self.peek_kind() == Kind::AttrValueText {
      let first = self.index as u32;
      let mut last = first;
      while matches!(
        self.peek_kind(),
        Kind::AttrValueText | Kind::AttrValueInterpolation | Kind::EncodedEntity
      ) {
        last = self.advance();
      }
      value = Some((first, last));
    }
    if self.peek_kind() == Kind::AttrQuote {
      self.advance();
    }
    self.tree.attrs.push(Attr {
      prefix,
      name,
      value,
    });
  }

  fn element_name(&self, token: Token, parent: Option<Name<'t>>) -> Name<'t> {
    let local = self.slice(token.part1);
    let mut prefix = Some(self.slice(token.part0)).filter(|prefix| !prefix.is_empty());
    if prefix.is_none() {
      prefix = tag_definition(local).implicit_namespace;
    }
    if prefix.is_none() {
      if let Some(parent) = parent {
        if !tag_definition(parent.local).prevents_namespace_inheritance {
          prefix = parent.prefix;
        }
      }
    }
    Name { prefix, local }
  }

  fn consume_element_end(&mut self, end_token: u32) -> Result<(), String> {
    let token = self.tokens[end_token as usize];
    let name = self.element_name(token, self.closest_element());
    if name.definition().is_void {
      return Err(format!(
        "Void elements do not have end tags \"{}\"",
        self.slice(token.part1)
      ));
    }
    if !self.pop_container(Some(name)) {
      return Err(format!(
        "Unexpected closing tag \"{}\". It may happen when the tag has already been closed by another tag. For more info see https://www.w3.org/TR/html5/syntax.html#closing-elements-that-have-implied-end-tags",
        name.full()
      ));
    }
    Ok(())
  }

  /// Closes the innermost element named `name` (or block, for none) and what is in it; false if
  /// none is open, or if one that does not close implicitly was in it.
  fn pop_container(&mut self, name: Option<Name<'t>>) -> bool {
    let mut unexpected = false;
    for index in (0..self.containers.len()).rev() {
      let container = self.containers[index];
      let matches = match (self.tree.nodes[container as usize].data, name) {
        (Data::Element { name: element, .. }, Some(name)) => element == name,
        (Data::Block { .. }, None) => true,
        _ => false,
      };
      if matches {
        self.containers.truncate(index);
        return !unexpected;
      }
      let closes_implicitly = self
        .definition_of(container)
        .is_some_and(|tag| tag.closed_by_parent);
      if !closes_implicitly {
        unexpected = true;
      }
    }
    false
  }

  fn consume_block_open(&mut self, token: u32) {
    let block = self.tokens[token as usize];
    let first_parameter = self.index as u32;
    while self.peek_kind() == Kind::BlockParameter {
      self.advance();
    }
    let parameters = (first_parameter, self.index as u32 - first_parameter);
    if self.peek_kind() == Kind::BlockOpenEnd {
      self.advance();
    }
    let start_end = self.peek().start;
    let name = self.block_name_of(block);
    let id = self.add(
      Data::Block {
        name,
        parameters,
        start_end,
        close: None,
      },
      block.start,
    );
    self.containers.push(id);
  }

  fn consume_block_close(&mut self) -> Result<(), String> {
    let close = self.tokens[self.index - 1];
    let length = self.containers.len();
    let top = self.container();
    let block = self.containers.iter().rposition(|&container| {
      matches!(self.tree.nodes[container as usize].data, Data::Block { .. })
    });
    if let Some(index) = block {
      let block = self.containers[index];
      if let Data::Block { close: closed, .. } = &mut self.tree.nodes[block as usize].data {
        *closed = Some((close.start, close.end));
      }
    }
    if !self.pop_container(None) {
      if self.containers.len() < length {
        let name = match self.tree.nodes[top as usize].data {
          Data::Element { name, .. } => name.full(),
          Data::Block { name, .. } => name.to_string(),
          _ => String::new(),
        };
        return Err(format!(
          "Unexpected closing block. The block may have been closed earlier. Did you forget to close the <{name}> element? If you meant to write the `}}` character, you should use the \"&#125;\" HTML entity instead."
        ));
      }
      return Err("Unexpected closing block. The block may have been closed earlier. If you meant to write the `}` character, you should use the \"&#125;\" HTML entity instead.".to_string());
    }
    Ok(())
  }

  fn consume_let(&mut self, start_token: u32) -> Result<(), String> {
    let token = self.tokens[start_token as usize];
    let name = self.slice(token.part0);
    if self.peek_kind() != Kind::LetValue {
      return Err(format!(
        "Invalid @let declaration \"{name}\". Declaration must have a value."
      ));
    }
    let value = self.advance();
    if self.peek_kind() != Kind::LetEnd {
      return Err(format!(
        "Unterminated @let declaration \"{name}\". Declaration must be terminated with a semicolon."
      ));
    }
    self.advance();
    self.add(
      Data::Let {
        name: token.part0,
        value,
      },
      token.start,
    );
    Ok(())
  }

  fn consume_expansion(&mut self, start_token: u32) -> Result<(), String> {
    let start = self.tokens[start_token as usize].start;
    let switch_value = self.advance();
    self.advance(); // its type
                    // Its cases, its children, are made first, and linked to it once it is complete.
    let mut cases = (NONE, NONE);
    while self.peek_kind() == Kind::ExpansionCaseValue {
      let value = self.advance();
      if self.peek_kind() != Kind::ExpansionCaseExpStart {
        return Err("Invalid ICU message. Missing '{'.".to_string());
      }
      self.advance();
      let first = self.index;
      self.collect_expansion_tokens()?;
      let last = self.index;
      self.advance(); // its `}`

      let case = self.tree.nodes.len() as u32;
      self.tree.nodes.push(Node {
        data: Data::ExpansionCase,
        start: self.tokens[value as usize].start,
        first_child: NONE,
        last_child: NONE,
        next: NONE,
      });
      let roots = Builder {
        text: self.text,
        tokens: &self.tokens[..last],
        end: last,
        index: first,
        containers: Vec::new(),
        tree: &mut *self.tree,
        roots: (NONE, NONE),
      }
      .build()?;
      let node = &mut self.tree.nodes[case as usize];
      node.first_child = roots.0;
      node.last_child = roots.1;
      if cases.0 == NONE {
        cases.0 = case;
      } else {
        self.tree.nodes[cases.1 as usize].next = case;
      }
      cases.1 = case;
    }
    if self.peek_kind() != Kind::ExpansionFormEnd {
      return Err("Invalid ICU message. Missing '}'.".to_string());
    }
    self.advance();

    let id = self.add(Data::Expansion { switch_value }, start);
    let node = &mut self.tree.nodes[id as usize];
    node.first_child = cases.0;
    node.last_child = cases.1;
    Ok(())
  }

  /// Moves to the `}` that ends the expansion case started before.
  fn collect_expansion_tokens(&mut self) -> Result<(), String> {
    let mut stack = vec![Kind::ExpansionCaseExpStart];
    loop {
      let kind = self.peek_kind();
      if matches!(kind, Kind::ExpansionFormStart | Kind::ExpansionCaseExpStart) {
        stack.push(kind);
      }
      if kind == Kind::ExpansionCaseExpEnd {
        if stack.last() == Some(&Kind::ExpansionCaseExpStart) {
          stack.pop();
          if stack.is_empty() {
            return Ok(());
          }
        } else {
          return Err("Invalid ICU message. Missing '}'.".to_string());
        }
      }
      if kind == Kind::ExpansionFormEnd {
        if stack.last() == Some(&Kind::ExpansionFormStart) {
          stack.pop();
        } else {
          return Err("Invalid ICU message. Missing '}'.".to_string());
        }
      }
      if kind == Kind::Eof {
        return Err("Invalid ICU message. Missing '}'.".to_string());
      }
      self.advance();
    }
  }
}

#[cfg(test)]
mod tests {
  use super::super::lexer::tokenize;
  use super::*;

  fn error(text: &str) -> Option<String> {
    let tokens = tokenize(text).ok()?;
    build(text, &tokens).err()
  }

  #[test]
  fn rejects_what_angular_rejects() {
    assert_eq!(
      error("@if (x) { <p>"),
      Some("Unclosed block \"if\"".to_string())
    );
    assert!(error("@if (x) { <div> }").is_some());
    assert!(error("<div></span>").is_some());
    assert!(error("<p><div></div></p>").is_some());
    assert!(error("<div/>").is_some());
    assert!(error("<input></input>").is_some());
    assert!(error("}").is_some());
    assert!(error("@let x = 1").is_some());
    assert!(error("<div title=a/b>").is_some());
  }

  #[test]
  fn accepts_what_angular_accepts() {
    for text in [
      "<div><p>a<p>b</div>",
      "<ul><li>a<li>b</ul>",
      "@if (x) { <p>a }",
      "<app-x/><svg><path/></svg>",
      "<input><br>",
      "<div>",
      "{n, plural, =0 {none} other {<b>{{ n }}</b>}}",
      "@switch (x) { @case (1) { a } @default { b } }",
    ] {
      assert_eq!(error(text), None, "{text}");
    }
  }

  #[test]
  fn namespaces_are_inherited() {
    let text = "<svg><path></path><foreignObject><div></div></foreignObject></svg>";
    let tokens = tokenize(text).unwrap_or_default();
    let Ok(tree) = build(text, &tokens) else {
      return;
    };
    let names: Vec<String> = tree
      .nodes
      .iter()
      .filter_map(|node| match node.data {
        Data::Element { name, .. } => Some(name.full()),
        _ => None,
      })
      .collect();
    assert_eq!(
      names,
      [":svg:svg", ":svg:path", ":svg:foreignObject", "div"]
    );
  }
}
