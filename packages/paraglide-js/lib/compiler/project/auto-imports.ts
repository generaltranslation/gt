import fs from 'node:fs/promises';
import path from 'node:path';
import { parseSync } from 'oxc-parser';
import {
  moduleExportName,
  staticString,
  type ESTree,
} from '../analysis/ast.js';

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
  const candidates = [
    ...new Set([
      ...DECLARATION_FILES.map((file) => path.join(projectRoot, file)),
      ...extraFiles,
    ]),
  ];
  const imports: AutoImport[] = [];
  for (const file of candidates) {
    const code = await fs.readFile(file, 'utf8').catch(() => undefined);
    if (code === undefined) continue;
    imports.push(...parseAutoImportDeclarations(code, file));
  }
  return unique(imports);
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
  const { program } = parseSync(importer, code, { lang: 'dts' });
  const imports: AutoImport[] = [];

  const visit = (
    statement:
      | ESTree.Statement
      | ESTree.Declaration
      | ESTree.TSModuleDeclaration
  ) => {
    switch (statement.type) {
      // `declare global { … }`
      case 'TSModuleDeclaration':
        if (statement.body?.type === 'TSModuleBlock')
          statement.body.body.forEach(visit);
        break;
      // `interface GlobalComponents { Foo: … }`
      case 'TSInterfaceDeclaration':
        for (const member of statement.body.body) {
          if (member.type !== 'TSPropertySignature' || member.computed)
            continue;
          const name =
            member.key.type === 'Identifier'
              ? member.key.name
              : staticString(member.key);
          const type = member.typeAnnotation?.typeAnnotation;
          const imported = type && typeofImport(type);
          if (name !== undefined && imported)
            imports.push({ name, ...imported, importer });
        }
        break;
      case 'VariableDeclaration':
        for (const declarator of statement.declarations) {
          const type = declarator.id.typeAnnotation?.typeAnnotation;
          const imported = type && typeofImport(type);
          if (declarator.id.type === 'Identifier' && imported) {
            imports.push({ name: declarator.id.name, ...imported, importer });
          }
        }
        break;
      case 'ExportNamedDeclaration':
        if (statement.declaration) visit(statement.declaration);
        if (!statement.source || statement.exportKind === 'type') break;
        for (const specifier of statement.specifiers) {
          if (specifier.exportKind === 'type') continue;
          imports.push({
            name: moduleExportName(specifier.exported),
            specifier: statement.source.value,
            exportName: moduleExportName(specifier.local),
            importer,
          });
        }
        break;
    }
  };
  program.body.forEach(visit);
  return imports;
}

/** `typeof import('x').m` and `typeof import('x')['m']` → x, m; `typeof import('x')` → x, * */
function typeofImport(
  type: ESTree.TSType
): { specifier: string; exportName: string } | undefined {
  let exportName: string | undefined;
  // Nuxt's `LazyComponent<typeof import(…)>`
  if (
    type.type === 'TSTypeReference' &&
    type.typeArguments?.params.length === 1
  ) {
    type = type.typeArguments.params[0]!;
  }
  if (type.type === 'TSIndexedAccessType') {
    const index = type.indexType;
    exportName =
      index.type === 'TSLiteralType' ? staticString(index.literal) : undefined;
    if (exportName === undefined) return undefined;
    type = type.objectType;
  }
  if (type.type !== 'TSTypeQuery' || type.exprName.type !== 'TSImportType')
    return undefined;
  const { source, qualifier } = type.exprName;
  if (qualifier) {
    // `.a.b` is not a module export.
    if (qualifier.type !== 'Identifier' || exportName !== undefined)
      return undefined;
    exportName = qualifier.name;
  }
  return { specifier: source.value, exportName: exportName ?? '*' };
}

/** The first declaration of each name wins. */
function unique(imports: AutoImport[]): AutoImport[] {
  const seen = new Map<string, AutoImport>();
  for (const autoImport of imports) {
    if (!seen.has(autoImport.name)) seen.set(autoImport.name, autoImport);
  }
  return [...seen.values()];
}
