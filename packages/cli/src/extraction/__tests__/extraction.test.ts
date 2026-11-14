import { describe, it, expect } from 'vitest';
import type { ExtractionResult } from '@generaltranslation/python-extractor';
import { mapExtractionResultsToUpdates } from '../mapToUpdates.js';
import {
  calculateHashes,
  dedupeUpdates,
  linkDeriveUpdates,
} from '../postProcess.js';
import type { Updates } from 'generaltranslation';
import { hashSource } from 'generaltranslation/id';

const update = (
  source: string,
  metadata: Updates[number]['metadata'] = {}
) => ({
  dataFormat: 'ICU' as const,
  source,
  metadata,
});

describe('mapExtractionResultsToUpdates', () => {
  it('maps every result, keeping the data format and the metadata it has', () => {
    const results: ExtractionResult[] = [
      {
        dataFormat: 'ICU',
        source: 'Hello, {name}!',
        metadata: {
          id: 'greeting',
          context: 'casual',
          maxChars: 100,
          filePaths: ['routes/index.py', 'routes/auth.py'],
          staticId: 'static-1',
        },
      },
      { dataFormat: 'JSX', source: '<p>Hello</p>', metadata: {} },
    ];

    expect(mapExtractionResultsToUpdates(results)).toStrictEqual(results);
    expect(mapExtractionResultsToUpdates([])).toEqual([]);
  });
});

describe('calculateHashes', () => {
  it('hashes the source and ignores a custom id', async () => {
    const updates: Updates = [
      update('hello'),
      update('hello', { id: 'custom' }),
      update('world'),
    ];

    await calculateHashes(updates);
    const [hello, helloWithId, world] = updates.map((u) => u.metadata.hash);

    expect(hello).toEqual(expect.any(String));
    expect(helloWithId).toBe(hello);
    expect(world).not.toBe(hello);
  });

  it('hashes MESSAGE_TREE sources with hashSource', async () => {
    const metadata = { context: 'button', maxChars: -12, requiresReview: true };
    const updates: Updates = [
      { dataFormat: 'MESSAGE_TREE', source: 'Save', metadata: { ...metadata } },
      update('Save', { ...metadata }),
    ];

    await calculateHashes(updates);

    // A plain-text tree is a string too; its format keeps its key apart.
    expect(updates[0].metadata.hash).not.toBe(updates[1].metadata.hash);
    expect(updates[0].metadata.hash).toBe(
      hashSource({
        source: 'Save',
        dataFormat: 'MESSAGE_TREE',
        context: 'button',
        maxChars: 12,
        requiresReview: true,
      })
    );
  });
});

describe('dedupeUpdates', () => {
  it('merges updates with the same hash and unions their file paths', () => {
    const updates: Updates = [
      update('hello', { hash: 'h1', filePaths: ['pathA'] }),
      update('no-hash'),
      update('hello', { hash: 'h1', filePaths: ['pathA', 'pathB'] }),
      update('world', { hash: 'h2', filePaths: ['pathC'] }),
      update('hello', { hash: 'h1', filePaths: ['pathD'] }),
    ];

    dedupeUpdates(updates);

    expect(updates).toHaveLength(3);
    expect(updates).toEqual(
      expect.arrayContaining([
        update('hello', { hash: 'h1', filePaths: ['pathA', 'pathB', 'pathD'] }),
        update('world', { hash: 'h2', filePaths: ['pathC'] }),
        update('no-hash'),
      ])
    );
  });
});

describe('linkDeriveUpdates', () => {
  it('replaces a temporary staticId with one shared by the group', () => {
    const updates: Updates = [
      update('variant-a', { hash: 'ha', staticId: 'temp-static' }),
      update('variant-b', { hash: 'hb', staticId: 'temp-static' }),
      update('no-static', { hash: 'h1' }),
    ];

    linkDeriveUpdates(updates);
    const [a, b, plain] = updates.map((u) => u.metadata.staticId);

    expect(a).toEqual(expect.any(String));
    expect(a).not.toBe('temp-static');
    expect(b).toBe(a);
    expect(plain).toBeUndefined();
  });
});
