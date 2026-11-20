import * as t from '@babel/types';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import type { PluginSettings } from '../../../config';
import { isGTImportSource } from '../gt/helpers';
import { isReactFunction, isReactImportSource } from './helpers';

const JSX_RUNTIME = /\/jsx-(?:dev-)?runtime$/;

/**
 * The JSX import sources a file is compiled against that the compiler does
 * not read, when it would have had work in the file: with automatic `<T>` on,
 * or when the file imports from a General Translation package.
 */
export function findUnreadJsxImportSources(
  program: t.Program,
  settings: Pick<PluginSettings, 'enableAutoJsxInjection'>
): string[] {
  const imports = program.body.filter((node) => t.isImportDeclaration(node));
  if (
    !settings.enableAutoJsxInjection &&
    !imports.some((node) => isGTImportSource(node.source.value))
  ) {
    return [];
  }
  const unread = new Set<string>();
  for (const { source, specifiers } of imports) {
    if (
      JSX_RUNTIME.test(source.value) &&
      !isReactImportSource(source.value) &&
      specifiers.some(
        (specifier) =>
          t.isImportSpecifier(specifier) &&
          isReactFunction(
            t.isIdentifier(specifier.imported)
              ? specifier.imported.name
              : specifier.imported.value
          )
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
    why: `it is compiled against "${source}", and the compiler reads only JSX compiled against React's runtime; this is said once per build, for the first file compiled against that source`,
    reassurance:
      'The build continues, and the JSX of such files gets no automatic <T>, no build-time hash and no usage checks',
    fix: "Compile the app's JSX against React's runtime, so that its files import react/jsx-runtime and react/jsx-dev-runtime, for example by resolving those two modules to the other runtime in the bundler",
  });
