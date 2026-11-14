//! Writes an Astro component as one TSX module: the frontmatter as it is, then the template as one
//! JSX fragment that holds what the analysis reads in it. Each template expression is copied as it
//! is, and markup in expressions is written as JSX, so that the expression's names stay in scope.
//! An element is written as a self-closing tag when it is a component (a call site) or has
//! expressions in its attributes, and its children follow it: nothing else in the markup matters.
//!
//! ```text
//! ---                                   import { m } from "./messages.js";
//! import { m } from "./messages.js";    ;<><h1 title={m.title()}/>{items.map((i) =>
//! ---                                   <><Item label={i}/>{m.x()}</>)}</>;
//! <h1 title={m.title()}>Hi</h1>
//! {items.map((i) => <li><Item label={i} />{m.x()}</li>)}
//! ```
//!
//! Each bare `<script>`, which Astro bundles, is a module of its own.

use super::scan::{self, Class, TagName};
use crate::{
  graph::PropsReads,
  languages::{CodeBuilder, Generated, Skipped},
  load::{GeneratedCode, GeneratedSource},
  lower::Lang,
  mapping::Mapping,
  positions::utf16_length,
};

/// How deep markup and expressions may nest in each other.
const MAX_DEPTH: u32 = 128;

pub fn generate(_file: &str, source: &str, skipped: &Skipped) -> Result<Generated, String> {
  let mut astro = Astro::new(source, skipped);
  astro.file();
  astro.finish()
}

/// What JavaScript is being read.
#[derive(Clone, Copy, PartialEq, Eq)]
enum Mode {
  /// The frontmatter: it ends at its closing `---`, and a `return` outside functions is written as
  /// `throw`, which a module allows.
  Frontmatter,
  /// A template literal's substitution in the frontmatter.
  FrontmatterSubstitution,
  /// A template expression, which may contain markup.
  Expression,
}

/// What the last token of JavaScript was.
#[derive(Clone, Copy, PartialEq, Eq)]
enum Prev {
  /// An operator, opening bracket or keyword: an expression may start, so `/` begins a regular
  /// expression and `<` an element.
  Operator,
  /// An operand: `/` and `<` are operators.
  Operand,
  /// `.` or `?.`: a property name follows, even a keyword.
  Dot,
}

/// A start tag being written.
struct Tag {
  name: (usize, usize),
  kind: TagName,
  /// Whether its `<name` is written: a component's always is, an intrinsic element's once it has
  /// an expression.
  is_written: bool,
  has_attributes: bool,
  is_raw: bool,
}

struct Astro<'s> {
  source: &'s str,
  bytes: &'s [u8],
  code: CodeBuilder<'s>,
  skipped: &'s Skipped,
  /// The UTF-8 range in the code of each skippable construct, by number.
  expressions: Vec<(u32, u32)>,
  /// While a skipped construct's content is read only to number the constructs in it.
  is_dry: bool,
  scripts: Vec<GeneratedCode>,
  /// The open elements of markup in expressions, by their name's range in the file: an element
  /// in an expression ends the markup when it closes. `<>` is an empty name.
  open: Vec<(usize, usize)>,
  depth: u32,
  is_too_deep: bool,
}

impl<'s> Astro<'s> {
  fn new(source: &'s str, skipped: &'s Skipped) -> Self {
    Astro {
      source,
      bytes: source.as_bytes(),
      code: CodeBuilder::new(source, skipped),
      skipped,
      expressions: Vec::new(),
      is_dry: false,
      scripts: Vec::new(),
      open: Vec::new(),
      depth: 0,
      is_too_deep: false,
    }
  }

  fn finish(self) -> Result<Generated, String> {
    if self.is_too_deep {
      return Err(format!(
        "the template nests markup and expressions more than {MAX_DEPTH} levels deep"
      ));
    }

    let built = self.code.finish(Lang::Tsx);

    Ok(Generated {
      source: GeneratedSource {
        main: built.code,
        scripts: self.scripts,
        language: "astro".to_string(),
        component_fields: Vec::new(),
        scope_objects: Vec::new(),
        props: Some(PropsReads {
          members: vec!["Astro.props".to_string()],
          ..PropsReads::default()
        }),
        component_instances: None,
      },
      expressions: self.expressions,
    })
  }

  // ---------------------------------------------------------------- writing

  fn glue(&mut self, text: &str) {
    if !self.is_dry {
      self.code.glue(text);
    }
  }

  fn copy(&mut self, start: usize, end: usize) {
    if !self.is_dry {
      self.code.copy(start, end);
    }
  }

  /// Copies the file from `*copied` to `to`.
  fn flush(&mut self, copied: &mut usize, to: usize) {
    self.copy(*copied, to);
    *copied = to;
  }

  /// Writes a construct with `write`, or `fallback` if it did not parse before. A skipped
  /// construct is still read, writing nothing, so that the ones in it keep their numbers.
  fn skippable<R>(&mut self, fallback: &str, write: impl FnOnce(&mut Self) -> R) -> R {
    let number = self.expressions.len();
    self.expressions.push((0, 0));
    let start = self.code.code().len() as u32;

    let result = if !self.is_dry && self.skipped.contains(&(number as u32)) {
      self.code.glue(fallback);
      self.is_dry = true;
      let result = write(self);
      self.is_dry = false;
      result
    } else {
      write(self)
    };

    self.expressions[number] = (start, self.code.code().len() as u32);
    result
  }

  // ---------------------------------------------------------------- the file

  fn file(&mut self) {
    let mut template = 0;

    if let Some(start) = frontmatter_start(self.bytes) {
      let mut copied = start;
      let end = self.js(start, Mode::Frontmatter, &mut copied);
      self.flush(&mut copied, end);
      self.glue("\n;");
      template = (end + 3).min(self.bytes.len());
    }

    self.glue("<>");
    self.markup(template, false);
    self.glue("</>;\n");
  }

  /// A `return` in the frontmatter: one at its top level is `throw`, which a module allows. One
  /// in a block may be in a function or not: it is written as it is, and as `throw` once it does
  /// not parse.
  fn frontmatter_return(&mut self, start: usize, is_top_level: bool, copied: &mut usize) {
    let end = start + "return".len();
    let fallback = if scan::returns_value(self.bytes, end) {
      "throw"
    } else {
      "throw 0"
    };

    self.flush(copied, start);
    if is_top_level {
      self.glue(fallback);
    } else {
      self.skippable(fallback, |astro| astro.copy(start, end));
    }
    *copied = end;
  }

  // ---------------------------------------------------------------- JavaScript

  /// Reads JavaScript from `pos` to its end: its unmatched `}`, its closing `---` in the
  /// frontmatter, or the file's end, which is returned. It is copied from `*copied` on, but for
  /// markup in it, written as JSX, and the frontmatter's top-level `return`s.
  fn js(&mut self, pos: usize, mode: Mode, copied: &mut usize) -> usize {
    if self.depth >= MAX_DEPTH {
      self.is_too_deep = true;
      return self.bytes.len();
    }

    self.depth += 1;
    let end = self.js_tokens(pos, mode, copied);
    self.depth -= 1;
    end
  }

  fn js_tokens(&mut self, mut pos: usize, mode: Mode, copied: &mut usize) -> usize {
    let bytes = self.bytes;
    let len = bytes.len();
    let mut braces = 0u32;
    let mut prev = Prev::Operator;

    while pos < len {
      let byte = bytes[pos];

      match scan::class(byte) {
        Class::Space => pos += 1,
        Class::Word => {
          let start = pos;
          pos = scan::word_end(bytes, pos + 1);
          if prev == Prev::Dot {
            prev = Prev::Operand;
            continue;
          }

          let word = &bytes[start..pos];
          if mode == Mode::Frontmatter && word == b"return" {
            self.frontmatter_return(start, braces == 0, copied);
          }
          prev = if scan::is_expression_keyword(word) {
            Prev::Operator
          } else {
            Prev::Operand
          };
        }
        Class::Digit => {
          pos = scan::number_end(bytes, pos + 1);
          prev = Prev::Operand;
        }
        Class::Other => match byte {
          b'\'' | b'"' => {
            pos = scan::string_end(bytes, pos, byte);
            prev = Prev::Operand;
          }
          b'`' => {
            pos = self.template_literal(pos, mode, copied);
            prev = Prev::Operand;
          }
          b'/' => match bytes.get(pos + 1) {
            Some(b'/') => pos = scan::line_comment_end(bytes, pos),
            Some(b'*') => pos = scan::block_comment_end(bytes, pos),
            _ if prev == Prev::Operator => {
              pos = scan::regex_end(bytes, pos);
              prev = Prev::Operand;
            }
            _ => {
              pos += 1;
              prev = Prev::Operator;
            }
          },
          b'{' => {
            braces += 1;
            pos += 1;
            prev = Prev::Operator;
          }
          b'}' => {
            if braces == 0 && mode != Mode::Frontmatter {
              return pos;
            }
            braces = braces.saturating_sub(1);
            pos += 1;
            prev = Prev::Operand;
          }
          b')' | b']' => {
            pos += 1;
            prev = Prev::Operand;
          }
          b'.' => {
            if bytes.get(pos + 1).is_some_and(u8::is_ascii_digit) {
              pos = scan::number_end(bytes, pos + 1);
              prev = Prev::Operand;
            } else if bytes[pos..].starts_with(b"...") {
              pos += 3;
              prev = Prev::Operator;
            } else {
              pos += 1;
              prev = Prev::Dot;
            }
          }
          b'?'
            if bytes.get(pos + 1) == Some(&b'.')
              && !bytes.get(pos + 2).is_some_and(u8::is_ascii_digit) =>
          {
            pos += 2;
            prev = Prev::Dot;
          }
          b'<'
            if mode == Mode::Expression && prev == Prev::Operator && starts_markup(bytes, pos) =>
          {
            self.flush(copied, pos);
            self.glue("<>");
            pos = self.markup(pos, true);
            self.glue("</>");
            *copied = pos;
            prev = Prev::Operand;
          }
          // TypeScript's `<T>(x: T) => x` is an element in TSX; `<T,>(x: T) => x` is not.
          b'<' if mode != Mode::Expression && prev == Prev::Operator => {
            match scan::generic_arrow_parameters_end(bytes, pos) {
              Some(close) => {
                if scan::last_non_space(bytes, pos, close) != Some(b',') {
                  self.flush(copied, close);
                  self.glue(",");
                }
                pos = close + 1;
              }
              None => pos += 1,
            }
            prev = Prev::Operator;
          }
          b'-' if mode == Mode::Frontmatter && bytes[pos..].starts_with(b"---") => return pos,
          _ => {
            pos += 1;
            prev = Prev::Operator;
          }
        },
      }
    }

    len
  }

  /// Reads the template literal at `start`; returns its end.
  fn template_literal(&mut self, start: usize, mode: Mode, copied: &mut usize) -> usize {
    let bytes = self.bytes;
    let len = bytes.len();
    let substitution = match mode {
      Mode::Expression => Mode::Expression,
      _ => Mode::FrontmatterSubstitution,
    };
    let mut pos = start + 1;

    while pos < len {
      let Some(found) = memchr::memchr3(b'`', b'\\', b'$', &bytes[pos..]) else {
        return len;
      };
      pos += found;

      match bytes[pos] {
        b'`' => return pos + 1,
        b'\\' => pos += 2,
        _ if bytes.get(pos + 1) == Some(&b'{') => {
          pos = self.js(pos + 2, substitution, copied);
          if pos < len {
            pos += 1;
          }
        }
        _ => pos += 1,
      }
    }

    len
  }

  /// Copies the expression that starts at `start`; returns where it ends, at its `}`.
  fn expression(&mut self, start: usize) -> usize {
    let mut copied = start;
    let end = self.js(start, Mode::Expression, &mut copied);
    self.flush(&mut copied, end);
    end
  }

  // ---------------------------------------------------------------- markup

  /// Writes the template's nodes from `pos` to the file's end; or, for markup in an expression
  /// (`is_embedded`, at its first tag), until its root elements are closed or an unmatched `}`.
  /// Returns where it ends.
  fn markup(&mut self, mut pos: usize, is_embedded: bool) -> usize {
    let bytes = self.bytes;
    let len = bytes.len();
    let base = self.open.len();

    if is_embedded {
      pos = self.tag(pos, true, base);
    }

    loop {
      if is_embedded && self.open.len() == base {
        // Astro allows more elements after the first.
        let next = scan::skip_space(bytes, pos);
        if !continues_markup(bytes, next) {
          return pos;
        }
        pos = self.tag(next, true, base);
        continue;
      }

      let found = if is_embedded {
        memchr::memchr3(b'<', b'{', b'}', &bytes[pos..])
      } else {
        memchr::memchr2(b'<', b'{', &bytes[pos..])
      };
      let Some(found) = found else {
        break;
      };
      pos += found;

      pos = match bytes[pos] {
        b'{' => self.child_expression(pos),
        b'<' => self.tag(pos, is_embedded, base),
        // Text in markup in an expression has no `}`: the expression ends there.
        _ => {
          self.open.truncate(base);
          return pos;
        }
      };
    }

    self.open.truncate(base);
    len
  }

  /// `{expression}` among elements.
  fn child_expression(&mut self, start: usize) -> usize {
    self.glue("{");
    let end = self.skippable("0", |astro| astro.expression(start + 1));
    self.glue("}");
    (end + 1).min(self.bytes.len())
  }

  /// What starts with `<` at `start`: a tag, a comment, or text. Returns its end.
  fn tag(&mut self, start: usize, is_embedded: bool, base: usize) -> usize {
    let bytes = self.bytes;

    match bytes.get(start + 1) {
      Some(byte) if byte.is_ascii_alphabetic() => self.element(start, is_embedded),
      Some(b'>') => {
        if is_embedded {
          self.open.push((0, 0));
        }
        start + 2
      }
      Some(b'/') => {
        let name_start = start + 2;
        let name_end = scan::tag_name_end(bytes, name_start);
        if is_embedded {
          let name = &bytes[name_start..name_end];
          let open = self.open[base..]
            .iter()
            .rposition(|&(start, end)| &bytes[start..end] == name);
          if let Some(index) = open {
            self.open.truncate(base + index);
          }
        }
        scan::after_gt(bytes, name_end)
      }
      Some(b'!') if bytes[start..].starts_with(b"<!--") => {
        scan::find(bytes, start + 4, b"-->").map_or(bytes.len(), |end| end + 3)
      }
      Some(b'!') if bytes[start..].starts_with(b"<![CDATA[") => {
        scan::find(bytes, start + 9, b"]]>").map_or(bytes.len(), |end| end + 3)
      }
      Some(b'!' | b'?') => scan::after_gt(bytes, start),
      _ => start + 1,
    }
  }

  /// The element whose start tag is at `start`. Returns the end of its start tag, or of the whole
  /// element when its content is raw text.
  fn element(&mut self, start: usize, is_embedded: bool) -> usize {
    let bytes = self.bytes;
    let name_end = scan::tag_name_end(bytes, start + 1);
    let name = &bytes[start + 1..name_end];
    let mut tag = Tag {
      name: (start + 1, name_end),
      kind: TagName::of(name),
      is_written: false,
      has_attributes: false,
      is_raw: false,
    };
    if tag.kind == TagName::Component {
      self.write_tag(&mut tag);
    }

    let (end, is_self_closing) = self.attributes(name_end, &mut tag);
    if tag.is_written {
      self.glue("/>");
    }
    if is_self_closing {
      return end;
    }

    let is_raw_text = name == b"script" || name == b"style";
    if is_raw_text || tag.is_raw {
      let content_end = scan::raw_text_end(bytes, end, name);
      // Astro bundles a script without attributes: a module of its own.
      if name == b"script" && !tag.has_attributes {
        self.script(end, content_end);
      }
      return scan::after_gt(bytes, content_end + 2 + name.len());
    }

    if is_embedded && !scan::is_void_element(name) {
      self.open.push(tag.name);
    }
    end
  }

  /// Writes `<name` once.
  fn write_tag(&mut self, tag: &mut Tag) {
    if tag.is_written {
      return;
    }
    tag.is_written = true;

    let (start, end) = tag.name;
    match tag.kind {
      TagName::Component => {
        self.glue("<");
        self.copy(start, end);
      }
      TagName::Intrinsic => {
        let source = self.source;
        self.glue("<");
        self.glue(&source[start..end]);
      }
      TagName::Invalid => self.glue("<div"),
    }
  }

  /// Reads the attributes from `pos` to the tag's end. Returns where it ends and whether it is
  /// self-closing.
  fn attributes(&mut self, mut pos: usize, tag: &mut Tag) -> (usize, bool) {
    let bytes = self.bytes;

    loop {
      pos = scan::skip_space(bytes, pos);
      let Some(&byte) = bytes.get(pos) else {
        return (bytes.len(), false);
      };

      match byte {
        b'>' => return (pos + 1, false),
        b'/' if bytes.get(pos + 1) == Some(&b'>') => return (pos + 2, true),
        b'/' => pos += 1,
        b'{' => {
          tag.has_attributes = true;
          pos = self.brace_attribute(pos, tag);
        }
        _ => {
          tag.has_attributes = true;
          pos = self.named_attribute(pos, tag);
        }
      }
    }
  }

  /// `{...spread}`, `{shorthand}`, or another expression where an attribute is.
  fn brace_attribute(&mut self, start: usize, tag: &mut Tag) -> usize {
    let bytes = self.bytes;
    let inner = scan::skip_space(bytes, start + 1);

    if bytes[inner..].starts_with(b"...") {
      self.write_tag(tag);
      self.glue(" {");
      let end = self.skippable("...0", |astro| astro.expression(start + 1));
      self.glue("}");
      return (end + 1).min(bytes.len());
    }

    let identifier_end = scan::ascii_identifier_end(bytes, inner);
    let after = scan::skip_space(bytes, identifier_end);
    if identifier_end > inner && bytes.get(after) == Some(&b'}') {
      let source = self.source;
      self.write_tag(tag);
      self.glue(" ");
      self.glue(&source[inner..identifier_end]);
      self.glue("={");
      self.skippable("0", |astro| astro.copy(inner, identifier_end));
      self.glue("}");
      return after + 1;
    }

    if let Some(end) = empty_expression_end(bytes, start) {
      return end;
    }

    self.write_tag(tag);
    self.glue(" _={");
    let end = self.skippable("0", |astro| astro.expression(start + 1));
    self.glue("}");
    (end + 1).min(bytes.len())
  }

  /// `name`, `name="value"`, `name=value`, `name={expression}` or ``name=`template` ``.
  fn named_attribute(&mut self, start: usize, tag: &mut Tag) -> usize {
    let bytes = self.bytes;
    let len = bytes.len();
    let source = self.source;
    let name_end = scan::attribute_name_end(bytes, start);
    let name = &source[start..name_end];
    if name == "is:raw" {
      tag.is_raw = true;
    }
    // Only a component's attributes without expressions matter: as its props.
    let is_prop = tag.kind == TagName::Component && scan::is_jsx_name(name.as_bytes());

    let equals = scan::skip_space(bytes, name_end);
    if bytes.get(equals) != Some(&b'=') {
      if is_prop {
        self.glue(" ");
        self.glue(name);
      }
      return name_end;
    }

    let value = scan::skip_space(bytes, equals + 1);
    match bytes.get(value) {
      Some(b'{') if empty_expression_end(bytes, value).is_some() => {
        if is_prop {
          self.glue(" ");
          self.glue(name);
        }
        empty_expression_end(bytes, value).unwrap_or(len)
      }
      Some(b'{') => {
        let close = self.attribute_value_start(tag, name);
        let end = self.skippable("0", |astro| astro.expression(value + 1));
        self.glue(close);
        (end + 1).min(len)
      }
      Some(b'`') => {
        let close = self.attribute_value_start(tag, name);
        let end = self.skippable("0", |astro| {
          let mut copied = value;
          let end = astro.template_literal(value, Mode::Expression, &mut copied);
          astro.flush(&mut copied, end);
          end
        });
        self.glue(close);
        end
      }
      Some(b'"' | b'\'') => {
        let end = scan::quoted_value_end(bytes, value);
        if is_prop {
          self.glue(" ");
          self.glue(name);
          match end {
            Some(end) => {
              self.glue("=");
              self.copy(value, end);
            }
            None => self.glue("=\"\""),
          }
        }
        end.unwrap_or(len)
      }
      Some(b'>') | None => {
        if is_prop {
          self.glue(" ");
          self.glue(name);
        }
        value
      }
      Some(_) => {
        let end = scan::unquoted_value_end(bytes, value);
        if is_prop {
          self.glue(" ");
          self.glue(name);
          self.glue("=\"");
          if !bytes[value..end].contains(&b'"') {
            self.copy(value, end);
          }
          self.glue("\"");
        }
        end
      }
    }
  }

  /// Writes the start of an attribute whose value is an expression; returns what closes it. A
  /// name that is not valid in JSX, e.g. `@click`, is a spread object's key.
  fn attribute_value_start(&mut self, tag: &mut Tag, name: &str) -> &'static str {
    self.write_tag(tag);
    if scan::is_jsx_name(name.as_bytes()) {
      self.glue(" ");
      self.glue(name);
      self.glue("={");
      "}"
    } else {
      self.glue(" {...{\"");
      self.glue(scan::property_key(name));
      self.glue("\":(");
      ")}}"
    }
  }

  /// A bundled client script, whose content is `source[start..end)`.
  fn script(&mut self, start: usize, end: usize) {
    let content = &self.source[start..end];
    if content.trim().is_empty() {
      return;
    }

    let length = utf16_length(content);
    self.scripts.push(GeneratedCode {
      code: content.to_string(),
      lang: Lang::Ts,
      mappings: vec![Mapping {
        generated: 0,
        source: self.code.source_offset(start),
        length: length as i32,
        source_length: length as i32,
      }],
      length,
    });
  }
}

/// After the frontmatter's opening `---`, which only whitespace may precede.
fn frontmatter_start(bytes: &[u8]) -> Option<usize> {
  let start = if bytes.starts_with("\u{feff}".as_bytes()) {
    3
  } else {
    0
  };
  let fence = scan::skip_space(bytes, start);

  bytes[fence..].starts_with(b"---").then_some(fence + 3)
}

/// `<` that starts an element where an expression may: `<tag` or `<>`.
fn starts_markup(bytes: &[u8], pos: usize) -> bool {
  bytes.get(pos) == Some(&b'<')
    && bytes
      .get(pos + 1)
      .is_some_and(|&byte| byte.is_ascii_alphabetic() || byte == b'>')
}

/// After markup's root element in an expression: another element, or a comment.
fn continues_markup(bytes: &[u8], pos: usize) -> bool {
  starts_markup(bytes, pos) || bytes[pos.min(bytes.len())..].starts_with(b"<!--")
}

/// After `{}`, `{ }` or `{/* comment */}` at `start`, which JSX does not allow as an attribute.
fn empty_expression_end(bytes: &[u8], start: usize) -> Option<usize> {
  let mut pos = start + 1;
  loop {
    pos = scan::skip_space(bytes, pos);
    match bytes.get(pos..pos + 2) {
      Some(b"/*") => pos = scan::block_comment_end(bytes, pos),
      Some(b"//") => pos = scan::line_comment_end(bytes, pos),
      _ => return (bytes.get(pos) == Some(&b'}')).then_some(pos + 1),
    }
  }
}
