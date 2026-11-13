import { randomUUID } from 'node:crypto';
import fsp from 'node:fs/promises';
import type { FileUsages } from '../analysis/types.js';
import type { MessageFile } from '../inlang/message-file.js';
import { messageIds, type InlangProject } from '../inlang/project.js';
import { metadataPath, renderMetadataFile } from '../output/metadata.js';
import {
  sourceCodeByMessage,
  type SourceCodeByFile,
} from '../output/source-code.js';
import { jsonChunks, parseJsonBytes } from '../utils/json.js';
import { relativePath } from '../utils/paths.js';
import { compareText } from '../utils/sort.js';

/** A metadata file that was left as it is, and why. */
export type SkippedFile = { file: string; reason: string };

type SourceCodeByMessage = ReadonlyMap<string, SourceCodeByFile>;

/** What a metadata file that does not exist counts as, so that none is created for nothing. */
const NO_METADATA = Buffer.from('{}\n');

/** Bytes written at once. */
const WRITE_SIZE = 1024 * 1024;

/**
 * The metadata files of a project's messages: holds the usages of each
 * analyzed source file and writes them next to the message files. Writes are
 * atomic for readers.
 */
export class MetadataFiles {
  /** The source files with usages, by absolute path. */
  private readonly entries = new Map<string, FileUsages>();
  /** By absolute directory. */
  private readonly projects = new Map<string, InlangProject>();

  constructor(
    private readonly projectRoot: string,
    private readonly radius: number
  ) {}

  /** Each message file of `project` gets a metadata file. */
  addProject(project: InlangProject): void {
    this.projects.set(project.directory, project);
  }

  /** Records the usages of `file` (absolute). */
  add(file: string, usages: FileUsages): void {
    this.entries.set(file, usages);
  }

  /** Writes the files whose content changed. Resolves with those it had to skip. */
  async write(): Promise<SkippedFile[]> {
    const projects = [...this.projects.values()].sort((a, b) =>
      compareText(a.directory, b.directory)
    );
    const results = await Promise.all(
      projects.flatMap((project) => this.writeProject(project))
    );

    return results.filter((skipped) => skipped !== undefined);
  }

  /** One write per message file of the project. */
  private writeProject(
    project: InlangProject
  ): Promise<SkippedFile | undefined>[] {
    const sourceCode = sourceCodeByMessage([...this.entries.values()], {
      ids: messageIds(project),
      inlangProject: relativePath(this.projectRoot, project.directory),
      radius: this.radius,
    });

    return project.messageFiles.map((messageFile) =>
      writeMetadata(messageFile, sourceCode)
    );
  }
}

/** Writes the metadata file of a message file if its content changed. Returns the file if it was skipped. */
async function writeMetadata(
  messageFile: MessageFile,
  sourceCode: SourceCodeByMessage
): Promise<SkippedFile | undefined> {
  const file = metadataPath(messageFile.path);
  const current = await readMetadata(file);
  // Overwriting it could lose hand-written fields.
  if ('unreadable' in current) {
    return { file, reason: `it could not be read (${current.unreadable})` };
  }

  // Only the hand-written fields of the current file are kept.
  const existing = parseJsonBytes(current.content, 'sourceCode');
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

  await writeAtomically(file, content());

  return undefined;
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
function* batched(chunks: Iterable<string>, end: string): Generator<Buffer> {
  let pending: Buffer[] = [];
  let size = 0;

  for (const chunk of chunks) {
    const bytes = Buffer.from(chunk);
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

async function writeAtomically(
  file: string,
  chunks: Iterable<Buffer>
): Promise<void> {
  // A unique name: other processes may write the same file.
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;

  try {
    const handle = await fsp.open(temporary, 'w');
    try {
      for (const chunk of chunks) await handle.write(chunk);
    } finally {
      await handle.close();
    }
    await fsp.rename(temporary, file);
  } catch (error) {
    // The failed write is what is reported, not a failed cleanup.
    await fsp.rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}
