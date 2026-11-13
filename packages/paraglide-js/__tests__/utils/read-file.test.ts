import { beforeEach, describe, expect, test, vi } from 'vitest';
import { readTextFile } from '../../src/compiler/utils/read-file.js';

/** Reads that were started and have not ended, by file. */
const pending = new Map<string, (text: string | Error) => void>();
let mostAtOnce = 0;

vi.mock('node:fs/promises', () => ({
  default: {
    readFile: (file: string) =>
      new Promise<string>((resolve, reject) => {
        pending.set(file, (text) => {
          pending.delete(file);
          if (text instanceof Error) reject(text);
          else resolve(text);
        });
        mostAtOnce = Math.max(mostAtOnce, pending.size);
      }),
  },
}));

/** Ends the reads as they start, until `texts` has them all. */
async function endReads<T>(texts: Promise<T>): Promise<T> {
  let isDone = false;
  void texts.finally(() => (isDone = true));

  while (!isDone) {
    for (const [file, end] of pending) {
      end(file.endsWith('missing') ? new Error('ENOENT') : `text of ${file}`);
    }
    await new Promise((resolve) => setImmediate(resolve));
  }

  return texts;
}

beforeEach(() => {
  mostAtOnce = 0;
});

describe('readTextFile', () => {
  test('reads many files with a bounded number of reads at once', async () => {
    const files = Array.from({ length: 1000 }, (_, index) => `/app/${index}`);

    const texts = await endReads(Promise.all(files.map(readTextFile)));

    expect(texts).toEqual(files.map((file) => `text of ${file}`));
    expect(mostAtOnce).toBeGreaterThan(1);
    expect(mostAtOnce).toBeLessThanOrEqual(64);
  });

  test('gives undefined for a file that cannot be read, and reads the ones after it', async () => {
    const files = Array.from({ length: 200 }, (_, index) =>
      index % 3 === 0 ? `/app/${index}/missing` : `/app/${index}`
    );

    const texts = await endReads(Promise.all(files.map(readTextFile)));

    expect(texts).toEqual(
      files.map((file) =>
        file.endsWith('missing') ? undefined : `text of ${file}`
      )
    );
  });
});
