import { parse } from '@babel/parser';
import generate from '@babel/generator';
import * as t from '@babel/types';
import {
  autoInsertJsxComponents,
  ensureTAndVarImported,
} from '../../../../cli/src/react/jsx/utils/jsxParsing/autoInsertion';
import { getPathsAndAliases } from '../../../../cli/src/react/jsx/utils/getPathsAndAliases';
import {
  GT_LIBRARIES_UPSTREAM,
  Libraries,
} from '../../../../cli/src/types/libraries';
import { canonical, lower } from './oracle';

function runCli(input: string): {
  ast: t.File;
  generatedImports: t.ImportDeclaration[];
} {
  const ast = parse(input, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx', 'decorators-legacy'],
  });
  // Match createInlineUpdates.getFilterPkgs for a gt-next project, including
  // upstream gt-i18n/react-core imports used by real extraction.
  const paths = getPathsAndAliases(
    ast,
    GT_LIBRARIES_UPSTREAM[Libraries.GT_NEXT]
  );
  // The CLI records T imports separately; its insertion pass needs both maps.
  const aliases = { ...paths.importAliases };
  for (const { localName, originalName } of paths.translationComponentPaths)
    aliases[localName] = originalName;
  const originalStatements = new Set(ast.program.body);
  ensureTAndVarImported(ast, aliases);
  const generatedImports = ast.program.body.filter(
    (statement): statement is t.ImportDeclaration =>
      t.isImportDeclaration(statement) && !originalStatements.has(statement)
  );
  autoInsertJsxComponents(ast, aliases);
  return { ast, generatedImports };
}

/** Run the CLI's actual insertion pass on the original, unlowered JSX input. */
export function cliOracle(input: string): t.File {
  return runCli(input).ast;
}

/** Preserve the CLI-authored JSX and import source in its own golden output. */
export function cliOutput(input: string): string {
  return print(cliOracle(input));
}

function print(ast: t.File): string {
  return `${
    generate(ast, {
      comments: false,
      jsescOption: { minimal: true },
    }).code
  }\n`;
}

/**
 * Compare insertion structure without changing the CLI golden. The CLI eagerly
 * imports helpers from gt-react; the compiler's Next.js adapter uses gt-next.
 * Normalize only import nodes created by ensureTAndVarImported in this run.
 * Original imports, bindings and all JSX remain part of the strict comparison.
 */
export function cliResult(
  input: string,
  development = false
): { output: string; canonical: string } {
  const { ast, generatedImports } = runCli(input);
  const output = print(ast);
  for (const statement of generatedImports) {
    if (
      statement.source.value === 'gt-react' &&
      statement.specifiers.every(
        (specifier) =>
          t.isImportSpecifier(specifier) &&
          t.isIdentifier(specifier.imported) &&
          ['GtInternalTranslateJsx', 'GtInternalVar'].includes(
            specifier.imported.name
          )
      )
    )
      statement.source.value = 'gt-next';
  }
  return { output, canonical: canonical(lower(print(ast), development)) };
}
