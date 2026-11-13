import fsp from 'node:fs/promises';

/** Files a process reads at once, at most: its threads share them. */
export const MAX_CONCURRENT_READS = 64;

/** The last read of each lane: a read starts when the one before it in its lane ends. */
let lanes = idleLanes(MAX_CONCURRENT_READS);
let nextLane = 0;

/** Has this thread read at most `count` files at once, e.g. a worker thread its share. Set before any read. */
export function limitConcurrentReads(count: number): void {
  lanes = idleLanes(Math.max(1, count));
  nextLane = 0;
}

/**
 * A file's text; undefined if it cannot be read. Node 24 and older keep a
 * file descriptor per pending read, so reading a project's files all at once
 * runs out of them.
 */
export function readTextFile(file: string): Promise<string | undefined> {
  const lane = nextLane;
  nextLane = (nextLane + 1) % lanes.length;

  const text = lanes[lane]!.then(() => fsp.readFile(file, 'utf8')).catch(
    () => undefined
  );
  lanes[lane] = text;

  return text;
}

function idleLanes(count: number): Promise<unknown>[] {
  return Array.from({ length: count }, () => Promise.resolve());
}
