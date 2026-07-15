import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  ImportBatchItem,
  processBatch,
  processImportBatch,
} from '../batchProcessor';
import { pluginConfig } from '../../adapter/core';

const importCounters = vi.hoisted(() => ({ active: 0, maxActive: 0 }));

vi.mock('../../translation/importDocument', () => ({
  importDocument: vi.fn(async () => {
    importCounters.active++;
    importCounters.maxActive = Math.max(
      importCounters.maxActive,
      importCounters.active
    );
    await new Promise((resolve) => setTimeout(resolve, 1));
    importCounters.active--;
  }),
}));

describe('processBatch', () => {
  test('serializes items with the same concurrency key', async () => {
    let activeForKey = 0;
    let maxActiveForKey = 0;

    await processBatch(
      ['first', 'second', 'third'],
      async () => {
        activeForKey++;
        maxActiveForKey = Math.max(maxActiveForKey, activeForKey);
        await new Promise((resolve) => setTimeout(resolve, 1));
        activeForKey--;
      },
      {
        getConcurrencyKey: () => 'article-1:es',
      }
    );

    expect(maxActiveForKey).toBe(1);
  });

  test('keeps unrelated concurrency keys parallel', async () => {
    let active = 0;
    let maxActive = 0;

    await processBatch(
      ['article-1', 'article-2'],
      async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 1));
        active--;
      },
      {
        getConcurrencyKey: (item) => item,
      }
    );

    expect(maxActive).toBe(2);
  });
});

describe('processImportBatch', () => {
  const originalLevel = pluginConfig.translationLevel;

  afterEach(() => {
    pluginConfig.translationLevel = originalLevel;
    importCounters.active = 0;
    importCounters.maxActive = 0;
  });

  const makeItem = (documentId: string, locale: string): ImportBatchItem => ({
    docInfo: { documentId, versionId: 'rev-1' },
    locale,
    data: '',
    translationContext: {} as ImportBatchItem['translationContext'],
    key: `${documentId}:${locale}`,
  });

  test('imports locales of the same document in parallel at document level', async () => {
    pluginConfig.translationLevel = 'document';

    await processImportBatch([
      makeItem('article-1', 'es'),
      makeItem('article-1', 'fr'),
    ]);

    expect(importCounters.maxActive).toBe(2);
  });

  test('serializes locales of the same document for in-place strategies', async () => {
    pluginConfig.translationLevel = 'internationalizedArray';

    await processImportBatch([
      makeItem('article-1', 'es'),
      makeItem('article-1', 'fr'),
    ]);

    expect(importCounters.maxActive).toBe(1);
  });
});
