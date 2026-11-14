import { expect, test } from 'vitest';
import { SnippetStore } from '../../src/compiler/output/source-code.js';

const json = (index: number) =>
  Buffer.from(
    JSON.stringify(
      { before: `line ${index}`, target: 'x'.repeat(index % 50), after: '' },
      null,
      2
    ).replaceAll('\n', `\n${' '.repeat(8)}`)
  );

test('reads back every snippet, those in its temporary file too, in any order', () => {
  // Blocks of 64 bytes: most snippets are in the file, one per block or so.
  const store = new SnippetStore(64);
  const snippets = Array.from({ length: 300 }, (_, index) => ({
    index,
    id: store.add(json(index)),
  }));

  try {
    for (const { index, id } of snippets) {
      expect(store.text(id)).toBe(json(index).toString());
    }
    for (const { index, id } of [...snippets].reverse()) {
      expect(store.equals(id, json(index))).toBe(true);
      expect(store.equals(id, json(index + 1))).toBe(false);
    }
  } finally {
    store.close();
  }
});

test('keeps a snippet larger than a block, and indents one read back from the file', () => {
  const store = new SnippetStore(64);
  const large = Buffer.from(
    JSON.stringify({ before: 'a'.repeat(500), target: 'b', after: '' }, null, 2)
  );
  const first = store.add(json(1));
  const big = store.add(large);
  store.add(json(2));

  try {
    expect(store.bytes(big).equals(large)).toBe(true);
    expect(store.indented(first, ' '.repeat(4)).toString()).toBe(
      json(1)
        .toString()
        .replaceAll(`\n${' '.repeat(8)}`, `\n${' '.repeat(4)}`)
    );
  } finally {
    store.close();
  }
});
