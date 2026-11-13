//! Moves the nodes of code a language tool generated to their positions in the source file.

use crate::ir::{Ast, UNMAPPED};

/// Generated `[generated, generated + length)` stands for source
/// `[source, source + source_length)`. Equal lengths are a copy, mapped character
/// by character; otherwise the whole generated range stands for the whole source range.
#[derive(Clone, Copy, Debug)]
pub struct Mapping {
  pub generated: i32,
  pub source: i32,
  pub length: i32,
  pub source_length: i32,
}

impl Mapping {
  fn is_copy(&self) -> bool {
    self.source_length == self.length
  }
}

/// Moves every node to its source position, and keeps its position in the
/// generated code apart. A node that starts in generated-only text gets
/// `start = end = -1` and is not a usage.
pub fn remap(ast: &mut Ast, mappings: &[Mapping], generated_length: usize) {
  // Longer mappings first, so that nested (more precise) ones win.
  let mut outermost_first: Vec<&Mapping> = mappings.iter().collect();
  outermost_first.sort_by_key(|mapping| std::cmp::Reverse(mapping.length));

  let mut source_start_at = vec![UNMAPPED; generated_length + 1];
  let mut source_end_at = vec![UNMAPPED; generated_length + 1];

  for mapping in outermost_first {
    let first = mapping.generated.max(0) as usize;
    let skipped = (first as i64 - mapping.generated as i64) as i32;

    for offset in skipped..mapping.length {
      let at = (mapping.generated + offset) as usize;
      if at >= generated_length {
        break;
      }

      if mapping.is_copy() {
        source_start_at[at] = mapping.source + offset;
        source_end_at[at] = mapping.source + offset + 1;
      } else {
        source_start_at[at] = mapping.source;
        source_end_at[at] = mapping.source + mapping.source_length;
      }
    }
  }

  let mut parsed = Vec::with_capacity(ast.nodes.len());

  for node in &mut ast.nodes {
    let (parsed_start, parsed_end) = (node.start as usize, node.end as usize);
    parsed.push((parsed_start as u32, parsed_end as u32));

    let start = source_start_at
      .get(parsed_start)
      .copied()
      .unwrap_or(UNMAPPED);
    let end = last_mapped_source_end(parsed_start, parsed_end, &source_end_at).unwrap_or(start);
    let is_mapped = start != UNMAPPED;

    node.start = start;
    node.end = if is_mapped { start.max(end) } else { UNMAPPED };
  }

  ast.parsed = Some(parsed);
}

fn last_mapped_source_end(start: usize, end: usize, source_end_at: &[i32]) -> Option<i32> {
  let last_offset = end.checked_sub(1)?;
  if last_offset == start {
    return source_end_at.get(last_offset).copied();
  }

  let mut offset = last_offset;
  while offset > start {
    match source_end_at.get(offset) {
      Some(&source_end) if source_end != UNMAPPED => return Some(source_end),
      _ => {}
    }
    offset -= 1;
  }

  None
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::lower::{lower, Lang};

  fn positions(code: &str, mappings: &[Mapping]) -> Vec<(i32, i32)> {
    let mut ast = lower(code, Lang::Ts).unwrap_or_default();
    remap(&mut ast, mappings, code.len());

    ast
      .nodes
      .iter()
      .map(|node| (node.start, node.end))
      .collect()
  }

  #[test]
  fn a_copy_maps_character_by_character() {
    // `m.a()` at 10 in the generated code stands for `m.a()` at 100 in the file.
    let code = "wrapper = m.a();";
    let copy = Mapping {
      generated: 10,
      source: 100,
      length: 5,
      source_length: 5,
    };
    let positions = positions(code, &[copy]);

    // The call, the member, and its two names.
    assert!(positions.contains(&(100, 105)));
    assert!(positions.contains(&(100, 103)));
    assert!(positions.contains(&(100, 101)));
    assert!(positions.contains(&(102, 103)));
  }

  #[test]
  fn generated_only_code_is_unmapped() {
    let code = "wrapper = m.a();";
    let copy = Mapping {
      generated: 10,
      source: 100,
      length: 5,
      source_length: 5,
    };
    let positions = positions(code, &[copy]);

    // The program and the statement start in text the tool wrote.
    assert_eq!(positions[0], (UNMAPPED, UNMAPPED));
    assert_eq!(positions[1], (UNMAPPED, UNMAPPED));
  }

  #[test]
  fn a_range_of_another_length_stands_for_its_source_as_a_whole() {
    let code = "__ctx.title;";
    let whole = Mapping {
      generated: 0,
      source: 40,
      length: 11,
      source_length: 5,
    };
    let positions = positions(code, &[whole]);

    assert!(positions.contains(&(40, 45)));
  }
}
