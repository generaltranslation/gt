//! A template as the analysis needs it, from HTML or Pug: its elements with their attributes, and
//! the expressions of its interpolations, in document order. Text and comments are left out.

use std::ops::Range;

/// A range of the file's bytes.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Span {
  pub start: u32,
  pub end: u32,
}

impl Span {
  pub fn new(start: usize, end: usize) -> Span {
    Span {
      start: start as u32,
      end: end.max(start) as u32,
    }
  }

  pub fn range(self) -> Range<usize> {
    self.start as usize..self.end as usize
  }

  pub fn is_empty(self) -> bool {
    self.start >= self.end
  }
}

/// An attribute's name: as written, or Pug's `.class` and `#id` shorthands.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AttributeName {
  Written(Span),
  Class,
  Id,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Attribute {
  pub name: AttributeName,
  /// The value without its quotes; none for `disabled` or `:message` alone.
  pub value: Option<Span>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum NodeKind {
  Element,
  /// `{{ expression }}`
  Interpolation,
}

#[derive(Clone, Copy, Debug)]
pub struct Node {
  pub kind: NodeKind,
  /// An element's tag name, empty for Pug's implicit `div`; an interpolation's expression.
  pub span: Span,
  /// An element's attributes in `Template::attributes`.
  pub attributes: (u32, u32),
  /// The index after the element's last descendant.
  pub end: u32,
}

const OPEN: u32 = u32::MAX;

#[derive(Default)]
pub struct Template {
  pub nodes: Vec<Node>,
  pub attributes: Vec<Attribute>,
}

impl Template {
  pub fn clear(&mut self) {
    self.nodes.clear();
    self.attributes.clear();
  }

  pub fn is_empty(&self) -> bool {
    self.nodes.is_empty()
  }

  /// Opens an element, whose attributes are added next, and returns its index.
  pub fn open(&mut self, tag: Span) -> u32 {
    let index = self.nodes.len() as u32;
    let attributes = self.attributes.len() as u32;
    self.nodes.push(Node {
      kind: NodeKind::Element,
      span: tag,
      attributes: (attributes, attributes),
      end: OPEN,
    });
    index
  }

  /// Adds an attribute to the element `index`, which was opened last.
  pub fn attribute(&mut self, index: u32, attribute: Attribute) {
    self.attributes.push(attribute);
    if let Some(node) = self.nodes.get_mut(index as usize) {
      node.attributes.1 = self.attributes.len() as u32;
    }
  }

  /// Closes the element `index`: the nodes added since are its descendants.
  pub fn close(&mut self, index: u32) {
    let end = self.nodes.len() as u32;
    if let Some(node) = self.nodes.get_mut(index as usize) {
      if node.end == OPEN {
        node.end = end;
      }
    }
  }

  pub fn interpolation(&mut self, expression: Span) {
    let index = self.nodes.len() as u32;
    self.nodes.push(Node {
      kind: NodeKind::Interpolation,
      span: expression,
      attributes: (0, 0),
      end: index + 1,
    });
  }

  /// Closes what a parser left open.
  pub fn finish(&mut self) {
    let end = self.nodes.len() as u32;
    for node in &mut self.nodes {
      if node.end == OPEN {
        node.end = end;
      }
    }
  }

  pub fn attributes_of(&self, node: &Node) -> &[Attribute] {
    let (start, end) = node.attributes;
    self
      .attributes
      .get(start as usize..end as usize)
      .unwrap_or_default()
  }
}

/// Adds the `{{ … }}` of `text[start..end)`, raw text of a template, e.g. a `<textarea>`'s or
/// Pug's: each ends at the first `}}`, and one without is text.
pub fn interpolations_in(text: &[u8], start: usize, end: usize, template: &mut Template) {
  let mut position = start;

  while position < end {
    let Some(open) = memchr::memmem::find(&text[position..end], b"{{") else {
      return;
    };
    let content = position + open + 2;
    let Some(close) = memchr::memmem::find(&text[content..end], b"}}") else {
      return;
    };
    template.interpolation(Span::new(content, content + close));
    position = content + close + 2;
  }
}
