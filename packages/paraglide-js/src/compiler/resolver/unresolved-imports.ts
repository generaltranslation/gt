import type { Diagnostic } from '../utils/diagnostics.js';
import { relativePath } from '../utils/paths.js';
import { compareText } from '../utils/sort.js';

export type UnresolvedWarningOptions = {
  projectRoot: string;
  /** Why aliases may be unknown, e.g. "vite.config.ts could not be read". */
  reason: string;
};

const MAX_LISTED = 5;
/** `./a.js`, `../a.js`, `.` */
const RELATIVE = /^\.{1,2}(?:\/|$)/;
/** `virtual:pwa-register`, `astro:content`, `node:fs`, `https://…` */
const SCHEME = /^[a-z][a-z\d+.-]*:/i;

/** Not a relative path or a virtual module. */
export function mayBeAlias(specifier: string): boolean {
  return !RELATIVE.test(specifier) && !SCHEME.test(specifier);
}

export function unresolvedWarning(
  unresolved: ReadonlyMap<string, string>,
  { projectRoot, reason }: UnresolvedWarningOptions
): Diagnostic | undefined {
  if (unresolved.size === 0) return undefined;

  const imports = [...unresolved].sort(([a], [b]) => compareText(a, b));
  const listed = imports
    .slice(0, MAX_LISTED)
    .map(
      ([specifier, importer]) =>
        `"${specifier}" (${relativePath(projectRoot, importer)})`
    );
  const more =
    imports.length > MAX_LISTED
      ? [`and ${imports.length - MAX_LISTED} more`]
      : [];

  return {
    whatHappened: `${imports.length} import(s) could not be resolved, so usages through them are missed`,
    fix: `If they are aliases, declare them in tsconfig.json "paths" or pass them with --alias, since ${reason}`,
    details: [...listed, ...more],
  };
}
