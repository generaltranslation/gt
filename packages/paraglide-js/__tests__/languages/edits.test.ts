import { expect, test } from 'vitest';
import { applyEdits, type Edit } from '../../src/compiler/languages/edits.js';
import type { Mapping } from '../../src/compiler/languages/mapping.js';

/** The edits' effect on an offset, edit by edit: what the binary search must find. */
function offsetAfterEach(offset: number, appliedInOrder: Edit[]): number {
  let shift = 0;

  for (const { start, end, text = '' } of appliedInOrder) {
    if (offset >= end) shift += text.length - Math.max(0, end - start);
    else if (offset > start) return start + shift + text.length;
    else break;
  }

  return offset + shift;
}

function appliedInOrder(edits: Edit[]): Edit[] {
  const applied: Edit[] = [];
  let appliedUntil = 0;

  for (const edit of [...edits].sort(
    (a, b) => a.start - b.start || a.end - b.end
  )) {
    if (edit.start < appliedUntil) continue;
    applied.push(edit);
    appliedUntil = edit.end;
  }

  return applied;
}

function expected(mappings: Mapping[], edits: Edit[]): Mapping[] {
  const applied = appliedInOrder(edits);

  return mappings.map((mapping) => {
    const generated = offsetAfterEach(mapping.generated, applied);
    const end = offsetAfterEach(mapping.generated + mapping.length, applied);
    const length = end - generated;
    if (length === mapping.length) return { ...mapping, generated };

    const sourceLength = mapping.sourceLength ?? mapping.length;
    return { ...mapping, generated, length, sourceLength };
  });
}

/** Deterministic: the same cases on every run. */
function random(seed: number): (below: number) => number {
  let state = seed;

  return (below) => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state % below;
  };
}

test('moves each mapping as the edits do, one by one', () => {
  const next = random(7);

  for (let round = 0; round < 300; round++) {
    const size = 50 + next(200);
    const code = 'x'.repeat(size);
    const edits: Edit[] = Array.from({ length: next(30) }, () => {
      const start = next(size);
      const end = Math.min(size, start + next(8));
      const text = next(3) === 0 ? undefined : 'y'.repeat(next(6));
      return { start, end, text };
    });
    // Mappings in no particular order, some at an edit's edges or inside one.
    const mappings: Mapping[] = Array.from({ length: next(40) }, () => {
      const generated = next(size);
      return { generated, source: next(size), length: next(size - generated) };
    });

    expect(applyEdits(code, mappings, edits).mappings).toEqual(
      expected(mappings, edits)
    );
  }
});

test('moves mappings past an edit that ends before it starts', () => {
  const edits: Edit[] = [
    { start: 2, end: 4, text: 'ab' },
    { start: 6, end: 3, text: 'cde' },
    { start: 6, end: 9 },
  ];
  const mappings: Mapping[] = [0, 3, 5, 6, 7, 9, 12].map((generated) => ({
    generated,
    source: generated,
    length: 2,
  }));

  expect(applyEdits('x'.repeat(20), mappings, edits).mappings).toEqual(
    expected(mappings, edits)
  );
});
