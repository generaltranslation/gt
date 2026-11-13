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
  const editedMappings = mappings.map((mapping) =>
    editedMapping(mapping, applied)
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
  appliedInOrder: readonly Edit[]
): Mapping {
  const generated = offsetAfterEdits(mapping.generated, appliedInOrder);
  const end = offsetAfterEdits(
    mapping.generated + mapping.length,
    appliedInOrder
  );
  const length = end - generated;
  if (length === mapping.length) return { ...mapping, generated };

  // No longer a copy: the edited text stands for the source text as a whole.
  const sourceLength = mapping.sourceLength ?? mapping.length;

  return { ...mapping, generated, length, sourceLength };
}

/** An offset inside an edit moves to the end of the edit's text. */
function offsetAfterEdits(
  offset: number,
  appliedInOrder: readonly Edit[]
): number {
  let shift = 0;

  for (const { start, end, text = '' } of appliedInOrder) {
    if (offset >= end) {
      shift += text.length - Math.max(0, end - start);
    } else if (offset > start) {
      return start + shift + text.length;
    } else {
      break;
    }
  }

  return offset + shift;
}
