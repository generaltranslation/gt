import assert from 'node:assert/strict';
import { describe, test, vi } from 'vitest';
import { processBatch } from '../batchProcessor';

vi.mock('../../adapter/core', () => ({ pluginConfig: {} }));
vi.mock('../../translation/importDocument', () => ({
  importDocument: () => {
    throw new Error('Unexpected document import in batch validation test');
  },
}));

describe('processBatch batch-size validation', () => {
  const invalidSizes = [
    0,
    -1,
    0.5,
    NaN,
    Infinity,
    -Infinity,
    Number.MAX_SAFE_INTEGER + 1,
  ];

  for (const batchSize of invalidSizes) {
    for (const items of [[], ['first', 'second']]) {
      test(`rejects ${String(batchSize)} before callbacks for ${items.length} items`, async () => {
        let calls = 0;
        let progress = 0;
        let successes = 0;
        let failures = 0;
        await assert.rejects(
          processBatch(
            items,
            async () => {
              calls++;
              return 'done';
            },
            {
              batchSize,
              onProgress: () => {
                progress++;
                // A sentinel stops a non-advancing loop without a timing race.
                throw new Error('Invalid batch size reached progress');
              },
              onItemSuccess: () => {
                successes++;
              },
              onItemFailure: () => {
                failures++;
              },
            }
          ),
          {
            name: 'RangeError',
            message:
              'gt-sanity Error: Cannot process the batch because batchSize must be a positive safe integer. Set batchSize to a positive safe integer.',
          }
        );
        assert.equal(calls, 0);
        assert.equal(progress, 0);
        assert.equal(successes, 0);
        assert.equal(failures, 0);
      });
    }
  }

  for (const batchSize of [undefined, 1, 2, 20, Number.MAX_SAFE_INTEGER]) {
    test(`processes every item exactly once with batch size ${String(batchSize)}`, async () => {
      const visited: number[] = [];
      const progress: number[] = [];
      const result = await processBatch(
        [0, 1, 2, 3, 4],
        async (item) => {
          visited.push(item);
          return item * 2;
        },
        {
          batchSize,
          onProgress: (current) => {
            progress.push(current);
          },
        }
      );
      assert.deepEqual(visited, [0, 1, 2, 3, 4]);
      assert.deepEqual(result, {
        successCount: 5,
        failureCount: 0,
        successfulItems: [0, 2, 4, 6, 8],
        failedItems: [],
      });
      assert.equal(progress.at(-1), 5);
    });
  }

  test('retains per-item failure accounting for valid batches', async () => {
    const error = new Error('processor failure');
    const result = await processBatch(
      [0, 1, 2],
      (item) => {
        if (item === 1) throw error;
        return item;
      },
      { batchSize: 2 }
    );
    assert.deepEqual(result, {
      successCount: 2,
      failureCount: 1,
      successfulItems: [0, 2],
      failedItems: [{ item: 1, error }],
    });
  });

  test('retains per-key serialization within a valid batch', async () => {
    let active = 0;
    let maximum = 0;
    await processBatch(
      [1, 2, 3],
      async () => {
        active++;
        maximum = Math.max(maximum, active);
        await Promise.resolve();
        active--;
      },
      { batchSize: 3, getConcurrencyKey: () => 'document' }
    );
    assert.equal(maximum, 1);
  });
});
