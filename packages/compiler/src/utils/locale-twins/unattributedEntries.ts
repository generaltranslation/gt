import path from 'node:path';
import * as t from '@babel/types';
import type {
  LocaleTwinEntryApi,
  LocaleTwinUnattributedEntry,
  LocaleTwinUnattributedReason,
} from '../../state/LocaleTwinCollector';
import { createCompilerDiagnostic } from '../diagnostics';

const API_LABELS: Record<LocaleTwinEntryApi, string> = {
  T: '<T>',
  gt: 'gt()',
  t: 't()',
  msg: 'msg()',
};

const REASONS: Record<LocaleTwinUnattributedReason, string> = {
  derive:
    'uses derive(), <Derive> or autoderive (its hash is only known at runtime)',
  customHash: 'has a custom hash that is not a compile-time hash',
  taggedTemplate: 'is a tagged template the macro transform did not expand',
  importSource:
    'its GT import source does not support locale twins (use gt-react, gt-tanstack-start or gt-i18n)',
};

/**
 * Where an unattributed entry is: the module id the compiler received, the
 * 1-based line and column of its call or `<T>` (when known), its API and why
 * it is unattributed.
 */
export type UnattributedEntryLocation = {
  file: string;
  line?: number;
  column?: number;
  api: string;
  reason: LocaleTwinUnattributedReason;
};

/** Locates an unattributed entry recorded while transforming `file`. */
export function locateUnattributedEntry(
  file: string,
  { api, reason, node }: LocaleTwinUnattributedEntry
): UnattributedEntryLocation {
  const start = findLocation(node)?.start;
  return {
    file,
    ...(start && { line: start.line, column: start.column + 1 }),
    api: API_LABELS[api],
    reason,
  };
}

/**
 * One unattributed entry as `file:line:column api: reason`, the file relative
 * to `baseDir` when it is inside it (default: the working directory).
 */
export function formatUnattributedEntry(
  entry: UnattributedEntryLocation,
  baseDir = process.cwd()
): string {
  const location =
    entry.line === undefined ? '' : `:${entry.line}:${entry.column}`;
  return `${displayPath(entry.file, baseDir)}${location} ${entry.api}: ${REASONS[entry.reason]}`;
}

/**
 * The entry for the build report: `file` relative to `baseDir` (POSIX) when
 * it is inside it.
 */
export function toUnattributedReportEntry(
  entry: UnattributedEntryLocation,
  baseDir: string
): UnattributedEntryLocation {
  return {
    ...entry,
    file: displayPath(entry.file, baseDir).split(path.sep).join('/'),
  };
}

/**
 * The build warning listing every entry that keeps its source text in
 * client code in locale twins mode: no twin carries it, so it renders in the
 * source locale for every visitor.
 */
export function createUnattributedEntriesWarning(details: string[]): string {
  const count = details.length;
  const one = count === 1;
  return createCompilerDiagnostic({
    severity: 'Warning',
    whatHappened: `${count} translation ${one ? 'entry renders' : 'entries render'} untranslated with locale twins`,
    why: `the compiler cannot attribute ${one ? 'it' : 'them'} to a locale twin at build time, so ${one ? 'it keeps its' : 'they keep their'} source text in client code and ${one ? 'renders' : 'render'} in the source locale for every visitor (in production builds; vite dev still translates ${one ? 'it' : 'them'})`,
    fix: `To translate ${one ? 'it' : 'them'}, use static content and let the compiler compute the hash`,
    // One entry per item; reasons may contain commas
    details: details.join('; '),
  });
}

function displayPath(file: string, baseDir: string): string {
  if (!path.isAbsolute(file)) return file;
  const relative = path.relative(baseDir, file);
  return relative.startsWith('..') || path.isAbsolute(relative)
    ? file
    : relative;
}

/**
 * The node's location, or its first descendant's (nodes the compiler inserts,
 * such as an auto-injected `<T>`, have none).
 */
function findLocation(node: t.Node): t.SourceLocation | undefined {
  if (node.loc) return node.loc;
  for (const key of t.VISITOR_KEYS[node.type] ?? []) {
    const value = (node as unknown as Record<string, unknown>)[key];
    for (const child of Array.isArray(value) ? value : [value]) {
      if (!t.isNode(child)) continue;
      const loc = findLocation(child);
      if (loc) return loc;
    }
  }
  return undefined;
}
