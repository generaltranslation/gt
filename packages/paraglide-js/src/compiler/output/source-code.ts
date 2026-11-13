import type { FileUsages, ParaglideUsage } from '../analysis/types.js';
import { matchingIds } from '../paraglide/catalog.js';
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

/**
 * Collects the source code around usages one source file at a time: a file's
 * code is not held once it is added. Each file is added once. A snippet is
 * kept as its JSON: its lines are slices of its file's code, which V8 keeps
 * whole while a slice is held.
 */
export class SourceCodeCollector {
  /** The JSON of each snippet, by message id, then by project-relative file. */
  private readonly snippets = new Map<string, Map<string, string[]>>();

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

      const snippet = JSON.stringify(sourceSnippet(lines, usage, radius));

      for (const id of named) {
        const snippets = this.snippetsOf(id, file);

        // Usages on the same lines, e.g. `a ? m.x() : m.x()`.
        const isRepeated = snippets.includes(snippet);
        if (isRepeated) continue;

        snippets.push(snippet);
      }
    }
  }

  /** For each message that is used, its snippets by file, in an order that does not depend on the analysis. */
  byMessage(): Map<string, SourceCodeByFile> {
    const byMessage = new Map<string, SourceCodeByFile>();

    for (const [id, byFile] of this.snippets) {
      const sourceCode: SourceCodeByFile = {};

      for (const file of [...byFile.keys()].sort(compareText)) {
        sourceCode[file] = byFile
          .get(file)!
          .map((snippet) => JSON.parse(snippet) as SourceCode);
      }
      byMessage.set(id, sourceCode);
    }

    return byMessage;
  }

  private snippetsOf(id: string, file: string): string[] {
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
