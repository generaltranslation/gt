// Reads the Start entries and the AST lookups shared by every entry.
import * as t from '@babel/types';
import { createDiagnosticMessage } from 'generaltranslation/internal';
import fs from 'node:fs';
import path from 'node:path';
import { Libraries } from '../../../types/libraries.js';
import { parseModule } from '../../setupViteSPA.js';

export const DOCS_URL =
  'https://generaltranslation.com/docs/react/tanstack-start/setup';

// Start resolves its entries by basename, so any of these may be the entry.
const SOURCE_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js'];

export type SourceFile = {
  /** Relative to the app, with forward slashes. */
  path: string;
  content: string;
  /** Undefined when the file cannot be parsed. */
  statements?: t.Statement[];
};

export async function readSourceFile(
  appDirectory: string,
  basename: string
): Promise<SourceFile | undefined> {
  for (const extension of SOURCE_EXTENSIONS) {
    const relativePath = `${basename}${extension}`;
    const absolutePath = path.join(appDirectory, relativePath);
    if (!fs.existsSync(absolutePath)) continue;
    const content = await fs.promises.readFile(absolutePath, 'utf8');
    return {
      path: relativePath,
      content,
      statements: parseModule(content, relativePath),
    };
  }
  return undefined;
}

function getMissingFileError(file: string): Error {
  return new Error(
    createDiagnosticMessage({
      source: 'gt',
      severity: 'Error',
      whatHappened: 'GT cannot configure this TanStack Start app',
      why: `${file} was not found`,
      reassurance: 'Nothing was changed',
      fix: 'Run `npx gt@latest init` from the app root, or set up GT manually',
      docsUrl: DOCS_URL,
    })
  );
}

/** Reads the Start entries without writing, so a missing one stops setup. */
export async function inspectTanStackStart(appDirectory: string) {
  const router = await readSourceFile(appDirectory, 'src/router');
  if (!router) throw getMissingFileError('src/router.tsx');
  const root = await readSourceFile(appDirectory, 'src/routes/__root');
  if (!root) throw getMissingFileError('src/routes/__root.tsx');
  return {
    router,
    root,
    start: await readSourceFile(appDirectory, 'src/start'),
  };
}

/** The local name `name` is imported as from gt-tanstack-start. */
export function getLocalImport(
  file: SourceFile,
  name: string
): string | undefined {
  for (const statement of file.statements ?? []) {
    if (
      statement.type !== 'ImportDeclaration' ||
      statement.source.value !== Libraries.GT_TANSTACK_START ||
      statement.importKind === 'type'
    ) {
      continue;
    }
    for (const specifier of statement.specifiers) {
      if (
        specifier.type === 'ImportSpecifier' &&
        specifier.importKind !== 'type' &&
        t.isIdentifier(specifier.imported, { name })
      ) {
        return specifier.local.name;
      }
    }
  }
  return undefined;
}

export function getPropertyName(
  property: t.ObjectExpression['properties'][number]
): string | undefined {
  if (property.type === 'SpreadElement' || property.computed) return undefined;
  if (property.key.type === 'Identifier') return property.key.name;
  if (property.key.type === 'StringLiteral') return property.key.value;
  return undefined;
}
