import { describe, it, expect } from 'vitest';
import {
  calculateHashes,
  dedupeUpdates,
  linkStaticUpdates,
} from '../postProcess.js';
import type { Updates } from '../../types/index.js';

describe('calculateHashes', () => {
  it('generates consistent hashes for same input', async () => {
    const updates1: Updates = [
      { dataFormat: 'ICU', source: 'hello', metadata: {} },
    ];
    const updates2: Updates = [
      { dataFormat: 'ICU', source: 'hello', metadata: {} },
    ];

    await calculateHashes(updates1);
    await calculateHashes(updates2);

    expect(updates1[0].metadata.hash).toBeDefined();
    expect(updates1[0].metadata.hash).toBe(updates2[0].metadata.hash);
  });

  it('generates different hashes for different sources', async () => {
    const updates: Updates = [
      { dataFormat: 'ICU', source: 'hello', metadata: {} },
      { dataFormat: 'ICU', source: 'world', metadata: {} },
    ];

    await calculateHashes(updates);

    expect(updates[0].metadata.hash).not.toBe(updates[1].metadata.hash);
  });
});

describe('dedupeUpdates', () => {
  it('removes duplicates with same hash, merges filePaths', () => {
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
    ];

    dedupeUpdates(updates);

    expect(updates).toHaveLength(1);
    expect(updates[0].metadata.filePaths).toEqual(['pathA', 'pathB']);
  });

  it('keeps distinct entries with different hashes', () => {
    const updates: Updates = [
      {
        dataFormat: 'ICU',
        source: 'hello',
        metadata: { hash: 'h1', filePaths: ['pathA'] },
      },
      {
        dataFormat: 'ICU',
        source: 'world',
        metadata: { hash: 'h2', filePaths: ['pathB'] },
      },
    ];

    dedupeUpdates(updates);

    expect(updates).toHaveLength(2);
  });

  it('handles entries without hashes', () => {
    const updates: Updates = [
      { dataFormat: 'ICU', source: 'no-hash', metadata: {} },
      {
        dataFormat: 'ICU',
        source: 'has-hash',
        metadata: { hash: 'h1', filePaths: ['pathA'] },
      },
    ];

    dedupeUpdates(updates);

    expect(updates).toHaveLength(2);
  });
});

describe('linkStaticUpdates', () => {
  it('groups entries by temporary staticId and assigns shared hash', () => {
    const updates: Updates = [
      {
        dataFormat: 'ICU',
        source: 'variant-a',
        metadata: { hash: 'ha', staticId: 'temp-static' },
      },
      {
        dataFormat: 'ICU',
        source: 'variant-b',
        metadata: { hash: 'hb', staticId: 'temp-static' },
      },
    ];

    linkStaticUpdates(updates);

    // Both should now share the same staticId (derived from their hashes)
    expect(updates[0].metadata.staticId).toBe(updates[1].metadata.staticId);
    // The staticId should have been replaced (no longer the temporary value)
    expect(updates[0].metadata.staticId).not.toBe('temp-static');
  });

  it('does not modify entries without staticId', () => {
    const updates: Updates = [
      { dataFormat: 'ICU', source: 'no-static', metadata: { hash: 'h1' } },
    ];

    linkStaticUpdates(updates);

    expect(updates[0].metadata.staticId).toBeUndefined();
  });
});
