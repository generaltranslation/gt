import type { FileUsages, ParaglideUsage } from '../analysis/types.js';
import { matchingIds } from '../paraglide/catalog.js';
import { StreamedJson } from '../utils/json.js';
import { readSpilled, SpillFile } from '../utils/spill-file.js';
import { compareText } from '../utils/sort.js';

/**
 * The lines of a source file around a usage, in the gt CLI's format. The CLI
 * has the same type; this package keeps its own so that it depends on no
 * workspace package.
 */
export type SourceCode = { before: string; target: string; after: string };

/** A message's snippets, by project-relative source file: what the gt CLI reads as `sourceCode`. */
export type SourceCodeByFile = Record<string, SourceCode[]>;

export type SourceCodeOptions = {
  /** The messages snippets are collected for. */
  ids: ReadonlySet<string>;
  /** Only usages of this project count; compared with `ParaglideUsage.inlangProject`. */
  inlangProject: string;
  /** Lines of context above and below each usage. */
  radius: number;
};

/** For each message that is used, the source code around its usages. */
export function sourceCodeByMessage(
  sourceFiles: readonly FileUsages[],
  options: SourceCodeOptions
): Map<string, SourceCodeByFile> {
  const collector = new SourceCodeCollector(options);
  for (const sourceFile of sourceFiles) collector.add(sourceFile);

  return collector.byMessage();
}

/** Where a snippet is in a metadata file whose message keys are not nested: the indentation it is kept with. */
const SNIPPET_INDENT = ' '.repeat(8);

/** Bytes of snippets kept in memory, at most: those before are in a temporary file. */
const BLOCK_SIZE = 16 * 1024 * 1024;

/**
 * Collects the source code around usages one source file at a time: a file's
 * code is not held once it is added. Each file is added once. The snippets
 * are kept as JSON in a temporary file: a large project's take as much as
 * its metadata files, gigabytes. `close()` deletes it.
 */
export class SourceCodeCollector {
  /** Snippet numbers in `store`, by message id, then by project-relative file. */
  private readonly snippets = new Map<string, Map<string, number[]>>();
  private readonly store = new SnippetStore();

  constructor(private readonly options: SourceCodeOptions) {}

  add({ file, code, usages }: FileUsages): void {
    const { ids, inlangProject, radius } = this.options;
    const ofProject = usages
      .filter((usage) => usage.inlangProject === inlangProject)
      .sort((a, b) => a.start - b.start || a.end - b.end);
    if (ofProject.length === 0) return;

    const lines = code.split(/\r?\n/);

    for (const usage of ofProject) {
      const named = namedMessages(usage, ids);
      if (named.length === 0) continue;

      const snippet = snippetJson(sourceSnippet(lines, usage, radius));
      let stored: number | undefined;

      for (const id of named) {
        const snippets = this.snippetsOf(id, file);

        // Usages on the same lines, e.g. `a ? m.x() : m.x()`.
        const isRepeated = snippets.some((other) =>
          this.store.equals(other, snippet)
        );
        if (isRepeated) continue;

        stored ??= this.store.add(snippet);
        snippets.push(stored);
      }
    }
  }

  /** For each message that is used, its snippets by file, in an order that does not depend on the analysis. */
  byMessage(): Map<string, SourceCodeByFile> {
    const byMessage = new Map<string, SourceCodeByFile>();

    for (const [id, byFile] of this.snippets) {
      const sourceCode: SourceCodeByFile = {};

      for (const file of sortedFiles(byFile)) {
        sourceCode[file] = byFile
          .get(file)!
          .map((snippet) => JSON.parse(this.store.text(snippet)) as SourceCode);
      }
      byMessage.set(id, sourceCode);
    }

    return byMessage;
  }

  /** Deletes the kept snippets, once written. */
  close(): void {
    this.store.close();
  }

  /** As `byMessage`, each message's written as JSON from the kept snippets. */
  streamedByMessage(): Map<string, StreamedJson> {
    const byMessage = new Map<string, StreamedJson>();

    for (const [id, byFile] of this.snippets) {
      byMessage.set(
        id,
        new StreamedJson((indent) => this.sourceCodeChunks(byFile, indent))
      );
    }

    return byMessage;
  }

  private *sourceCodeChunks(
    byFile: ReadonlyMap<string, readonly number[]>,
    indent: string
  ): Generator<string | Buffer> {
    const inner = `${indent}  `;
    const item = `${inner}  `;
    let isFirstFile = true;

    for (const file of sortedFiles(byFile)) {
      yield `${isFirstFile ? '{' : ','}\n${inner}${JSON.stringify(file)}: [`;
      isFirstFile = false;

      for (const [index, snippet] of byFile.get(file)!.entries()) {
        yield `${index === 0 ? '' : ','}\n${item}`;
        yield this.store.indented(snippet, item);
      }

      yield `\n${inner}]`;
    }

    yield `\n${indent}}`;
  }

  private snippetsOf(id: string, file: string): number[] {
    let byFile = this.snippets.get(id);

    if (!byFile) {
      byFile = new Map();
      this.snippets.set(id, byFile);
    }

    let snippets = byFile.get(file);

    if (!snippets) {
      snippets = [];
      byFile.set(file, snippets);
    }

    return snippets;
  }
}

/**
 * Snippets' JSON, outside the JavaScript heap: the block being filled in
 * memory, the full ones in a temporary file, created once one is full.
 */
export class SnippetStore {
  private block: Buffer;
  private used = 0;
  /** Where the block starts among every snippet's bytes: those before it are in the file. */
  private blockStart = 0;
  private spill: SpillFile | undefined;
  /** Of each snippet: where its bytes start, and how many there are. */
  private starts = new Float64Array(1024);
  private lengths = new Uint32Array(1024);
  private count = 0;

  constructor(private readonly blockSize = BLOCK_SIZE) {
    this.block = Buffer.allocUnsafe(blockSize);
  }

  add(json: Buffer): number {
    if (this.used + json.length > this.block.length) this.flush();
    if (json.length > this.block.length) {
      this.block = Buffer.allocUnsafe(json.length);
    }

    json.copy(this.block, this.used);
    this.record(this.blockStart + this.used, json.length);
    this.used += json.length;

    return this.count - 1;
  }

  bytes(snippet: number): Buffer {
    const start = this.starts[snippet]!;
    const length = this.lengths[snippet]!;
    if (start >= this.blockStart) {
      const offset = start - this.blockStart;
      return this.block.subarray(offset, offset + length);
    }

    // Snippets are read in the metadata's order, by message: those read one
    // after the other are rarely near each other in the file.
    return readSpilled(this.spill!.fd, start, length);
  }

  equals(snippet: number, json: Buffer): boolean {
    return this.bytes(snippet).equals(json);
  }

  text(snippet: number): string {
    return this.bytes(snippet).toString('utf8');
  }

  /** The snippet's JSON at `indent`. */
  indented(snippet: number, indent: string): Buffer {
    const bytes = this.bytes(snippet);
    if (indent === SNIPPET_INDENT) return bytes;

    const text = bytes
      .toString('utf8')
      .replaceAll(`\n${SNIPPET_INDENT}`, `\n${indent}`);
    return Buffer.from(text);
  }

  close(): void {
    this.spill?.close();
    this.spill = undefined;
  }

  private flush(): void {
    if (this.used === 0) return;

    this.spill ??= new SpillFile();
    this.spill.append(this.block.subarray(0, this.used));
    this.blockStart += this.used;
    this.used = 0;
    this.block = Buffer.allocUnsafe(this.blockSize);
  }

  private record(start: number, length: number): void {
    if (this.count === this.starts.length) {
      const starts = new Float64Array(this.count * 2);
      starts.set(this.starts);
      this.starts = starts;

      const lengths = new Uint32Array(this.count * 2);
      lengths.set(this.lengths);
      this.lengths = lengths;
    }

    this.starts[this.count] = start;
    this.lengths[this.count] = length;
    this.count++;
  }
}

/** `JSON.stringify(snippet, null, 2)`, indented as `SNIPPET_INDENT`. Newlines in JSON are between tokens, never inside a string. */
function snippetJson(snippet: SourceCode): Buffer {
  const json = JSON.stringify(snippet, null, 2);

  return Buffer.from(json.replaceAll('\n', `\n${SNIPPET_INDENT}`));
}

function sortedFiles(byFile: ReadonlyMap<string, unknown>): string[] {
  return [...byFile.keys()].sort(compareText);
}

/** `radius` of the file's `lines` around a usage, and the usage's own lines. */
export function sourceSnippet(
  lines: readonly string[],
  usage: Pick<ParaglideUsage, 'line' | 'endLine'>,
  radius: number
): SourceCode {
  const start = usage.line - 1;
  const end = usage.endLine;

  return {
    before: lines.slice(Math.max(0, start - radius), start).join('\n'),
    target: lines.slice(start, end).join('\n'),
    after: lines.slice(end, end + radius).join('\n'),
  };
}

/** The messages a usage names: its own, or every match of a dynamic name like `error_*`. */
function namedMessages(
  usage: ParaglideUsage,
  ids: ReadonlySet<string>
): readonly string[] {
  if (!usage.dynamic) return ids.has(usage.name) ? [usage.name] : [];

  // `m[key]` says nothing about any one message.
  const isAnyMessage = usage.name.replaceAll('*', '') === '';
  if (isAnyMessage) return [];

  return matchingIds(usage.name, ids);
}
