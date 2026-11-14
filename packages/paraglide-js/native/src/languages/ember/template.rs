//! A Glimmer template, written as statements that read what it reads, the way Glint's transform
//! writes it once `normalizeGlintCode` (`ember.ts`) made it read like the template:
//!
//! - `{{m.title}}` and `title={{m.title}}`: `m.title();` — a path without arguments is called,
//!   except as a component's argument (`@label={{m.label}}`), where it is passed as is.
//! - `{{m.items count=@count}}`, `(m.x a)`: `m.items({count:__glint.count});`, `m.x(a)`.
//! - `{{#if c}}…{{else}}…{{/if}}`: `if(c){…}else{…}`; `{{if c a b}}`: `(c?a:b)`.
//! - `{{#each list as |item i|}}…{{/each}}`, `<Foo as |x|>`: the call, then `{let item,i;…}`.
//! - `<Foo @a={{m.a}} class={{m.c}} {{mod m.d}} />`: `Foo({a:m.a});m.c();mod(__glint,m.d);`.
//! - `{{yield m.a}}`: `__glint(m.a);`
//!
//! `__glint` stands for what the module does not hold: arguments, Ember's keywords, the element a
//! modifier gets. Plain elements and text write nothing. A construct Glint maps as a whole is
//! mapped so here, so that a usage in it ends where it does with Glint.

use memchr::{memchr, memmem};

use super::glimmer::{self, segments, Call, Curly, Expr, Head, Pair, Path, Span, SyntaxError};
use crate::languages::CodeBuilder;
use crate::positions::utf16_length;

/// What stands for a value the module does not hold.
const OPAQUE: &str = "__glint";

/// Writes the template `source[start..end)` into `code`.
pub fn write(code: &mut CodeBuilder<'_>, start: usize, end: usize) -> Result<(), SyntaxError> {
  let source = code.source();
  let mut writer = Writer {
    source,
    bytes: source.as_bytes(),
    code,
    html: Html::Data,
    tag: Tag::default(),
    comment_start: 0,
    raw_text: None,
    frames: Vec::new(),
    scope: Vec::new(),
    skipping: 0,
  };
  writer.write(start, end)
}

/// The states of Glimmer's HTML tokenizer (`simple-html-tokenizer`).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Html {
  Data,
  TagOpen,
  MarkupDeclarationOpen,
  Doctype,
  CommentStart,
  CommentStartDash,
  Comment,
  CommentEndDash,
  CommentEnd,
  TagName,
  EndTagOpen,
  EndTagName,
  BeforeAttributeName,
  AttributeName,
  AfterAttributeName,
  BeforeAttributeValue,
  AttributeValueDoubleQuoted,
  AttributeValueSingleQuoted,
  AttributeValueUnquoted,
  AfterAttributeValueQuoted,
  SelfClosingStartTag,
}

impl Html {
  fn name(self) -> &'static str {
    match self {
      Html::Data => "data",
      Html::TagOpen => "tagOpen",
      Html::MarkupDeclarationOpen => "markupDeclarationOpen",
      Html::Doctype => "doctype",
      Html::CommentStart => "commentStart",
      Html::CommentStartDash => "commentStartDash",
      Html::Comment => "comment",
      Html::CommentEndDash => "commentEndDash",
      Html::CommentEnd => "commentEnd",
      Html::TagName => "tagName",
      Html::EndTagOpen => "endTagOpen",
      Html::EndTagName => "endTagName",
      Html::BeforeAttributeName => "beforeAttributeName",
      Html::AttributeName => "attributeName",
      Html::AfterAttributeName => "afterAttributeName",
      Html::BeforeAttributeValue => "beforeAttributeValue",
      Html::AttributeValueDoubleQuoted => "attributeValueDoubleQuoted",
      Html::AttributeValueSingleQuoted => "attributeValueSingleQuoted",
      Html::AttributeValueUnquoted => "attributeValueUnquoted",
      Html::AfterAttributeValueQuoted => "afterAttributeValueQuoted",
      Html::SelfClosingStartTag => "selfClosingStartTag",
    }
  }

  fn is_comment(self) -> bool {
    matches!(
      self,
      Html::CommentStart
        | Html::CommentStartDash
        | Html::Comment
        | Html::CommentEndDash
        | Html::CommentEnd
    )
  }
}

/// The tag being read, kept from one to the next for its buffers.
#[derive(Default)]
struct Tag {
  is_end: bool,
  name: Span,
  self_closing: bool,
  attributes: Vec<Attribute>,
  /// The parts of the attributes' values, which hold ranges of it.
  parts: Vec<Part>,
  modifiers: Vec<Call>,
  params: Vec<Span>,
  current: Option<CurrentAttribute>,
}

impl Tag {
  fn begin(&mut self, is_end: bool, name_start: usize) {
    self.is_end = is_end;
    self.name = (name_start, name_start);
    self.self_closing = false;
    self.attributes.clear();
    self.parts.clear();
    self.modifiers.clear();
    self.params.clear();
    self.current = None;
  }
}

struct Attribute {
  name: Span,
  /// From the name to the end of the value.
  span: Span,
  value: Value,
  /// The value's parts in `Tag::parts`.
  parts: (usize, usize),
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Value {
  /// `disabled`, `title=""`
  Empty,
  Text,
  /// `title={{…}}`
  Mustache,
  /// `title="a {{…}}"`
  Concat,
}

enum Part {
  Text(Span),
  Mustache(Call),
}

struct CurrentAttribute {
  name: Span,
  quoted: bool,
  dynamic: bool,
  parts_start: usize,
  /// Where the value's current text part starts.
  text_start: Option<usize>,
}

enum Frame {
  Element {
    name: Span,
    component: bool,
    /// Block params were declared: a `}` closes them.
    braces: bool,
    scope: usize,
    /// It has named blocks, and other content.
    named_blocks: bool,
    content: bool,
  },
  NamedBlock {
    name: Span,
    braces: bool,
    scope: usize,
  },
  Block {
    /// The callee's text, which the close must repeat.
    name: Span,
    kind: BlockKind,
    /// `{{else if …}}`: closed by the block it chains to.
    chained: bool,
    inverse: bool,
    braces: bool,
    scope: usize,
  },
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum BlockKind {
  If,
  /// Any other block, and its callee if it is a path the module may hold: Glint reads it again
  /// at the close.
  Other(Option<Path>),
}

struct Writer<'s, 'c> {
  source: &'s str,
  bytes: &'s [u8],
  code: &'c mut CodeBuilder<'s>,
  html: Html,
  tag: Tag,
  /// Where the HTML comment being read starts, after `<!--`.
  comment_start: usize,
  /// While the last start tag is `title`, `style` or `script`: its end tag, the only tag in its text.
  raw_text: Option<&'static [u8]>,
  frames: Vec<Frame>,
  /// Block params in scope, innermost last.
  scope: Vec<&'s str>,
  /// How deep in a block that is in an HTML comment, which the comment holds as text.
  skipping: u32,
}

/// The context of a writer's expressions, borrowing only the fields it needs.
macro_rules! context {
  ($writer:expr) => {
    Context {
      source: $writer.source,
      scope: &$writer.scope,
      wide: None,
    }
  };
}

impl<'s> Writer<'s, '_> {
  fn write(&mut self, start: usize, end: usize) -> Result<(), SyntaxError> {
    let bytes = self.bytes;
    let mut pos = start;
    // Where Handlebars' current text starts, for the backslashes before a `{{`.
    let mut run = start;

    loop {
      let Some(at) = memmem::find(&bytes[pos..end], b"{{").map(|at| pos + at) else {
        self.text(pos, end)?;
        break;
      };

      let backslashes = bytes[run..at]
        .iter()
        .rev()
        .take(2)
        .take_while(|&&byte| byte == b'\\')
        .count();
      if backslashes == 1 {
        // `\{{`: text.
        self.text(pos, at + 2)?;
        pos = at + 2;
        run = pos;
        continue;
      }

      self.text(pos, at)?;
      let (curly, after) = glimmer::parse_curly(bytes, at, end)?;
      self.curly(curly, at)?;
      pos = after;
      run = after;
    }

    self.finish(end)
  }

  fn finish(&mut self, end: usize) -> Result<(), SyntaxError> {
    // A start tag that is not finished is dropped, as Glimmer drops it.
    let unclosed_block = self.frames.iter().rev().find_map(|frame| match frame {
      Frame::Block { name, .. } => Some(*name),
      _ => None,
    });
    if let Some(name) = unclosed_block {
      return Err(SyntaxError::new(
        end,
        format!(
          "Parse error: `{{{{#{}}}}}` is not closed",
          &self.source[name.0..name.1]
        ),
      ));
    }
    if let Some(frame) = self.frames.last() {
      return Err(unclosed(self.source, frame));
    }
    Ok(())
  }

  // ---------------------------------------------------------------- curlies

  fn curly(&mut self, curly: Curly, at: usize) -> Result<(), SyntaxError> {
    if self.skipping > 0 {
      match curly {
        Curly::Open { .. } => self.skipping += 1,
        Curly::Close { .. } => self.skipping -= 1,
        _ => {}
      }
      if self.skipping == 0 {
        self.html = Html::Comment;
      }
      return Ok(());
    }

    match curly {
      Curly::Mustache(call) => self.mustache(call, at),
      Curly::Comment { value } => self.mustache_comment(value, at),
      Curly::Raw => match self.html {
        Html::Data => {
          self.note_content();
          Ok(())
        }
        html if html.is_comment() => Ok(()),
        _ => Err(not_in_element(at)),
      },
      Curly::Open { call, params } => match self.html {
        Html::Data => self.open_block(call, &params, false),
        html if html.is_comment() => {
          self.skipping = 1;
          Ok(())
        }
        _ => Err(not_in_element(at)),
      },
      Curly::Else => {
        self.check_structural(at)?;
        self.else_block(at, None)
      }
      Curly::ElseChain { call, params } => {
        self.check_structural(at)?;
        self.else_block(at, Some((call, params)))
      }
      Curly::Close { name } => {
        self.check_structural(at)?;
        self.close_block(name, at)
      }
    }
  }

  fn check_structural(&self, at: usize) -> Result<(), SyntaxError> {
    if self.html == Html::Data || self.html.is_comment() {
      Ok(())
    } else {
      Err(not_in_element(at))
    }
  }

  fn mustache(&mut self, call: Call, at: usize) -> Result<(), SyntaxError> {
    match self.html {
      Html::Data => {
        self.note_content();
        if context!(self).is_inert_call(&call) {
          return Ok(());
        }
        statement(self.code, context!(self), |context, code| {
          context.mustache(code, &call, Position::TopLevel)
        })
      }
      html if html.is_comment() => Ok(()),
      Html::TagOpen | Html::TagName | Html::EndTagOpen | Html::EndTagName => Err(SyntaxError::new(
        at,
        "Cannot use mustaches in an elements tagname",
      )),
      Html::BeforeAttributeName | Html::SelfClosingStartTag => {
        self.modifier(call, at)?;
        self.html = Html::BeforeAttributeName;
        Ok(())
      }
      Html::AttributeName | Html::AfterAttributeName => {
        if self.tag.is_end {
          return Err(end_tag_mustache(at));
        }
        self.finish_attribute(at)?;
        self.modifier(call, at)?;
        self.html = Html::BeforeAttributeName;
        Ok(())
      }
      Html::AfterAttributeValueQuoted => {
        self.modifier(call, at)?;
        self.html = Html::BeforeAttributeName;
        Ok(())
      }
      Html::BeforeAttributeValue => {
        self.begin_value(false);
        self.value_mustache(call, at);
        self.html = Html::AttributeValueUnquoted;
        Ok(())
      }
      Html::AttributeValueDoubleQuoted
      | Html::AttributeValueSingleQuoted
      | Html::AttributeValueUnquoted => {
        self.value_mustache(call, at);
        Ok(())
      }
      html => Err(SyntaxError::new(
        at,
        format!(
          "Using a Handlebars mustache when in the `{}` state is not supported",
          html.name()
        ),
      )),
    }
  }

  fn modifier(&mut self, call: Call, at: usize) -> Result<(), SyntaxError> {
    if self.tag.is_end {
      return Err(end_tag_mustache(at));
    }
    self.tag.modifiers.push(call);
    Ok(())
  }

  fn mustache_comment(&mut self, value: Span, at: usize) -> Result<(), SyntaxError> {
    match self.html {
      html if html.is_comment() => Ok(()),
      Html::BeforeAttributeName | Html::AfterAttributeName if self.tag.is_end => {
        Err(SyntaxError::new(
          at,
          "Invalid end tag: closing tag must not contain Handlebars comments",
        ))
      }
      Html::Data | Html::BeforeAttributeName | Html::AfterAttributeName => {
        check_directive(&self.source[value.0..value.1], at)
      }
      html => Err(SyntaxError::new(
        at,
        format!(
          "Using a Handlebars comment when in the `{}` state is not supported",
          html.name()
        ),
      )),
    }
  }

  fn open_block(&mut self, call: Call, params: &[Span], chained: bool) -> Result<(), SyntaxError> {
    self.note_content();
    let name = call.callee.span();

    let kind = match context!(self).special_form(&call.callee) {
      Some(form @ (Form::If | Form::Unless)) => {
        if call.params.len() != 1 {
          return Err(SyntaxError::new(
            call.span.0,
            format!("{{{{#{}}}}} requires exactly one condition", form.name()),
          ));
        }
        self.code.glue("if(");
        let unless = form == Form::Unless;
        let condition = &call.params[0];
        let mut result = Ok(());
        let context = context!(self);
        self.code.skippable("0", |code| {
          if unless {
            code.glue("!(");
          }
          result = context.expression(code, condition);
          if unless {
            code.glue(")");
          }
        });
        result?;
        self.code.glue("){");
        BlockKind::If
      }
      Some(form @ (Form::Component | Form::Helper | Form::Modifier)) => {
        return Err(SyntaxError::new(
          name.0,
          format!(
            "The {{{{{0}}}}} helper can't be used directly in block form under Glint. Consider first binding the result to a variable, e.g. '{{{{#let ({0} ...) as |...|}}}}' and then using the bound value.",
            form.name()
          ),
        ));
      }
      Some(Form::Yield) => {
        return Err(SyntaxError::new(name.0, "yield is not valid in block form"));
      }
      None => {
        if !context!(self).is_inert_call(&call) {
          statement(self.code, context!(self), |context, code| {
            context.invoke(code, &call, false)
          })?;
        }
        let trailing = match call.callee {
          Expr::Path(path) if !context!(self).is_opaque_path(path) => Some(path),
          _ => None,
        };
        BlockKind::Other(trailing)
      }
    };

    let scope = self.scope.len();
    let braces = kind != BlockKind::If && self.declare(params)?;
    self.frames.push(Frame::Block {
      name,
      kind,
      chained,
      inverse: false,
      braces,
      scope,
    });
    Ok(())
  }

  /// Declares block params, in a block of code that `}` closes; returns whether there were any.
  fn declare(&mut self, params: &[Span]) -> Result<bool, SyntaxError> {
    if params.is_empty() {
      return Ok(false);
    }

    self.code.glue("{let ");
    for (index, &(start, end)) in params.iter().enumerate() {
      let name = &self.source[start..end];
      if name.contains('-') {
        return Err(SyntaxError::new(
          start,
          "Block params must be valid TypeScript identifiers",
        ));
      }
      if index > 0 {
        self.code.glue(",");
      }
      if needs_prefix(name) {
        self.code.glue("__");
      }
      if is_identifier(name) {
        self.code.glue(name);
      } else {
        // Not a name in JavaScript: nothing reads it.
        self.code.glue("__glint");
        self.code.glue(&index.to_string());
      }
      self.scope.push(name);
    }
    self.code.glue(";");
    Ok(true)
  }

  fn else_block(&mut self, at: usize, chain: Option<(Call, Vec<Span>)>) -> Result<(), SyntaxError> {
    match self.frames.last_mut() {
      Some(Frame::Block {
        kind,
        inverse,
        braces,
        scope,
        ..
      }) if !*inverse => {
        *inverse = true;
        if *kind == BlockKind::If {
          self.code.glue("}else{");
        } else if *braces {
          *braces = false;
          self.code.glue("}");
        }
        let scope = *scope;
        self.scope.truncate(scope);
      }
      Some(frame @ (Frame::Element { .. } | Frame::NamedBlock { .. })) => {
        return Err(unclosed(self.source, frame));
      }
      _ => {
        return Err(SyntaxError::new(at, "Parse error: unexpected `{{else}}`"));
      }
    }

    if let Some((call, params)) = chain {
      self.open_block(call, &params, true)?;
    }
    Ok(())
  }

  fn close_block(&mut self, close: Span, at: usize) -> Result<(), SyntaxError> {
    loop {
      match self.frames.pop() {
        Some(Frame::Block {
          name,
          kind,
          chained,
          braces,
          scope,
          ..
        }) => {
          if kind == BlockKind::If || braces {
            self.code.glue("}");
          }
          self.scope.truncate(scope);
          if chained {
            continue;
          }

          let opened = &self.source[name.0..name.1];
          let closed = &self.source[close.0..close.1];
          if opened != closed {
            return Err(SyntaxError::new(
              at,
              format!("{opened} doesn't match {closed}"),
            ));
          }
          if let BlockKind::Other(Some(path)) = kind {
            let path = Path {
              span: close,
              ..path
            };
            statement(self.code, context!(self), |context, code| {
              context.path(code, path);
              Ok(())
            })?;
          }
          return Ok(());
        }
        Some(frame) => return Err(unclosed(self.source, &frame)),
        None => {
          return Err(SyntaxError::new(
            at,
            format!(
              "Parse error: `{{{{/{}}}}}` closes no block",
              &self.source[close.0..close.1]
            ),
          ));
        }
      }
    }
  }

  /// Marks the component whose direct child is being read as having content besides named blocks.
  fn note_content(&mut self) {
    if let Some(Frame::Element {
      component: true,
      content,
      ..
    }) = self.frames.last_mut()
    {
      *content = true;
    }
  }

  // ---------------------------------------------------------------- HTML

  /// Reads `bytes[start..end)`, which has no curlies, as Glimmer's HTML tokenizer does.
  fn text(&mut self, start: usize, end: usize) -> Result<(), SyntaxError> {
    if self.skipping > 0 {
      return Ok(());
    }

    let bytes = self.bytes;
    let mut pos = start;
    while pos < end {
      let byte = bytes[pos];
      match self.html {
        Html::Data => {
          let open = memchr(b'<', &bytes[pos..end]).map(|at| pos + at);
          self.data(pos, open.unwrap_or(end));
          let Some(open) = open else {
            return Ok(());
          };
          pos = open + 1;
          if let Some(close) = self.raw_text {
            if !bytes[open..].starts_with(close) {
              self.note_content();
              continue;
            }
          }
          self.html = Html::TagOpen;
        }
        Html::TagOpen => {
          pos += 1;
          match byte {
            b'!' => self.html = Html::MarkupDeclarationOpen,
            b'/' => self.html = Html::EndTagOpen,
            _ if is_html_space(byte) => {}
            _ => {
              self.tag.begin(false, pos - 1);
              self.html = Html::TagName;
            }
          }
        }
        Html::TagName | Html::EndTagName => {
          pos += 1;
          match byte {
            _ if is_html_space(byte) => {
              self.end_tag_name(pos - 1);
              self.html = Html::BeforeAttributeName;
            }
            b'/' => {
              self.end_tag_name(pos - 1);
              self.html = Html::SelfClosingStartTag;
            }
            b'>' => {
              self.end_tag_name(pos - 1);
              self.finish_tag(pos)?;
            }
            _ => {}
          }
        }
        Html::EndTagOpen => {
          pos += 1;
          if !is_html_space(byte) {
            self.tag.begin(true, pos - 1);
            self.raw_text = None;
            self.html = Html::EndTagName;
          }
        }
        Html::BeforeAttributeName => match byte {
          _ if is_html_space(byte) => pos += 1,
          b'/' => {
            self.html = Html::SelfClosingStartTag;
            pos += 1;
          }
          b'>' => {
            pos += 1;
            self.finish_tag(pos)?;
          }
          b'=' => {
            return Err(SyntaxError::new(
              pos,
              "attribute name cannot start with equals sign",
            ));
          }
          _ => {
            self.begin_attribute(pos);
            self.html = Html::AttributeName;
          }
        },
        Html::AttributeName => match byte {
          _ if is_html_space(byte) => {
            self.end_attribute_name(pos);
            self.html = Html::AfterAttributeName;
            pos += 1;
          }
          b'/' => {
            self.end_attribute_name(pos);
            self.finish_attribute(pos)?;
            pos += 1;
            self.html = Html::SelfClosingStartTag;
          }
          b'=' => {
            self.end_attribute_name(pos);
            self.html = Html::BeforeAttributeValue;
            pos += 1;
          }
          b'>' => {
            self.end_attribute_name(pos);
            self.finish_attribute(pos)?;
            pos += 1;
            self.finish_tag(pos)?;
          }
          b'"' | b'\'' | b'<' => {
            return Err(SyntaxError::new(
              pos,
              format!(
                "{} is not a valid character within attribute names",
                byte as char
              ),
            ));
          }
          _ => {
            pos += 1;
            let is_as = self
              .tag
              .current
              .as_ref()
              .is_some_and(|attribute| &bytes[attribute.name.0..pos] == b"as");
            if is_as {
              pos = self.block_params(pos, end)?;
            }
          }
        },
        Html::AfterAttributeName => match byte {
          _ if is_html_space(byte) => pos += 1,
          b'/' => {
            self.finish_attribute(pos)?;
            pos += 1;
            self.html = Html::SelfClosingStartTag;
          }
          b'=' => {
            pos += 1;
            self.html = Html::BeforeAttributeValue;
          }
          b'>' => {
            self.finish_attribute(pos)?;
            pos += 1;
            self.finish_tag(pos)?;
          }
          _ => {
            self.finish_attribute(pos)?;
            self.begin_attribute(pos);
            pos += 1;
            self.html = Html::AttributeName;
          }
        },
        Html::BeforeAttributeValue => match byte {
          _ if is_html_space(byte) => pos += 1,
          b'"' => {
            self.begin_value(true);
            pos += 1;
            self.html = Html::AttributeValueDoubleQuoted;
          }
          b'\'' => {
            self.begin_value(true);
            pos += 1;
            self.html = Html::AttributeValueSingleQuoted;
          }
          b'>' => {
            self.begin_value(false);
            self.finish_attribute(pos)?;
            pos += 1;
            self.finish_tag(pos)?;
          }
          _ => {
            self.begin_value(false);
            self.value_text(pos);
            pos += 1;
            self.html = Html::AttributeValueUnquoted;
          }
        },
        Html::AttributeValueDoubleQuoted | Html::AttributeValueSingleQuoted => {
          let quote = if self.html == Html::AttributeValueDoubleQuoted {
            b'"'
          } else {
            b'\''
          };
          match memchr(quote, &bytes[pos..end]) {
            Some(at) => {
              let at = pos + at;
              if at > pos {
                self.value_text(pos);
              }
              self.finish_attribute(at + 1)?;
              pos = at + 1;
              self.html = Html::AfterAttributeValueQuoted;
            }
            None => {
              self.value_text(pos);
              pos = end;
            }
          }
        }
        Html::AttributeValueUnquoted => match byte {
          _ if is_html_space(byte) => {
            self.finish_attribute(pos)?;
            pos += 1;
            self.html = Html::BeforeAttributeName;
          }
          b'/' => {
            self.finish_attribute(pos)?;
            pos += 1;
            self.html = Html::SelfClosingStartTag;
          }
          b'>' => {
            self.finish_attribute(pos)?;
            pos += 1;
            self.finish_tag(pos)?;
          }
          _ => {
            self.value_text(pos);
            pos += 1;
          }
        },
        Html::AfterAttributeValueQuoted => match byte {
          _ if is_html_space(byte) => {
            pos += 1;
            self.html = Html::BeforeAttributeName;
          }
          b'/' => {
            pos += 1;
            self.html = Html::SelfClosingStartTag;
          }
          b'>' => {
            pos += 1;
            self.finish_tag(pos)?;
          }
          _ => self.html = Html::BeforeAttributeName,
        },
        Html::SelfClosingStartTag => {
          if byte == b'>' {
            if self.tag.is_end {
              return Err(SyntaxError::new(
                pos,
                "Invalid end tag: closing tag must not be self-closing",
              ));
            }
            self.tag.self_closing = true;
            pos += 1;
            self.finish_tag(pos)?;
          } else {
            self.html = Html::BeforeAttributeName;
          }
        }
        Html::MarkupDeclarationOpen => {
          pos += 1;
          if byte == b'-' && pos < end && bytes[pos] == b'-' {
            pos += 1;
            self.comment_start = pos;
            self.html = Html::CommentStart;
          } else if bytes[pos - 1..end.min(pos + 6)].eq_ignore_ascii_case(b"DOCTYPE") {
            pos += 6;
            self.html = Html::Doctype;
          }
        }
        Html::Doctype => match memchr(b'>', &bytes[pos..end]) {
          Some(at) => {
            pos += at + 1;
            self.html = Html::Data;
          }
          None => pos = end,
        },
        Html::CommentStart | Html::CommentStartDash => {
          pos += 1;
          self.html = match (self.html, byte) {
            (Html::CommentStart, b'-') => Html::CommentStartDash,
            (_, b'-') => Html::CommentEnd,
            (_, b'>') => {
              self.finish_comment(pos - 1, pos)?;
              Html::Data
            }
            _ => Html::Comment,
          };
        }
        Html::Comment => match memchr(b'-', &bytes[pos..end]) {
          Some(at) => {
            pos += at + 1;
            self.html = Html::CommentEndDash;
          }
          None => pos = end,
        },
        Html::CommentEndDash => {
          pos += 1;
          self.html = if byte == b'-' {
            Html::CommentEnd
          } else {
            Html::Comment
          };
        }
        Html::CommentEnd => {
          pos += 1;
          self.html = if byte == b'>' {
            self.finish_comment(pos - 3, pos)?;
            Html::Data
          } else {
            Html::Comment
          };
        }
      }
    }

    Ok(())
  }

  /// Text between tags: content of a component besides named blocks unless it is whitespace.
  fn data(&mut self, start: usize, end: usize) {
    if start < end {
      if let Some(Frame::Element {
        component: true,
        content,
        ..
      }) = self.frames.last_mut()
      {
        if !self.source[start..end].trim().is_empty() {
          *content = true;
        }
      }
    }
  }

  fn finish_comment(&mut self, data_end: usize, at: usize) -> Result<(), SyntaxError> {
    let start = self.comment_start.min(data_end);
    check_directive(&self.source[start..data_end], at)
  }

  fn end_tag_name(&mut self, end: usize) {
    self.tag.name.1 = end;
    if !self.tag.is_end {
      let name = &self.bytes[self.tag.name.0..end];
      self.raw_text = match name {
        b"title" => Some(b"</title>"),
        b"style" => Some(b"</style>"),
        b"script" => Some(b"</script>"),
        _ => None,
      };
    }
  }

  fn begin_attribute(&mut self, start: usize) {
    self.tag.current = Some(CurrentAttribute {
      name: (start, start),
      quoted: false,
      dynamic: false,
      parts_start: self.tag.parts.len(),
      text_start: None,
    });
  }

  fn end_attribute_name(&mut self, end: usize) {
    if let Some(attribute) = &mut self.tag.current {
      attribute.name.1 = end;
    }
  }

  fn begin_value(&mut self, quoted: bool) {
    if let Some(attribute) = &mut self.tag.current {
      attribute.quoted = quoted;
    }
  }

  fn value_text(&mut self, at: usize) {
    if let Some(attribute) = &mut self.tag.current {
      attribute.text_start.get_or_insert(at);
    }
  }

  fn close_text_part(&mut self, end: usize) {
    if let Some(attribute) = &mut self.tag.current {
      if let Some(start) = attribute.text_start.take() {
        self.tag.parts.push(Part::Text((start, end)));
      }
    }
  }

  fn value_mustache(&mut self, call: Call, at: usize) {
    self.close_text_part(at);
    if let Some(attribute) = &mut self.tag.current {
      attribute.dynamic = true;
      self.tag.parts.push(Part::Mustache(call));
    }
  }

  /// The attribute being read ends at `end`, after its value.
  fn finish_attribute(&mut self, end: usize) -> Result<(), SyntaxError> {
    let value_end = match self.html {
      Html::AttributeValueDoubleQuoted | Html::AttributeValueSingleQuoted => end - 1,
      _ => end,
    };
    self.close_text_part(value_end);
    let Some(attribute) = self.tag.current.take() else {
      return Ok(());
    };
    // A name that a mustache or the tag's end cut runs up to there.
    let name = if attribute.name.1 > attribute.name.0 {
      attribute.name
    } else {
      (attribute.name.0, value_end.max(attribute.name.0))
    };

    if self.tag.is_end {
      return Err(SyntaxError::new(
        name.0,
        "Invalid end tag: closing tag must not have attributes",
      ));
    }

    let parts = (attribute.parts_start, self.tag.parts.len());
    let count = parts.1 - parts.0;
    if self.bytes[name.0] == b'|' && count == 0 && !attribute.quoted {
      return Err(SyntaxError::new(
        name.0,
        "Invalid block parameters syntax: block parameters must be preceded by the `as` keyword",
      ));
    }

    let value = if attribute.dynamic {
      if attribute.quoted {
        Value::Concat
      } else {
        let second = self.tag.parts.get(parts.0 + 1);
        let is_single = count == 1
          || (count == 2
            && matches!(second, Some(Part::Text((start, end))) if &self.bytes[*start..*end] == b"/"));
        if !is_single {
          return Err(SyntaxError::new(
            name.0,
            "An unquoted attribute value must be a string or a mustache, preceded by whitespace or a '=' character, and followed by whitespace, a '>' character, or '/>'",
          ));
        }
        Value::Mustache
      }
    } else if count > 0 {
      Value::Text
    } else {
      Value::Empty
    };

    self.tag.attributes.push(Attribute {
      name,
      span: (name.0, end),
      value,
      parts,
    });
    Ok(())
  }

  /// `as |a b|` in a start tag, after `as` at `pos`; returns where the tag goes on.
  fn block_params(&mut self, mut pos: usize, end: usize) -> Result<usize, SyntaxError> {
    let bytes = self.bytes;
    let start = pos - 2;
    if self.tag.is_end {
      return Err(SyntaxError::new(
        start,
        "Invalid end tag: closing tag must not have attributes",
      ));
    }
    let invalid = |at: usize, what: &str| {
      SyntaxError::new(at, format!("Invalid block parameters syntax: {what}"))
    };

    // " as |"
    match bytes.get(pos).filter(|_| pos < end) {
      Some(&byte) if is_html_space(byte) => {}
      Some(b'|') => {
        return Err(invalid(
          start,
          "expecting at least one space character between \"as\" and \"|\"",
        ));
      }
      _ => return Ok(pos),
    }
    let mut pipe = pos;
    while pipe < end && is_html_space(bytes[pipe]) {
      pipe += 1;
    }
    if pipe >= end || bytes[pipe] != b'|' {
      // `as` is an attribute.
      self.end_attribute_name(pos);
      self.html = Html::AfterAttributeName;
      return Ok(pipe);
    }

    // The params, which are not an attribute.
    self.tag.current = None;
    pos = pipe + 1;
    loop {
      while pos < end && is_html_space(bytes[pos]) {
        pos += 1;
      }
      if pos >= end {
        return Err(invalid(
          start,
          "mustaches cannot be used inside parameters list",
        ));
      }
      match bytes[pos] {
        b'|' if self.tag.params.is_empty() => {
          return Err(invalid(
            start,
            "empty parameters list, expecting at least one identifier",
          ));
        }
        b'|' => {
          pos += 1;
          break;
        }
        b'>' | b'/' => {
          return Err(invalid(
            start,
            "incomplete parameters list, expecting \"|\" but the tag was closed prematurely",
          ));
        }
        _ => {
          let name_start = pos;
          while pos < end && !is_html_space(bytes[pos]) && bytes[pos] != b'|' {
            if matches!(bytes[pos], b'>' | b'/') {
              return Err(invalid(
                start,
                "expecting \"|\" but the tag was closed prematurely",
              ));
            }
            pos += 1;
          }
          if pos >= end {
            return Err(invalid(
              start,
              "mustaches cannot be used inside parameters list",
            ));
          }
          let name = &bytes[name_start..pos];
          let is_invalid = name == b"this"
            || name.iter().any(|byte| {
              matches!(
                byte,
                b'!'
                  | b'"'
                  | b'#'
                  | b'%'
                  | b'&'
                  | b'\''
                  | b'('
                  | b')'
                  | b'*'
                  | b'+'
                  | b'.'
                  | b'/'
                  | b';'
                  | b'<'
                  | b'='
                  | b'>'
                  | b'@'
                  | b'['
                  | b'\\'
                  | b']'
                  | b'^'
                  | b'`'
                  | b'{'
                  | b'|'
                  | b'}'
                  | b'~'
              )
            });
          if is_invalid {
            return Err(invalid(
              name_start,
              &format!(
                "invalid identifier name `{}`",
                String::from_utf8_lossy(name)
              ),
            ));
          }
          self.tag.params.push((name_start, pos));
        }
      }
    }

    while pos < end && is_html_space(bytes[pos]) {
      pos += 1;
    }
    if pos >= end {
      return Err(invalid(start, "modifiers cannot follow parameters list"));
    }
    if !matches!(bytes[pos], b'>' | b'/') {
      return Err(invalid(
        pos,
        "expecting the tag to be closed with \">\" or \"/>\" after parameters list",
      ));
    }
    self.html = Html::BeforeAttributeName;
    Ok(pos)
  }

  /// The tag ends at `end`, after its `>`.
  fn finish_tag(&mut self, end: usize) -> Result<(), SyntaxError> {
    self.html = Html::Data;
    if self.tag.is_end {
      self.finish_end_tag(end)
    } else {
      self.finish_start_tag()
    }
  }

  fn finish_start_tag(&mut self) -> Result<(), SyntaxError> {
    let name_span = self.tag.name;
    let name = &self.source[name_span.0..name_span.1];

    if name == ":" {
      return Err(SyntaxError::new(
        name_span.0,
        "Invalid named block named detected, you may have created a named block without a name, or you may have began your name with a number. Named blocks must have names that are at least one character long, and begin with a lower case letter",
      ));
    }

    let closes_itself = self.tag.self_closing || VOID_ELEMENTS.contains(&name);

    if name.starts_with(':') {
      match self.frames.last_mut() {
        Some(Frame::Element {
          component: true,
          named_blocks,
          ..
        }) => *named_blocks = true,
        _ => {
          return Err(SyntaxError::new(
            name_span.0,
            format!("Unexpected named block <{name}>"),
          ));
        }
      }
      let scope = self.scope.len();
      let params = std::mem::take(&mut self.tag.params);
      let braces = self.declare(&params);
      self.tag.params = params;
      let braces = braces?;
      if closes_itself {
        if braces {
          self.code.glue("}");
        }
        self.scope.truncate(scope);
      } else {
        self.frames.push(Frame::NamedBlock {
          name: name_span,
          braces,
          scope,
        });
      }
      return Ok(());
    }

    self.note_content();
    let component = is_component(name, &self.scope);

    for attribute in &self.tag.attributes {
      let attribute_name = &self.source[attribute.name.0..attribute.name.1];
      if attribute_name == "...attributes" && attribute.value != Value::Empty {
        return Err(SyntaxError::new(
          attribute.name.0,
          "`...attributes` cannot accept a value",
        ));
      }
    }

    if component {
      let tag = &self.tag;
      statement(self.code, context!(self), |context, code| {
        context.component(code, tag)
      })?;
    }

    // Attributes, then modifiers.
    for attribute in &self.tag.attributes {
      let attribute_name = &self.source[attribute.name.0..attribute.name.1];
      if attribute_name.starts_with('@') || attribute_name == "...attributes" {
        continue;
      }
      let position = match attribute.value {
        Value::Mustache => Position::Attribute,
        Value::Concat => Position::Concat,
        Value::Empty | Value::Text => continue,
      };
      let wide = (!is_safe_key(attribute_name)).then_some(attribute.span);
      for part in &self.tag.parts[attribute.parts.0..attribute.parts.1] {
        let Part::Mustache(call) = part else {
          continue;
        };
        if context!(self).is_inert_call(call) {
          continue;
        }
        statement(self.code, context!(self), |context, code| {
          Context { wide, ..*context }.mustache(code, call, position)
        })?;
      }
    }

    for call in &self.tag.modifiers {
      statement(self.code, context!(self), |context, code| {
        context.invoke(code, call, true)
      })?;
    }

    if !closes_itself {
      let scope = self.scope.len();
      let braces = if component {
        let params = std::mem::take(&mut self.tag.params);
        let braces = self.declare(&params);
        self.tag.params = params;
        braces?
      } else {
        false
      };
      self.frames.push(Frame::Element {
        name: name_span,
        component,
        braces,
        scope,
        named_blocks: false,
        content: false,
      });
    }
    Ok(())
  }

  fn finish_end_tag(&mut self, end: usize) -> Result<(), SyntaxError> {
    let span = self.tag.name;
    let name = &self.source[span.0..span.1];
    if VOID_ELEMENTS.contains(&name) {
      return Err(SyntaxError::new(
        span.0,
        format!("<{name}> elements do not need end tags. You should remove it"),
      ));
    }

    match self.frames.last() {
      Some(Frame::Element { name: open, .. } | Frame::NamedBlock { name: open, .. }) => {
        let open_name = &self.source[open.0..open.1];
        if open_name != name {
          return Err(SyntaxError::new(
            span.0,
            format!(
              "Closing tag </{name}> did not match last open tag <{open_name}> (on line {})",
              super::script::line_of(self.bytes, open.0)
            ),
          ));
        }
      }
      _ => {
        return Err(SyntaxError::new(
          span.0,
          format!("Closing tag </{name}> without an open tag"),
        ));
      }
    }

    match self.frames.pop() {
      Some(Frame::Element {
        name: open,
        braces,
        scope,
        named_blocks,
        content,
        ..
      }) => {
        if braces {
          self.code.glue("}");
        }
        self.scope.truncate(scope);
        if named_blocks && content {
          return Err(SyntaxError::new(
            open.0,
            "Named blocks may not be mixed with other content",
          ));
        }
      }
      Some(Frame::NamedBlock { braces, scope, .. }) => {
        if braces {
          self.code.glue("}");
        }
        self.scope.truncate(scope);
      }
      _ => {}
    }
    let _ = end;
    Ok(())
  }
}

/// Writes one construct, which a fallback replaces if it does not parse, as a statement.
fn statement<'s>(
  code: &mut CodeBuilder<'s>,
  context: Context<'_, 's>,
  write: impl FnOnce(&Context<'_, 's>, &mut CodeBuilder<'s>) -> Result<(), SyntaxError>,
) -> Result<(), SyntaxError> {
  let mut result = Ok(());
  code.skippable("0", |code| result = write(&context, code));
  code.glue(";");
  result
}

fn unclosed(source: &str, frame: &Frame) -> SyntaxError {
  let (Frame::Element { name, .. } | Frame::NamedBlock { name, .. } | Frame::Block { name, .. }) =
    frame;
  SyntaxError::new(
    name.0,
    format!("Unclosed element `{}`", &source[name.0..name.1]),
  )
}

fn not_in_element(at: usize) -> SyntaxError {
  SyntaxError::new(
    at,
    "A block may only be used inside an HTML element or another block.",
  )
}

fn end_tag_mustache(at: usize) -> SyntaxError {
  SyntaxError::new(
    at,
    "Invalid end tag: closing tag must not contain mustaches",
  )
}

/// Glint's directives, `{{! @glint-ignore }}`: an unknown one is an error.
fn check_directive(comment: &str, at: usize) -> Result<(), SyntaxError> {
  let text = comment.trim();
  let Some(rest) = text
    .get(..7)
    .filter(|start| start.eq_ignore_ascii_case("@glint-"))
  else {
    return Ok(());
  };
  let _ = rest;
  let kind_length = text[7..]
    .bytes()
    .take_while(|byte| byte.is_ascii_alphabetic() || *byte == b'-')
    .count();
  if kind_length == 0 {
    return Ok(());
  }
  let kind = &text[7..7 + kind_length];
  let known = [
    "ignore",
    "expect-error",
    "nocheck",
    "in-svg",
    "in-mathml",
    "out-svg",
    "out-mathml",
  ];
  if known.contains(&kind) {
    Ok(())
  } else {
    Err(SyntaxError::new(
      at,
      format!("Unknown directive @glint-{kind}"),
    ))
  }
}

/// Elements without end tags.
const VOID_ELEMENTS: [&str; 16] = [
  "area", "base", "br", "col", "command", "embed", "hr", "img", "input", "keygen", "link", "meta",
  "param", "source", "track", "wbr",
];

/// Ember's keywords that Glint reads from its own `Globals` rather than the module (before Ember
/// 7.1, which adds `and`, `eq`, `fn`, `hash`, `on`…).
const GLOBALS: [&str; 20] = [
  "action",
  "component",
  "debugger",
  "each",
  "each-in",
  "has-block",
  "has-block-params",
  "helper",
  "if",
  "in-element",
  "let",
  "log",
  "modifier",
  "mount",
  "mut",
  "outlet",
  "unbound",
  "unless",
  "with",
  "yield",
];

/// Names Glint prefixes with `__`, as `makeJSSafe` does.
const RESERVED: [&str; 48] = [
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "eval",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "implements",
  "import",
  "in",
  "instanceof",
  "interface",
  "let",
  "new",
  "null",
  "package",
  "private",
  "protected",
  "public",
  "return",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "undefined",
  "var",
  "void",
  "while",
  "with",
  "yield",
];

fn needs_prefix(name: &str) -> bool {
  name.starts_with("__") || RESERVED.contains(&name)
}

/// `[\t\n\f ]`, and `\r`, which Glimmer turns into `\n`.
fn is_html_space(byte: u8) -> bool {
  matches!(byte, b' ' | b'\t' | b'\n' | b'\r' | 0x0C)
}

/// `/^[a-z_$][a-z0-9_$]*$/i`: a key Glint writes as a name.
fn is_safe_key(key: &str) -> bool {
  let mut bytes = key.bytes();
  bytes
    .next()
    .is_some_and(|first| first.is_ascii_alphabetic() || first == b'_' || first == b'$')
    && bytes.all(|byte| byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'$')
}

/// Whether `name` can be written as a name in JavaScript.
fn is_identifier(name: &str) -> bool {
  let mut bytes = name.bytes();
  bytes
    .next()
    .is_some_and(|first| !first.is_ascii_digit() && is_identifier_byte(first))
    && bytes.all(is_identifier_byte)
}

fn is_identifier_byte(byte: u8) -> bool {
  byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'$' || byte >= 0x80
}

/// Glint's `isComponentTag`: a tag that does not start with a lowercase letter, or has a `.`, or
/// is a block param.
fn is_component(tag: &str, scope: &[&str]) -> bool {
  let first = tag.chars().next().unwrap_or(' ');
  first.to_uppercase().eq(std::iter::once(first)) || tag.contains('.') || scope.contains(&tag)
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum Position {
  /// `{{…}}` in content.
  TopLevel,
  /// `title={{…}}`
  Attribute,
  /// `@label={{…}}`: a path is passed, not called.
  Argument,
  /// `title="a {{…}}"`
  Concat,
  /// `(…)`
  Sexpr,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum Form {
  If,
  Unless,
  Yield,
  Component,
  Helper,
  Modifier,
}

impl Form {
  fn name(self) -> &'static str {
    match self {
      Form::If => "if",
      Form::Unless => "unless",
      Form::Yield => "yield",
      Form::Component => "component",
      Form::Helper => "helper",
      Form::Modifier => "modifier",
    }
  }
}

/// What writing an expression needs: the block params in scope, and the range that glue stands
/// for while a construct Glint maps as a whole is written.
#[derive(Clone, Copy)]
struct Context<'a, 's> {
  source: &'s str,
  scope: &'a [&'s str],
  wide: Option<Span>,
}

impl<'s> Context<'_, 's> {
  fn glue(&self, code: &mut CodeBuilder<'s>, text: &str) {
    match self.wide {
      Some((start, end)) => code.write_for(start, end, text),
      None => code.glue(text),
    }
  }

  fn opaque(&self, code: &mut CodeBuilder<'s>, span: Span) {
    code.write_for(span.0, span.1, OPAQUE);
  }

  fn is_bound(&self, name: &str) -> bool {
    self.scope.iter().rev().any(|bound| *bound == name)
  }

  /// The keyword a call's callee is, unless a block param shadows it.
  fn special_form(&self, callee: &Expr) -> Option<Form> {
    let Expr::Path(path) = callee else {
      return None;
    };
    if path.head != Head::Var {
      return None;
    }
    let form = match &self.source[path.span.0..path.span.1] {
      "if" => Form::If,
      "unless" => Form::Unless,
      "yield" => Form::Yield,
      "component" => Form::Component,
      "helper" => Form::Helper,
      "modifier" => Form::Modifier,
      _ => return None,
    };
    (!self.is_bound(form.name())).then_some(form)
  }

  /// Whether a path reads nothing the module holds: an argument or a keyword of Ember's.
  fn is_opaque_path(&self, path: Path) -> bool {
    match path.head {
      Head::Arg => true,
      Head::This => false,
      Head::Var => {
        let bytes = self.source.as_bytes();
        let Some((start, end, _)) = segments(bytes, path.span).next() else {
          return true;
        };
        let head = &self.source[start..end];
        path.slashed || (GLOBALS.contains(&head) && !self.is_bound(head))
      }
    }
  }

  fn is_global(&self, callee: &Expr) -> bool {
    match callee {
      Expr::Path(path) if path.head == Head::Var => {
        let bytes = self.source.as_bytes();
        segments(bytes, path.span)
          .next()
          .is_some_and(|(start, end, _)| {
            let head = &self.source[start..end];
            GLOBALS.contains(&head) && !self.is_bound(head)
          })
      }
      _ => false,
    }
  }

  /// Whether a call reads nothing the module holds, so need not be written: its callee and
  /// arguments are arguments, keywords or literals.
  fn is_inert_call(&self, call: &Call) -> bool {
    self.special_form(&call.callee).is_none()
      && self.is_inert(&call.callee)
      && call.params.iter().all(|param| self.is_inert(param))
      && call.hash.iter().all(|pair| self.is_inert(&pair.value))
  }

  fn is_inert(&self, expression: &Expr) -> bool {
    match expression {
      Expr::Path(path) => self.is_opaque_path(*path),
      Expr::Sub(_) => false,
      Expr::String(_) | Expr::Number(_) | Expr::Keyword(_) => true,
    }
  }

  /// A mustache: `{{…}}`, an attribute's or an argument's value.
  fn mustache(
    &self,
    code: &mut CodeBuilder<'s>,
    call: &Call,
    position: Position,
  ) -> Result<(), SyntaxError> {
    if let Some(form) = self.special_form(&call.callee) {
      return self.special(code, form, call, position);
    }
    if !matches!(call.callee, Expr::Path(_) | Expr::Sub(_)) {
      // `{{"text"}}`: Glimmer drops a literal's arguments.
      return self.expression(code, &call.callee);
    }
    if !call.has_arguments() && position == Position::Argument && !self.is_global(&call.callee) {
      return self.expression(code, &call.callee);
    }
    self.invoke(code, call, false)
  }

  /// `callee(params, {hash})`, with the element first for a modifier.
  fn invoke(
    &self,
    code: &mut CodeBuilder<'s>,
    call: &Call,
    is_modifier: bool,
  ) -> Result<(), SyntaxError> {
    if is_modifier {
      self.expression(code, &call.callee)?;
    } else {
      // Glint maps the callee it resolves as a whole.
      let callee = Context {
        wide: Some(call.callee.span()),
        ..*self
      };
      callee.expression(code, &call.callee)?;
    }
    self.glue(code, "(");
    let mut first = true;
    if is_modifier {
      self.glue(code, OPAQUE);
      first = false;
    }
    for param in &call.params {
      if !first {
        self.glue(code, ",");
      }
      self.expression(code, param)?;
      first = false;
    }
    if !call.hash.is_empty() {
      if !first {
        self.glue(code, ",");
      }
      self.hash(code, &call.hash)?;
    }
    self.glue(code, ")");
    Ok(())
  }

  fn hash(&self, code: &mut CodeBuilder<'s>, pairs: &[Pair]) -> Result<(), SyntaxError> {
    self.glue(code, "{");
    for pair in pairs {
      self.key(code, pair.key);
      self.glue(code, ":");
      self.expression(code, &pair.value)?;
      self.glue(code, ",");
    }
    self.glue(code, "}");
    Ok(())
  }

  fn key(&self, code: &mut CodeBuilder<'s>, (start, end): Span) {
    let key = &self.source[start..end];
    if is_safe_key(key) {
      code.copy(start, end);
    } else {
      self.string_for(code, (start, end), key);
    }
  }

  /// `"value"` for `span`: mapped character by character if it is as long as the text, else not.
  fn string_for(&self, code: &mut CodeBuilder<'s>, span: Span, value: &str) {
    let needs_escape = value
      .bytes()
      .any(|byte| byte == b'"' || byte == b'\\' || byte < 0x20);
    if !needs_escape {
      self.glue(code, "\"");
      code.copy(span.0, span.1);
      self.glue(code, "\"");
    } else {
      self.glue(code, &json_string(value));
    }
  }

  fn special(
    &self,
    code: &mut CodeBuilder<'s>,
    form: Form,
    call: &Call,
    position: Position,
  ) -> Result<(), SyntaxError> {
    match form {
      Form::If | Form::Unless => {
        if call.params.len() < 2 {
          return Err(SyntaxError::new(
            call.span.0,
            format!("{{{{{}}}}} requires at least two parameters", form.name()),
          ));
        }
        self.glue(code, if form == Form::If { "((" } else { "(!(" });
        self.expression(code, &call.params[0])?;
        self.glue(code, ")?(");
        self.expression(code, &call.params[1])?;
        self.glue(code, "):(");
        match call.params.get(2) {
          Some(otherwise) => self.expression(code, otherwise)?,
          None => self.glue(code, "undefined"),
        }
        self.glue(code, "))");
        Ok(())
      }
      Form::Yield => {
        if position != Position::TopLevel {
          return Err(SyntaxError::new(
            call.span.0,
            "{{yield}} may only appear as a top-level statement",
          ));
        }
        let to = call
          .hash
          .iter()
          .find(|pair| &self.source[pair.key.0..pair.key.1] == "to");
        if to.is_some_and(|pair| !matches!(pair.value, Expr::String(_))) {
          return Err(SyntaxError::new(
            call.span.0,
            "Named block {{yield}}s must have a literal block name",
          ));
        }
        // Glint maps all of `{{yield …}}` as a whole.
        let wide = Context {
          wide: Some(call.span),
          ..*self
        };
        wide.opaque(code, call.span);
        wide.glue(code, "(");
        for (index, param) in call.params.iter().enumerate() {
          if index > 0 {
            wide.glue(code, ",");
          }
          wide.expression(code, param)?;
        }
        wide.glue(code, ")");
        Ok(())
      }
      Form::Component | Form::Helper | Form::Modifier => {
        if call.params.is_empty() {
          return Err(SyntaxError::new(
            call.span.0,
            format!(
              "{{{{{}}}}} requires at least one positional argument",
              form.name()
            ),
          ));
        }
        if call.params.len() > 1 && !call.hash.is_empty() {
          return Err(SyntaxError::new(
            call.span.0,
            format!(
              "Due to TypeScript inference limitations, {{{{{0}}}}} can only pre-bind either named or positional arguments in a single pass. You can instead break the binding into two parts, e.g. {{{{{0} ({0} ... posA posB) namedA=true namedB=true}}}}",
              form.name()
            ),
          ));
        }
        self.invoke(code, call, false)
      }
    }
  }

  fn expression(&self, code: &mut CodeBuilder<'s>, expression: &Expr) -> Result<(), SyntaxError> {
    match expression {
      Expr::Path(path) => {
        self.path(code, *path);
        Ok(())
      }
      Expr::String(span) => {
        self.string_literal(code, *span);
        Ok(())
      }
      Expr::Number(span) => {
        self.number(code, *span);
        Ok(())
      }
      Expr::Keyword((start, end)) => {
        code.copy(*start, *end);
        Ok(())
      }
      Expr::Sub(call) => {
        if let Some(form) = self.special_form(&call.callee) {
          return self.special(code, form, call, Position::Sexpr);
        }
        self.invoke(code, call, false)
      }
    }
  }

  /// A path's value: `m.title`, `this.label`; `__glint` for what the module does not hold.
  fn path(&self, code: &mut CodeBuilder<'s>, path: Path) {
    let bytes = self.source.as_bytes();
    let (start, end) = path.span;
    let segments_start = if path.head == Head::Arg {
      start + 1
    } else {
      start
    };
    let mut parts = segments(bytes, (segments_start, end));
    let Some((head_start, head_end, bracketed)) = parts.next() else {
      self.opaque(code, path.span);
      return;
    };
    let head = &self.source[head_start..head_end];

    match path.head {
      Head::Arg => self.opaque(code, (start, head_end)),
      _ if path.slashed => {
        self.opaque(code, path.span);
        return;
      }
      Head::This => {
        if is_plain(bytes, path.span) {
          code.copy(start, end);
          return;
        }
        code.copy(head_start, head_end);
      }
      Head::Var => {
        let is_bound = self.is_bound(head);
        let is_keyword = !is_bound && GLOBALS.contains(&head);
        if is_keyword || bracketed || !is_identifier(head) {
          self.opaque(code, (head_start, head_end));
        } else if needs_prefix(head) {
          code.write_for(head_start, head_end, &format!("__{head}"));
        } else if is_plain(bytes, path.span) {
          code.copy(start, end);
          return;
        } else {
          code.copy(head_start, head_end);
        }
      }
    }

    for (segment_start, segment_end, bracketed) in parts {
      let segment = &self.source[segment_start..segment_end];
      if !bracketed && is_safe_key(segment) {
        self.glue(code, ".");
        code.copy(segment_start, segment_end);
      } else {
        self.glue(code, "[");
        let value = if bracketed {
          unescape_bracketed(segment)
        } else {
          segment.into()
        };
        self.string_for(code, (segment_start, segment_end), &value);
        self.glue(code, "]");
      }
    }
  }

  /// A string literal: its value is its text but for `\"` (or `\'`), which Handlebars unescapes.
  fn string_literal(&self, code: &mut CodeBuilder<'s>, (start, end): Span) {
    let bytes = self.source.as_bytes();
    let quote = bytes[start];
    let raw = &self.source[start + 1..end - 1];
    let is_plain_text = raw
      .bytes()
      .all(|byte| byte != b'\\' && byte >= 0x20 && byte != b'"');
    if is_plain_text {
      // The same JavaScript string as Glint's `JSON.stringify(value)`, and as long.
      code.copy(start, end);
      return;
    }

    let escaped_quote = if quote == b'"' { "\\\"" } else { "\\'" };
    let value = raw.replace(escaped_quote, if quote == b'"' { "\"" } else { "'" });
    let json = json_string(&value);
    if utf16_length(&json) == utf16_length(&self.source[start..end]) {
      code.write_for(start, end, &json);
    } else {
      self.glue(code, &json);
    }
  }

  /// A number as `JSON.stringify` writes it: as is, unless it is written otherwise (`1.0`, `007`).
  fn number(&self, code: &mut CodeBuilder<'s>, (start, end): Span) {
    let text = &self.source[start..end];
    let value: f64 = text.parse().unwrap_or(0.0);
    let mut buffer = ryu_js::Buffer::new();
    let canonical = buffer.format(value);
    if canonical == text {
      code.copy(start, end);
    } else {
      let canonical = canonical.to_string();
      self.glue(code, &canonical);
    }
  }

  /// `Foo({a:m.a,…})` for `<Foo @a={{m.a}} …>`.
  fn component(&self, code: &mut CodeBuilder<'s>, tag: &Tag) -> Result<(), SyntaxError> {
    let (start, end) = tag.name;
    let name = &self.source[start..end];
    let head = if name.starts_with('@') {
      Head::Arg
    } else if name == "this" || name.starts_with("this.") {
      Head::This
    } else {
      Head::Var
    };
    self.path(
      code,
      Path {
        span: tag.name,
        head,
        slashed: false,
      },
    );

    self.glue(code, "(");
    let mut any = false;
    for attribute in &tag.attributes {
      let name = &self.source[attribute.name.0..attribute.name.1];
      let Some(key) = name.strip_prefix('@') else {
        continue;
      };
      if !any {
        self.glue(code, "{");
        any = true;
      }
      let context = Context {
        wide: (!is_safe_key(key)).then_some(attribute.span),
        ..*self
      };
      context.key(code, (attribute.name.0 + 1, attribute.name.1));
      context.glue(code, ":");
      let parts = &tag.parts[attribute.parts.0..attribute.parts.1];
      match attribute.value {
        Value::Empty => context.glue(code, "\"\""),
        Value::Text => {
          if let Some(Part::Text(span)) = parts.first() {
            context.string_for(code, *span, &self.source[span.0..span.1]);
          }
        }
        Value::Mustache => {
          if let Some(Part::Mustache(call)) = parts.first() {
            context.mustache(code, call, Position::Argument)?;
          }
        }
        Value::Concat => {
          context.glue(code, "`");
          for part in parts {
            if let Part::Mustache(call) = part {
              context.glue(code, "${");
              context.mustache(code, call, Position::Concat)?;
              context.glue(code, "}");
            }
          }
          context.glue(code, "`");
        }
      }
      context.glue(code, ",");
    }
    if any {
      self.glue(code, "}");
    }
    self.glue(code, ")");
    Ok(())
  }
}

/// Whether a path's text is JavaScript as is: names separated by `.`.
fn is_plain(bytes: &[u8], (start, end): Span) -> bool {
  let text = &bytes[start..end];
  let mut segment_start = true;
  for &byte in text {
    if byte == b'.' {
      if segment_start {
        return false;
      }
      segment_start = true;
    } else if segment_start {
      if !(byte.is_ascii_alphabetic() || byte == b'_' || byte == b'$') {
        return false;
      }
      segment_start = false;
    } else if !(byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'$') {
      return false;
    }
  }
  !segment_start
}

/// A `[…]` segment's name: `\]` and `\\` are `]` and `\`.
fn unescape_bracketed(segment: &str) -> String {
  let mut value = String::with_capacity(segment.len());
  let mut characters = segment.chars();
  while let Some(character) = characters.next() {
    if character == '\\' {
      if let Some(next) = characters.next() {
        if next != ']' && next != '\\' {
          value.push('\\');
        }
        value.push(next);
        continue;
      }
    }
    value.push(character);
  }
  value
}

/// `JSON.stringify` of a string.
fn json_string(value: &str) -> String {
  let mut json = String::with_capacity(value.len() + 2);
  json.push('"');
  for character in value.chars() {
    match character {
      '"' => json.push_str("\\\""),
      '\\' => json.push_str("\\\\"),
      '\n' => json.push_str("\\n"),
      '\r' => json.push_str("\\r"),
      '\t' => json.push_str("\\t"),
      '\u{8}' => json.push_str("\\b"),
      '\u{c}' => json.push_str("\\f"),
      character if (character as u32) < 0x20 => {
        json.push_str(&format!("\\u{:04x}", character as u32));
      }
      character => json.push(character),
    }
  }
  json.push('"');
  json
}
