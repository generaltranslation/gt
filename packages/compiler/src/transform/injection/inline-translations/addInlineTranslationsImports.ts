import path from 'node:path';
import * as t from '@babel/types';
import {
  getInlineTranslationsModuleFile,
  getInlineTranslationsVirtualModuleId,
  type InlineTranslationsModules,
} from './inlineTranslationsModules';

export function isEsModule(program: t.Program): boolean {
  return program.body.some(
    (statement) =>
      t.isImportDeclaration(statement) ||
      t.isExportNamedDeclaration(statement) ||
      t.isExportDefaultDeclaration(statement) ||
      t.isExportAllDeclaration(statement)
  );
}

export function addInlineTranslationsImports(
  program: t.Program,
  imports: Map<string, string>,
  modules: InlineTranslationsModules,
  importerId: string
): void {
  const declarations = [...imports].map(([hash, name]) =>
    t.importDeclaration(
      [t.importDefaultSpecifier(t.identifier(name))],
      t.stringLiteral(getImportSource(hash, modules, importerId))
    )
  );
  program.body.unshift(...declarations);
}

function getImportSource(
  hash: string,
  modules: InlineTranslationsModules,
  importerId: string
): string {
  if (modules.mode === 'virtual') {
    return getInlineTranslationsVirtualModuleId(hash);
  }
  const file = getInlineTranslationsModuleFile(modules.dir, hash);
  const importer = importerId.split('?')[0];
  if (!path.isAbsolute(importer)) return toPosix(file);
  const relative = path.relative(path.dirname(importer), file);
  // Windows has no relative path between drives
  if (path.isAbsolute(relative)) return toPosix(file);
  const posixRelative = toPosix(relative);
  // A bare `.gt/…` would be read as a package name
  return posixRelative.startsWith('../') ? posixRelative : `./${posixRelative}`;
}

function toPosix(file: string): string {
  return file.split(path.sep).join('/');
}
