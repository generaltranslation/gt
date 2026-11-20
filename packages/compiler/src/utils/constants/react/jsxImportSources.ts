import * as t from '@babel/types';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import type { PluginSettings } from '../../../config';
import { isGTComponent, isGTImportSource } from '../gt/helpers';
import { isReactFunction, isReactImportSource } from './helpers';

const JSX_RUNTIME = /\/jsx-(?:dev-)?runtime$/;

const importedName = ({ imported }: t.ImportSpecifier): string =>
  t.isIdentifier(imported) ? imported.name : imported.value;

/**
 * Whether the compiler reads the JSX calls imported from `source`: React's,
 * and the two runtimes of each configured JSX import source. A source itself
 * is not read: the `jsx` a library exports there, as Emotion does, takes the
 * arguments of `createElement`.
 */
export function isJsxImportSource(
  source: string,
  jsxImportSources: readonly string[]
): boolean {
  return (
    isReactImportSource(source) ||
    (JSX_RUNTIME.test(source) &&
      jsxImportSources.includes(source.replace(JSX_RUNTIME, '')))
  );
}

/** The production runtime of the JSX import source that `source` is of. */
export function getJsxRuntimeSource(source: string): string {
  return `${source.replace(JSX_RUNTIME, '')}/jsx-runtime`;
}

/** Throws when the `jsxImportSources` option is not a list of import sources. */
export function validateJsxImportSources(value: unknown): void {
  if (value === undefined) return;
  if (
    Array.isArray(value) &&
    value.every((source) => typeof source === 'string' && source !== '')
  ) {
    return;
  }
  throw new Error(
    createDiagnosticMessage({
      source: '@generaltranslation/compiler',
      severity: 'Error',
      whatHappened: `jsxImportSources is set to ${JSON.stringify(value)}, which is not a list of import sources`,
      fix: 'Set it to a list of the import sources your JSX is compiled against, such as jsxImportSources: ["@emotion/react"]',
    })
  );
}

/**
 * The JSX import sources a file is compiled against that the compiler does
 * not read, when it would have had work in the file: with automatic `<T>` on,
 * or when the file imports a General Translation component. A namespace or
 * default import counts, as it can hold one.
 */
export function findUnreadJsxImportSources(
  program: t.Program,
  settings: Pick<PluginSettings, 'enableAutoJsxInjection' | 'jsxImportSources'>
): string[] {
  const imports = program.body.filter((node) => t.isImportDeclaration(node));
  if (
    !settings.enableAutoJsxInjection &&
    !imports.some(
      (node) =>
        isGTImportSource(node.source.value) &&
        node.specifiers.some(
          (specifier) =>
            !t.isImportSpecifier(specifier) ||
            isGTComponent(importedName(specifier))
        )
    )
  ) {
    return [];
  }
  const unread = new Set<string>();
  for (const { source, specifiers } of imports) {
    if (
      JSX_RUNTIME.test(source.value) &&
      !isJsxImportSource(source.value, settings.jsxImportSources) &&
      specifiers.some(
        (specifier) =>
          t.isImportSpecifier(specifier) &&
          isReactFunction(importedName(specifier))
      )
    ) {
      unread.add(source.value.replace(JSX_RUNTIME, ''));
    }
  }
  return [...unread];
}

export const createUnreadJsxImportSourceWarning = (
  source: string,
  file: string
) =>
  createDiagnosticMessage({
    source: '@generaltranslation/compiler',
    severity: 'Warning',
    whatHappened: `The compiler skipped the JSX in ${file}`,
    why: `it is compiled against "${source}", and the compiler reads only JSX compiled against React's runtime or against a source in its jsxImportSources option; this is said once per build, for the first file compiled against that source`,
    reassurance:
      'The build continues, and the JSX of such files gets no automatic <T>, no build-time hash and no usage checks',
    fix: `If "${source}" creates elements as React's JSX runtime does, add it to the compiler's options: jsxImportSources: ["${source}"]`,
    wayOut:
      "compile the app's JSX against React's runtime, so that its files import react/jsx-runtime and react/jsx-dev-runtime, and to keep the other runtime resolve those two modules to it for the app's own files only, not for the runtime's own imports of them",
  });
