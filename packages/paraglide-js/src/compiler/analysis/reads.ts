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
export function replay(reads: Reads | undefined): void {
  const frame = frames.at(-1);
  if (!frame || !reads) return;

  merge(frame, reads);
}

/**
 * Runs `compute` in a frame of its own, and returns what it read, which the
 * enclosing frame records too. Outside any frame nothing is recorded.
 */
export function tracked<T>(compute: () => T): { value: T; reads: Reads } {
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

/** As a structured clone or JSON carries them: from another thread, or to a later run. */
export type ReadList = {
  files: string[];
  importers: string[];
  mentions: string[];
};

export function toReadList(reads: Reads): ReadList {
  return {
    files: [...reads.files],
    importers: [...reads.importers],
    mentions: [...reads.mentions],
  };
}

export function fromReadList(list: ReadList): Reads {
  return {
    files: new Set(list.files),
    importers: new Set(list.importers),
    mentions: new Set(list.mentions),
  };
}

function merge(into: Reads, reads: Reads): void {
  for (const file of reads.files) into.files.add(file);
  for (const file of reads.importers) into.importers.add(file);
  for (const name of reads.mentions) into.mentions.add(name);
}
