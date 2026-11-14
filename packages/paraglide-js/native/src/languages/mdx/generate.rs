//! An MDX file as the JSX module MDX compiles it to: its ESM at the top level, then a default
//! export that renders its JSX and `{…}` expressions with `props`, so that names in them resolve
//! to the ESM's bindings. Markdown around them is left out: only MDX's constructs are code.
//!
//! One pass over the lines reads what decides what is code: front matter, ESM blocks, fenced code,
//! the paragraphs, GFM tables and containers that bound code spans, and in text, code spans,
//! escapes, link destinations and GFM's autolink literals, besides the expressions and JSX tags
//! themselves. MDX has no indented code, and `<` always starts JSX.

use super::{
  js::{self, Lexer},
  jsx,
};
use crate::{
  languages::{CodeBuilder, Generated, Skipped},
  load::GeneratedSource,
  lower::Lang,
};

/// Writes the MDX file `source` as a JSX module.
pub fn generate(_file: &str, source: &str, skipped: &Skipped) -> Result<Generated, String> {
  let mut scanner = Scanner::new(source);
  scanner.document()?;

  Ok(scanner.write(skipped))
}

/// What the module is written from, in order.
enum Piece {
  Copy(usize, usize),
  /// A `{…}`, written as `fallback` once it did not parse.
  Expression {
    start: usize,
    end: usize,
    fallback: &'static str,
  },
  Glue(&'static str),
}

struct OpenTag {
  start: usize,
  name: (usize, usize),
}

struct Scanner<'s> {
  src: &'s str,
  bytes: &'s [u8],
  /// Reads the content's code, and notes whether it awaits.
  lexer: Lexer<'s>,
  esm: Vec<Piece>,
  content: Vec<Piece>,
  /// The JSX elements that are open, innermost last.
  open: Vec<OpenTag>,
  /// The current tag's attribute expressions.
  attributes: Vec<jsx::Expression>,
  /// The `[` of the paragraph that no `]` closed yet: links may follow.
  brackets: u32,
  has_layout: bool,
}

impl<'s> Scanner<'s> {
  fn new(src: &'s str) -> Self {
    Scanner {
      src,
      bytes: src.as_bytes(),
      lexer: Lexer::new(src),
      esm: Vec::new(),
      content: Vec::new(),
      open: Vec::new(),
      attributes: Vec::new(),
      brackets: 0,
      has_layout: false,
    }
  }

  /// Reads the file line by line.
  fn document(&mut self) -> Result<(), String> {
    let bytes = self.bytes;
    let mut at = self.after_front_matter();
    // Whether the previous line is in a paragraph, which the next continues unless it starts
    // another block: ESM does not interrupt one. Link reference definitions start what a
    // paragraph may continue, and further definitions too.
    let mut in_paragraph = false;
    let mut in_definitions = false;
    // Whether the previous line is a GFM table's: the next is one of its rows unless it starts
    // another block.
    let mut in_table = false;
    let mut table_quotes = 0;
    // The containers of the paragraph, which a line with fewer of them continues lazily.
    let mut paragraph = Container::default();

    while at < bytes.len() {
      let line = at;
      let end = js::line_end(bytes, line);
      let next = js::after_line_ending(bytes, end);

      // Only at the start of a line, outside containers.
      if !in_paragraph
        && !in_definitions
        && (bytes[line..].starts_with(b"import ") || bytes[line..].starts_with(b"export "))
      {
        at = self.esm(line)?;
        in_table = false;
        continue;
      }

      let (content, quotes) = container_content(bytes, line, end);
      let after_definitions = std::mem::take(&mut in_definitions);
      let after_table = std::mem::take(&mut in_table);
      if content == end {
        in_paragraph = false;
        at = next;
        continue;
      }

      if let Some(fence) = fence_at(bytes, content, end) {
        at = fence_end(bytes, fence, quotes, next);
        in_paragraph = false;
        continue;
      }

      let plain = quote_content(bytes, line, end);
      // A block quote or list item that starts here starts a paragraph of its own.
      if in_paragraph && (plain.0 != content || quotes > paragraph.quotes) {
        in_paragraph = false;
      }
      // A lazy line is no setext underline, nor a table's header.
      let is_lazy = in_paragraph && paragraph.is_lazy(line, plain);
      let kind = line_kind(
        bytes,
        content,
        end,
        in_paragraph || after_table,
        in_paragraph && !is_lazy,
      );
      // A row has the table's containers, and starts no other.
      let is_row = after_table
        && matches!(kind, LineKind::Text | LineKind::Definition)
        && plain == (content, table_quotes);
      let line_container = Container { quotes, column: 0 };
      if is_row {
        let (after, is_flow) = self.text(content, line_container, Inline::TableRow, false)?;
        in_table = !is_flow;
        at = after;
        continue;
      }

      match kind {
        LineKind::Break => {
          in_paragraph = false;
          at = next;
        }
        LineKind::Heading => {
          at = self
            .text(content, line_container, Inline::Heading, false)?
            .0;
          in_paragraph = false;
        }
        LineKind::Definition => {
          in_definitions = true;
          at = next;
        }
        LineKind::Text if !is_lazy && starts_table(bytes, content, end, next) => {
          // A table interrupts a paragraph. Its delimiter row has no text.
          let (after, _) = self.text(content, line_container, Inline::TableRow, false)?;
          at = if after == next {
            js::after_line_ending(bytes, js::line_end(bytes, next))
          } else {
            after
          };
          in_paragraph = false;
          in_table = true;
          table_quotes = quotes;
        }
        LineKind::Text => {
          let continues = in_paragraph || after_definitions;
          if !in_paragraph {
            // Only a paragraph that starts with a list item's marker is known to be in one.
            let is_in_list = plain.0 != content;
            paragraph = Container {
              quotes,
              column: if is_in_list { content - line } else { 0 },
            };
          }
          let (after, is_flow) = self.text(content, paragraph, Inline::Paragraph, continues)?;
          in_paragraph = !is_flow;
          at = after;
        }
      }
    }

    match self.open.last() {
      Some(open) => Err(format!(
        "MDX: Expected a closing tag for `<{}>` ({}) before the end of the document",
        self.name(open.name),
        jsx::place(self.src, open.start)
      )),
      None => Ok(()),
    }
  }

  /// Front matter, YAML between `---` lines or TOML between `+++` lines at the start of the file,
  /// is not MDX: where the file's MDX starts.
  fn after_front_matter(&self) -> usize {
    let bytes = self.bytes;
    let start = if bytes.starts_with("\u{feff}".as_bytes()) {
      3
    } else {
      0
    };

    let Some(marker) = front_matter_fence(bytes, start) else {
      return start;
    };
    let first_end = js::line_end(bytes, start);
    let mut at = js::after_line_ending(bytes, first_end);
    if at == first_end {
      return start;
    }

    while at < bytes.len() {
      let end = js::line_end(bytes, at);
      if front_matter_fence(bytes, at) == Some(marker) {
        return js::after_line_ending(bytes, end);
      }
      at = js::after_line_ending(bytes, end);
    }

    start
  }

  /// The ESM block at `start`, copied to the top level: where the next line starts.
  fn esm(&mut self, start: usize) -> Result<usize, String> {
    let esm = Lexer::new(self.src).esm(start)?;

    let mut copied = start;
    for (from, to, text) in esm.edits {
      self.esm.push(Piece::Copy(copied, from));
      self.esm.push(Piece::Glue(text));
      copied = to;
    }
    self.esm.push(Piece::Copy(copied, esm.end));
    self.esm.push(Piece::Glue("\n"));
    self.has_layout |= esm.has_layout;

    Ok(esm.next)
  }

  /// Text from `start` to the end of its line, and through the lines that its expressions, tags,
  /// code spans and links go on to. Returns where the next line starts, and whether the line holds
  /// only tags and expressions: MDX's flow, which ends a paragraph. `container` is the containers
  /// of its paragraph.
  fn text(
    &mut self,
    start: usize,
    container: Container,
    inline: Inline,
    continues_paragraph: bool,
  ) -> Result<(usize, bool), String> {
    let bytes = self.bytes;
    if !continues_paragraph {
      self.brackets = 0;
    }

    let mut at = start;
    let mut is_flow = matches!(bytes[start], b'<' | b'{');
    // Where an autolink literal may start: not in what was read as a construct.
    let mut constructs_end = start;

    loop {
      if !is_flow {
        while at < bytes.len() && !ENDS_TEXT[bytes[at] as usize] {
          at += 1;
        }
      }
      let Some(&byte) = bytes.get(at) else {
        return Ok((at, is_flow));
      };

      match byte {
        b'\n' | b'\r' => return Ok((js::after_line_ending(bytes, at), is_flow)),
        b' ' | b'\t' => at += 1,
        b'{' => {
          if is_in_autolink(bytes, at, constructs_end, self.brackets) {
            is_flow = false;
            at += 1;
            continue;
          }
          let end = self
            .lexer
            .expression_end(at + 1)
            .ok_or_else(jsx::unclosed_expression)?
            + 1;
          self.content.push(Piece::Expression {
            start: at,
            end,
            fallback: "{0}",
          });
          at = end;
          constructs_end = end;
        }
        b'<' => match self.tag(at)? {
          Some(end) => {
            at = end;
            constructs_end = end;
          }
          None => {
            is_flow = false;
            at += 1;
          }
        },
        b'\\' => {
          is_flow = false;
          let is_escape = bytes.get(at + 1).is_some_and(u8::is_ascii_punctuation);
          at += if is_escape { 2 } else { 1 };
        }
        b'`' => {
          is_flow = false;
          at = code_span_end(self.src, at, inline, container);
          constructs_end = at;
        }
        b'[' => {
          is_flow = false;
          self.brackets += 1;
          at += 1;
        }
        b']' => {
          is_flow = false;
          at += 1;
          if self.brackets > 0 {
            self.brackets -= 1;
            if bytes.get(at) == Some(&b'(') {
              if let Some(end) = resource_end(bytes, at) {
                at = end;
                constructs_end = end;
              }
            }
          }
        }
        _ => {
          is_flow = false;
          at += 1;
        }
      }
    }
  }

  /// The JSX tag at `start`, matched with the open ones: where it ends, none if `<` is text.
  fn tag(&mut self, start: usize) -> Result<Option<usize>, String> {
    let mut attributes = std::mem::take(&mut self.attributes);
    attributes.clear();
    let tag = jsx::tag(self.src, start, &mut self.lexer, &mut attributes);
    let tag = match tag {
      Ok(Some(tag)) => tag,
      other => {
        self.attributes = attributes;
        return other.map(|_| None);
      }
    };

    if tag.is_closing {
      let place = || jsx::place(self.src, start);
      if tag.has_attributes {
        return Err(format!(
          "MDX: Unexpected attribute in closing tag, expected the end of the tag ({})",
          place()
        ));
      }
      if tag.is_self_closing {
        return Err(format!(
          "MDX: Unexpected self-closing slash `/` in closing tag, expected the end of the tag ({})",
          place()
        ));
      }
      match self.open.pop() {
        None => {
          return Err(format!(
            "MDX: Unexpected closing slash `/` in tag, expected an open tag first ({})",
            place()
          ));
        }
        Some(open) if !self.is_same_name(open.name, tag.name) => {
          return Err(format!(
            "MDX: Unexpected closing tag `</{}>` ({}), expected corresponding closing tag for `<{}>` ({})",
            self.name(tag.name),
            place(),
            self.name(open.name),
            jsx::place(self.src, open.start)
          ));
        }
        Some(_) => {}
      }
    } else if !tag.is_self_closing {
      self.open.push(OpenTag {
        start,
        name: tag.name,
      });
    }

    let mut copied = start;
    for attribute in &attributes {
      self.content.push(Piece::Copy(copied, attribute.start));
      self.content.push(Piece::Expression {
        start: attribute.start,
        end: attribute.end,
        fallback: if attribute.is_spread {
          "{...{}}"
        } else {
          "{0}"
        },
      });
      copied = attribute.end;
    }
    self.content.push(Piece::Copy(copied, tag.end));
    self.attributes = attributes;

    Ok(Some(tag.end))
  }

  /// A tag's name without the whitespace MDX allows in it: `a.b` for `a . b`.
  fn name(&self, (start, end): (usize, usize)) -> String {
    self.src[start..end]
      .chars()
      .filter(|character| !character.is_whitespace())
      .collect()
  }

  fn is_same_name(&self, a: (usize, usize), b: (usize, usize)) -> bool {
    let not_space = |byte: &&u8| !byte.is_ascii_whitespace();
    self.bytes[a.0..a.1]
      .iter()
      .filter(not_space)
      .eq(self.bytes[b.0..b.1].iter().filter(not_space))
  }

  fn write(self, skipped: &Skipped) -> Generated {
    let mut code = CodeBuilder::new(self.src, skipped);

    for piece in &self.esm {
      write_piece(&mut code, piece);
    }
    code.glue(if self.lexer.awaits {
      "export default async function MDXContent(props) {\nreturn "
    } else {
      "export default function MDXContent(props) {\nreturn "
    });
    if self.has_layout {
      code.glue("<MDXLayout {...props}>");
    }
    code.glue("<>");
    for piece in &self.content {
      write_piece(&mut code, piece);
    }
    code.glue("</>");
    if self.has_layout {
      code.glue("</MDXLayout>");
    }
    code.glue(";\n}\n");

    let built = code.finish(Lang::Jsx);
    Generated {
      source: GeneratedSource {
        main: built.code,
        scripts: Vec::new(),
        language: "mdx".to_string(),
        component_fields: Vec::new(),
        scope_objects: Vec::new(),
        props: None,
        component_instances: None,
      },
      expressions: built.expressions,
    }
  }
}

fn write_piece(code: &mut CodeBuilder, piece: &Piece) {
  match *piece {
    Piece::Copy(start, end) => code.copy(start, end),
    Piece::Expression {
      start,
      end,
      fallback,
    } => {
      code.skippable(fallback, |code| code.copy(start, end));
    }
    Piece::Glue(text) => code.glue(text),
  }
}

/// Bytes that may start something other than plain text.
static ENDS_TEXT: [bool; 256] = {
  let mut table = [false; 256];
  let mut index = 0;
  let bytes = b"\n\r{<\\`[]";
  while index < bytes.len() {
    table[bytes[index] as usize] = true;
    index += 1;
  }
  table
};

/// The containers of a paragraph: how many block quotes, and the column of its list item's
/// content, if it starts with the item's marker (0 otherwise).
#[derive(Clone, Copy, Default)]
struct Container {
  quotes: u32,
  column: usize,
}

impl Container {
  /// Whether the line at `line`, whose content after block quotes' markers is `plain`, continues
  /// the paragraph lazily: without all of its containers.
  fn is_lazy(self, line: usize, (plain, quotes): (usize, u32)) -> bool {
    quotes < self.quotes || plain - line < self.column
  }
}

/// What text is in: a paragraph's lines, a heading's one line, or a table row's cells.
#[derive(Clone, Copy, PartialEq, Eq)]
enum Inline {
  Paragraph,
  Heading,
  TableRow,
}

enum LineKind {
  /// A thematic break or a setext heading's underline.
  Break,
  Heading,
  /// A link reference definition, whose text is not text.
  Definition,
  Text,
}

/// `in_paragraph`: the line may continue a paragraph, so it defines no link; `may_underline`: it
/// may be the paragraph's setext underline.
fn line_kind(
  bytes: &[u8],
  content: usize,
  end: usize,
  in_paragraph: bool,
  may_underline: bool,
) -> LineKind {
  let line = &bytes[content..end];
  let first = line[0];

  if first == b'#' {
    let size = line.iter().take_while(|&&byte| byte == b'#').count();
    if size <= 6 && matches!(line.get(size), None | Some(b' ' | b'\t')) {
      return LineKind::Heading;
    }
  }

  if matches!(first, b'=' | b'-' | b'*' | b'_') {
    let size = line.iter().take_while(|&&byte| byte == first).count();
    let is_underline = may_underline
      && matches!(first, b'=' | b'-')
      && line[size..]
        .iter()
        .all(|&byte| byte == b' ' || byte == b'\t');
    let is_thematic_break = first != b'='
      && line
        .iter()
        .all(|&byte| byte == first || byte == b' ' || byte == b'\t')
      && line.iter().filter(|&&byte| byte == first).count() >= 3;
    if is_underline || is_thematic_break {
      return LineKind::Break;
    }
  }

  if first == b'[' && !in_paragraph && is_definition(bytes, content, end) {
    return LineKind::Definition;
  }

  LineKind::Text
}

/// Where a line's content starts after the markers of the block quotes and list items it is in,
/// and how many block quotes it is in.
fn container_content(bytes: &[u8], line: usize, end: usize) -> (usize, u32) {
  let mut at = line;
  let mut quotes = 0;

  loop {
    while at < end && matches!(bytes[at], b' ' | b'\t') {
      at += 1;
    }
    if at < end && bytes[at] == b'>' {
      quotes += 1;
      at += 1;
      continue;
    }
    match list_marker_end(bytes, at, end).or_else(|| footnote_label_end(bytes, at, end)) {
      Some(after) => at = after,
      None => return (at, quotes),
    }
  }
}

/// Whether the line at `content` is a GFM table's header row: the next line is a delimiter row
/// with as many cells, e.g. `| a | b |` then `| - | :-: |`.
fn starts_table(bytes: &[u8], content: usize, end: usize, next: usize) -> bool {
  if next >= bytes.len() {
    return false;
  }
  let next_end = js::line_end(bytes, next);
  let (delimiter, _) = quote_content(bytes, next, next_end);
  if !matches!(bytes.get(delimiter), Some(b'|' | b'-' | b':')) {
    return false;
  }

  delimiter_cells(&bytes[delimiter..next_end])
    .is_some_and(|cells| cells == row_cells(&bytes[content..end]))
}

fn trim_spaces(bytes: &[u8]) -> &[u8] {
  let start = bytes
    .iter()
    .position(|&byte| byte != b' ' && byte != b'\t')
    .unwrap_or(bytes.len());
  let end = bytes
    .iter()
    .rposition(|&byte| byte != b' ' && byte != b'\t')
    .map_or(start, |last| last + 1);
  &bytes[start..end.max(start)]
}

/// How many cells a table row has, between unescaped `|`.
fn row_cells(row: &[u8]) -> usize {
  let row = trim_spaces(row);
  let row = row.strip_prefix(b"|").unwrap_or(row);
  let row = match row.strip_suffix(b"|") {
    Some(rest) if !rest.ends_with(b"\\") => rest,
    _ => row,
  };

  let mut cells = 1;
  let mut at = 0;
  while at < row.len() {
    match row[at] {
      b'\\' => at += 2,
      b'|' => {
        cells += 1;
        at += 1;
      }
      _ => at += 1,
    }
  }
  cells
}

/// How many cells a delimiter row has: `-`, `:-`, `-:` or `:-:` between `|`, at least one.
fn delimiter_cells(row: &[u8]) -> Option<usize> {
  let row = trim_spaces(row);
  if !row.contains(&b'|') {
    return None;
  }
  let row = row.strip_prefix(b"|").unwrap_or(row);
  let row = row.strip_suffix(b"|").unwrap_or(row);

  let mut cells = 0;
  for cell in row.split(|&byte| byte == b'|') {
    let cell = trim_spaces(cell);
    let cell = cell.strip_prefix(b":").unwrap_or(cell);
    let cell = cell.strip_suffix(b":").unwrap_or(cell);
    if cell.is_empty() || cell.iter().any(|&byte| byte != b'-') {
      return None;
    }
    cells += 1;
  }
  Some(cells)
}

/// A GFM footnote definition's `[^label]:`, which contains blocks as a list item does.
fn footnote_label_end(bytes: &[u8], at: usize, end: usize) -> Option<usize> {
  if !bytes[at..end].starts_with(b"[^") {
    return None;
  }
  let label = bytes[at + 2..end]
    .iter()
    .position(|&byte| matches!(byte, b']' | b'[' | b' ' | b'\t'))?;
  let close = at + 2 + label;
  (label > 0 && bytes[close] == b']' && bytes.get(close + 1) == Some(&b':')).then_some(close + 2)
}

/// Where a line's content starts after its block quotes' markers, and how many there are.
fn quote_content(bytes: &[u8], line: usize, end: usize) -> (usize, u32) {
  let mut at = line;
  let mut quotes = 0;
  loop {
    while at < end && matches!(bytes[at], b' ' | b'\t') {
      at += 1;
    }
    if at < end && bytes[at] == b'>' {
      quotes += 1;
      at += 1;
    } else {
      return (at, quotes);
    }
  }
}

/// `-`, `*`, `+`, `1.` or `1)` followed by whitespace or the end of the line.
fn list_marker_end(bytes: &[u8], at: usize, end: usize) -> Option<usize> {
  let after = match *bytes.get(at)? {
    b'-' | b'*' | b'+' => at + 1,
    b'0'..=b'9' => {
      let digits = bytes[at..end]
        .iter()
        .take_while(|byte| byte.is_ascii_digit())
        .count();
      if digits > 9 || !matches!(bytes.get(at + digits), Some(b'.' | b')')) {
        return None;
      }
      at + digits + 1
    }
    _ => return None,
  };

  (after == end || matches!(bytes[after], b' ' | b'\t')).then_some(after)
}

#[derive(Clone, Copy)]
struct Fence {
  marker: u8,
  size: usize,
}

/// A code fence that opens at `at`: three or more backticks or tildes, indented or not (MDX has
/// no indented code).
fn fence_at(bytes: &[u8], at: usize, end: usize) -> Option<Fence> {
  let marker = bytes[at];
  if marker != b'`' && marker != b'~' {
    return None;
  }
  let size = bytes[at..end]
    .iter()
    .take_while(|&&byte| byte == marker)
    .count();
  if size < 3 || (marker == b'`' && memchr::memchr(b'`', &bytes[at + size..end]).is_some()) {
    return None;
  }

  Some(Fence { marker, size })
}

/// The lines of fenced code from `at` to its closing fence, or to the end of the block quote it is
/// in: where the next line starts.
fn fence_end(bytes: &[u8], fence: Fence, quotes: u32, mut at: usize) -> usize {
  while at < bytes.len() {
    let end = js::line_end(bytes, at);
    let mut content = at;

    let mut seen = 0;
    while seen < quotes {
      while content < end && matches!(bytes[content], b' ' | b'\t') {
        content += 1;
      }
      if content < end && bytes[content] == b'>' {
        seen += 1;
        content += 1;
      } else {
        // The block quote ends, and so does the code.
        return at;
      }
    }

    while content < end && matches!(bytes[content], b' ' | b'\t') {
      content += 1;
    }
    let size = bytes[content..end]
      .iter()
      .take_while(|&&byte| byte == fence.marker)
      .count();
    let is_closing = size >= fence.size
      && bytes[content + size..end]
        .iter()
        .all(|&byte| byte == b' ' || byte == b'\t');
    at = js::after_line_ending(bytes, end);
    if is_closing {
      return at;
    }
  }

  bytes.len()
}

/// `---` or `+++`, alone on its line but for trailing whitespace.
fn front_matter_fence(bytes: &[u8], at: usize) -> Option<u8> {
  let marker = *bytes.get(at)?;
  if (marker != b'-' && marker != b'+') || bytes.get(at..at + 3)? != [marker; 3] {
    return None;
  }
  let end = js::line_end(bytes, at);

  bytes[at + 3..end]
    .iter()
    .all(|&byte| byte == b' ' || byte == b'\t')
    .then_some(marker)
}

/// From the first backtick of a code span, the offset after its closing backticks: as many, in the
/// same paragraph. Without them, the backticks are text and it is the offset after them.
fn code_span_end(src: &str, start: usize, inline: Inline, container: Container) -> usize {
  let bytes = src.as_bytes();
  let size = bytes[start..]
    .iter()
    .take_while(|&&byte| byte == b'`')
    .count();
  let opening_end = start + size;
  let mut at = opening_end;

  loop {
    // A table's cells end at `|`, even in code, unless it is escaped.
    let found = if inline == Inline::TableRow {
      bytes[at..]
        .iter()
        .position(|&byte| matches!(byte, b'`' | b'\n' | b'\r' | b'|'))
    } else {
      memchr::memchr3(b'`', b'\n', b'\r', &bytes[at..])
    };
    let Some(found) = found else {
      return opening_end;
    };
    at += found;

    match bytes[at] {
      b'`' => {
        let run = bytes[at..].iter().take_while(|&&byte| byte == b'`').count();
        if run == size {
          return at + run;
        }
        at += run;
      }
      b'|' if bytes[at - 1] == b'\\' => at += 1,
      b'|' => return opening_end,
      _ => {
        let next = js::after_line_ending(bytes, at);
        if inline != Inline::Paragraph || ends_paragraph(src, next, container) {
          return opening_end;
        }
        at = next;
      }
    }
  }
}

/// Whether the line at `line` ends a paragraph in `container`: a blank line, or one that starts
/// another block, MDX's flow of tags and expressions included.
fn ends_paragraph(src: &str, line: usize, container: Container) -> bool {
  let bytes = src.as_bytes();
  let end = js::line_end(bytes, line);
  let plain = quote_content(bytes, line, end);
  let (at, quotes) = plain;
  let is_lazy = container.is_lazy(line, plain);

  at == end
    || quotes > container.quotes
    || list_marker_end(bytes, at, end).is_some()
    || fence_at(bytes, at, end).is_some()
    || matches!(
      line_kind(bytes, at, end, true, !is_lazy),
      LineKind::Heading | LineKind::Break
    )
    || is_flow_line(src, at)
    || (!is_lazy && starts_table(bytes, at, end, js::after_line_ending(bytes, end)))
}

/// Whether the line's content from `at` is only JSX tags and expressions, which MDX reads as flow.
fn is_flow_line(src: &str, mut at: usize) -> bool {
  let bytes = src.as_bytes();
  if !matches!(bytes.get(at), Some(b'<' | b'{')) {
    return false;
  }
  let mut lexer = Lexer::new(src);
  let mut attributes = Vec::new();

  loop {
    at = match bytes.get(at) {
      Some(b'{') => match lexer.expression_end(at + 1) {
        Some(end) => end + 1,
        None => return false,
      },
      Some(b'<') => match jsx::tag(src, at, &mut lexer, &mut attributes) {
        Ok(Some(tag)) => tag.end,
        _ => return false,
      },
      _ => return false,
    };
    while matches!(bytes.get(at), Some(b' ' | b'\t')) {
      at += 1;
    }
    if matches!(bytes.get(at), None | Some(b'\n' | b'\r')) {
      return true;
    }
  }
}

/// From the `(` after a link's `]`, the offset after its `)` when it is a resource: a destination
/// and a title, which are not text.
fn resource_end(bytes: &[u8], open: usize) -> Option<usize> {
  let mut at = link_space(bytes, open + 1)?;

  match *bytes.get(at)? {
    b')' => return Some(at + 1),
    b'<' => {
      at += 1;
      loop {
        match *bytes.get(at)? {
          b'\\' => at += 2,
          b'>' => break,
          b'<' | b'\n' | b'\r' => return None,
          _ => at += 1,
        }
      }
      at += 1;
    }
    _ => {
      let start = at;
      let mut depth = 0u32;
      while let Some(&byte) = bytes.get(at) {
        match byte {
          b'\\' if bytes.get(at + 1).is_some_and(u8::is_ascii_punctuation) => at += 2,
          b'(' => {
            depth += 1;
            at += 1;
          }
          b')' if depth == 0 => break,
          b')' => {
            depth -= 1;
            at += 1;
          }
          0..=b' ' | 0x7f => break,
          _ => at += 1,
        }
      }
      if at == start || depth > 0 {
        return None;
      }
    }
  }

  let destination_end = at;
  at = link_space(bytes, at)?;
  if at > destination_end {
    if let Some(close) = match bytes.get(at) {
      Some(b'"') => Some(b'"'),
      Some(b'\'') => Some(b'\''),
      Some(b'(') => Some(b')'),
      _ => None,
    } {
      at += 1;
      loop {
        match *bytes.get(at)? {
          b'\\' => at += 2,
          b'\n' | b'\r' => at = link_space(bytes, at)?,
          byte if byte == close => break,
          _ => at += 1,
        }
      }
      at = link_space(bytes, at + 1)?;
    }
  }

  (bytes.get(at) == Some(&b')')).then_some(at + 1)
}

/// Spaces and at most one line ending, a blank line not: the offset after them.
fn link_space(bytes: &[u8], mut at: usize) -> Option<usize> {
  let mut line_endings = 0;
  loop {
    match bytes.get(at) {
      Some(b' ' | b'\t') => at += 1,
      Some(b'\n' | b'\r') => {
        line_endings += 1;
        if line_endings > 1 {
          return None;
        }
        at = js::after_line_ending(bytes, at);
      }
      _ => return Some(at),
    }
  }
}

/// A link reference definition on one line: `[label]: destination "title"`.
fn is_definition(bytes: &[u8], start: usize, end: usize) -> bool {
  let line = &bytes[..end];
  let mut at = start + 1;
  // `[^note]:` defines a GFM footnote, whose content is text.
  if line.get(at) == Some(&b'^') {
    return false;
  }

  loop {
    match line.get(at) {
      Some(b'\\') => at += 2,
      Some(b']') => break,
      Some(b'[') | None => return false,
      Some(_) => at += 1,
    }
  }
  let is_empty = bytes[start + 1..at].iter().all(u8::is_ascii_whitespace);
  if is_empty || line.get(at + 1) != Some(&b':') {
    return false;
  }

  at = skip_spaces(line, at + 2);
  if at >= end {
    return false;
  }

  if line[at] == b'<' {
    at += 1;
    loop {
      match line.get(at) {
        Some(b'\\') => at += 2,
        Some(b'>') => break,
        Some(b'<') | None => return false,
        Some(_) => at += 1,
      }
    }
    at += 1;
  } else {
    let start = at;
    let mut depth = 0u32;
    while let Some(&byte) = line.get(at) {
      match byte {
        b'\\' => at += 2,
        b'(' => {
          depth += 1;
          at += 1;
        }
        b')' if depth == 0 => return false,
        b')' => {
          depth -= 1;
          at += 1;
        }
        0..=b' ' | 0x7f => break,
        _ => at += 1,
      }
    }
    if at == start || depth > 0 {
      return false;
    }
  }

  let destination_end = at.min(end);
  at = skip_spaces(line, destination_end);
  if at >= end {
    return true;
  }
  let close = match line[at] {
    b'"' => b'"',
    b'\'' => b'\'',
    b'(' => b')',
    _ => return false,
  };
  if at == destination_end {
    return false;
  }

  at += 1;
  loop {
    match line.get(at) {
      Some(b'\\') => at += 2,
      Some(&byte) if byte == close => break,
      None => return false,
      Some(_) => at += 1,
    }
  }

  skip_spaces(line, at + 1) >= end
}

fn skip_spaces(bytes: &[u8], mut at: usize) -> usize {
  while matches!(bytes.get(at), Some(b' ' | b'\t')) {
    at += 1;
  }
  at
}

/// Whether the `{` at `brace` is in a GFM autolink literal, e.g. `https://a.com/{id}` or
/// `www.a.com/{id}`, whose path goes on to whitespace or `<`. `floor` is where the text after the
/// last construct starts, and no link literal starts in an unclosed `[`.
fn is_in_autolink(bytes: &[u8], brace: usize, floor: usize, brackets: u32) -> bool {
  if brackets > 0 {
    return false;
  }

  let mut start = brace;
  while start > floor && !matches!(bytes[start - 1], b' ' | b'\t' | b'\n' | b'\r' | b'<') {
    start -= 1;
  }
  if brace - start < 5 {
    return false;
  }

  (start..brace).any(|at| {
    let rest = &bytes[at..brace];
    let previous = at.checked_sub(1).map(|before| bytes[before]);

    match bytes[at] | 0x20 {
      b'h' => {
        let prefix = if starts_with_ignoring_case(rest, b"https://") {
          8
        } else if starts_with_ignoring_case(rest, b"http://") {
          7
        } else {
          return false;
        };
        !previous.is_some_and(|byte| byte.is_ascii_alphabetic()) && is_domain(&rest[prefix..])
      }
      b'w' => {
        starts_with_ignoring_case(rest, b"www.")
          && previous.is_none_or(|byte| {
            matches!(
              byte,
              b' ' | b'\t' | b'\n' | b'\r' | b'(' | b'*' | b'_' | b'[' | b']' | b'~'
            )
          })
          && is_domain(rest)
      }
      _ => false,
    }
  })
}

fn starts_with_ignoring_case(bytes: &[u8], prefix: &[u8]) -> bool {
  bytes.len() >= prefix.len() && bytes[..prefix.len()].eq_ignore_ascii_case(prefix)
}

/// Whether `text` starts with a domain as GFM reads one: letters, digits, `-`, `.` and `_`, none
/// of the last in its last two segments.
fn is_domain(text: &[u8]) -> bool {
  let size = text
    .iter()
    .take_while(|&&byte| {
      byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'.' | b'_') || byte >= 0x80
    })
    .count();
  let domain = &text[..size];
  if !domain.iter().any(|&byte| byte != b'.' && byte != b'_') {
    return false;
  }

  let mut segments = domain.rsplit(|&byte| byte == b'.');
  let has_underscore =
    |segment: Option<&[u8]>| segment.is_some_and(|segment| segment.contains(&b'_'));
  !has_underscore(segments.next()) && !has_underscore(segments.next())
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::lower::lower;

  /// The module written for `source`, checked to parse.
  fn module(source: &str) -> String {
    let skipped = Skipped::default();
    let generated = match generate("a.mdx", source, &skipped) {
      Ok(generated) => generated,
      Err(error) => panic!("{error}"),
    };
    let code = generated.source.main.code;
    if let Err(error) = lower(&code, Lang::Jsx) {
      panic!("{error}:\n{code}");
    }
    code
  }

  /// What the content renders, without the function around it.
  fn content(source: &str) -> String {
    let code = module(source);
    let start = code.find("<>").map_or(0, |at| at + 2);
    let end = code.rfind("</>").unwrap_or(code.len());
    code[start..end].to_string()
  }

  fn error(source: &str) -> String {
    generate("a.mdx", source, &Skipped::default())
      .err()
      .unwrap_or_default()
  }

  #[test]
  fn writes_esm_then_the_content_with_props() {
    let source = "import { m } from './m.js'\nexport const t = m.t()\n\n# {m.h()}\n\nText {props.a} <Note kind={m.k()}>\n  {m.i()}\n</Note>\n";
    assert_eq!(
      module(source),
      "import { m } from './m.js'\nexport const t = m.t()\nexport default function MDXContent(props) {\nreturn <>{m.h()}{props.a}<Note kind={m.k()}>{m.i()}</Note></>;\n}\n"
    );
  }

  #[test]
  fn maps_each_copy_to_its_source() {
    let source = "Grüße {m.a()}\n";
    let skipped = Skipped::default();
    let generated = generate("a.mdx", source, &skipped).ok();
    let mappings = generated.map(|generated| generated.source.main.mappings);
    let mapping = mappings
      .as_deref()
      .and_then(|mappings| mappings.first().copied());
    // `{m.a()}` starts at UTF-16 offset 6.
    assert_eq!(
      mapping.map(|mapping| (mapping.source, mapping.length)),
      Some((6, 7))
    );
  }

  #[test]
  fn code_is_not_mdx() {
    let source = "```tsx\n<p>{m.a()}</p>\n```\n\n~~~\n{m.b()}\n~~~\n\n- item\n\n      ```js\n      {m.c()}\n      ```\n  {m.d()}\n\n> ```\n> {m.e()}\n> ```\n\n> ```\n> {m.f()}\n\n{m.g()}\n\n- ```\n  {m.h()}\n  ```\n";
    assert_eq!(content(source), "{m.d()}{m.g()}");

    // Backticks without as many after them in the paragraph are text.
    let source = "Use `{m.a()}` or ``a ` {m.b()}`` and `\n{m.c()}` but ` {m.d()}\n\n`{m.e()}\n";
    assert_eq!(content(source), "{m.d()}{m.e()}");

    // A heading is one line.
    let source = "# `{m.a()}\n{m.b()}`\n";
    assert_eq!(content(source), "{m.a()}{m.b()}");
  }

  #[test]
  fn code_spans_end_with_their_paragraph() {
    // A flow line, a list item, a deeper block quote or a thematic break ends the paragraph.
    let source = "a `b\n{`${c}}`}\n\n- `d\n- {m.a()}\n  `{m.b()}`\n\n> `e\n> > {m.c()} `\n\nf `g\n***\n{m.d()} `\n";
    assert_eq!(content(source), "{`${c}}`}{m.a()}{m.c()}{m.d()}");
    // Text with tags is not flow, and a block quote's lines go on.
    let source = "a `b\n<b>x</b> {m.a()}` {m.b()}\n\n> c `d\n> {m.c()}` {m.d()}\n";
    assert_eq!(content(source), "{m.b()}{m.d()}");
  }

  #[test]
  fn definitions_start_what_a_paragraph_continues() {
    let source = "[a]: /x\n[b]: /y \"{t}\"\nimport { a } from 'b'\n[c]: /z \"{u}\"\n\n[d]: /w\n\nimport e from 'f'\n";
    assert_eq!(
      module(source),
      "import e from 'f'\nexport default function MDXContent(props) {\nreturn <>{ a }{u}</>;\n}\n"
    );
  }

  #[test]
  fn table_cells_end_code_spans() {
    let source = "text {m.p()}\n| a | `b |\n| - | - |\n| {m.c()} | d` |\nrow {m.d()}\nimport x from \"y\"\n\n<A />\nafter {m.e()}\n";
    assert_eq!(
      module(source),
      "import x from \"y\"\nexport default function MDXContent(props) {\nreturn <>{m.p()}{m.c()}{m.d()}<A />{m.e()}</>;\n}\n"
    );
    // Without as many cells as the delimiter row, it is a paragraph.
    let source = "x | `y | {m.a()}\n--- | ---\n`z | w {m.b()}\n\nUse `a | b` {m.c()}\n";
    assert_eq!(content(source), "{m.b()}{m.c()}");
    // An escaped `|` is in the cell.
    let source = "| a |\n| - |\n| `b \\| {m.a()}` {m.b()} |\n";
    assert_eq!(content(source), "{m.b()}");
    // A table ends a paragraph's code spans, and a list item its rows.
    let source = "`a {m.a()}\n| b | {m.b()} |\n| - | - |\n| `c` | d |\n1. e\nimport f {m.c()}\n";
    assert_eq!(content(source), "{m.a()}{m.b()}{m.c()}");
  }

  #[test]
  fn a_container_that_starts_starts_a_paragraph() {
    let source = "a `b\n> `c\n> `{m.a()}`\n- `d\n  `{m.b()}`\n";
    assert_eq!(content(source), "{m.a()}{m.b()}");
  }

  #[test]
  fn lazy_lines_are_no_underlines_nor_tables() {
    // `===` continues the list item's paragraph, and so does the definition after it.
    let source = "1. a\nb\n===\n[def]: /x \"{m.a()}\"\n\n- `c\n| d | {m.b()} |\n| - | - |\n| `e` | f |\n\n> `g\n| h | {m.c()} |\n| - | - |\n| `i` | j |\n";
    assert_eq!(content(source), "{m.a()}");
    // With its containers, a line may be either.
    let source = "- a\n  ===\n  [def]: /x \"{m.a()}\"\n\n> `b\n> | c | {m.b()} |\n> | - | - |\n";
    assert_eq!(content(source), "{m.b()}");
  }

  #[test]
  fn footnote_definitions_contain_blocks() {
    let source =
      "[^1]: {m.a()}\n[def]: https://x.com/{d} \"{t}\"\n\n[^2]:\n    ```\n    {m.b()}\n    ```\n";
    assert_eq!(content(source), "{m.a()}");
  }

  #[test]
  fn indented_lines_are_not_code() {
    assert_eq!(
      content("    {m.a()}\n\n\t<A b={m.b()} />\n"),
      "{m.a()}<A b={m.b()} />"
    );
  }

  #[test]
  fn escapes_link_destinations_and_definitions_are_not_code() {
    let source = "\\{m.a()} \\<b> a < b [l {m.c()}](http://a.com/{m.d()} \"{m.e()}\") ![i](<{m.f()}>)\n\n[ref]: http://a.com/{m.g()} '{m.h()}'\n\n[^1]: {m.i()}\n\n]({m.j()}) [a]\n({m.k()})";
    assert_eq!(content(source), "{m.c()}{m.i()}{m.j()}{m.k()}");
  }

  #[test]
  fn autolink_literals_hold_their_braces() {
    let source = "See https://a.com/users/{id} and www.a.com/{b}, {m.a()} x.https://a.com/{m.b()} https://{m.c()} [https://a.com/{m.d()}](b) <b>www.a.com/{c}</b>\n";
    // `www.` only starts one after whitespace or `(*_[]~`.
    assert_eq!(content(source), "{m.a()}{m.c()}{m.d()}<b>{c}</b>");
    let source = "ahttps://a.com/{m.e()} (www.a.com/{f}) Xwww.a.com/{m.g()} https://a_b.c_d/{m.h()} https://a.b_c.d/{m.i()}";
    assert_eq!(content(source), "{m.e()}{m.g()}{m.h()}{m.i()}");
  }

  #[test]
  fn front_matter_is_not_mdx() {
    assert_eq!(content("---\ntitle: { a: 1 }\n---\n{m.a()}\n"), "{m.a()}");
    assert_eq!(
      content("\u{feff}+++ \r\na = {b}\r\n+++\r\n{m.a()}"),
      "{m.a()}"
    );
    // Unclosed, it is a thematic break.
    assert_eq!(content("---\n{m.a()}\n"), "{m.a()}");
    // Only at the start.
    assert_eq!(content("\n---\na: {m.a()}\n---\n"), "{m.a()}");
  }

  #[test]
  fn esm_is_at_the_start_of_lines_outside_paragraphs() {
    let code = module("A paragraph,\nimport inside it is text {m.a()}\n\n- a\nimport b from 'c'\n\n> b\nexport is text\n\n# Title\nimport d from 'e'\n\n<A />\nexport const f = 1\n\n  import g from 'h'\nimportant {m.b()}\n");
    assert_eq!(
      code,
      "import d from 'e'\nexport const f = 1\nexport default function MDXContent(props) {\nreturn <>{m.a()}<A />{m.b()}</>;\n}\n"
    );
  }

  #[test]
  fn esm_goes_on_past_blank_lines_while_incomplete() {
    let code = module("export const meta = {\n  a: m.a(),\n\n  b: m.b(),\n};\n\n{meta.a}\n");
    assert!(
      code.starts_with("export const meta = {\n  a: m.a(),\n\n  b: m.b(),\n};\nexport default")
    );
  }

  #[test]
  fn a_default_export_is_the_layout() {
    let code = module("export default function Layout({ children }) {\n  return <main>{children}</main>\n}\n\n{m.a()}\n");
    assert_eq!(
      code,
      "const MDXLayout = function Layout({ children }) {\n  return <main>{children}</main>\n}\nexport default function MDXContent(props) {\nreturn <MDXLayout {...props}><>{m.a()}</></MDXLayout>;\n}\n"
    );

    let code = module("export { default } from './layout.js'\n");
    assert!(code.starts_with("export { default as MDXLayout } from './layout.js'\n"));
  }

  #[test]
  fn awaiting_content_is_async() {
    assert!(module("{await m.a()}").starts_with("export default async function"));
    assert!(module("{a.map(async (b) => await b)}").contains("async function MDXContent"));
    assert!(
      module("export const a = await b\n\n{a}").contains("export default function MDXContent")
    );
  }

  #[test]
  fn tags_go_across_lines_and_hold_markdown() {
    let source = "a <b title={m.a()}\n  c=\"d\">e\nf</b> g\n\n<A.B {...props}>\n\n* {m.b()}\n\n</A.B>\n\n<>{m.c()}</>\n";
    assert_eq!(
      content(source),
      "<b title={m.a()}\n  c=\"d\"></b><A.B {...props}>{m.b()}</A.B><>{m.c()}</>"
    );
  }

  #[test]
  fn expressions_go_across_lines() {
    let source =
      "{[1, 2].map((n) => (\n  <li title={m.a({ n })}>{n}</li>\n))}\nimport a from 'b'\n";
    assert_eq!(
      module(source),
      "import a from 'b'\nexport default function MDXContent(props) {\nreturn <>{[1, 2].map((n) => (\n  <li title={m.a({ n })}>{n}</li>\n))}</>;\n}\n"
    );
    assert_eq!(
      content("{/* a {m.a()} */}\n{a // }\n}"),
      "{/* a {m.a()} */}{a // }\n}"
    );
  }

  #[test]
  fn line_endings_may_be_crlf() {
    let source = "import a from 'b'\r\n\r\n```\r\n{m.a()}\r\n```\r\nText {m.b()}\r\nimport c\r\n";
    assert_eq!(content(source), "{m.b()}");
  }

  #[test]
  fn skipped_expressions_are_written_as_their_fallback() {
    let source = "{m.a(} <A b={c(} {...d(} /> {m.e()}";
    let mut skipped = Skipped::default();
    skipped.extend([0, 1, 2]);
    let generated = generate("a.mdx", source, &skipped).ok();
    let code = generated
      .map(|generated| generated.source.main.code)
      .unwrap_or_default();
    assert!(
      code.contains("<>{0}<A b={0} {...{}} />{m.e()}</>"),
      "{code}"
    );
  }

  #[test]
  fn fails_as_mdx_does() {
    assert!(error("See <https://example.com>.").starts_with("MDX: Unexpected character `/`"));
    assert!(error("<!-- a -->").contains("to create a comment in MDX"));
    assert_eq!(
      error("{m.a("),
      "MDX: Unexpected end of file in expression, expected a corresponding closing brace for `{`"
    );
    assert_eq!(
      error("<A>\n\n<B>\n</A>"),
      "MDX: Unexpected closing tag `</A>` (4:1), expected corresponding closing tag for `<B>` (3:1)"
    );
    assert_eq!(
      error("a </b>"),
      "MDX: Unexpected closing slash `/` in tag, expected an open tag first (1:3)"
    );
    assert_eq!(
      error("<A>\n"),
      "MDX: Expected a closing tag for `<A>` (1:1) before the end of the document"
    );
    assert!(error("<A></A b>").contains("Unexpected attribute in closing tag"));
    assert!(error("export const a = {\n").starts_with("MDX: Could not parse import/exports"));
  }

  /// `MDX_SAMPLE=<file> cargo test … mdx::generate::tests::timing -- --ignored --nocapture`: how
  /// long writing the file takes, and parsing what is written.
  #[test]
  #[ignore]
  fn timing() {
    let Ok(path) = std::env::var("MDX_SAMPLE") else {
      return;
    };
    let source = std::fs::read_to_string(&path).unwrap_or_default();
    let skipped = Skipped::default();
    let written = || generate(&path, &source, &skipped).map(|generated| generated.source.main.code);
    let code = match written() {
      Ok(code) => code,
      Err(error) => panic!("{error}"),
    };

    let runs = 200;
    let start = std::time::Instant::now();
    for _ in 0..runs {
      std::hint::black_box(written().map(|code| code.len()).unwrap_or_default());
    }
    let generating = start.elapsed() / runs;

    let start = std::time::Instant::now();
    for _ in 0..runs {
      std::hint::black_box(lower(&code, Lang::Jsx).is_ok());
    }
    let parsing = start.elapsed() / runs;

    let megabytes = source.len() as f64 / 1_000_000.0;
    println!(
      "{path}: {} bytes written as {} bytes of JSX in {generating:?} ({:.1} ms/MB); parsing the JSX takes {parsing:?}",
      source.len(),
      code.len(),
      generating.as_secs_f64() * 1000.0 / megabytes,
    );
  }

  /// `MDX_CORPUS=<list of files> MDX_DUMP=<out.jsonl> cargo test … dump -- --ignored`: for each
  /// file, the UTF-16 source ranges its module copies, or why it is rejected, to compare with
  /// MDX's language service.
  #[test]
  #[ignore]
  fn dump() {
    let (Ok(corpus), Ok(out)) = (std::env::var("MDX_CORPUS"), std::env::var("MDX_DUMP")) else {
      return;
    };
    let list = std::fs::read_to_string(corpus).unwrap_or_default();
    let skipped = Skipped::default();
    let mut lines = Vec::new();
    for path in list.lines().filter(|line| !line.is_empty()) {
      let source = std::fs::read_to_string(path).unwrap_or_default();
      let line = match generate(path, &source, &skipped) {
        Ok(generated) => {
          let ranges: Vec<(i32, i32)> = generated
            .source
            .main
            .mappings
            .iter()
            .map(|mapping| (mapping.source, mapping.source + mapping.source_length))
            .collect();
          let parses = lower(&generated.source.main.code, Lang::Jsx).err();
          serde_json::json!({ "file": path, "ranges": ranges, "parse": parses })
        }
        Err(error) => serde_json::json!({ "file": path, "error": error }),
      };
      lines.push(line.to_string());
    }
    let _ = std::fs::write(out, lines.join("\n"));
  }

  /// `MDX_SAMPLE=<file> cargo test … mdx::generate::tests::prints -- --ignored --nocapture`: the
  /// module written for the file.
  #[test]
  #[ignore]
  fn prints() {
    let Ok(path) = std::env::var("MDX_SAMPLE") else {
      return;
    };
    let source = std::fs::read_to_string(&path).unwrap_or_default();
    match generate(&path, &source, &Skipped::default()) {
      Ok(generated) => println!("{}", generated.source.main.code),
      Err(error) => println!("FAILS: {error}"),
    }
  }

  #[test]
  fn less_than_followed_by_whitespace_is_text() {
    assert_eq!(content("a < b {m.a()}\n<\n{m.b()}"), "{m.a()}{m.b()}");
  }
}

/// Files made of random pieces, many of them broken: each is written or fails, never panics.
#[cfg(test)]
mod random {
  use super::*;

  const PIECES: [&str; 56] = [
    "{",
    "}",
    "<",
    ">",
    "</",
    "/>",
    "<A",
    "<a b={",
    " c=\"",
    "'",
    "\"",
    "`",
    "```",
    "~~~",
    "\n",
    "\n\n",
    "\r\n",
    "import a from 'b'",
    "export default ",
    "export const a = {",
    "export { default } from 'c'",
    "---",
    "+++",
    "[",
    "](",
    ")",
    "\\",
    "/*",
    "*/",
    "//",
    "${",
    "é",
    "😀",
    "\u{a0}",
    "> ",
    "- ",
    "1. ",
    "# ",
    "https://a.com/",
    "www.",
    "{...a}",
    "m.a()",
    " ",
    "\t",
    "<>",
    "</>",
    "=",
    ":",
    ".",
    "await ",
    "/re/",
    "(",
    "<!--",
    "&",
    "[^1]: ",
    "    ",
  ];

  #[test]
  fn random_files_never_panic() {
    let mut state: u64 = 0x9E37_79B9_7F4A_7C15;
    let mut next = move || {
      state ^= state << 13;
      state ^= state >> 7;
      state ^= state << 17;
      state
    };

    let mut skipped = Skipped::default();
    for round in 0..30_000 {
      let length = 1 + next() % 24;
      let mut source = String::new();
      for _ in 0..length {
        source.push_str(PIECES[(next() % PIECES.len() as u64) as usize]);
      }
      skipped.clear();
      if round % 3 == 0 {
        skipped.insert((next() % 4) as u32);
      }
      let _ = generate("a.mdx", &source, &skipped);
    }
  }
}
