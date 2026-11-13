import fsp from 'node:fs/promises';

const MAX_CONCURRENT_READS = 64;

/** The last read of each lane: a read starts when the one before it in its lane ends. */
const lanes: Promise<unknown>[] = Array.from(
  { length: MAX_CONCURRENT_READS },
  () => Promise.resolve()
);
let nextLane = 0;

/**
 * A file's text; undefined if it cannot be read. Node 24 and older keep a
 * file descriptor per pending read, so reading a project's files all at once
 * runs out of them.
 */
export function readTextFile(file: string): Promise<string | undefined> {
  const lane = nextLane;
  nextLane = (nextLane + 1) % MAX_CONCURRENT_READS;

  const text = lanes[lane]!.then(() => fsp.readFile(file, 'utf8')).catch(
    () => undefined
  );
  lanes[lane] = text;

  return text;
}
