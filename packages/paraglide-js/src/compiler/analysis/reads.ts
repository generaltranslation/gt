/**
 * What a file's analysis read of the project, recorded so that a later run
 * can reuse what it found while none of it changed: see the collector's
 * `UsageCache`.
 *
 * Reading a module, its summary in the index, who imports a module, or which
 * modules mention an auto-imported name is recorded in the current frame. A
 * value an analysis keeps for later files keeps what computing it read, and
 * a later file that uses the value records that too: what each file found
 * depends only on what it recorded.
 */

export type Reads = {
  /** Absolute: modules read, or their summaries. */
  files: Set<string>;
  /** Absolute: modules whose importers were looked up. */
  importers: Set<string>;
  /** Auto-imported names whose mentions were looked up. */
  mentions: Set<string>;
};

const frames: Reads[] = [];

/** Runs going on that keep a cache: reads are recorded only during one. */
let trackingRuns = 0;

/**
 * Records reads until the returned function is called: only a run that keeps
 * a `UsageCache` needs them. A run without one that overlaps it records them
 * too, which costs work, never a wrong result.
 */
export function trackReads(): () => void {
  trackingRuns++;
  let isStopped = false;

  return () => {
    if (isStopped) return;
    isStopped = true;
    trackingRuns--;
  };
}

export function emptyReads(): Reads {
  return { files: new Set(), importers: new Set(), mentions: new Set() };
}

export function readFile(file: string): void {
  frames.at(-1)?.files.add(file);
}

export function readImporters(file: string): void {
  frames.at(-1)?.importers.add(file);
}

export function readMentions(names: Iterable<string>): void {
  const frame = frames.at(-1);
  if (!frame) return;

  for (const name of names) frame.mentions.add(name);
}

/** Records `reads` in the current frame: what a kept value was computed from. */
export function replay(reads: Reads): void {
  const frame = frames.at(-1);
  if (!frame) return;

  mergeReads(frame, reads);
}

/**
 * Runs `compute` in a frame of its own, and returns what it read, which the
 * enclosing frame records too. Outside any frame, or while no run tracks
 * reads (see `trackReads`), nothing is recorded.
 */
export function tracked<T>(compute: () => T): { value: T; reads: Reads } {
  if (trackingRuns === 0) return { value: compute(), reads: emptyReads() };

  const frame = emptyReads();
  frames.push(frame);

  let value: T;
  try {
    value = compute();
  } finally {
    frames.pop();
    replay(frame);
  }

  return { value, reads: frame };
}

/** A cache whose values keep what computing them read: see `tracked`. */
export class TrackedCache<K extends object, V> {
  private readonly values = new WeakMap<K, { value: V; reads: Reads }>();

  get(key: K): V | undefined {
    const entry = this.values.get(key);
    if (!entry) return undefined;

    replay(entry.reads);
    return entry.value;
  }

  set(key: K, value: V, reads: Reads): void {
    this.values.set(key, { value, reads });
  }
}

/** Adds `reads` to `into`. */
export function mergeReads(into: Reads, reads: Reads): void {
  for (const file of reads.files) into.files.add(file);
  for (const file of reads.importers) into.importers.add(file);
  for (const name of reads.mentions) into.mentions.add(name);
}
