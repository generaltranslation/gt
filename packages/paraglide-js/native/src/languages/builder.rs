//! Generated code built from copies of a file's text, which are mapped to where they come from, and
//! glue, which is not. Offsets in the mappings count UTF-16 code units, as JavaScript does.

use rustc_hash::FxHashSet;

use crate::{
  load::GeneratedCode,
  lower::Lang,
  mapping::Mapping,
  positions::{utf16_length, Utf16Offsets},
};

/// The template expressions of a file that did not parse before, by their number in the order they
/// are written. They are written as their fallback, so that the rest of the file is analyzed.
pub type Skipped = FxHashSet<u32>;

/// Generated code, and where its skippable template expressions are in it.
pub struct BuiltCode {
  pub code: GeneratedCode,
  /// The UTF-8 range of each skippable expression in `code`, by number.
  pub expressions: Vec<(u32, u32)>,
}

pub struct CodeBuilder<'s> {
  source: &'s str,
  offsets: Utf16Offsets<'s>,
  skipped: &'s Skipped,
  code: String,
  /// The length of `code` in UTF-16 code units.
  length: usize,
  mappings: Vec<Mapping>,
  expressions: Vec<(u32, u32)>,
}

impl<'s> CodeBuilder<'s> {
  pub fn new(source: &'s str, skipped: &'s Skipped) -> Self {
    CodeBuilder {
      source,
      offsets: Utf16Offsets::new(source),
      skipped,
      code: String::with_capacity(source.len() + source.len() / 2),
      length: 0,
      mappings: Vec::new(),
      expressions: Vec::new(),
    }
  }

  /// The file the code is built from.
  pub fn source(&self) -> &'s str {
    self.source
  }

  /// The code so far.
  pub fn code(&self) -> &str {
    &self.code
  }

  /// Writes `text`, which stands for nothing in the file.
  pub fn glue(&mut self, text: &str) {
    self.length += utf16_length(text);
    self.code.push_str(text);
  }

  /// Copies `source[start..end)` (UTF-8 offsets at character boundaries), mapped character by
  /// character.
  pub fn copy(&mut self, start: usize, end: usize) {
    if end <= start {
      return;
    }

    let text = &self.source[start..end];
    let length = utf16_length(text);
    self.mappings.push(Mapping {
      generated: self.length as i32,
      source: self.offsets.of(start as u32) as i32,
      length: length as i32,
      source_length: length as i32,
    });
    self.code.push_str(text);
    self.length += length;
  }

  /// Writes `text` for `source[start..end)` as a whole, e.g. `ParaglideMessage` for the tag name
  /// `paraglide-message`: a node in it stands for the whole range.
  pub fn write_for(&mut self, start: usize, end: usize, text: &str) {
    let length = utf16_length(text);
    let source_start = self.offsets.of(start as u32);
    let source_end = self.offsets.of(end as u32);

    if length > 0 {
      self.mappings.push(Mapping {
        generated: self.length as i32,
        source: source_start as i32,
        length: length as i32,
        source_length: (source_end - source_start) as i32,
      });
    }
    self.code.push_str(text);
    self.length += length;
  }

  /// Writes one template construct with `write`, unless it did not parse before: then `fallback`
  /// (glue) instead, which must be valid where the construct is. Returns whether it was written.
  pub fn skippable(&mut self, fallback: &str, write: impl FnOnce(&mut Self)) -> bool {
    let number = self.expressions.len() as u32;
    // Reserved before `write`, which may write skippable constructs of its own.
    self.expressions.push((0, 0));
    let start = self.code.len();
    let (length, mappings) = (self.length, self.mappings.len());

    // Written even when skipped, so that the constructs in it keep their numbers, and every later
    // one its own.
    write(self);

    let is_written = !self.skipped.contains(&number);
    if !is_written {
      self.code.truncate(start);
      self.length = length;
      self.mappings.truncate(mappings);
      self.glue(fallback);
      // Gone with it: no error is ever in them.
      for inner in &mut self.expressions[number as usize + 1..] {
        *inner = (u32::MAX, u32::MAX);
      }
    }

    self.expressions[number as usize] = (start as u32, self.code.len() as u32);
    is_written
  }

  /// Copies the template expression `source[start..end)`, or writes `0` if it did not parse before.
  pub fn expression(&mut self, start: usize, end: usize) -> bool {
    self.skippable("0", |code| code.copy(start, end))
  }

  /// The UTF-16 offset in the file of the UTF-8 offset `utf8`, e.g. for a prop's declaration.
  pub fn source_offset(&self, utf8: usize) -> i32 {
    self.offsets.of(utf8 as u32) as i32
  }

  pub fn finish(self, lang: Lang) -> BuiltCode {
    BuiltCode {
      code: GeneratedCode {
        code: self.code,
        lang,
        mappings: self.mappings,
        length: self.length,
      },
      expressions: self.expressions,
    }
  }
}

/// The skippable expression that a syntax error at UTF-8 offset `error` of the code is in or right
/// after: the innermost one around it, else the last one before it.
pub fn expression_at(expressions: &[(u32, u32)], skipped: &Skipped, error: usize) -> Option<u32> {
  let error = error as u32;
  let unskipped = expressions
    .iter()
    .enumerate()
    .filter(|(number, _)| !skipped.contains(&(*number as u32)));

  let around = unskipped
    .clone()
    .filter(|(_, &(start, end))| start <= error && error <= end)
    .min_by_key(|(_, &(start, end))| end - start);
  if let Some((number, _)) = around {
    return Some(number as u32);
  }

  unskipped
    .filter(|(_, &(_, end))| end <= error)
    .max_by_key(|(_, &(start, end))| (end, std::cmp::Reverse(end - start)))
    .map(|(number, _)| number as u32)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn copies_are_mapped_in_utf16_units() {
    let source = "é{{ m.a() }}";
    let skipped = Skipped::default();
    let mut code = CodeBuilder::new(source, &skipped);
    code.glue("(");
    code.copy(5, 11);
    code.glue(");");
    let built = code.finish(Lang::Ts);

    assert_eq!(built.code.code, "(m.a() );");
    assert_eq!(built.code.length, 9);
    let mapping = built.code.mappings[0];
    assert_eq!(
      (
        mapping.generated,
        mapping.source,
        mapping.length,
        mapping.source_length
      ),
      (1, 4, 6, 6)
    );
  }

  #[test]
  fn a_skipped_expression_is_its_fallback() {
    let source = "{{ m.( }} {{ m.b() }}";
    let mut skipped = Skipped::default();
    skipped.insert(0);
    let mut code = CodeBuilder::new(source, &skipped);
    code.glue(";(");
    code.expression(3, 6);
    code.glue(");(");
    code.expression(13, 18);
    code.glue(");");
    let built = code.finish(Lang::Ts);

    assert_eq!(built.code.code, ";(0);(m.b());");
    assert_eq!(built.expressions, vec![(2, 3), (6, 11)]);
  }

  #[test]
  fn constructs_after_a_skipped_one_keep_their_numbers() {
    let source = "{{ a( b( }} {{ c }}";
    let write = |skipped: &Skipped| {
      let mut code = CodeBuilder::new(source, skipped);
      code.skippable("0", |code| {
        code.copy(3, 5);
        code.expression(5, 8);
      });
      code.glue(";");
      code.expression(15, 16);
      code.finish(Lang::Ts)
    };

    let mut skipped = Skipped::default();
    skipped.insert(1);
    skipped.insert(0);
    let built = write(&skipped);

    assert_eq!(built.code.code, "0;c");
    assert_eq!(
      built.expressions,
      vec![(0, 1), (u32::MAX, u32::MAX), (2, 3)]
    );
    assert_eq!(built.code.mappings.len(), 1);
    assert_eq!(expression_at(&built.expressions, &skipped, 2), Some(2));
  }

  #[test]
  fn an_error_is_in_the_innermost_expression_or_after_the_last() {
    let expressions = [(0, 20), (5, 10), (25, 30)];
    let skipped = Skipped::default();

    assert_eq!(expression_at(&expressions, &skipped, 7), Some(1));
    assert_eq!(expression_at(&expressions, &skipped, 15), Some(0));
    assert_eq!(expression_at(&expressions, &skipped, 22), Some(0));
    assert_eq!(expression_at(&expressions, &skipped, 40), Some(2));
  }
}
