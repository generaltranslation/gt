import fsp from 'node:fs/promises';
import type { FileUsages } from '../analysis/types.js';
import type { MessageFile } from '../inlang/message-file.js';
import { messageIds, type InlangProject } from '../inlang/project.js';
import { metadataPath, renderMetadataFile } from '../output/metadata.js';
import { SourceCodeCollector } from '../output/source-code.js';
import {
  jsonChunks,
  parseJsonBytes,
  type StreamedJson,
} from '../utils/json.js';
import { relativePath } from '../utils/paths.js';
import { compareText } from '../utils/sort.js';
import { writeFileAtomically } from '../utils/write-file.js';

/** A metadata file that was left as it is, and why. */
export type SkippedFile = { file: string; reason: string };

type SourceCodeByMessage = ReadonlyMap<string, StreamedJson>;

/** What a metadata file that does not exist counts as, so that none is created for nothing. */
const NO_METADATA = Buffer.from('{}\n');

/** Bytes written at once. */
const WRITE_SIZE = 1024 * 1024;

/**
 * The metadata files of a project's messages: holds the source code around
 * the usages of each analyzed source file and writes it next to the message
 * files. Writes are atomic for readers.
 */
export class MetadataFiles {
  /** By absolute directory. */
  private readonly projects = new Map<string, InlangProject>();
  /** The snippets of each project's messages, by absolute directory. */
  private readonly snippets = new Map<string, SourceCodeCollector>();

  constructor(
    private readonly projectRoot: string,
    private readonly radius: number,
    /** Bytes of a metadata file parsed at once: see `parseJsonBytes`. */
    private readonly maxParsedBytes?: number,
    /** Bytes of snippets kept in memory: see `SnippetStore`. */
    private readonly snippetBlockSize?: number
  ) {}

  /** Each message file of `project` gets a metadata file. Projects are added before any usages. */
  addProject(project: InlangProject): void {
    this.projects.set(project.directory, project);
    if (this.snippets.has(project.directory)) return;

    this.snippets.set(
      project.directory,
      new SourceCodeCollector({
        ids: messageIds(project),
        inlangProject: relativePath(this.projectRoot, project.directory),
        radius: this.radius,
        blockSize: this.snippetBlockSize,
      })
    );
  }

  /** Records the source code around the usages of a source file; its code is not held. */
  add(usages: FileUsages): void {
    for (const snippets of this.snippets.values()) snippets.add(usages);
  }

  /**
   * Writes the files whose content changed. Resolves with those it had to
   * skip; if a write fails, rejects with the first failure once every write
   * is done, so that the snippets can be closed.
   */
  async write(): Promise<SkippedFile[]> {
    const projects = [...this.projects.values()].sort((a, b) =>
      compareText(a.directory, b.directory)
    );
    const results = await Promise.allSettled(
      projects.flatMap((project) => this.writeProject(project))
    );

    const skipped: SkippedFile[] = [];
    for (const result of results) {
      if (result.status === 'rejected') throw result.reason;
      if (result.value) skipped.push(result.value);
    }

    return skipped;
  }

  /** Deletes the snippets kept for writing: see `SourceCodeCollector`. */
  close(): void {
    for (const snippets of this.snippets.values()) snippets.close();
  }

  /** One write per message file of the project. */
  private writeProject(
    project: InlangProject
  ): Promise<SkippedFile | undefined>[] {
    const sourceCode = this.snippets
      .get(project.directory)!
      .streamedByMessage();

    return project.messageFiles.map((messageFile) =>
      writeMetadata(messageFile, sourceCode, this.maxParsedBytes)
    );
  }
}

/** Writes the metadata file of a message file if its content changed. Returns the file if it was skipped. */
async function writeMetadata(
  messageFile: MessageFile,
  sourceCode: SourceCodeByMessage,
  maxParsedBytes: number | undefined
): Promise<SkippedFile | undefined> {
  const file = metadataPath(messageFile.path);
  const current = await readMetadata(file);
  // Overwriting it could lose hand-written fields.
  if ('unreadable' in current) {
    return { file, reason: `it could not be read (${current.unreadable})` };
  }

  // Only the hand-written fields of the current file are kept.
  const existing = parseJsonBytes(
    current.content,
    isSourceCodeOf(messageFile),
    maxParsedBytes
  );
  if (!existing) {
    return { file, reason: 'it is not a JSON object; fix or delete it' };
  }

  const metadata = renderMetadataFile({
    keys: messageFile.keys,
    sourceCode,
    existing,
  });
  // A large project's JSON is longer than the longest string V8 holds.
  const content = () => batched(jsonChunks(metadata), '\n');
  if (isSameContent(content(), current.content)) return undefined;

  await writeFileAtomically(file, content());

  return undefined;
}

/**
 * Whether a key path of a metadata file is the `sourceCode` of a message of
 * `messageFile`, which is written again. A message or a group can itself be
 * named `sourceCode`.
 */
function isSourceCodeOf(
  messageFile: MessageFile
): (keyPath: readonly string[]) => boolean {
  const messages = new Set(
    messageFile.keys.map(({ path }) => JSON.stringify(path))
  );

  return (keyPath) =>
    keyPath.at(-1) === 'sourceCode' &&
    messages.has(JSON.stringify(keyPath.slice(0, -1)));
}

/** Only a file that does not exist counts as empty: one that cannot be read may hold hand-written fields. */
async function readMetadata(
  file: string
): Promise<{ content: Buffer } | { unreadable: string }> {
  try {
    return { content: await readBytes(file) };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return { content: NO_METADATA };

    return { unreadable: code ?? (error as Error).message };
  }
}

/** A file's bytes, read in pieces: `readFile` refuses files of 2 GB and more. */
async function readBytes(file: string): Promise<Buffer> {
  const handle = await fsp.open(file, 'r');

  try {
    const { size } = await handle.stat();
    const bytes = Buffer.allocUnsafe(size);
    let read = 0;

    while (read < size) {
      const length = Math.min(WRITE_SIZE * 64, size - read);
      const { bytesRead } = await handle.read(bytes, read, length, read);
      if (bytesRead === 0) break;
      read += bytesRead;
    }

    return bytes.subarray(0, read);
  } finally {
    await handle.close();
  }
}

/** `chunks`, then `end`, joined into pieces of about `WRITE_SIZE` bytes. */
function* batched(
  chunks: Iterable<string | Buffer>,
  end: string
): Generator<Buffer> {
  let pending: Buffer[] = [];
  let size = 0;

  for (const chunk of chunks) {
    const bytes = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    pending.push(bytes);
    size += bytes.length;
    if (size < WRITE_SIZE) continue;

    yield Buffer.concat(pending, size);
    pending = [];
    size = 0;
  }

  pending.push(Buffer.from(end));
  yield Buffer.concat(pending);
}

function isSameContent(chunks: Iterable<Buffer>, current: Buffer): boolean {
  let offset = 0;

  for (const bytes of chunks) {
    const end = offset + bytes.length;
    if (end > current.length || !bytes.equals(current.subarray(offset, end))) {
      return false;
    }

    offset = end;
  }

  return offset === current.length;
}
