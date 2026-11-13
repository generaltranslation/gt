import type { FileUsages, ParaglideUsage } from '../analysis/types.js';
import { matchingIds } from '../paraglide/catalog.js';
import { StreamedJson } from '../utils/json.js';
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
  /** Bytes of snippets kept in memory: see `SnippetStore`. Default: 16 MB. */
  blockSize?: number;
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

/** Bytes of snippets kept in one buffer. */
const BLOCK_SIZE = 16 * 1024 * 1024;

/**
 * Collects the source code around usages one source file at a time: a file's
 * code is not held once it is added. Each file is added once. The snippets
 * are kept as JSON outside the JavaScript heap: a large project's do not fit
 * in it.
 */
export class SourceCodeCollector {
  /** Snippet numbers in `store`, by message id, then by project-relative file. */
  private readonly snippets = new Map<string, Map<string, number[]>>();
  private readonly store: SnippetStore;

  constructor(private readonly options: SourceCodeOptions) {
    this.store = new SnippetStore(options.blockSize ?? BLOCK_SIZE);
  }

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
    // Decoded once: a dynamic name's snippet is kept for every message it matches.
    const decoded = new Map<number, SourceCode>();

    for (const [id, byFile] of this.snippets) {
      const sourceCode: SourceCodeByFile = {};

      for (const file of sortedFiles(byFile)) {
        sourceCode[file] = byFile.get(file)!.map((snippet) => {
          let source = decoded.get(snippet);

          if (!source) {
            source = JSON.parse(this.store.text(snippet)) as SourceCode;
            decoded.set(snippet, source);
          }

          return source;
        });
      }
      byMessage.set(id, sourceCode);
    }

    return byMessage;
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

/** Snippets' JSON, in buffers that the JavaScript heap does not count. */
class SnippetStore {
  private readonly blocks: Buffer[] = [];
  /** Of the last block: there is none yet, so the first snippet starts one. */
  private used = Infinity;
  /** Of each snippet: its block, start and end. */
  private readonly locations: number[] = [];

  /** `blockSize` bytes in each buffer, or a larger snippet's. */
  constructor(private readonly blockSize: number) {}

  add(json: Buffer): number {
    if (this.used + json.length > this.blockSize) {
      this.blocks.push(
        Buffer.allocUnsafe(Math.max(this.blockSize, json.length))
      );
      this.used = 0;
    }

    const block = this.blocks.length - 1;
    json.copy(this.blocks[block]!, this.used);
    this.locations.push(block, this.used, this.used + json.length);
    this.used += json.length;

    return this.locations.length / 3 - 1;
  }

  bytes(snippet: number): Buffer {
    const at = snippet * 3;
    const block = this.blocks[this.locations[at]!]!;

    return block.subarray(this.locations[at + 1], this.locations[at + 2]);
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

    const text = this.text(snippet).replaceAll(
      `\n${SNIPPET_INDENT}`,
      `\n${indent}`
    );
    return Buffer.from(text);
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
