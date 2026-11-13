//! The source code around each usage of a message, by message and source file:
//! what a metadata file holds as each message's `sourceCode`.
//!
//! A snippet is not copied out of its file: it is three ranges of the file's
//! code, written as text only into the metadata file itself.

use std::{
  cmp::Ordering,
  hash::{Hash, Hasher},
};

use memchr::{memchr, memchr_iter, memmem};
use rayon::prelude::*;
use rustc_hash::{FxHashMap, FxHasher};

use super::json::compare_utf16;

/// A source file that has usages.
pub struct SourceFile<'a> {
  /// Project-relative: the metadata names the file by it.
  pub name: &'a [u8],
  /// WTF-8.
  pub code: &'a [u8],
  pub usages: Vec<SourceUsage<'a>>,
}

/// A usage, as `ParaglideUsage` has it.
#[derive(Clone, Debug)]
pub struct SourceUsage<'a> {
  pub name: &'a [u8],
  /// `name` is a pattern where `*` stands for any text.
  pub dynamic: bool,
  pub start: f64,
  pub end: f64,
  pub line: f64,
  pub end_line: f64,
  /// The inlang project the usage counts for, project-relative.
  pub project: Option<&'a [u8]>,
}

/// Bytes of a file's code, `start..end`.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Default)]
pub struct Span {
  pub start: usize,
  pub end: usize,
}

/// The lines around a usage, and its own lines; each part's text is its lines
/// joined by `\n`.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Snippet {
  pub before: Span,
  pub target: Span,
  pub after: Span,
}

/// The snippets of one file.
pub struct FileSnippets<'a> {
  pub name: &'a [u8],
  pub code: &'a [u8],
  /// Grouped by message.
  snippets: Vec<Snippet>,
}

/// The snippets of one message in one file: `FileSnippets::snippets[start..end]`.
#[derive(Clone, Copy, Debug)]
pub struct Group {
  pub file: u32,
  start: u32,
  end: u32,
}

/// The snippets of each message in a file: `(id, start, end)` of `FileSnippets::snippets`.
type FileGroups = Vec<(u32, u32, u32)>;

/// For each message that is used, the source code around its usages: what
/// `sourceCodeByMessage` returned.
pub struct SourceCode<'a> {
  /// Ordered by name.
  pub files: Vec<FileSnippets<'a>>,
  ids: FxHashMap<&'a [u8], u32>,
  /// By message, in the order of `files`.
  by_id: Vec<Vec<Group>>,
}

impl<'a> SourceCode<'a> {
  /// The snippets of the usages of `ids` that count for the project `inlang_project`.
  pub fn collect(
    sources: &'a [SourceFile<'a>],
    inlang_project: &[u8],
    ids: &[&'a [u8]],
    radius: f64,
  ) -> SourceCode<'a> {
    let mut numbered: FxHashMap<&'a [u8], u32> = FxHashMap::default();
    let mut unique: Vec<&'a [u8]> = Vec::new();
    for &id in ids {
      numbered.entry(id).or_insert_with(|| {
        unique.push(id);
        unique.len() as u32 - 1
      });
    }

    let names = Names {
      ids: &numbered,
      patterns: patterns_of(sources, inlang_project, &unique),
    };

    // An order that does not depend on the analysis: by name, then by place in the file.
    let mut order: Vec<usize> = (0..sources.len()).collect();
    order.sort_by(|&a, &b| compare_utf16(sources[a].name, sources[b].name));

    let collected: Vec<(FileSnippets<'a>, FileGroups)> = order
      .par_iter()
      .filter_map(|&source| snippets_of(&sources[source], inlang_project, &names, radius))
      .collect();

    let mut by_id: Vec<Vec<Group>> = vec![Vec::new(); unique.len()];
    let mut files = Vec::with_capacity(collected.len());
    for (position, (file, groups)) in collected.into_iter().enumerate() {
      for (id, start, end) in groups {
        by_id[id as usize].push(Group {
          file: position as u32,
          start,
          end,
        });
      }
      files.push(file);
    }

    SourceCode {
      files,
      ids: numbered,
      by_id,
    }
  }

  /// The snippets of a message, by file; None if it is not used.
  pub fn of(&self, id: &[u8]) -> Option<&[Group]> {
    let groups = &self.by_id[*self.ids.get(id)? as usize];
    (!groups.is_empty()).then_some(groups)
  }

  pub fn group(&self, group: &Group) -> (&FileSnippets<'a>, &[Snippet]) {
    let file = &self.files[group.file as usize];
    (
      file,
      &file.snippets[group.start as usize..group.end as usize],
    )
  }
}

/// What a usage's name is matched with.
struct Names<'n, 'a> {
  ids: &'n FxHashMap<&'a [u8], u32>,
  /// The messages each dynamic name matches.
  patterns: FxHashMap<&'a [u8], Vec<u32>>,
}

impl Names<'_, '_> {
  /// The messages a usage names: its own, or each match of a dynamic name like `error_*`.
  fn of(&self, usage: &SourceUsage) -> &[u32] {
    if usage.dynamic {
      return self.patterns.get(usage.name).map_or(&[], Vec::as_slice);
    }

    match self.ids.get_key_value(usage.name) {
      Some((_, id)) => std::slice::from_ref(id),
      None => &[],
    }
  }
}

/// The messages each dynamic name of the project's usages matches. `m[key]` is
/// all `*`, and says nothing about any one message.
fn patterns_of<'a>(
  sources: &'a [SourceFile<'a>],
  inlang_project: &[u8],
  ids: &[&'a [u8]],
) -> FxHashMap<&'a [u8], Vec<u32>> {
  let mut patterns: Vec<&'a [u8]> = sources
    .iter()
    .flat_map(|source| &source.usages)
    .filter(|usage| usage.dynamic && usage.project == Some(inlang_project))
    .map(|usage| usage.name)
    .filter(|name| name.iter().any(|&byte| byte != b'*'))
    .collect();
  patterns.sort_unstable();
  patterns.dedup();

  patterns
    .into_par_iter()
    .map(|pattern| {
      let matches = (0..ids.len() as u32)
        .filter(|&id| matches_pattern(pattern, ids[id as usize]))
        .collect();
      (pattern, matches)
    })
    .collect()
}

/// Whether `id` matches `pattern`, where `*` is any text: the regular expression
/// `matchingIds` makes of it. On WTF-8 as on UTF-16, as `*` is one byte that is
/// part of no other character.
pub fn matches_pattern(pattern: &[u8], id: &[u8]) -> bool {
  let parts: Vec<&[u8]> = pattern.split(|&byte| byte == b'*').collect();
  let (first, last) = match parts.as_slice() {
    [only] => return *only == id,
    [first, .., last] => (*first, *last),
    [] => return false,
  };

  if id.len() < first.len() + last.len() || !id.starts_with(first) || !id.ends_with(last) {
    return false;
  }

  let mut rest = &id[first.len()..id.len() - last.len()];
  for part in &parts[1..parts.len() - 1] {
    match memmem::find(rest, part) {
      Some(at) => rest = &rest[at + part.len()..],
      None => return false,
    }
  }

  true
}

/// What `a.start - b.start || a.end - b.end` orders by.
fn compare_places(a: &SourceUsage, b: &SourceUsage) -> Ordering {
  let by = |difference: f64| {
    if difference.is_nan() || difference == 0.0 {
      None
    } else if difference < 0.0 {
      Some(Ordering::Less)
    } else {
      Some(Ordering::Greater)
    }
  };

  by(a.start - b.start)
    .or_else(|| by(a.end - b.end))
    .unwrap_or(Ordering::Equal)
}

/// A file's snippets, and those of each message as `(id, start, end)`; None if
/// none of its usages count for the project.
fn snippets_of<'a>(
  source: &SourceFile<'a>,
  inlang_project: &[u8],
  names: &Names,
  radius: f64,
) -> Option<(FileSnippets<'a>, FileGroups)> {
  let mut usages: Vec<&SourceUsage> = source
    .usages
    .iter()
    .filter(|usage| usage.project == Some(inlang_project))
    .collect();
  if usages.is_empty() {
    return None;
  }
  // Stable, as JavaScript's `sort` is.
  usages.sort_by(|a, b| compare_places(a, b));

  let code = source.code;
  let mut lines: Option<Lines> = None;
  let mut snippets: Vec<(u32, Snippet)> = Vec::new();
  // The snippets of each message with the same text's hash.
  let mut seen: FxHashMap<(u32, u64), Vec<usize>> = FxHashMap::default();
  let mut text = Vec::new();

  for usage in usages {
    let named = names.of(usage);
    if named.is_empty() {
      continue;
    }

    let lines = lines.get_or_insert_with(|| Lines::new(code));
    let snippet = lines.snippet(usage.line, usage.end_line, radius);
    let hash = hash_of(code, &snippet, &mut text);

    for &id in named {
      // Usages on the same lines, e.g. `a ? m.x() : m.x()`.
      let same = seen.entry((id, hash)).or_default();
      let is_repeated = same
        .iter()
        .any(|&other| is_same_snippet(code, &snippets[other].1, &snippet));
      if is_repeated {
        continue;
      }

      same.push(snippets.len());
      snippets.push((id, snippet));
    }
  }

  // Each message's in the order they were found.
  snippets.sort_by_key(|&(id, _)| id);

  let mut groups: FileGroups = Vec::new();
  for (position, &(id, _)) in snippets.iter().enumerate() {
    match groups.last_mut() {
      Some((last, _, end)) if *last == id => *end = position as u32 + 1,
      _ => groups.push((id, position as u32, position as u32 + 1)),
    }
  }

  let file = FileSnippets {
    name: source.name,
    code,
    snippets: snippets.into_iter().map(|(_, snippet)| snippet).collect(),
  };

  Some((file, groups))
}

/// Where each line of a file starts, as `code.split(/\r?\n/)` splits it.
struct Lines<'a> {
  code: &'a [u8],
  starts: Vec<usize>,
}

impl<'a> Lines<'a> {
  fn new(code: &'a [u8]) -> Self {
    let mut starts = Vec::with_capacity(code.len() / 32 + 1);
    starts.push(0);
    starts.extend(memchr_iter(b'\n', code).map(|newline| newline + 1));

    Lines { code, starts }
  }

  /// Where line `index`'s text ends: before its `\n`, or its `\r\n`.
  fn end_of(&self, index: usize) -> usize {
    let Some(&next) = self.starts.get(index + 1) else {
      return self.code.len();
    };

    let newline = next - 1;
    if newline > self.starts[index] && self.code[newline - 1] == b'\r' {
      newline - 1
    } else {
      newline
    }
  }

  /// The text of lines `from..to`, joined by line breaks.
  fn span(&self, (from, to): (usize, usize)) -> Span {
    if from >= to {
      return Span::default();
    }

    Span {
      start: self.starts[from],
      end: self.end_of(to - 1),
    }
  }

  /// `sourceSnippet`: `radius` lines around a usage, and its own lines.
  fn snippet(&self, line: f64, end_line: f64, radius: f64) -> Snippet {
    let count = self.starts.len();
    let start = line - 1.0;
    let end = end_line;

    Snippet {
      before: self.span(slice(count, js_max(0.0, start - radius), start)),
      target: self.span(slice(count, start, end)),
      after: self.span(slice(count, end, end + radius)),
    }
  }
}

/// `Math.max(a, b)`: NaN if either is.
fn js_max(a: f64, b: f64) -> f64 {
  if a.is_nan() || b.is_nan() {
    f64::NAN
  } else {
    a.max(b)
  }
}

/// The items `Array.prototype.slice(start, end)` takes of `count`.
pub fn slice(count: usize, start: f64, end: f64) -> (usize, usize) {
  let index = |relative: f64| {
    // ToIntegerOrInfinity.
    let relative = if relative.is_nan() {
      0.0
    } else {
      relative.trunc()
    };
    let count = count as f64;

    if relative < 0.0 {
      (count + relative).max(0.0) as usize
    } else {
      relative.min(count) as usize
    }
  };

  let from = index(start);
  (from, index(end).max(from))
}

/// The text of a part: a `\r` before a `\n` is left out.
fn push_text(out: &mut Vec<u8>, code: &[u8], span: Span) {
  let mut text = &code[span.start..span.end];

  while let Some(at) = memchr(b'\r', text) {
    let is_crlf = text.get(at + 1) == Some(&b'\n');
    out.extend_from_slice(&text[..if is_crlf { at } else { at + 1 }]);
    text = &text[at + 1..];
  }

  out.extend_from_slice(text);
}

/// A hash of a snippet's text: of each part's, apart.
fn hash_of(code: &[u8], snippet: &Snippet, text: &mut Vec<u8>) -> u64 {
  text.clear();
  for span in [snippet.before, snippet.target, snippet.after] {
    push_text(text, code, span);
    // Not in UTF-8: parts never run into each other.
    text.push(0xFF);
  }

  let mut hasher = FxHasher::default();
  text.hash(&mut hasher);
  hasher.finish()
}

fn is_same_snippet(code: &[u8], a: &Snippet, b: &Snippet) -> bool {
  a == b
    || (same_text(code, a.before, b.before)
      && same_text(code, a.target, b.target)
      && same_text(code, a.after, b.after))
}

fn same_text(code: &[u8], a: Span, b: Span) -> bool {
  if a == b {
    return true;
  }

  let (mut first, mut second) = (Vec::new(), Vec::new());
  push_text(&mut first, code, a);
  push_text(&mut second, code, b);

  first == second
}

/// A part's text, as JavaScript has it: for tests.
#[cfg(test)]
pub fn text_of(code: &[u8], span: Span) -> Vec<u8> {
  let mut text = Vec::new();
  push_text(&mut text, code, span);
  text
}

#[cfg(test)]
pub(super) mod tests {
  use super::*;

  /// A usage of `name` on `line`, of `project.inlang`.
  pub fn usage(name: &str, line: u32) -> SourceUsage<'_> {
    SourceUsage {
      name: name.as_bytes(),
      dynamic: false,
      start: f64::from(line * 100),
      end: f64::from(line * 100 + 5),
      line: f64::from(line),
      end_line: f64::from(line),
      project: Some(b"project.inlang"),
    }
  }

  fn text(code: &[u8], snippet: &Snippet) -> [String; 3] {
    [snippet.before, snippet.target, snippet.after]
      .map(|span| String::from_utf8_lossy(&text_of(code, span)).into_owned())
  }

  /// Each message's snippets, as `id: file: before|target|after` lines.
  fn listed(source: &SourceCode, ids: &[&str]) -> Vec<String> {
    let mut out = Vec::new();
    for id in ids {
      for group in source.of(id.as_bytes()).unwrap_or_default() {
        let (file, snippets) = source.group(group);
        for snippet in snippets {
          out.push(format!(
            "{id}: {}: {}",
            String::from_utf8_lossy(file.name),
            text(file.code, snippet).join("|")
          ));
        }
      }
    }
    out
  }

  #[test]
  fn splits_lines_as_javascript_does() {
    for code in [
      "",
      "a",
      "a\n",
      "\n",
      "a\r\nb",
      "a\r\r\nb",
      "a\rb\n\r\nc\r",
      "\r\n\r\n",
      "x\n\ny",
    ] {
      let lines = Lines::new(code.as_bytes());
      let expected: Vec<String> = code
        .split('\n')
        .map(|line| line.strip_suffix('\r').unwrap_or(line).to_string())
        .collect();
      let actual: Vec<String> = (0..lines.starts.len())
        .map(|line| {
          String::from_utf8_lossy(&text_of(code.as_bytes(), lines.span((line, line + 1))))
            .into_owned()
        })
        .collect();
      // The last line keeps a `\r` no `\n` follows.
      let expected: Vec<String> = expected
        .into_iter()
        .enumerate()
        .map(|(index, line)| {
          if index + 1 == lines.starts.len() && code.ends_with('\r') {
            format!("{line}\r")
          } else {
            line
          }
        })
        .collect();
      assert_eq!(actual, expected, "{code:?}");

      // Lines joined by `\n`.
      let whole = lines.span((0, lines.starts.len()));
      assert_eq!(
        String::from_utf8_lossy(&text_of(code.as_bytes(), whole)),
        expected.join("\n"),
        "{code:?}"
      );
    }
  }

  #[test]
  fn slices_as_javascript_does() {
    // [start, end] → what `[0, 1, 2, 3, 4].slice(start, end)` takes.
    let cases = [
      ((0.0, 5.0), (0, 5)),
      ((1.0, 3.0), (1, 3)),
      ((3.0, 1.0), (3, 3)),
      ((-2.0, 5.0), (3, 5)),
      ((0.0, -1.0), (0, 4)),
      ((-10.0, 2.0), (0, 2)),
      ((1.5, 3.9), (1, 3)),
      ((f64::NAN, 2.0), (0, 2)),
      ((2.0, f64::NAN), (2, 2)),
      ((0.0, f64::INFINITY), (0, 5)),
      ((f64::NEG_INFINITY, 2.0), (0, 2)),
      ((7.0, 9.0), (5, 5)),
      ((-0.5, 2.0), (0, 2)),
    ];
    for ((start, end), expected) in cases {
      assert_eq!(slice(5, start, end), expected, "slice({start}, {end})");
    }
  }

  #[test]
  fn snippets_clamp_to_the_file() {
    let code = b"a\nb\nc\nd\ne";
    let lines = Lines::new(code);
    assert_eq!(
      text(code, &lines.snippet(2.0, 3.0, 1.0)),
      ["a", "b\nc", "d"]
    );
    assert_eq!(
      text(code, &lines.snippet(1.0, 1.0, 10.0)),
      ["", "a", "b\nc\nd\ne"]
    );
    assert_eq!(text(code, &lines.snippet(5.0, 5.0, 0.0)), ["", "e", ""]);
    // A radius that is not a whole number cuts as `slice` cuts it.
    assert_eq!(
      text(code, &lines.snippet(3.0, 3.0, 1.5)),
      ["a\nb", "c", "d"]
    );
    assert_eq!(
      text(code, &lines.snippet(3.0, 3.0, f64::INFINITY)),
      ["a\nb", "c", "d\ne"]
    );
    assert_eq!(
      text(code, &lines.snippet(3.0, 3.0, f64::NAN)),
      ["a\nb", "c", ""]
    );
    assert_eq!(text(code, &lines.snippet(3.0, 3.0, -1.0)), ["", "c", ""]);
  }

  #[test]
  fn each_used_message_gets_the_lines_around_its_usages() {
    let code = b"one\ntwo\nthree\nfour";
    let sources = [
      SourceFile {
        name: b"src/b.ts",
        code,
        usages: vec![usage("save", 4)],
      },
      SourceFile {
        name: b"src/a.ts",
        code,
        usages: vec![usage("cancel", 1), usage("save", 2)],
      },
    ];
    let ids: Vec<&[u8]> = vec![b"save", b"unused", b"cancel"];
    let source = SourceCode::collect(&sources, b"project.inlang", &ids, 1.0);

    assert_eq!(
      listed(&source, &["save", "unused", "cancel"]),
      [
        "save: src/a.ts: one|two|three",
        "save: src/b.ts: three|four|",
        "cancel: src/a.ts: |one|two",
      ]
    );
    assert!(source.of(b"unused").is_none());
    assert!(source.of(b"missing").is_none());
  }

  #[test]
  fn usages_on_the_same_lines_give_one_snippet() {
    let code = b"same\nx\nsame\nx\nsame";
    let sources = [SourceFile {
      name: b"a.ts",
      code,
      usages: vec![
        usage("save", 2),
        SourceUsage {
          start: 250.0,
          ..usage("save", 2)
        },
        // The same text, elsewhere.
        usage("save", 4),
        usage("save", 3),
        usage("save", 1),
      ],
    }];
    let source = SourceCode::collect(&sources, b"project.inlang", &[b"save"], 1.0);
    assert_eq!(
      listed(&source, &["save"]),
      [
        "save: a.ts: |same|x",
        "save: a.ts: same|x|same",
        "save: a.ts: x|same|x",
      ]
    );
  }

  #[test]
  fn line_breaks_do_not_tell_snippets_apart() {
    let code = b"a\r\nb\nc\na\nb";
    let sources = [SourceFile {
      name: b"a.ts",
      code,
      usages: vec![
        SourceUsage {
          end_line: 2.0,
          ..usage("save", 1)
        },
        SourceUsage {
          end_line: 5.0,
          ..usage("save", 4)
        },
      ],
    }];
    let source = SourceCode::collect(&sources, b"project.inlang", &[b"save"], 0.0);
    assert_eq!(listed(&source, &["save"]), ["save: a.ts: |a\nb|"]);

    // Nor do an empty line and no line: both join to "".
    let code = b"x\ny\n\nx\ny";
    let sources = [SourceFile {
      name: b"a.ts",
      code,
      usages: vec![usage("save", 1), usage("save", 4)],
    }];
    let source = SourceCode::collect(&sources, b"project.inlang", &[b"save"], 1.0);
    assert_eq!(listed(&source, &["save"]), ["save: a.ts: |x|y"]);
  }

  #[test]
  fn a_dynamic_name_goes_to_every_message_it_matches() {
    let code = b"one\ntwo";
    let dynamic = |name, line| SourceUsage {
      dynamic: true,
      ..usage(name, line)
    };
    let sources = [SourceFile {
      name: b"a.ts",
      code,
      usages: vec![
        dynamic("error_*", 1),
        dynamic("*", 2),
        dynamic("**", 2),
        dynamic("save", 2),
      ],
    }];
    let ids: Vec<&[u8]> = vec![b"error_404", b"error_500", b"save"];
    let source = SourceCode::collect(&sources, b"project.inlang", &ids, 0.0);
    assert_eq!(
      listed(&source, &["error_404", "error_500", "save"]),
      [
        "error_404: a.ts: |one|",
        "error_500: a.ts: |one|",
        "save: a.ts: |two|"
      ]
    );
  }

  #[test]
  fn other_projects_usages_are_left_out() {
    let code = b"one\ntwo";
    let sources = [SourceFile {
      name: b"a.ts",
      code,
      usages: vec![
        SourceUsage {
          project: Some(b"admin.inlang"),
          ..usage("save", 1)
        },
        SourceUsage {
          project: None,
          ..usage("save", 2)
        },
      ],
    }];
    let source = SourceCode::collect(&sources, b"project.inlang", &[b"save"], 0.0);
    assert!(source.of(b"save").is_none());
    assert!(source.files.is_empty());
  }

  #[test]
  fn matches_patterns_as_the_regular_expression_does() {
    let cases: [(&str, &str, bool); 16] = [
      ("error_*", "error_404", true),
      ("error_*", "error_", true),
      ("error_*", "errors", false),
      ("*_title", "page_title", true),
      ("a*b*c", "abc", true),
      ("a*b*c", "axbxc", true),
      ("a*b*c", "acb", false),
      ("a*a", "a", false),
      ("a*a", "aa", true),
      ("*.*", "nav.home", true),
      ("x*", "x\ny", true),
      ("save", "save", true),
      ("save", "saved", false),
      ("a**b", "ab", true),
      ("*😀*", "x😀y", true),
      ("é*", "e\u{301}", false),
    ];
    for (pattern, id, expected) in cases {
      assert_eq!(
        matches_pattern(pattern.as_bytes(), id.as_bytes()),
        expected,
        "{pattern} {id}"
      );
    }
  }
}
