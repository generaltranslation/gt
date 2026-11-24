import type { Mapping } from './mapping.js';

/** Replaces generated `[start, end)` with generated `text`, by default nothing. */
export type Edit = { start: number; end: number; text?: string };

/**
 * Edits generated code and moves its mappings along. An edit may touch mapped
 * (source) text only at its edges.
 */
export function applyEdits(
  code: string,
  mappings: readonly Mapping[],
  edits: readonly Edit[]
): { code: string; mappings: Mapping[] } {
  const applied = withoutOverlaps(edits);
  const offsetAfterEdits = offsetsAfterEdits(applied);
  const editedMappings = mappings.map((mapping) =>
    editedMapping(mapping, offsetAfterEdits)
  );

  return { code: editedCode(code, applied), mappings: editedMappings };
}

function withoutOverlaps(edits: readonly Edit[]): Edit[] {
  const inOrder = [...edits].sort((a, b) => a.start - b.start || a.end - b.end);
  const applied: Edit[] = [];
  let appliedUntil = 0;

  for (const edit of inOrder) {
    const overlapsPrevious = edit.start < appliedUntil;
    if (overlapsPrevious) continue;

    applied.push(edit);
    appliedUntil = edit.end;
  }

  return applied;
}

function editedCode(code: string, appliedInOrder: readonly Edit[]): string {
  const parts: string[] = [];
  let copiedUntil = 0;

  for (const edit of appliedInOrder) {
    parts.push(code.slice(copiedUntil, edit.start), edit.text ?? '');
    copiedUntil = edit.end;
  }

  parts.push(code.slice(copiedUntil));

  return parts.join('');
}

function editedMapping(
  mapping: Mapping,
  offsetAfterEdits: (offset: number) => number
): Mapping {
  const generated = offsetAfterEdits(mapping.generated);
  const end = offsetAfterEdits(mapping.generated + mapping.length);
  const length = end - generated;
  if (length === mapping.length) return { ...mapping, generated };

  // No longer a copy: the edited text stands for the source text as a whole.
  const sourceLength = mapping.sourceLength ?? mapping.length;

  return { ...mapping, generated, length, sourceLength };
}

/**
 * Where an offset moves once the edits are applied: by what the edits that
 * end at or before it add and remove. An offset inside an edit moves to the
 * end of the edit's text.
 *
 * A file can have thousands of mappings and edits: the edit that matters, the
 * first that ends after the offset, is found by binary search. Edits applied
 * in order also end in order, unless one ends before it starts: then each
 * offset looks through them in order.
 */
function offsetsAfterEdits(
  appliedInOrder: readonly Edit[]
): (offset: number) => number {
  const count = appliedInOrder.length;
  /** By how much the edits before each one move an offset. */
  const shifts = new Float64Array(count + 1);
  let endInOrder = true;

  appliedInOrder.forEach(({ start, end, text = '' }, index) => {
    shifts[index + 1] = shifts[index]! + text.length - Math.max(0, end - start);
    if (index > 0 && end < appliedInOrder[index - 1]!.end) endInOrder = false;
  });

  const firstEndingAfter = (offset: number): number => {
    let low = 0;

    if (!endInOrder) {
      while (low < count && offset >= appliedInOrder[low]!.end) low++;
      return low;
    }

    let high = count;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (offset >= appliedInOrder[middle]!.end) low = middle + 1;
      else high = middle;
    }

    return low;
  };

  return (offset) => {
    const index = firstEndingAfter(offset);
    const shift = shifts[index]!;
    const edit = appliedInOrder[index];

    return edit && offset > edit.start
      ? edit.start + shift + (edit.text ?? '').length
      : offset + shift;
  };
}
