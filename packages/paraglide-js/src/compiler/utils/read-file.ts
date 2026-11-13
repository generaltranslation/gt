import fsp from 'node:fs/promises';

/** Files a process reads at once, at most: its threads share them. */
export const MAX_CONCURRENT_READS = 64;

let maxReads = MAX_CONCURRENT_READS;
let reading = 0;
/** Reads waiting for one to end, in two stacks: Array#shift copies a long array. */
let waiting: (() => void)[] = [];
let nextUp: (() => void)[] = [];

/** Has this thread read at most `count` files at once, e.g. a worker thread its share. Set before any read. */
export function limitConcurrentReads(count: number): void {
  maxReads = Math.max(1, count);
}

/**
 * A file's text; undefined if it cannot be read. Node 24 and older keep a
 * file descriptor per pending read, so reading a project's files all at once
 * runs out of them.
 */
export async function readTextFile(file: string): Promise<string | undefined> {
  if (reading < maxReads) reading++;
  else await new Promise<void>((start) => waiting.push(start));

  try {
    return await fsp.readFile(file, 'utf8');
  } catch {
    return undefined;
  } finally {
    endRead();
  }
}

/** Gives the place of a read that ended to the oldest waiting one, if any. */
function endRead(): void {
  if (nextUp.length === 0) {
    nextUp = waiting.reverse();
    waiting = [];
  }

  const start = nextUp.pop();
  if (start) start();
  else reading--;
}
