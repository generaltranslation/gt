import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Bytes kept in a temporary file instead of memory, read back by position.
 * The file is deleted as soon as it is open, so that nothing is left behind
 * if the process ends early; it lives on until it is closed. Its descriptor
 * is the process's, so worker threads read it too: see `readSpilled`.
 */
export class SpillFile {
  readonly fd: number;
  private size = 0;
  /** The directory to delete on close, where an open file cannot be deleted. */
  private readonly leftover: string | undefined;

  constructor() {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'paraglide-context-')
    );
    const file = path.join(directory, 'spill');
    this.fd = fs.openSync(file, 'w+');

    try {
      fs.unlinkSync(file);
      fs.rmdirSync(directory);
    } catch {
      this.leftover = directory;
    }
  }

  /** Writes `bytes` at the end of the file; returns where they start. */
  append(bytes: Uint8Array): number {
    const position = this.size;
    let written = 0;

    while (written < bytes.length) {
      written += fs.writeSync(
        this.fd,
        bytes,
        written,
        bytes.length - written,
        position + written
      );
    }
    this.size += bytes.length;

    return position;
  }

  close(): void {
    fs.closeSync(this.fd);
    if (this.leftover) {
      fs.rmSync(this.leftover, { recursive: true, force: true });
    }
  }
}

/** `length` bytes of a `SpillFile`, from `position`; `fd` is its descriptor. */
export function readSpilled(
  fd: number,
  position: number,
  length: number
): Buffer {
  const bytes = Buffer.allocUnsafe(length);
  let read = 0;

  while (read < length) {
    const count = fs.readSync(fd, bytes, read, length - read, position + read);
    if (count === 0) throw new Error('a spilled file ended early');
    read += count;
  }

  return bytes;
}

/** Where bytes are in a `SpillFile`: their position, and how many. */
export type SpilledPlace = readonly [position: number, length: number];

/** What another thread reads `SpilledBytes` with: see `spilledReader`. */
export type SharedSpill = {
  /** -1 when no bytes were added. */
  fd: number;
  places: ReadonlyArray<readonly [key: string, place: SpilledPlace]>;
};

/** Bytes by key, in a `SpillFile` made when the first are added. */
export class SpilledBytes {
  private file: SpillFile | undefined;
  private readonly places = new Map<string, SpilledPlace>();

  set(key: string, bytes: Uint8Array): void {
    this.file ??= new SpillFile();
    this.places.set(key, [this.file.append(bytes), bytes.length]);
  }

  get(key: string): Buffer | undefined {
    const place = this.places.get(key);
    return place && readSpilled(this.file!.fd, ...place);
  }

  shared(): SharedSpill {
    return { fd: this.file?.fd ?? -1, places: [...this.places] };
  }

  close(): void {
    this.file?.close();
    this.file = undefined;
    this.places.clear();
  }
}

/** Reads, in any thread of the process, the bytes `shared` describes, until they are closed. */
export function spilledReader({
  fd,
  places,
}: SharedSpill): (key: string) => Buffer | undefined {
  const byKey = new Map(places);

  return (key) => {
    const place = byKey.get(key);
    return place && readSpilled(fd, ...place);
  };
}
