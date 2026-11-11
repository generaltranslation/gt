import type { ProbedConfig } from '../bundler-configs/probe.js';
import { relativePath } from '../utils/paths.js';

export type UnresolvedWarningOptions = {
  projectRoot: string;
  /** Nothing is warned about when a config was read. */
  probed: ProbedConfig;
  /** Names of the bundlers a config was looked for. */
  bundlers: readonly string[];
};

/** "vite, webpack, or rspack" */
const OR = new Intl.ListFormat('en', { type: 'disjunction' });
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
  { projectRoot, probed, bundlers }: UnresolvedWarningOptions
): string | undefined {
  const reason = unknownAliasesReason(probed, bundlers, projectRoot);
  if (!reason || unresolved.size === 0) return undefined;

  const imports = [...unresolved].sort(([a], [b]) => a.localeCompare(b));
  const listed = imports
    .slice(0, MAX_LISTED)
    .map(
      ([specifier, importer]) =>
        `"${specifier}" (${relativePath(projectRoot, importer)})`
    )
    .join(', ');
  const more =
    imports.length > MAX_LISTED
      ? `, and ${imports.length - MAX_LISTED} more`
      : '';

  return (
    `${imports.length} import(s) could not be resolved, so usages through them are missed: ${listed}${more}. ` +
    `If they are aliases, declare them in tsconfig.json "paths" or pass them with --alias: ${reason}.`
  );
}

/** Undefined when a bundler config gave the aliases. */
function unknownAliasesReason(
  probed: ProbedConfig,
  bundlers: readonly string[],
  projectRoot: string
): string | undefined {
  switch (probed.type) {
    case 'read':
      return undefined;
    case 'unreadable':
      return `${relativePath(projectRoot, probed.file)} could not be read`;
    case 'none':
      return bundlers.length > 0
        ? `no ${OR.format(bundlers)} config was found to read them from`
        : 'no bundler config is read';
  }
}
