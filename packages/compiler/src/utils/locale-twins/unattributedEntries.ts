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
    'its GT import source has no locale twin registration (use gt-react, gt-tanstack-start or gt-i18n)',
};

/**
 * One unattributed entry as `file:line:column api: reason` (1-based line
 * and column in the code the compiler received; the file is relative to the
 * working directory when it is inside it).
 */
export function formatUnattributedEntry(
  file: string,
  { api, reason, node }: LocaleTwinUnattributedEntry
): string {
  const start = findLocation(node)?.start;
  const location = start ? `:${start.line}:${start.column + 1}` : '';
  return `${displayPath(file)}${location} ${API_LABELS[api]}: ${REASONS[reason]}`;
}

/**
 * The build warning listing every entry that keeps its source text in
 * client code in locale twins mode.
 */
export function createUnattributedEntriesWarning(details: string[]): string {
  const count = details.length;
  const one = count === 1;
  return createCompilerDiagnostic({
    severity: 'Warning',
    whatHappened: `${count} translation ${one ? 'entry keeps its' : 'entries keep their'} source text in client code`,
    why: `the compiler cannot attribute ${one ? 'it' : 'them'} to a locale twin at build time`,
    reassurance: one
      ? 'It still renders, but its source text ships to every locale'
      : 'They still render, but their source text ships to every locale',
    fix: `To move ${one ? 'it' : 'them'} into locale twins, use static content and let the compiler compute the hash`,
    // One entry per item; reasons may contain commas
    details: details.join('; '),
  });
}

function displayPath(file: string): string {
  if (!path.isAbsolute(file)) return file;
  const relative = path.relative(process.cwd(), file);
  return relative.startsWith('..') ? file : relative;
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
