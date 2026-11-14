//! What parse5 sees of an HTML file, as JavaScript read it: whether it is a page (a doctype, or a
//! written `<html>`) and the content of its inline `<script type="module">` tags, or an Analog
//! component's top-level `<script>` and `<template>` blocks.

use super::tags::{named_entity, numeric_entity};

/// A start or end tag, a comment or doctype, or text, with its range.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Event {
  /// A start tag: its name's range; `attrs` holds its attributes until the next one.
  Start {
    name: (usize, usize),
    start: usize,
    end: usize,
  },
  End {
    name: (usize, usize),
    start: usize,
  },
  Comment,
  Doctype,
  Text {
    start: usize,
    end: usize,
  },
}

/// An attribute: its name's range, and its value's, if it has one.
type Attribute = ((usize, usize), Option<(usize, usize)>);

/// The tokens of the HTML standard's tokenizer, for HTML content.
struct Scanner<'s> {
  source: &'s str,
  bytes: &'s [u8],
  pos: usize,
  attrs: Vec<Attribute>,
  /// The element whose raw text comes next (`<script>`, `<style>`…), and the end of its text.
  raw: Option<(usize, usize)>,
}

const RAW_TEXT: [&str; 10] = [
  "script",
  "style",
  "xmp",
  "iframe",
  "noembed",
  "noframes",
  "noscript",
  "textarea",
  "title",
  "plaintext",
];

fn is_space(byte: u8) -> bool {
  matches!(byte, b'\t' | b'\n' | 0x0c | b'\r' | b' ')
}

impl<'s> Scanner<'s> {
  fn new(source: &'s str) -> Self {
    let pos = if source.starts_with('\u{feff}') { 3 } else { 0 };
    Scanner {
      source,
      bytes: source.as_bytes(),
      pos,
      attrs: Vec::new(),
      raw: None,
    }
  }

  fn name(&self, range: (usize, usize)) -> &'s str {
    &self.source[range.0..range.1]
  }

  fn find(&self, from: usize, needle: &[u8]) -> Option<usize> {
    memchr::memmem::find(&self.bytes[from..], needle).map(|offset| from + offset)
  }

  fn next_event(&mut self) -> Option<Event> {
    if let Some((name_start, name_end)) = self.raw.take() {
      return Some(self.raw_text(name_start, name_end));
    }
    let start = self.pos;
    if start >= self.bytes.len() {
      return None;
    }
    if self.bytes[start] != b'<' {
      let end = memchr::memchr(b'<', &self.bytes[start + 1..])
        .map_or(self.bytes.len(), |offset| start + 1 + offset);
      self.pos = end;
      return Some(Event::Text { start, end });
    }

    let next = self.bytes.get(start + 1).copied().unwrap_or(0);
    if next.is_ascii_alphabetic() {
      return Some(self.start_tag(start));
    }
    if next == b'/' {
      let after = self.bytes.get(start + 2).copied().unwrap_or(0);
      if after.is_ascii_alphabetic() {
        let name_start = start + 2;
        let name_end = self.tag_name_end(name_start);
        self.pos = name_end;
        self.attributes();
        return Some(Event::End {
          name: (name_start, name_end),
          start,
        });
      }
      if after == b'>' {
        self.pos = start + 3;
        return Some(Event::Comment);
      }
      if after == 0 && start + 2 >= self.bytes.len() {
        self.pos = self.bytes.len();
        return Some(Event::Text {
          start,
          end: self.bytes.len(),
        });
      }
      self.bogus_comment(start + 2);
      return Some(Event::Comment);
    }
    if next == b'!' {
      let rest = &self.bytes[start + 2..];
      if rest.starts_with(b"--") {
        let content = start + 4;
        let end = if self.bytes[content..].starts_with(b">") {
          content + 1
        } else if self.bytes[content..].starts_with(b"->") {
          content + 2
        } else {
          let close = self.find(content, b"-->").map(|at| at + 3);
          let bang = self.find(content, b"--!>").map(|at| at + 4);
          match (close, bang) {
            (Some(close), Some(bang)) => close.min(bang),
            (Some(end), None) | (None, Some(end)) => end,
            (None, None) => self.bytes.len(),
          }
        };
        self.pos = end;
        return Some(Event::Comment);
      }
      if rest.len() >= 7 && rest[..7].eq_ignore_ascii_case(b"doctype") {
        self.bogus_comment(start + 9);
        return Some(Event::Doctype);
      }
      self.bogus_comment(start + 2);
      return Some(Event::Comment);
    }
    if next == b'?' {
      self.bogus_comment(start + 1);
      return Some(Event::Comment);
    }
    // A `<` that starts nothing is text.
    let end = memchr::memchr(b'<', &self.bytes[start + 1..])
      .map_or(self.bytes.len(), |offset| start + 1 + offset);
    self.pos = end;
    Some(Event::Text { start, end })
  }

  fn bogus_comment(&mut self, from: usize) {
    self.pos = memchr::memchr(b'>', &self.bytes[from.min(self.bytes.len())..])
      .map_or(self.bytes.len(), |offset| from + offset + 1);
  }

  fn tag_name_end(&self, start: usize) -> usize {
    let mut end = start;
    while end < self.bytes.len()
      && !is_space(self.bytes[end])
      && !matches!(self.bytes[end], b'/' | b'>')
    {
      end += 1;
    }
    end
  }

  fn start_tag(&mut self, start: usize) -> Event {
    let name_start = start + 1;
    let name_end = self.tag_name_end(name_start);
    self.pos = name_end;
    self.attributes();
    let name = self.name((name_start, name_end));
    if RAW_TEXT.iter().any(|raw| raw.eq_ignore_ascii_case(name)) {
      self.raw = Some((name_start, name_end));
    }
    Event::Start {
      name: (name_start, name_end),
      start,
      end: self.pos,
    }
  }

  /// Reads a tag's attributes and its `>` (or the end of the file).
  fn attributes(&mut self) {
    self.attrs.clear();
    let bytes = self.bytes;
    let length = bytes.len();
    loop {
      while self.pos < length && (is_space(bytes[self.pos]) || bytes[self.pos] == b'/') {
        if bytes[self.pos] == b'/' && bytes.get(self.pos + 1) == Some(&b'>') {
          self.pos += 2;
          return;
        }
        self.pos += 1;
      }
      if self.pos >= length {
        return;
      }
      if bytes[self.pos] == b'>' {
        self.pos += 1;
        return;
      }

      let name_start = self.pos;
      self.pos += 1;
      while self.pos < length
        && !is_space(bytes[self.pos])
        && !matches!(bytes[self.pos], b'/' | b'>' | b'=')
      {
        self.pos += 1;
      }
      let name = (name_start, self.pos);
      while self.pos < length && is_space(bytes[self.pos]) {
        self.pos += 1;
      }
      let mut value = None;
      if self.pos < length && bytes[self.pos] == b'=' {
        self.pos += 1;
        while self.pos < length && is_space(bytes[self.pos]) {
          self.pos += 1;
        }
        match bytes.get(self.pos) {
          Some(&quote @ (b'"' | b'\'')) => {
            let value_start = self.pos + 1;
            let value_end = memchr::memchr(quote, &bytes[value_start..])
              .map_or(length, |offset| value_start + offset);
            value = Some((value_start, value_end));
            self.pos = (value_end + 1).min(length);
          }
          Some(b'>') | None => value = Some((self.pos, self.pos)),
          Some(_) => {
            let value_start = self.pos;
            while self.pos < length && !is_space(bytes[self.pos]) && bytes[self.pos] != b'>' {
              self.pos += 1;
            }
            value = Some((value_start, self.pos));
          }
        }
      }
      let name_text = &self.source[name.0..name.1];
      let is_duplicate = self
        .attrs
        .iter()
        .any(|(other, _)| self.source[other.0..other.1].eq_ignore_ascii_case(name_text));
      if !is_duplicate {
        self.attrs.push((name, value));
      }
    }
  }

  /// The text of a `<script>`-like element up to its end tag, which is read next.
  fn raw_text(&mut self, name_start: usize, name_end: usize) -> Event {
    let name = &self.bytes[name_start..name_end];
    let start = self.pos;
    if name.eq_ignore_ascii_case(b"plaintext") {
      self.pos = self.bytes.len();
      return Event::Text {
        start,
        end: self.pos,
      };
    }
    let mut from = start;
    while let Some(at) = self.find(from, b"</") {
      let candidate = at + 2;
      let matches = self
        .bytes
        .get(candidate..candidate + name.len())
        .is_some_and(|text| text.eq_ignore_ascii_case(name));
      let after = self.bytes.get(candidate + name.len()).copied();
      if matches && after.is_some_and(|byte| is_space(byte) || byte == b'/' || byte == b'>') {
        self.pos = at;
        return Event::Text { start, end: at };
      }
      from = candidate;
    }
    self.pos = self.bytes.len();
    Event::Text {
      start,
      end: self.pos,
    }
  }

  /// The value of the start tag's attribute `name`, decoded; none if it has none.
  fn attribute(&self, name: &str) -> Option<String> {
    self
      .attrs
      .iter()
      .find(|(attr, _)| self.source[attr.0..attr.1].eq_ignore_ascii_case(name))
      .map(|(_, value)| {
        value.map_or(String::new(), |(start, end)| {
          decode(&self.source[start..end])
        })
      })
  }

  fn has_attribute(&self, name: &str) -> bool {
    self
      .attrs
      .iter()
      .any(|(attr, _)| self.source[attr.0..attr.1].eq_ignore_ascii_case(name))
  }
}

/// An attribute value with its character references decoded.
fn decode(value: &str) -> String {
  if !value.contains('&') {
    return value.to_string();
  }
  let mut decoded = String::with_capacity(value.len());
  let mut rest = value;
  while let Some(at) = rest.find('&') {
    decoded.push_str(&rest[..at]);
    rest = &rest[at..];
    let end = rest[1..]
      .find(|character: char| !(character.is_ascii_alphanumeric() || character == '#'))
      .map_or(rest.len(), |offset| offset + 1);
    let reference = &rest[1..end];
    let character = match reference.strip_prefix('#') {
      Some(numeric) => match numeric.strip_prefix(['x', 'X']) {
        Some(hex) => numeric_entity(hex, true).map(String::from),
        None => numeric_entity(numeric, false).map(String::from),
      },
      None => named_entity(reference).map(String::from),
    };
    match character {
      Some(character) => {
        decoded.push_str(&character);
        rest = rest[end..].strip_prefix(';').unwrap_or(&rest[end..]);
      }
      None => {
        decoded.push('&');
        rest = &rest[1..];
      }
    }
  }
  decoded.push_str(rest);
  decoded
}

/// Whether parse5 finds a doctype, or a `<html>` start tag before any content.
pub fn is_page(source: &str) -> bool {
  let mut scanner = Scanner::new(source);
  // Before anything but spaces and comments, a doctype is the document's; after, it is ignored.
  let mut is_initial = true;
  while let Some(event) = scanner.next_event() {
    match event {
      Event::Comment => {}
      Event::Text { start, end } => {
        if !source.as_bytes()[start..end]
          .iter()
          .all(|&byte| is_space(byte))
        {
          return false;
        }
      }
      Event::Doctype => {
        if is_initial {
          return true;
        }
      }
      Event::Start { name, .. } => return scanner.name(name).eq_ignore_ascii_case("html"),
      Event::End { name, .. } => {
        let name = scanner.name(name);
        let implies_html = ["head", "body", "html", "br"]
          .iter()
          .any(|implying| implying.eq_ignore_ascii_case(name));
        if implies_html {
          return false;
        }
        is_initial = false;
      }
    }
  }
  false
}

/// The content of each inline `<script type="module">` (one without `src`), in a `<template>` or
/// not.
pub fn module_scripts(source: &str) -> Vec<(usize, usize)> {
  let mut scripts = Vec::new();
  let mut scanner = Scanner::new(source);
  let mut pending: Option<usize> = None;
  while let Some(event) = scanner.next_event() {
    match event {
      Event::Start { name, end, .. } if scanner.name(name).eq_ignore_ascii_case("script") => {
        let is_module = scanner.attribute("type").as_deref() == Some("module");
        if is_module && !scanner.has_attribute("src") {
          pending = Some(end);
        }
      }
      Event::Text { end, .. } => {
        if let Some(start) = pending.take() {
          if end > start {
            scripts.push((start, end));
          }
        }
      }
      _ => {}
    }
  }
  scripts
}

/// An Analog component's top-level blocks: the content of each inline `<script>` (without `src`)
/// and of each `<template>`.
#[derive(Default, Debug, PartialEq, Eq)]
pub struct AnalogBlocks {
  pub scripts: Vec<(usize, usize)>,
  pub templates: Vec<(usize, usize)>,
}

pub fn analog_blocks(source: &str) -> AnalogBlocks {
  const VOID: [&str; 14] = [
    "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source",
    "track", "wbr",
  ];
  let mut blocks = AnalogBlocks::default();
  let mut scanner = Scanner::new(source);
  // The open elements: each one's name, and for a top-level `<template>` where its content starts.
  let mut open: Vec<(&str, Option<usize>)> = Vec::new();
  let mut pending_script: Option<usize> = None;

  while let Some(event) = scanner.next_event() {
    match event {
      Event::Start { name, end, .. } => {
        let name = scanner.name(name);
        let is_top_level = open.is_empty();
        if name.eq_ignore_ascii_case("script") {
          if is_top_level && !scanner.has_attribute("src") {
            pending_script = Some(end);
          }
          // Its text and end tag come next.
          continue;
        }
        if VOID.iter().any(|void| void.eq_ignore_ascii_case(name)) {
          continue;
        }
        let is_raw = RAW_TEXT.iter().any(|raw| raw.eq_ignore_ascii_case(name));
        if is_raw {
          continue;
        }
        let content = (is_top_level && name.eq_ignore_ascii_case("template")).then_some(end);
        open.push((name, content));
      }
      Event::Text { start, end } => {
        if pending_script.take().is_some() && end > start {
          blocks.scripts.push((start, end));
        }
      }
      Event::End { name, start } => {
        let name = scanner.name(name);
        let is_template = name.eq_ignore_ascii_case("template");
        let found = open.iter().rposition(|(open_name, _)| {
          open_name.eq_ignore_ascii_case(name)
            || (!is_template && open_name.eq_ignore_ascii_case("template"))
        });
        let Some(index) = found else {
          continue;
        };
        if !open[index].0.eq_ignore_ascii_case(name) {
          // A `<template>` bounds the elements an end tag can close.
          continue;
        }
        if let Some(content) = open[index].1 {
          if start > content {
            blocks.templates.push((content, start));
          }
        }
        open.truncate(index);
      }
      Event::Comment | Event::Doctype => {}
    }
  }
  // An unclosed top-level `<template>` holds the rest of the file.
  if let Some(&(_, Some(content))) = open.first() {
    if source.len() > content {
      blocks.templates.push((content, source.len()));
    }
  }
  blocks
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn pages() {
    assert!(is_page("<!doctype html><p>"));
    assert!(is_page("  <!-- c -->\n<!DOCTYPE html>"));
    assert!(is_page("<html lang=\"en\"><body></body></html>"));
    assert!(is_page("<!-- c --><HTML>"));
    assert!(!is_page("<p>{{ m.x() }}</p>"));
    assert!(!is_page("text <html>"));
    assert!(!is_page("<div><!doctype html>"));
  }

  #[test]
  fn module_scripts_of_a_page() {
    let page = "<!doctype html><script>a</script><script type=\"module\" src=\"x.js\"></script><textarea><script type=module>no</script></textarea><!-- <script type=\"module\">no</script> --><script type='module'>yes()</script><template><script type=\"module\">also()</script></template>";
    let scripts: Vec<&str> = module_scripts(page)
      .into_iter()
      .map(|(start, end)| &page[start..end])
      .collect();
    assert_eq!(scripts, ["yes()", "also()"]);
  }

  #[test]
  fn analog_components() {
    let source = "<script lang=\"ts\">const a = '</template>';</script>\n<template>\n  <p>{{ a<b }}</p><template><i></i></template>\n</template>\n<style>p { color: red }</style><script src=\"x.js\"></script>";
    let blocks = analog_blocks(source);
    let scripts: Vec<&str> = blocks
      .scripts
      .iter()
      .map(|&(start, end)| &source[start..end])
      .collect();
    let templates: Vec<&str> = blocks
      .templates
      .iter()
      .map(|&(start, end)| &source[start..end])
      .collect();
    assert_eq!(scripts, ["const a = '</template>';"]);
    assert_eq!(
      templates,
      ["\n  <p>{{ a<b }}</p><template><i></i></template>\n"]
    );
  }
}
