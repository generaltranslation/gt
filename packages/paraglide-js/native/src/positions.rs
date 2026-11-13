//! The parser counts UTF-8 bytes, while JavaScript, and so every offset the analysis reads or
//! reports, counts UTF-16 code units.

use std::cell::Cell;

/// The UTF-16 offset of each UTF-8 offset of a text.
pub struct Utf16Offsets<'t> {
  table: Table<'t>,
}

enum Table<'t> {
  Ascii,
  /// Where each non-ASCII character ends in UTF-8 with how many more UTF-8 bytes than UTF-16 units
  /// the text has up to there, and in `passed` how many of them the last offset asked about was
  /// after.
  Sparse {
    shifts: Vec<(u32, u32)>,
    passed: Cell<usize>,
  },
  /// For a text of many non-ASCII characters: the same difference at the start of each block
  /// of `BLOCK` bytes, the rest counted in the text.
  Blocks {
    blocks: Vec<u32>,
    bytes: &'t [u8],
  },
}

const BLOCK: usize = 16;

impl<'t> Utf16Offsets<'t> {
  pub fn new(text: &'t str) -> Self {
    if text.is_ascii() {
      return Self {
        table: Table::Ascii,
      };
    }

    let bytes = text.as_bytes();
    let most_sparse = bytes.len() / (BLOCK * 2);
    let mut shifts = Vec::new();
    let mut shift = 0u32;
    let mut next = next_non_ascii(bytes, 0);

    while let Some(start) = next {
      if shifts.len() > most_sparse {
        return Self {
          table: Table::Blocks {
            blocks: blocks_of(bytes),
            bytes,
          },
        };
      }

      let width = match bytes[start] {
        0xF0.. => 4,
        0xE0.. => 3,
        _ => 2,
      };
      // A character beyond U+FFFF is two units.
      shift += if width == 4 { 2 } else { width - 1 };
      let end = start + width as usize;
      shifts.push((end as u32, shift));
      next = next_non_ascii(bytes, end);
    }

    let table = if shifts.is_empty() {
      Table::Ascii
    } else {
      Table::Sparse {
        shifts,
        passed: Cell::new(0),
      }
    };

    Self { table }
  }

  /// `utf8` is at a character's start or end.
  #[inline(always)]
  pub fn of(&self, utf8: u32) -> u32 {
    match &self.table {
      Table::Ascii => utf8,
      table => table.non_ascii_offset(utf8),
    }
  }
}

impl Table<'_> {
  #[inline(never)]
  fn non_ascii_offset(&self, utf8: u32) -> u32 {
    match self {
      Table::Ascii => utf8,
      Table::Sparse { shifts, passed } => sparse_offset(shifts, passed, utf8),
      Table::Blocks { blocks, bytes } => {
        let end = utf8 as usize;
        let mut at = end / BLOCK * BLOCK;
        let mut shift = blocks[at / BLOCK];

        if end - at >= 8 {
          shift = shift.wrapping_add(word_shift(word_at(bytes, at)));
          at += 8;
        }
        if end > at {
          let kept = u64::MAX >> (64 - 8 * (end - at));
          shift = shift.wrapping_add(word_shift(word_at(bytes, at) & kept));
        }

        utf8.wrapping_sub(shift)
      }
    }
  }
}

#[inline]
fn sparse_offset(shifts: &[(u32, u32)], passed: &Cell<usize>, utf8: u32) -> u32 {
  let is_after = |&(end, _): &(u32, u32)| end <= utf8;
  let mut count = passed.get();

  if count < shifts.len() && is_after(&shifts[count]) {
    let ahead = &shifts[count + 1..];
    count += 1
      + match ahead.iter().take(4).position(|shift| !is_after(shift)) {
        Some(steps) => steps,
        None => ahead.partition_point(is_after),
      };
  } else if count > 0 && !is_after(&shifts[count - 1]) {
    count = shifts[..count - 1].partition_point(is_after);
  }
  passed.set(count);

  match count {
    0 => utf8,
    _ => utf8 - shifts[count - 1].1,
  }
}

/// The difference at the start of each block, and at the end of the text.
fn blocks_of(bytes: &[u8]) -> Vec<u32> {
  let mut blocks = Vec::with_capacity(bytes.len() / BLOCK + 1);
  let mut shift = 0u32;

  blocks.push(0);
  for block in bytes.chunks(BLOCK) {
    shift = shift.wrapping_add(shift_of(block));
    blocks.push(shift);
  }

  blocks
}

/// How many more UTF-8 bytes than UTF-16 units `bytes` are, wrapping below zero when `bytes` ends
/// within a character.
fn shift_of(bytes: &[u8]) -> u32 {
  (0..bytes.len()).step_by(8).fold(0u32, |shift, at| {
    shift.wrapping_add(word_shift(word_at(bytes, at)))
  })
}

/// The eight bytes from `at` on, little-endian; past the end, zeros, which are ASCII.
#[inline]
fn word_at(bytes: &[u8], at: usize) -> u64 {
  let mut eight = [0u8; 8];
  match bytes.get(at..at + 8) {
    Some(word) => eight.copy_from_slice(word),
    None => {
      let rest = &bytes[at.min(bytes.len())..];
      eight[..rest.len()].copy_from_slice(rest);
    }
  }

  u64::from_le_bytes(eight)
}

/// One for each continuation byte, less one for each character beyond U+FFFF: the first
/// byte of four, which are two UTF-16 units.
#[inline]
fn word_shift(word: u64) -> u32 {
  const HIGH: u64 = 0x8080_8080_8080_8080;
  let continuations = word & !(word << 1) & HIGH;
  let four_bytes_leads = word & (word << 1) & (word << 2) & (word << 3) & HIGH;

  continuations
    .count_ones()
    .wrapping_sub(four_bytes_leads.count_ones())
}

fn next_non_ascii(bytes: &[u8], from: usize) -> Option<usize> {
  const HIGH: u64 = 0x8080_8080_8080_8080;
  let (words, rest) = bytes.get(from..)?.as_chunks::<8>();
  let mut offset = from;

  for &word in words {
    let high = u64::from_le_bytes(word) & HIGH;
    if high != 0 {
      return Some(offset + (high.trailing_zeros() / 8) as usize);
    }
    offset += 8;
  }

  rest
    .iter()
    .position(|&byte| byte >= 0x80)
    .map(|index| offset + index)
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

/// A text's length in UTF-16 code units, as JavaScript's `length`.
pub fn utf16_length(text: &str) -> usize {
  if text.is_ascii() {
    return text.len();
  }

  text
    .bytes()
    .map(|byte| usize::from(byte & 0xC0 != 0x80) + usize::from(byte >= 0xF0))
    .sum()
}

/// 1-based.
pub fn line_column(line_starts: &[u32], offset: u32) -> (u32, u32) {
  // The first line starts at 0, at or before any offset.
  let line = line_starts.partition_point(|&start| start <= offset) - 1;

  (line as u32 + 1, offset - line_starts[line] + 1)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn utf16_lengths_are_javascripts() {
    for text in ["", "abc", "é", "日本", "😀", "a😀é日\u{10FFFF}\u{FFFF}"] {
      assert_eq!(utf16_length(text), text.encode_utf16().count(), "{text}");
    }
  }

  #[test]
  fn ascii_offsets_are_their_own() {
    let offsets = Utf16Offsets::new("const a = 1;");
    assert_eq!(offsets.of(6), 6);
  }

  #[test]
  fn offsets_are_those_of_javascript_in_any_order() {
    let text = "a\u{e9}b\u{65e5}\u{672c}\u{1F600}c\u{e9}\u{e9} d\u{10FFFF}e".repeat(40) + "tail";
    let few = "a".repeat(5000) + &text[..40] + &"b".repeat(5000);
    for text in [&text, &few] {
      let boundaries: Vec<(u32, u32)> = text
        .char_indices()
        .map(|(utf8, _)| (utf8 as u32, text[..utf8].encode_utf16().count() as u32))
        .chain([(text.len() as u32, text.encode_utf16().count() as u32)])
        .collect();
      let offsets = Utf16Offsets::new(text);

      for &(utf8, utf16) in boundaries.iter().chain(boundaries.iter().rev()) {
        assert_eq!(offsets.of(utf8), utf16, "{utf8}");
      }
      for index in 0..boundaries.len() {
        let (utf8, utf16) = boundaries[(index * 7919) % boundaries.len()];
        assert_eq!(offsets.of(utf8), utf16, "{utf8}");
      }
    }
    assert!(matches!(
      Utf16Offsets::new(&text).table,
      Table::Blocks { .. }
    ));
    assert!(matches!(
      Utf16Offsets::new(&few).table,
      Table::Sparse { .. }
    ));
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
