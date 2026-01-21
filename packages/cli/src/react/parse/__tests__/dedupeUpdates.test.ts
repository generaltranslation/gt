import { describe, it, expect } from 'vitest';
import { _test_dedupeUpdates as dedupeUpdates } from '../createInlineUpdates.js';
import type { Updates } from '../../../types/index.js';

describe('dedupeUpdates', () => {
  it('coalesces filePaths for identical hashes', () => {
    const updates: Updates = [
      {
        dataFormat: 'ICU',
        source: 'hello',
        metadata: { hash: 'h1', filePaths: ['pathA'] },
      },
      {
        dataFormat: 'ICU',
        source: 'hello',
        metadata: { hash: 'h1', filePaths: ['pathB'] },
      },
      {
        dataFormat: 'ICU',
        source: 'world',
        metadata: { hash: 'h2', filePaths: ['pathC'] },
      },
    ];

    dedupeUpdates(updates);

    expect(updates).toHaveLength(2);
    const merged = updates.find((u) => u.metadata.hash === 'h1');
    expect(merged?.metadata.filePaths).toEqual(['pathA', 'pathB']);
  });

  it('dedupes file paths when merging', () => {
    const updates: Updates = [
      {
        dataFormat: 'ICU',
        source: 'hello',
        metadata: { hash: 'h1', filePaths: ['pathA'] },
      },
      {
        dataFormat: 'ICU',
        source: 'hello',
        metadata: { hash: 'h1', filePaths: ['pathA', 'pathB'] },
      },
    ];

    dedupeUpdates(updates);

    const merged = updates.find((u) => u.metadata.hash === 'h1');
    expect(merged?.metadata.filePaths).toEqual(['pathA', 'pathB']);
  });
});
