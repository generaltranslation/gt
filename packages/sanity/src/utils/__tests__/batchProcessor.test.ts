import { describe, expect, test } from 'vitest';
import { processBatch } from '../batchProcessor';

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
