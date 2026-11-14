//! Vue's HTML template parser (`@vue/compiler-dom`, from Vue 3.4), byte by byte: tags with their
//! attributes, `{{ … }}` interpolations, comments, and raw text elements. As Vue's, and unlike a
//! browser's, it closes no element implicitly: an end tag closes the innermost open element of its
//! name (and those inside it), one that matches none is ignored, and any element may self-close.

use memchr::{memchr, memchr2, memmem};

use super::{
  names::{is_html_space, is_void_tag},
  template::{interpolations_in, Attribute, AttributeName, Span, Template},
};

/// How an open tag ended.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum TagEnd {
  /// `>`
  Open,
  /// `/>`
  SelfClosing,
  /// At a `</` inside the tag, which Vue reads as the tag's end (for text being typed).
  BeforeEndTag,
  /// At the end of the text.
  Unterminated,
}

/// Reads the attributes of an open tag from `position`, after its name, into `attributes`, and
/// returns how and where (after) the tag ends.
///
/// With `pug`, it reads the inside of Pug's `(…)`, as `@vue/language-plugin-pug` hands it to Vue:
/// a comma between attributes is a space, and a value may be quoted with backticks.
pub fn attributes(
  text: &[u8],
  position: usize,
  end: usize,
  pug: bool,
  attributes: &mut Vec<Attribute>,
) -> (usize, TagEnd) {
  let is_space = |byte: u8| is_html_space(byte) || (pug && byte == b',');
  let mut position = position;

  loop {
    while position < end && is_space(text[position]) {
      position += 1;
    }
    if position >= end {
      return (end, TagEnd::Unterminated);
    }

    if !pug {
      match text[position] {
        b'>' => return (position + 1, TagEnd::Open),
        b'/' => {
          let mut after = position + 1;
          while after < end && is_html_space(text[after]) {
            after += 1;
          }
          if after < end && text[after] == b'>' {
            return (after + 1, TagEnd::SelfClosing);
          }
          position = after;
          continue;
        }
        b'<' if text.get(position + 1) == Some(&b'/') => return (position, TagEnd::BeforeEndTag),
        _ => {}
      }
    }

    // The name ends at `=`, a space, `/` or `>`; its first character is part of it, even `=`.
    let name_start = position;
    position += 1;
    while position < end {
      let byte = text[position];
      let ends_name = byte == b'='
        || is_space(byte)
        || (!pug && (byte == b'/' || byte == b'>'))
        || (pug && byte == b'!' && text.get(position + 1) == Some(&b'='));
      if ends_name {
        break;
      }
      position += 1;
    }
    let name = Span::new(name_start, position);

    let mut after_name = position;
    while after_name < end && is_space(text[after_name]) {
      after_name += 1;
    }
    if pug && text.get(after_name) == Some(&b'!') {
      after_name += 1;
    }

    let mut value = None;
    if after_name < end && text[after_name] == b'=' {
      position = after_name + 1;
      while position < end && is_space(text[position]) {
        position += 1;
      }

      if position < end {
        let quote = text[position];
        if quote == b'"' || quote == b'\'' || (pug && quote == b'`') {
          let content = position + 1;
          match memchr(quote, &text[content..end]) {
            Some(length) => {
              value = Some(Span::new(content, content + length));
              position = content + length + 1;
            }
            None => {
              attributes.push(Attribute {
                name: AttributeName::Written(name),
                value: Some(Span::new(content, end)),
              });
              return (end, TagEnd::Unterminated);
            }
          }
        } else {
          let content = position;
          while position < end {
            let byte = text[position];
            if is_space(byte) || (!pug && byte == b'>') {
              break;
            }
            position += 1;
          }
          value = Some(Span::new(content, position));
        }
      }
    }

    attributes.push(Attribute {
      name: AttributeName::Written(name),
      value,
    });
  }
}

/// Where a parse starts.
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Mode {
  /// Inside a single-file component's `<template>`, which ends at the end tag that closes it.
  Root,
  /// A piece of HTML, e.g. a line of Pug: what it leaves open closes at its end.
  Fragment,
}

/// Where a root `<template>` ends.
pub struct Parsed {
  /// After its end tag, or the end.
  pub after: usize,
}

struct Open {
  node: u32,
  tag: Span,
}

/// Parses `text[start..end)` into `template`.
pub fn parse(text: &[u8], start: usize, end: usize, mode: Mode, template: &mut Template) -> Parsed {
  let mut parser = Parser {
    text,
    end,
    template,
    stack: Vec::new(),
    attributes: Vec::new(),
  };
  let parsed = parser.run(start, mode);
  for open in parser.stack.drain(..).rev() {
    parser.template.close(open.node);
  }
  parsed
}

struct Parser<'a, 't> {
  text: &'a [u8],
  end: usize,
  template: &'t mut Template,
  stack: Vec<Open>,
  attributes: Vec<Attribute>,
}

impl Parser<'_, '_> {
  fn run(&mut self, start: usize, mode: Mode) -> Parsed {
    let text = self.text;
    let end = self.end;
    let mut position = start;

    while position < end {
      let Some(found) = memchr2(b'<', b'{', &text[position..end]) else {
        break;
      };
      let at = position + found;

      if text[at] == b'{' {
        if text.get(at + 1) != Some(&b'{') || at + 1 >= end {
          position = at + 1;
          continue;
        }
        // An interpolation without its `}}` makes the rest text.
        let content = at + 2;
        let Some(close) = memmem::find(&text[content..end], b"}}") else {
          break;
        };
        self
          .template
          .interpolation(Span::new(content, content + close));
        position = content + close + 2;
        continue;
      }

      let next = if at + 1 < end { text[at + 1] } else { 0 };
      match next {
        b'!' => {
          position = if text[at..end].starts_with(b"<!--") {
            match memmem::find(&text[at + 4..end], b"-->") {
              Some(close) => at + 4 + close + 3,
              None => end,
            }
          } else {
            skip_past(text, at + 2, end, b'>')
          };
        }
        b'?' => position = skip_past(text, at + 2, end, b'>'),
        b'/' => {
          let name_start = at + 2;
          let is_name = name_start < end && text[name_start].is_ascii_alphabetic();
          if !is_name {
            position = skip_past(text, name_start, end, b'>');
            continue;
          }
          let mut name_end = name_start;
          while name_end < end && text[name_end] != b'>' && !is_html_space(text[name_end]) {
            name_end += 1;
          }
          if name_end >= end {
            break;
          }
          let after = skip_past(text, name_end, end, b'>');
          if self.end_tag(Span::new(name_start, name_end), mode) {
            return Parsed { after };
          }
          position = after;
        }
        letter if letter.is_ascii_alphabetic() => position = self.start_tag(at + 1),
        _ => position = at + 1,
      }
    }

    Parsed { after: end }
  }

  /// Reads the tag whose name starts at `name_start`, and the raw text of a `<script>` and the
  /// like; returns where to go on.
  fn start_tag(&mut self, name_start: usize) -> usize {
    let text = self.text;
    let end = self.end;
    let mut name_end = name_start;
    while name_end < end {
      let byte = text[name_end];
      if byte == b'/' || byte == b'>' || is_html_space(byte) {
        break;
      }
      name_end += 1;
    }
    let tag = Span::new(name_start, name_end);

    let node = self.template.open(tag);
    self.attributes.clear();
    let (after, tag_end) = attributes(text, name_end, end, false, &mut self.attributes);
    for &attribute in &self.attributes {
      self.template.attribute(node, attribute);
    }

    let name = &text[tag.range()];
    let has_children = tag_end != TagEnd::SelfClosing && !is_void_tag(name);
    if !has_children || tag_end == TagEnd::Unterminated {
      self.template.close(node);
      return after;
    }

    // Raw text, as Vue's tokenizer reads it in HTML mode: `<textarea>` and `<title>` with
    // interpolations, `<script>` and `<style>` without.
    let interpolates = match name {
      b"script" | b"style" => false,
      b"textarea" | b"title" => true,
      _ => {
        self.stack.push(Open { node, tag });
        return after;
      }
    };
    let (content_end, resume) = raw_text_end(text, after, end, name);
    if interpolates {
      interpolations_in(text, after, content_end, self.template);
    }
    self.template.close(node);
    resume
  }

  /// Closes the innermost open element named `name`; returns whether it closes the root template.
  fn end_tag(&mut self, name: Span, mode: Mode) -> bool {
    let text = self.text;
    let name = &text[name.range()];
    if is_void_tag(name) {
      return false;
    }

    let open = self
      .stack
      .iter()
      .rposition(|open| text[open.tag.range()].eq_ignore_ascii_case(name));
    match open {
      Some(index) => {
        for open in self.stack.drain(index..).rev() {
          self.template.close(open.node);
        }
        false
      }
      None => mode == Mode::Root && name.eq_ignore_ascii_case(b"template"),
    }
  }
}

/// After the next `byte` from `position`, or the end.
fn skip_past(text: &[u8], position: usize, end: usize, byte: u8) -> usize {
  if position >= end {
    return end;
  }
  match memchr(byte, &text[position..end]) {
    Some(found) => position + found + 1,
    None => end,
  }
}

/// Where the raw text from `start` ends, at `</name` (in any case) and a space or `>`, and where to
/// go on after its end tag.
pub fn raw_text_end(text: &[u8], start: usize, end: usize, name: &[u8]) -> (usize, usize) {
  let mut position = start;

  while position < end {
    let Some(found) = memchr(b'<', &text[position..end]) else {
      break;
    };
    let at = position + found;
    let name_start = at + 2;
    let name_end = name_start + name.len();
    let is_end_tag = text.get(at + 1) == Some(&b'/')
      && name_end <= end
      && text[name_start..name_end].eq_ignore_ascii_case(name)
      && (name_end == end || text[name_end] == b'>' || is_html_space(text[name_end]));
    if is_end_tag {
      return (at, skip_past(text, name_end, end, b'>'));
    }
    position = at + 1;
  }

  (end, end)
}

#[cfg(test)]
pub(crate) mod tests {
  use super::*;
  use crate::languages::vue::template::NodeKind;

  /// The template as `tag[attribute=value]{…}` and `{{expression}}`.
  pub fn outline(text: &str, template: &Template) -> String {
    let mut out = String::new();
    let mut ends = Vec::new();
    for (index, node) in template.nodes.iter().enumerate() {
      while ends.last() == Some(&(index as u32)) {
        ends.pop();
        out.push('}');
      }
      match node.kind {
        NodeKind::Interpolation => {
          out.push_str("{{");
          out.push_str(&text[node.span.range()]);
          out.push_str("}}");
        }
        NodeKind::Element => {
          out.push_str(if node.span.is_empty() {
            "div"
          } else {
            &text[node.span.range()]
          });
          for attribute in template.attributes_of(node) {
            out.push('[');
            match attribute.name {
              AttributeName::Written(name) => out.push_str(&text[name.range()]),
              AttributeName::Class => out.push_str(".class"),
              AttributeName::Id => out.push_str("#id"),
            }
            if let Some(value) = attribute.value {
              out.push('=');
              out.push_str(&text[value.range()]);
            }
            out.push(']');
          }
          out.push('{');
          ends.push(node.end);
        }
      }
    }
    while ends.pop().is_some() {
      out.push('}');
    }
    out
  }

  fn parsed(text: &str, mode: Mode) -> (String, usize) {
    let mut template = Template::default();
    let parsed = parse(text.as_bytes(), 0, text.len(), mode, &mut template);
    template.finish();
    (outline(text, &template), parsed.after)
  }

  #[test]
  fn reads_elements_attributes_and_interpolations() {
    let (outline, _) = parsed(
      r#"<h1 :title="m.title()" class=big disabled>{{ m.a({ b }) }}</h1><input v-model='x'><p/>"#,
      Mode::Fragment,
    );
    assert_eq!(
      outline,
      "h1[:title=m.title()][class=big][disabled]{{{ m.a({ b }) }}}input[v-model=x]{}p{}"
    );
  }

  #[test]
  fn end_tags_close_the_innermost_element_of_their_name() {
    let (outline, _) = parsed("<ul><li>a<li>b</ul><b></i>c</B>", Mode::Fragment);
    assert_eq!(outline, "ul{li{li{}}}b{}");
    let (outline, _) = parsed("<Input>{{ a }}</Input><Link/>", Mode::Fragment);
    assert_eq!(outline, "Input{{{ a }}}Link{}");
  }

  #[test]
  fn comments_raw_text_and_interpolations_hide_tags() {
    let (outline, _) = parsed(
      "<!-- <p :a=\"x\"> --><script>{{ no }}<p></script><textarea>{{ yes }}</textarea>{{ a < b }}",
      Mode::Fragment,
    );
    assert_eq!(outline, "script{}textarea{{{ yes }}}{{ a < b }}");
  }

  #[test]
  fn a_root_template_ends_at_its_own_end_tag() {
    let text = "<template v-if=\"a\"><p>{{ x }}</template></template>after";
    let (outline, after) = parsed(text, Mode::Root);
    assert_eq!(outline, "template[v-if=a]{p{{{ x }}}}");
    assert_eq!(&text[after..], "after");
  }

  #[test]
  fn reads_dynamic_arguments_and_odd_attributes() {
    let (outline, _) = parsed(
      r#"<a :[key]="v" @click.stop = "go()" #default="{ m }" href=/x/ / ></a><b </b>"#,
      Mode::Fragment,
    );
    assert_eq!(
      outline,
      "a[:[key]=v][@click.stop=go()][#default={ m }][href=/x/]{}b{}"
    );
  }

  #[test]
  fn pug_attributes_are_separated_by_commas() {
    let text = "type=\"button\",\n  @click=\"a(); b()\", disabled, :x=`y`, foo!=\"z\"";
    let mut attributes = Vec::new();
    super::attributes(text.as_bytes(), 0, text.len(), true, &mut attributes);
    let names: Vec<_> = attributes
      .iter()
      .map(|attribute| {
        let AttributeName::Written(name) = attribute.name else {
          unreachable!()
        };
        let value = attribute.value.map_or("", |value| &text[value.range()]);
        format!("{}={}", &text[name.range()], value)
      })
      .collect();
    assert_eq!(
      names,
      [
        "type=button",
        "@click=a(); b()",
        "disabled=",
        ":x=y",
        "foo=z"
      ]
    );
  }
}
