//! VitePress Markdown (`.md`), as `@vue/language-core` reads it with `vitePressExtensions` (its
//! `file-md` plugin): the file is a Vue template, once front matter, code (```` ``` ```` fences and
//! `$$` math) and `<<<` snippet imports are blanked; its `<script>` and `<style>` blocks are taken
//! out of it; and inline code and autolinks (`<https://…>`) are blanked, unless they are inside a
//! tag or an interpolation. Each step is one of the plugin's regular expressions, matched as
//! JavaScript matches it, on bytes: a blank keeps every offset.

use memchr::{memchr, memmem};

use super::{names::is_word_byte, template::Span};

pub struct Markdown {
  /// The file with front matter and code blanked.
  pub text: Vec<u8>,
  /// What is blanked in `text`.
  code: Vec<Span>,
  /// The `<script>` and `<style>` blocks outside inline code, in order.
  pub blocks: Vec<Span>,
  /// The inline code and autolinks that are blanked in the template.
  ambiguous: Vec<Span>,
}

/// The template VitePress Markdown is, with what differs from the file.
pub struct MarkdownTemplate {
  /// The file as a template: blanked where it is not one.
  pub text: Vec<u8>,
  /// Where the blocks' text differs from the file: front matter and code, in order.
  pub code: Vec<Span>,
  /// Where the template differs from the file, in order.
  pub blanks: Vec<Span>,
}

pub fn read(source: &str) -> Markdown {
  let mut text = source.as_bytes().to_vec();
  let mut code = Vec::new();

  if let Some(end) = front_matter_end(&text) {
    code.push(Span::new(0, end));
  }
  blank_all(&mut text, &code);

  let fences = code_blocks(&text);
  blank_all(&mut text, &fences);
  code.extend(fences);

  let snippets = snippet_imports(&text);
  blank_all(&mut text, &snippets);
  code.extend(snippets);
  code.sort_unstable_by_key(|span| span.start);

  let inline = inline_code(&text);
  let autolinks = autolinks(&text);
  let tags = html_tags(&text);
  let interpolations = interpolations(&text);

  let blocks = sfc_blocks(&text, &inline, &autolinks);

  let ambiguous = inline
    .iter()
    .chain(&autolinks)
    .filter(|span| !contains(&tags, **span) && !contains(&interpolations, **span))
    .copied()
    .collect();

  Markdown {
    text,
    code,
    blocks,
    ambiguous,
  }
}

impl Markdown {
  pub fn into_template(self) -> MarkdownTemplate {
    let Markdown {
      mut text,
      code,
      blocks,
      ambiguous,
    } = self;
    blank_all(&mut text, &blocks);
    blank_all(&mut text, &ambiguous);

    let mut blanks: Vec<Span> = code
      .iter()
      .chain(&blocks)
      .chain(&ambiguous)
      .copied()
      .collect();
    blanks.sort_unstable_by_key(|span| span.start);
    MarkdownTemplate {
      text,
      code: merged(code),
      blanks: merged(blanks),
    }
  }
}

fn blank_all(text: &mut [u8], spans: &[Span]) {
  for span in spans {
    if let Some(bytes) = text.get_mut(span.range()) {
      bytes.fill(b' ');
    }
  }
}

/// Sorted spans, with those that overlap or touch merged.
fn merged(spans: Vec<Span>) -> Vec<Span> {
  let mut merged: Vec<Span> = Vec::with_capacity(spans.len());
  for span in spans {
    match merged.last_mut() {
      Some(last) if span.start <= last.end => last.end = last.end.max(span.end),
      _ => merged.push(span),
    }
  }
  merged
}

/// Whether one of `spans` (sorted, not overlapping) contains `span`.
fn contains(spans: &[Span], span: Span) -> bool {
  let after = spans.partition_point(|candidate| candidate.start <= span.start);
  after > 0 && spans[after - 1].end >= span.end
}

/// Whether one of `spans` (sorted, not overlapping) has `offset` in it.
fn has_offset(spans: &[Span], offset: u32) -> bool {
  let after = spans.partition_point(|candidate| candidate.start <= offset);
  after > 0 && offset < spans[after - 1].end
}

/// `\s` of a JavaScript regular expression, in ASCII.
fn is_js_space(byte: u8) -> bool {
  matches!(byte, b' ' | b'\t' | b'\n' | b'\x0b' | b'\x0c' | b'\r')
}

fn is_line_terminator(byte: u8) -> bool {
  byte == b'\n' || byte == b'\r'
}

/// `/^---[\s\S]*?\n---(?:\r?\n|$)/`
fn front_matter_end(text: &[u8]) -> Option<usize> {
  if !text.starts_with(b"---") {
    return None;
  }

  let mut from = 3;
  loop {
    let newline = from + memmem::find(&text[from..], b"\n---")?;
    let after = newline + 4;
    match text.get(after) {
      None => return Some(after),
      Some(b'\n') => return Some(after + 1),
      Some(b'\r') if text.get(after + 1) == Some(&b'\n') => return Some(after + 2),
      _ => from = newline + 1,
    }
  }
}

/// ``/(`{3}|\${2})[\s\S]+?\1/g``
fn code_blocks(text: &[u8]) -> Vec<Span> {
  let mut spans = Vec::new();
  let mut position = 0;
  // Once a delimiter has no closing one after an opening, none after has either.
  let mut delimiters: [Option<&[u8]>; 2] = [Some(b"```"), Some(b"$$")];
  let mut next: [Option<usize>; 2] = [None, None];

  loop {
    for (index, delimiter) in delimiters.iter().enumerate() {
      let Some(delimiter) = delimiter else {
        next[index] = None;
        continue;
      };
      if next[index].is_none_or(|at| at < position) {
        next[index] =
          memmem::find(&text[position.min(text.len())..], delimiter).map(|found| position + found);
      }
    }

    let Some((index, open)) = next
      .iter()
      .enumerate()
      .filter_map(|(index, at)| at.map(|at| (index, at)))
      .min_by_key(|&(_, at)| at)
    else {
      return spans;
    };
    let Some(delimiter) = delimiters[index] else {
      return spans;
    };

    let search = open + delimiter.len() + 1;
    let close = (search <= text.len())
      .then(|| memmem::find(&text[search..], delimiter))
      .flatten();
    match close {
      Some(found) => {
        let end = search + found + delimiter.len();
        spans.push(Span::new(open, end));
        position = end;
      }
      None => {
        delimiters[index] = None;
        position = open + 1;
      }
    }
  }
}

/// `/^\s*<<<\s*.+/gm`
fn snippet_imports(text: &[u8]) -> Vec<Span> {
  let mut spans = Vec::new();
  let mut from = 0;

  while let Some(found) = memmem::find(&text[from.min(text.len())..], b"<<<") {
    let at = from + found;
    from = at + 1;

    let mut line_start = at;
    while line_start > 0 && is_js_space(text[line_start - 1]) {
      line_start -= 1;
    }
    let starts_line = line_start == 0
      || text[line_start..at]
        .iter()
        .any(|&byte| is_line_terminator(byte));
    if !starts_line {
      continue;
    }

    let after = at + 3;
    let mut rest = after;
    while rest < text.len() && is_js_space(text[rest]) {
      rest += 1;
    }
    // `.+` takes the last place `\s*` can give back that is not a line terminator.
    let dot = (after..=rest)
      .rev()
      .find(|&start| start < text.len() && !is_line_terminator(text[start]));
    let Some(dot) = dot else {
      continue;
    };
    let end = text[dot..]
      .iter()
      .position(|&byte| is_line_terminator(byte))
      .map_or(text.len(), |length| dot + length);
    spans.push(Span::new(at, end));
    from = end;
  }

  spans
}

/// ``/(`{1,2})[^`\n]+\1/g``
fn inline_code(text: &[u8]) -> Vec<Span> {
  let mut spans = Vec::new();
  let mut position = 0;
  let run_end = |start: usize| {
    text[start..]
      .iter()
      .position(|&byte| byte == b'`' || byte == b'\n')
      .map_or(text.len(), |length| start + length)
  };

  while let Some(found) = memchr(b'`', &text[position.min(text.len())..]) {
    let at = position + found;
    let ticks = if text.get(at + 1) == Some(&b'`') {
      2
    } else {
      1
    };
    let content = at + ticks;
    let end = run_end(content);
    let closes = end > content && text[end..].starts_with(&b"``"[..ticks]);
    if closes {
      spans.push(Span::new(at, end + ticks));
      position = end + ticks;
    } else {
      position = at + 1;
    }
  }

  spans
}

/// `/<[^\s:]*:\S*>/g`
fn autolinks(text: &[u8]) -> Vec<Span> {
  let mut spans = Vec::new();
  let mut position = 0;

  while let Some(found) = memchr(b'<', &text[position.min(text.len())..]) {
    let at = position + found;
    position = at + 1;

    let mut colon = at + 1;
    while colon < text.len() && !is_js_space(text[colon]) && text[colon] != b':' {
      colon += 1;
    }
    if colon >= text.len() || text[colon] != b':' {
      continue;
    }
    let mut last_close = None;
    let mut scan = colon + 1;
    while scan < text.len() && !is_js_space(text[scan]) {
      if text[scan] == b'>' {
        last_close = Some(scan);
      }
      scan += 1;
    }
    if let Some(close) = last_close {
      spans.push(Span::new(at, close + 1));
      position = close + 1;
    }
  }

  spans
}

/// `/(?<=<\/?)([a-z][a-z0-9-]*)\b[^>]*(?=>)/gi`: a tag from its name to before its `>`.
fn html_tags(text: &[u8]) -> Vec<Span> {
  let mut spans = Vec::new();
  let mut position = 0;
  let is_word = |at: usize| at < text.len() && is_word_byte(text[at]);

  while let Some(found) = memchr(b'<', &text[position.min(text.len())..]) {
    let at = position + found;
    position = at + 1;

    let name = match text.get(at + 1) {
      Some(letter) if letter.is_ascii_alphabetic() => at + 1,
      Some(b'/') if text.get(at + 2).is_some_and(u8::is_ascii_alphabetic) => at + 2,
      _ => continue,
    };
    let mut name_end = name + 1;
    while name_end < text.len()
      && (text[name_end].is_ascii_alphanumeric() || text[name_end] == b'-')
    {
      name_end += 1;
    }
    // `\b`, giving back characters of the name until there is one.
    while name_end > name && is_word(name_end - 1) == is_word(name_end) {
      name_end -= 1;
    }
    if name_end == name {
      continue;
    }
    let Some(close) = memchr(b'>', &text[name_end..]) else {
      continue;
    };
    spans.push(Span::new(name, name_end + close));
    position = name_end + close;
  }

  spans
}

/// `/(?<=\{\{)[\s\S]*?(?=\}\})/g`
fn interpolations(text: &[u8]) -> Vec<Span> {
  let mut spans = Vec::new();
  // Where the last match ended: the next starts after a `{{` that ends there or later.
  let mut last_end: usize = 0;

  loop {
    let from = last_end.saturating_sub(2);
    let Some(found) = memmem::find(&text[from.min(text.len())..], b"{{") else {
      return spans;
    };
    let content = from + found + 2;
    let Some(length) = memmem::find(&text[content..], b"}}") else {
      return spans;
    };
    spans.push(Span::new(content, content + length));
    // An empty match moves on by one.
    last_end = if length == 0 {
      content + 1
    } else {
      content + length
    };
  }
}

/// `/<(script|style)\b[^>]*>([\s\S]*?)<\/\1>/g`, except those that start in inline code or an
/// autolink.
fn sfc_blocks(text: &[u8], inline: &[Span], autolinks: &[Span]) -> Vec<Span> {
  let mut blocks = Vec::new();
  let mut position = 0;

  while let Some(found) = memchr(b'<', &text[position.min(text.len())..]) {
    let at = position + found;
    position = at + 1;

    let rest = &text[at + 1..];
    let (name, close_tag): (&[u8], &[u8]) = if rest.starts_with(b"script") {
      (b"script", b"</script>")
    } else if rest.starts_with(b"style") {
      (b"style", b"</style>")
    } else {
      continue;
    };
    let name_end = at + 1 + name.len();
    if name_end < text.len() && is_word_byte(text[name_end]) {
      continue;
    }
    let Some(open_end) = memchr(b'>', &text[name_end..]) else {
      continue;
    };
    let content = name_end + open_end + 1;
    let Some(close) = memmem::find(&text[content..], close_tag) else {
      continue;
    };
    let end = content + close + close_tag.len();
    position = end;

    let offset = at as u32;
    if !has_offset(inline, offset) && !has_offset(autolinks, offset) {
      blocks.push(Span::new(at, end));
    }
  }

  blocks
}

#[cfg(test)]
mod tests {
  use super::*;

  fn texts(source: &str, spans: &[Span]) -> Vec<String> {
    spans
      .iter()
      .map(|span| source[span.range()].to_string())
      .collect()
  }

  #[test]
  fn front_matter_needs_its_closing_line() {
    assert_eq!(front_matter_end(b"---\na: 1\n---\n# x"), Some(13));
    assert_eq!(front_matter_end(b"---\na: 1\n----\n---"), Some(17));
    assert_eq!(front_matter_end(b"---\r\na\r\n---\r\nb"), Some(13));
    assert_eq!(front_matter_end(b"# x\n---\n"), None);
  }

  #[test]
  fn code_fences_and_math_pair_up() {
    let source = "a ```js\n{{ x }}\n``` b $$ {{ y }} $$ ```` c";
    assert_eq!(
      texts(source, &code_blocks(source.as_bytes())),
      ["```js\n{{ x }}\n```", "$$ {{ y }} $$"]
    );
  }

  #[test]
  fn snippet_imports_start_a_line() {
    let source = "a <<< b\n  <<< @/snippets/a.js\n<<<\n";
    assert_eq!(
      texts(source, &snippet_imports(source.as_bytes())),
      ["<<< @/snippets/a.js"]
    );
  }

  #[test]
  fn inline_code_and_autolinks() {
    let source = "a `{{ x }}` b ``c`d`` e ` f <https://a.b> <span :a=\"b\">";
    assert_eq!(
      texts(source, &inline_code(source.as_bytes())),
      ["`{{ x }}`", "`c`", "` e `"]
    );
    assert_eq!(
      texts(source, &autolinks(source.as_bytes())),
      ["<https://a.b>"]
    );
  }

  #[test]
  fn semantic_ranges_are_tags_and_interpolations() {
    let source = "<span :title=\"`a`\">{{ `b` }}{{}}</span> a < b <a_b>";
    assert_eq!(
      texts(source, &html_tags(source.as_bytes())),
      ["span :title=\"`a`\"", "span"]
    );
    assert_eq!(
      texts(source, &interpolations(source.as_bytes())),
      [" `b` ", ""]
    );
  }

  #[test]
  fn the_template_keeps_tags_and_interpolations() {
    let source = "---\nt: \"{{ no }}\"\n---\n<script setup>\nconst a = `x`;\n</script>\n\n# {{ a }} `{{ no }}`\n\n<p :title=\"`{{ yes }}`\">x</p>\n";
    let markdown = read(source);
    assert_eq!(
      texts(source, &markdown.blocks),
      ["<script setup>\nconst a = `x`;\n</script>"]
    );
    let template = markdown.into_template();
    let text = String::from_utf8_lossy(&template.text);
    assert_eq!(
      text.trim(),
      "# {{ a }}           \n\n<p :title=\"`{{ yes }}`\">x</p>"
    );
  }
}
