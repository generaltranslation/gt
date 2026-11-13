import fs from 'node:fs/promises';
import path from 'node:path';
import { moduleExportName, staticString, type ESTree } from '../utils/ast.js';
import { parseCode } from '../utils/parse.js';

/** A name the app uses without importing it. */
export type AutoImport = {
  name: string;
  specifier: string;
  /** "*" for the module namespace. */
  exportName: string;
  /** The file `specifier` is relative to. */
  importer: string;
};

/** `{ m: "./src/paraglide/messages.js" }` imports `m`; `{ from, export }` names another export. */
export type AutoImportOptions = Record<
  string,
  string | { from: string; export?: string }
>;

/** What a type like `typeof import('x').m` imports. */
type ImportedExport = Pick<AutoImport, 'specifier' | 'exportName'>;

type DeclaredImport = Omit<AutoImport, 'importer'>;

type DeclarationStatement =
  | ESTree.Statement
  | ESTree.Declaration
  | ESTree.TSModuleDeclaration;

/** Declarations that auto-import tools generate, relative to the project root. */
const DECLARATION_FILES = [
  // unplugin-auto-import (default `dts`)
  'auto-imports.d.ts',
  'src/auto-imports.d.ts',
  'types/auto-imports.d.ts',
  // unplugin-vue-components (default `dts`)
  'components.d.ts',
  'src/components.d.ts',
  // Nuxt
  '.nuxt/types/imports.d.ts',
  '.nuxt/imports.d.ts',
  '.nuxt/components.d.ts',
];

export function autoImportsFromOptions(
  options: AutoImportOptions,
  projectRoot: string
): AutoImport[] {
  const importer = path.join(projectRoot, 'package.json');

  return Object.entries(options).map(([name, value]) => {
    const { from, export: exportName = name } =
      typeof value === 'string' ? { from: value } : value;

    return { name, specifier: from, exportName, importer };
  });
}

/** Reads the declaration files of unplugin-auto-import and Nuxt. */
export async function detectAutoImports(
  projectRoot: string,
  extraFiles: readonly string[] = []
): Promise<AutoImport[]> {
  const candidates = new Set([
    ...DECLARATION_FILES.map((file) => path.join(projectRoot, file)),
    ...extraFiles,
  ]);
  const imports: AutoImport[] = [];

  for (const file of candidates) {
    const code = await fs.readFile(file, 'utf8').catch(() => undefined);
    if (code === undefined) continue;

    imports.push(...parseAutoImportDeclarations(code, file));
  }

  return imports;
}

/**
 * The names a declaration file declares, read from its syntax tree:
 *
 * - `const m: typeof import('./paraglide/messages').m` (unimport, unplugin-auto-import)
 * - `const m: typeof import('./paraglide/messages')['m']` (older versions)
 * - `const i18n: typeof import('./i18n')` (a namespace)
 * - `export { m, default as greet } from './paraglide/messages'` (Nuxt's `imports.d.ts`)
 * - `interface GlobalComponents { Foo: typeof import('./Foo.vue')['default'] }`
 *   (unplugin-vue-components)
 * - `export const LazyFoo: LazyComponent<typeof import('./Foo.vue')['default']>` (Nuxt)
 */
export function parseAutoImportDeclarations(
  code: string,
  importer: string
): AutoImport[] {
  const { program } = parseCode(importer, code, { lang: 'dts' });

  return program.body
    .flatMap((statement) => declaredImports(statement))
    .map((declared) => ({ ...declared, importer }));
}

function declaredImports(statement: DeclarationStatement): DeclaredImport[] {
  switch (statement.type) {
    // `declare global { … }`
    case 'TSModuleDeclaration':
      return statement.body?.type === 'TSModuleBlock'
        ? statement.body.body.flatMap((inner) => declaredImports(inner))
        : [];

    // `interface GlobalComponents { Foo: … }`
    case 'TSInterfaceDeclaration':
      return statement.body.body.flatMap(memberImport);

    case 'VariableDeclaration':
      return statement.declarations.flatMap(variableImport);

    case 'ExportNamedDeclaration':
      return [
        ...(statement.declaration
          ? declaredImports(statement.declaration)
          : []),
        ...reexportedImports(statement),
      ];

    default:
      return [];
  }
}

/** `Foo: typeof import('./Foo.vue')['default']` */
function memberImport(member: ESTree.TSSignature): DeclaredImport[] {
  if (member.type !== 'TSPropertySignature' || member.computed) return [];

  const name =
    member.key.type === 'Identifier'
      ? member.key.name
      : staticString(member.key);
  const imported = typeofImport(member.typeAnnotation?.typeAnnotation);
  if (name === undefined || !imported) return [];

  return [{ name, ...imported }];
}

/** `const m: typeof import('./paraglide/messages').m` */
function variableImport(
  declarator: ESTree.VariableDeclarator
): DeclaredImport[] {
  const { id } = declarator;
  const imported = typeofImport(id.typeAnnotation?.typeAnnotation);
  if (id.type !== 'Identifier' || !imported) return [];

  return [{ name: id.name, ...imported }];
}

/** `export { m, default as greet } from './paraglide/messages'` */
function reexportedImports(
  statement: ESTree.ExportNamedDeclaration
): DeclaredImport[] {
  if (!statement.source || statement.exportKind === 'type') return [];

  const specifier = statement.source.value;

  return statement.specifiers
    .filter(({ exportKind }) => exportKind !== 'type')
    .map(({ exported, local }) => ({
      name: moduleExportName(exported),
      specifier,
      exportName: moduleExportName(local),
    }));
}

/** `typeof import('x').m` and `typeof import('x')['m']` → x, m; `typeof import('x')` → x, * */
function typeofImport(
  annotation: ESTree.TSType | null | undefined
): ImportedExport | undefined {
  if (!annotation) return undefined;

  // Nuxt's `LazyComponent<typeof import(…)>`
  const isWrapped =
    annotation.type === 'TSTypeReference' &&
    annotation.typeArguments?.params.length === 1;
  const type = isWrapped ? annotation.typeArguments!.params[0]! : annotation;

  if (type.type !== 'TSIndexedAccessType') return importQuery(type, undefined);

  const index = type.indexType;
  const exportName =
    index.type === 'TSLiteralType' ? staticString(index.literal) : undefined;
  if (exportName === undefined) return undefined;

  return importQuery(type.objectType, exportName);
}

/** `typeof import('x')` and `typeof import('x').m`; `indexed` is the `m` of a `['m']` after it. */
function importQuery(
  type: ESTree.TSType,
  indexed: string | undefined
): ImportedExport | undefined {
  if (type.type !== 'TSTypeQuery' || type.exprName.type !== 'TSImportType')
    return undefined;

  const { source, qualifier } = type.exprName;
  const specifier = source.value;
  if (!qualifier) return { specifier, exportName: indexed ?? '*' };

  // `.a.b` and `.a['b']` are not module exports.
  const isExport = qualifier.type === 'Identifier' && indexed === undefined;

  return isExport ? { specifier, exportName: qualifier.name } : undefined;
}
