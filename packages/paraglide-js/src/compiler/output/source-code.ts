import type { FileUsages, ParaglideUsage } from '../analysis/types.js';
import { patternMatcher } from '../paraglide/catalog.js';

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

type LocatedUsage = {
  /** Project-relative. */
  file: string;
  lines: readonly string[];
  usage: ParaglideUsage;
};

type MessageSnippet = { id: string; file: string; snippet: SourceCode };

/** For each message that is used, the source code around its usages. */
export function sourceCodeByMessage(
  sourceFiles: readonly FileUsages[],
  options: SourceCodeOptions
): Map<string, SourceCodeByFile> {
  const byMessage = new Map<string, SourceCodeByFile>();

  for (const { id, file, snippet } of messageSnippets(sourceFiles, options)) {
    const byFile = byMessage.get(id) ?? {};
    const snippets = (byFile[file] ??= []);
    byMessage.set(id, byFile);

    // Usages on the same lines, e.g. `a ? m.x() : m.x()`.
    const isRepeated = snippets.some((other) => isSameSnippet(other, snippet));
    if (isRepeated) continue;

    snippets.push(snippet);
  }

  return byMessage;
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

function messageSnippets(
  sourceFiles: readonly FileUsages[],
  { ids, inlangProject, radius }: SourceCodeOptions
): MessageSnippet[] {
  const usages = projectUsages(sourceFiles, inlangProject);

  return usages.flatMap(({ file, lines, usage }) => {
    const named = namedMessages(usage, ids);
    if (named.length === 0) return [];

    const snippet = sourceSnippet(lines, usage, radius);

    return named.map((id) => ({ id, file, snippet }));
  });
}

/** The project's usages, in an order that does not depend on the analysis. */
function projectUsages(
  sourceFiles: readonly FileUsages[],
  inlangProject: string
): LocatedUsage[] {
  const sorted = [...sourceFiles].sort((a, b) => a.file.localeCompare(b.file));

  return sorted.flatMap(({ file, code, usages }) => {
    const ofProject = usages.filter(
      (usage) => usage.inlangProject === inlangProject
    );
    if (ofProject.length === 0) return [];

    const lines = code.split(/\r?\n/);

    return ofProject
      .sort((a, b) => a.start - b.start || a.end - b.end)
      .map((usage) => ({ file, lines, usage }));
  });
}

/** The messages a usage names: its own, or every match of a dynamic name like `error_*`. */
function namedMessages(
  usage: ParaglideUsage,
  ids: ReadonlySet<string>
): string[] {
  if (!usage.dynamic) return ids.has(usage.name) ? [usage.name] : [];

  // `m[key]` says nothing about any one message.
  const isAnyMessage = usage.name.replaceAll('*', '') === '';
  if (isAnyMessage) return [];

  return [...ids].filter(patternMatcher(usage.name));
}

function isSameSnippet(a: SourceCode, b: SourceCode): boolean {
  return a.before === b.before && a.target === b.target && a.after === b.after;
}
