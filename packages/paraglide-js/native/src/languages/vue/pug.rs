//! Pug templates (`<template lang="pug">`), as `@vue/language-plugin-pug` hands them to Vue: it
//! writes the tags of `pug-parser`'s tree as HTML, with each attribute block's text (Vue's
//! directives) and the text of tags, piped lines and dot blocks (with their `{{ … }}`), and leaves
//! out the rest: code (`= …`, `- …`, `#{…}`), conditionals and loops, comments, filters and the
//! like, with what is nested in them. Nesting is by indentation.

use memchr::{memchr, memmem};

use super::{
  html::{self, attributes},
  names::is_word_byte,
  template::{interpolations_in, Attribute, AttributeName, Span, Template},
};

/// Parses the Pug of `text[content]` into `template`.
pub fn parse(text: &[u8], content: Span, template: &mut Template) {
  let mut parser = Parser {
    text,
    end: content.end as usize,
    template,
    stack: Vec::new(),
    attributes: Vec::new(),
  };
  parser.run(content.start as usize);
  while let Some(level) = parser.stack.pop() {
    parser.close(level);
  }
}

struct Level {
  indent: usize,
  /// None for a mixin, whose nested lines belong to the element around it.
  node: Option<u32>,
  /// In a `<script>` or `<style>`: text is not interpolated.
  raw: bool,
}

struct Parser<'a, 't> {
  text: &'a [u8],
  end: usize,
  template: &'t mut Template,
  stack: Vec<Level>,
  attributes: Vec<Attribute>,
}

impl Parser<'_, '_> {
  fn run(&mut self, start: usize) {
    let mut position = start;

    while position < self.end {
      let line_end = self.line_end(position);
      let (content, indent) = self.indentation(position, line_end);
      if self.is_blank(content, line_end) {
        position = line_end + 1;
        continue;
      }

      while self
        .stack
        .last()
        .is_some_and(|level| level.indent >= indent)
      {
        if let Some(level) = self.stack.pop() {
          self.close(level);
        }
      }

      position = self.line(content, line_end, indent);
    }
  }

  fn close(&mut self, level: Level) {
    if let Some(node) = level.node {
      self.template.close(node);
    }
  }

  fn line_end(&self, position: usize) -> usize {
    memchr(b'\n', &self.text[position.min(self.end)..self.end])
      .map_or(self.end, |found| position + found)
  }

  /// Where a line's content starts, and its indentation.
  fn indentation(&self, start: usize, line_end: usize) -> (usize, usize) {
    let mut content = start;
    while content < line_end && matches!(self.text[content], b' ' | b'\t') {
      content += 1;
    }
    (content, content - start)
  }

  fn is_blank(&self, content: usize, line_end: usize) -> bool {
    content >= line_end || (self.text[content] == b'\r' && content + 1 >= line_end)
  }

  fn is_raw(&self) -> bool {
    self.stack.last().is_some_and(|level| level.raw)
  }

  /// After the line, and the lines nested in it.
  fn after_block(&self, line_end: usize, indent: usize) -> usize {
    let mut position = line_end + 1;
    while position < self.end {
      let line_end = self.line_end(position);
      let (content, line_indent) = self.indentation(position, line_end);
      if !self.is_blank(content, line_end) && line_indent <= indent {
        return position;
      }
      position = line_end + 1;
    }
    self.end
  }

  /// Text from `start` to `end`: its `{{ … }}`, and the tags of its `#[…]`.
  fn text(&mut self, start: usize, end: usize, raw: bool) {
    let text = self.text;
    let mut position = start;

    while position < end {
      let Some(found) = memmem::find(&text[position..end], b"#[") else {
        break;
      };
      let at = position + found;
      let is_escaped = at > start && text[at - 1] == b'\\';
      if !raw {
        interpolations_in(text, position, at, self.template);
      }
      position = if is_escaped {
        at + 2
      } else {
        self.inline_tag(at + 2, end, raw)
      };
    }

    if !raw && position < end {
      interpolations_in(text, position, end, self.template);
    }
  }

  /// The tag of `#[tag(attributes) text]` from after its `#[`; returns where its `]` ends.
  fn inline_tag(&mut self, start: usize, end: usize, raw: bool) -> usize {
    let text = self.text;
    let mut name_end = start;
    while name_end < end && (is_word_byte(text[name_end]) || matches!(text[name_end], b'-' | b':'))
    {
      name_end += 1;
    }
    while name_end > start && !is_word_byte(text[name_end - 1]) {
      name_end -= 1;
    }
    let name = &text[start..name_end];
    let raw = raw || name == b"script" || name == b"style";
    let node = self.template.open(Span::new(start, name_end));
    let mut position = name_end;

    let after = loop {
      if position >= end {
        break end;
      }
      let next = text.get(position + 1).copied().unwrap_or(b']');
      match text[position] {
        b'.' if is_class_byte(next) => {
          position = self.shorthand(node, AttributeName::Class, position + 1, end);
        }
        b'#' if is_word_byte(next) || next == b'-' => {
          position = self.shorthand(node, AttributeName::Id, position + 1, end);
        }
        b'(' => match bracket_end(text, position, end) {
          Some(close) => {
            self.attributes.clear();
            attributes(text, position + 1, close, true, &mut self.attributes);
            for &attribute in &self.attributes {
              self.template.attribute(node, attribute);
            }
            position = close + 1;
          }
          None => break end,
        },
        b']' => break position + 1,
        b' ' => {
          // The text ends at the first `]` that is not another tag's.
          let mut text_start = position + 1;
          loop {
            let close =
              memchr(b']', &text[text_start..end]).map_or(end, |found| text_start + found);
            let nested =
              memmem::find(&text[text_start..close], b"#[").map(|found| text_start + found);
            match nested {
              Some(nested) => {
                if !raw {
                  interpolations_in(text, text_start, nested, self.template);
                }
                text_start = self.inline_tag(nested + 2, end, raw);
              }
              None => {
                if !raw {
                  interpolations_in(text, text_start, close, self.template);
                }
                break;
              }
            }
          }
          let close =
            memchr(b']', &text[text_start.min(end)..end]).map_or(end, |found| text_start + found);
          break (close + 1).min(end);
        }
        _ => {
          // `=` code, or what Pug rejects.
          break memchr(b']', &text[position..end]).map_or(end, |found| position + found + 1);
        }
      }
    };

    self.template.close(node);
    after
  }

  /// A `.class` or `#id` from after its `.` or `#`; returns where it ends.
  fn shorthand(&mut self, node: u32, name: AttributeName, start: usize, end: usize) -> usize {
    let mut value_end = start;
    while value_end < end && is_class_byte(self.text[value_end]) {
      value_end += 1;
    }
    self.template.attribute(
      node,
      Attribute {
        name,
        value: Some(Span::new(start, value_end)),
      },
    );
    value_end
  }

  /// Reads the line whose content starts at `content`; returns where the next line starts.
  fn line(&mut self, content: usize, line_end: usize, indent: usize) -> usize {
    let text = self.text;
    let next = text.get(content + 1).copied().unwrap_or(0);

    match text[content] {
      b'|' => {
        let start = if next == b' ' {
          content + 2
        } else {
          content + 1
        };
        let raw = self.is_raw();
        self.text(start, line_end, raw);
        line_end + 1
      }
      b'<' => {
        html::parse(text, content, line_end, html::Mode::Fragment, self.template);
        line_end + 1
      }
      b'/' if next == b'/' => self.after_block(line_end, indent),
      b'-' | b'=' | b':' => self.after_block(line_end, indent),
      b'!' if next == b'=' => self.after_block(line_end, indent),
      b'#' if next == b'{' || next == b'[' => self.after_block(line_end, indent),
      b'+' => self.mixin_call(content + 1, line_end, indent),
      b'#' | b'.' => self.tag(content, line_end, indent),
      byte if is_word_byte(byte) => match self.keyword(content, line_end) {
        Some(Keyword::Block) => self.after_block(line_end, indent),
        Some(Keyword::Line) => line_end + 1,
        Some(Keyword::Mixin) => {
          let raw = self.is_raw();
          self.stack.push(Level {
            indent,
            node: None,
            raw,
          });
          line_end + 1
        }
        None => self.tag(content, line_end, indent),
      },
      _ => line_end + 1,
    }
  }

  /// A keyword that `pug-lexer` reads before a tag name.
  fn keyword(&self, content: usize, line_end: usize) -> Option<Keyword> {
    let text = self.text;
    let mut word_end = content;
    while word_end < line_end && text[word_end].is_ascii_alphabetic() {
      word_end += 1;
    }
    let after = if word_end < line_end {
      text[word_end]
    } else {
      b'\n'
    };
    let is_boundary = !is_word_byte(after);
    let is_space_or_end = matches!(after, b' ' | b'\t' | b'\r' | b'\n');

    let keyword = match &text[content..word_end] {
      b"if" | b"unless" | b"else" | b"each" | b"for" | b"case" | b"default" if is_boundary => {
        Keyword::Block
      }
      b"while" | b"when" | b"append" | b"prepend" | b"block" if is_space_or_end => Keyword::Block,
      b"include" | b"extends" | b"extend" if is_space_or_end || after == b':' => Keyword::Block,
      b"yield" => Keyword::Block,
      b"doctype" if is_boundary => Keyword::Line,
      b"mixin" if after == b' ' => Keyword::Mixin,
      _ => return None,
    };
    Some(keyword)
  }

  /// `+name(arguments)(attributes)`, whose nested lines and text are the mixin's block.
  fn mixin_call(&mut self, position: usize, line_end: usize, indent: usize) -> usize {
    let text = self.text;
    let mut position = position;
    while position < line_end && matches!(text[position], b' ' | b'\t') {
      position += 1;
    }
    while position < line_end && (is_word_byte(text[position]) || text[position] == b'-') {
      position += 1;
    }
    let mut line_end = line_end;
    while position < self.end && text[position] == b'(' {
      match bracket_end(text, position, self.end) {
        Some(close) => {
          position = close + 1;
          line_end = self.line_end(position);
        }
        None => return self.end,
      }
    }

    let raw = self.is_raw();
    self.stack.push(Level {
      indent,
      node: None,
      raw,
    });
    if position < line_end && text[position] == b' ' {
      self.text(position + 1, line_end, raw);
    }
    line_end + 1
  }

  /// A tag, from its name (or `.class` or `#id` for a `div`), to the end of its line: its text, or
  /// the tag after `: `.
  fn tag(&mut self, start: usize, line_end: usize, indent: usize) -> usize {
    let text = self.text;
    let mut position = start;
    let mut line_end = line_end;

    // `\w(?:[-:\w]*\w)?`
    let mut name_end = start;
    if is_word_byte(text[start]) {
      let mut scan = start + 1;
      name_end = scan;
      while scan < line_end && (is_word_byte(text[scan]) || matches!(text[scan], b'-' | b':')) {
        scan += 1;
        if is_word_byte(text[scan - 1]) {
          name_end = scan;
        }
      }
      position = name_end;
    }
    let tag = Span::new(start, name_end);
    let name = &text[tag.range()];
    let raw = self.is_raw() || name == b"script" || name == b"style";
    let node = self.template.open(tag);

    loop {
      if position >= line_end {
        self.stack.push(Level {
          indent,
          node: Some(node),
          raw,
        });
        return line_end + 1;
      }

      let byte = text[position];
      let next = text.get(position + 1).copied().unwrap_or(b'\n');
      match byte {
        b'.' if is_class_byte(next) => {
          position = self.shorthand(node, AttributeName::Class, position + 1, line_end);
        }
        b'#' if is_word_byte(next) || next == b'-' => {
          position = self.shorthand(node, AttributeName::Id, position + 1, line_end);
        }
        b'(' => {
          let Some(close) = bracket_end(text, position, self.end) else {
            self.template.close(node);
            return self.end;
          };
          self.attributes.clear();
          attributes(text, position + 1, close, true, &mut self.attributes);
          for &attribute in &self.attributes {
            self.template.attribute(node, attribute);
          }
          position = close + 1;
          line_end = self.line_end(position);
        }
        b'&' if text[position..line_end].starts_with(b"&attributes(") => {
          let open = position + b"&attributes".len();
          let Some(close) = bracket_end(text, open, self.end) else {
            self.template.close(node);
            return self.end;
          };
          position = close + 1;
          line_end = self.line_end(position);
        }
        b'.' => {
          // A dot block: the nested lines are text.
          self.stack.push(Level {
            indent,
            node: Some(node),
            raw,
          });
          let block_end = self.after_block(line_end, indent);
          if line_end + 1 < block_end {
            self.text(line_end + 1, block_end, raw);
          }
          return block_end;
        }
        b':' if next == b' ' || next == b'\t' => {
          // Block expansion: the rest of the line is a nested tag.
          self.stack.push(Level {
            indent,
            node: Some(node),
            raw,
          });
          let mut nested = position + 1;
          while nested < line_end && matches!(text[nested], b' ' | b'\t') {
            nested += 1;
          }
          if nested >= line_end {
            return line_end + 1;
          }
          return self.line(nested, line_end, indent);
        }
        b'/' => {
          self.template.close(node);
          return line_end + 1;
        }
        b' ' | b'\t' => {
          self.stack.push(Level {
            indent,
            node: Some(node),
            raw,
          });
          self.text(position + 1, line_end, raw);
          return line_end + 1;
        }
        _ => {
          // `=`/`!=` code, or text Pug rejects.
          self.stack.push(Level {
            indent,
            node: Some(node),
            raw,
          });
          return line_end + 1;
        }
      }
    }
  }
}

enum Keyword {
  /// Leaves out the line and those nested in it.
  Block,
  /// Leaves out the line.
  Line,
  /// A mixin's declaration: its block is written where it is.
  Mixin,
}

/// `[_a-z0-9-]` of a Pug class name.
fn is_class_byte(byte: u8) -> bool {
  byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'-'
}

/// The `)` (or `]`, `}`) that closes the bracket at `open`, past nested brackets and strings, as
/// `character-parser` finds it for Pug.
fn bracket_end(text: &[u8], open: usize, end: usize) -> Option<usize> {
  let mut depth = 0usize;
  let mut position = open;

  while position < end {
    match text[position] {
      b'(' | b'[' | b'{' => depth += 1,
      b')' | b']' | b'}' => {
        depth = depth.saturating_sub(1);
        if depth == 0 {
          return Some(position);
        }
      }
      quote @ (b'"' | b'\'' | b'`') => {
        position += 1;
        while position < end && text[position] != quote {
          if text[position] == b'\\' {
            position += 1;
          }
          position += 1;
        }
      }
      _ => {}
    }
    position += 1;
  }

  None
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::languages::vue::html::tests::outline;

  fn parsed(pug: &str) -> String {
    let mut template = Template::default();
    parse(pug.as_bytes(), Span::new(0, pug.len()), &mut template);
    template.finish();
    outline(pug, &template)
  }

  #[test]
  fn nests_by_indentation() {
    let pug = "\ndiv.cart#main\n  h1(:title=\"m.title()\" class=\"big\") {{ m.heading() }}\n  p Total: #{m.total()}\n  span= m.buffered()\n\n  ul: li {{ m.nested() }}\np last\n";
    assert_eq!(
      parsed(pug),
      "div[.class=cart][#id=main]{h1[:title=m.title()][class=big]{{{ m.heading() }}}p{}span{}ul{li{{{ m.nested() }}}}}p{}"
    );
  }

  #[test]
  fn reads_attribute_blocks_across_lines() {
    let pug = "button(\n  type=\"button\",\n  @click=\"setLocale('de'); track()\"\n) DE {{ x }}\n  span child\nparaglide-message(:message=\"m.tos\")/\n";
    assert_eq!(
      parsed(pug),
      "button[type=button][@click=setLocale('de'); track()]{{{ x }}span{}}paraglide-message[:message=m.tos]{}"
    );
  }

  #[test]
  fn leaves_out_comments_code_and_control_flow() {
    let pug = "div\n  // {{ a }}\n    p {{ b }}\n  //- {{ c }}\n  - const x = 1\n  if x\n    p {{ d }}\n  else\n    p {{ e }}\n  each i in list\n    p {{ f }}\n  | piped {{ g }}\n  p.\n    A block {{ h }}\n    more\n  script.\n    {{ no }}\n  +mixin(a)\n    p {{ i }}\n";
    assert_eq!(parsed(pug), "div{{{ g }}p{{{ h }}}script{}p{{{ i }}}}");
  }

  #[test]
  fn tag_interpolations_are_tags() {
    let pug =
      "p a #[Child(:label=\"m.x\")] b {{ c }} #[strong.big {{ d }} #[em {{ e[0] }}] f] \\#[g]\n";
    assert_eq!(
      parsed(pug),
      "p{Child[:label=m.x]{}{{ c }}strong[.class=big]{{{ d }}em{}}}"
    );
  }

  #[test]
  fn inline_html_lines_are_html() {
    let pug = "div\n  <span :title=\"m.x()\">{{ y }}</span>\n  p z\n";
    assert_eq!(parsed(pug), "div{span[:title=m.x()]{{{ y }}}p{}}");
  }

  #[test]
  fn a_template_may_be_indented_as_a_whole() {
    let pug = "\n  ul\n    li(v-for=\"m in lists\") {{ m.label }}\n  p {{ m.after() }}\n";
    assert_eq!(
      parsed(pug),
      "ul{li[v-for=m in lists]{{{ m.label }}}}p{{{ m.after() }}}"
    );
  }
}
