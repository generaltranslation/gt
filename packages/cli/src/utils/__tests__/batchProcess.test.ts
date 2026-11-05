import { describe, it, expect } from 'vitest';
import { batchProcess } from '../batchProcess';

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('batchProcess', () => {
  it('never has more than batchSize items in flight', async () => {
    let active = 0;
    let peak = 0;

    const results = await batchProcess(
      Array.from({ length: 20 }, (_, i) => i),
      async (item) => {
        active++;
        peak = Math.max(peak, active);
        await tick();
        active--;
        return item * 2;
      },
      3
    );

    expect(peak).toBe(3);
    expect(results).toEqual(Array.from({ length: 20 }, (_, i) => i * 2));
  });

  it('returns results in input order when items finish out of order', async () => {
    const results = await batchProcess(
      [30, 10, 20],
      async (ms) => {
        await new Promise((resolve) => setTimeout(resolve, ms));
        return ms;
      },
      3
    );

    expect(results).toEqual([30, 10, 20]);
  });

  it('rejects when an item fails', async () => {
    await expect(
      batchProcess(
        [1, 2, 3],
        async (item) => {
          if (item === 2) throw new Error('boom');
          return item;
        },
        2
      )
    ).rejects.toThrow('boom');
  });

  it('returns an empty array for no items', async () => {
    await expect(batchProcess([], async () => 1)).resolves.toEqual([]);
  });
});
