//! Offsets. The parser counts UTF-8 bytes; JavaScript, and so every offset the
//! analysis reads or reports, counts UTF-16 code units.

/// The UTF-16 offset of each UTF-8 offset of a text; nothing to look up when the text is ASCII.
pub struct Utf16Offsets {
  table: Option<Vec<u32>>,
}

impl Utf16Offsets {
  pub fn new(text: &str) -> Self {
    if text.is_ascii() {
      return Self { table: None };
    }

    let mut table = Vec::with_capacity(text.len() + 1);
    let mut utf16 = 0u32;

    for character in text.chars() {
      for _ in 0..character.len_utf8() {
        table.push(utf16);
      }
      utf16 += character.len_utf16() as u32;
    }
    table.push(utf16);

    Self { table: Some(table) }
  }

  #[inline]
  pub fn of(&self, utf8: u32) -> u32 {
    match &self.table {
      Some(table) => table.get(utf8 as usize).copied().unwrap_or(utf8),
      None => utf8,
    }
  }
}

/// The UTF-16 offset each line starts at.
pub fn line_starts(text: &str) -> Vec<u32> {
  let mut starts = vec![0];

  if text.is_ascii() {
    for index in memchr::memchr_iter(b'\n', text.as_bytes()) {
      starts.push(index as u32 + 1);
    }

    return starts;
  }

  let mut utf16 = 0u32;
  for character in text.chars() {
    utf16 += character.len_utf16() as u32;
    if character == '\n' {
      starts.push(utf16);
    }
  }

  starts
}

/// 1-based.
pub fn line_column(line_starts: &[u32], offset: u32) -> (u32, u32) {
  let mut low = 0usize;
  let mut high = line_starts.len() - 1;

  while low < high {
    let middle = (low + high + 1) >> 1;

    if line_starts[middle] <= offset {
      low = middle;
    } else {
      high = middle - 1;
    }
  }

  (low as u32 + 1, offset - line_starts[low] + 1)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn ascii_offsets_are_their_own() {
    let offsets = Utf16Offsets::new("const a = 1;");
    assert_eq!(offsets.of(6), 6);
  }

  #[test]
  fn offsets_count_utf16_code_units() {
    // "é" is two bytes and one unit; "😀" is four bytes and two units.
    let text = "é😀x";
    let offsets = Utf16Offsets::new(text);
    assert_eq!(offsets.of(0), 0);
    assert_eq!(offsets.of(2), 1);
    assert_eq!(offsets.of(6), 3);
    assert_eq!(offsets.of(7), 4);
  }

  #[test]
  fn lines_and_columns_are_one_based() {
    let starts = line_starts("a\n😀b\nc");
    assert_eq!(starts, vec![0, 2, 6]);
    assert_eq!(line_column(&starts, 0), (1, 1));
    assert_eq!(line_column(&starts, 4), (2, 3));
    assert_eq!(line_column(&starts, 6), (3, 1));
  }
}
