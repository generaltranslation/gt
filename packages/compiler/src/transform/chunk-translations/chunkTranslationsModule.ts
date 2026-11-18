import * as parser from '@babel/parser';
import generate from '@babel/generator';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import type { TransformState } from '../../state/types';
import { GT_IMPORT_SOURCES } from '../../utils/constants/gt/constants';
import {
  CHUNK_TRANSLATIONS_IMPORTS,
  CHUNK_TRANSLATIONS_LOCAL_PREFIX,
  CHUNK_TRANSLATIONS_SOURCE,
  IMPORTED_CHUNKS_PLACEHOLDER,
  UNSPLIT_LOADER_PLACEHOLDER,
  defaultChunkTranslationsNaming,
  getEntryExport,
  type ChunkTranslationsNaming,
  type ChunkTranslationsImport,
} from './resolveChunkTranslations';

/** What a file imports from the entry; set on files that can import it. */
export type ChunkTranslationsFile = { imports: Set<ChunkTranslationsImport> };

// The function gt-react starts a single-page app with
const INITIALIZE_SPA = 'initializeGTSPA';
// The option an app gives it the loader of its catalogs in
const LOAD_TRANSLATIONS = 'loadTranslations';
const INITIALIZE_SPA_LOCAL = `${CHUNK_TRANSLATIONS_LOCAL_PREFIX}initialize_spa`;

// The hashes the compiler computes, which the build finds again in its chunks
const COMPUTED_HASH = /^[0-9a-f]{16}$/;

// A CommonJS module cannot take the import of the entry
const COMMONJS_REFERENCE = /\b(?:require|module|exports)\b/;

/** Whether a file can import the entry: the names it declares must be free. */
export function canImportChunkTranslations(
  program: t.Program,
  code: string
): boolean {
  return isEsModule(program) && !code.includes(CHUNK_TRANSLATIONS_LOCAL_PREFIX);
}

/**
 * Records the hash a call site looks up: a hash the compiler computed is read
 * from the file of the chunk the call site ends up in, any other from the
 * unsplit file.
 */
export function recordChunkHash(hash: string, state: TransformState): void {
  const build = state.settings.chunkTranslations;
  if (!build) return;
  if (COMPUTED_HASH.test(hash)) build.hashes.add(hash);
  else build.unsplit.add(hash);
}

/**
 * Records a call site that does not read its translation from a chunk's
 * file, so the build keeps that translation in the unsplit file.
 */
export function keepUnsplit(hash: string, state: TransformState): void {
  state.settings.chunkTranslations?.unsplit.add(hash);
}

/**
 * Finishes a file of a build with chunk translations: `initializeGTSPA`
 * imported from gt-react becomes a function that also waits for the entry's
 * translations, and the file imports what it uses from the entry. The
 * function is a declaration, so it can be called before the module has run.
 * Its call ends in a placeholder, which the build takes out again once it
 * knows whether it has an unsplit file to load there. Returns whether the
 * file changed.
 *
 * Such a build never calls the app's `loadTranslations`: the unsplit file
 * stands in for the catalog. So the option is taken out of the object
 * `initializeGTSPA` is called with, and the bundler drops the loader and the
 * catalogs it imports. Left in, they would be chunks of the build, and the
 * chunk that names them would change with every translation.
 */
export function finishChunkTranslationsFile(
  ast: t.File,
  state: TransformState
): boolean {
  const { program } = ast;
  const file = state.chunkTranslations;
  if (!file) return false;
  for (const statement of program.body) {
    if (
      !t.isImportDeclaration(statement) ||
      statement.importKind === 'type' ||
      statement.source.value !== GT_IMPORT_SOURCES.GT_REACT
    ) {
      continue;
    }
    for (const specifier of statement.specifiers) {
      if (
        !t.isImportSpecifier(specifier) ||
        specifier.importKind === 'type' ||
        getImportedName(specifier) !== INITIALIZE_SPA
      ) {
        continue;
      }
      const local = specifier.local.name;
      dropCatalogLoader(ast, local);
      specifier.local = t.identifier(INITIALIZE_SPA_LOCAL);
      program.body.push(
        t.functionDeclaration(
          t.identifier(local),
          [t.identifier('config')],
          t.blockStatement([
            t.returnStatement(
              t.callExpression(
                t.identifier(CHUNK_TRANSLATIONS_IMPORTS.initialize.local),
                [
                  t.identifier(INITIALIZE_SPA_LOCAL),
                  t.identifier('config'),
                  t.stringLiteral(UNSPLIT_LOADER_PLACEHOLDER),
                ]
              )
            ),
          ])
        )
      );
      file.imports.add('initialize');
      if (state.settings.chunkTranslations) {
        state.settings.chunkTranslations.starts++;
      }
    }
  }
  if (!file.imports.size) return false;
  program.body.unshift(
    createEntryImport(
      file.imports,
      state.settings.chunkTranslations?.naming,
      state.settings.chunkTranslations?.regions !== undefined
    )
  );
  return true;
}

/**
 * Takes `loadTranslations` out of the object each call of the imported
 * `local` is given, where it is a function or the name of one, which leaves
 * nothing behind.
 */
function dropCatalogLoader(ast: t.File, local: string): void {
  traverse(ast, {
    CallExpression(path) {
      const [options] = path.node.arguments;
      if (
        !t.isIdentifier(path.node.callee, { name: local }) ||
        !t.isObjectExpression(options) ||
        path.scope.getBinding(local)?.kind !== 'module'
      ) {
        return;
      }
      options.properties = options.properties.filter(
        (property) => !isCatalogLoader(property)
      );
    },
  });
}

function isCatalogLoader(property: t.ObjectExpression['properties'][number]) {
  if (t.isSpreadElement(property) || property.computed) return false;
  const named =
    t.isIdentifier(property.key, { name: LOAD_TRANSLATIONS }) ||
    t.isStringLiteral(property.key, { value: LOAD_TRANSLATIONS });
  return (
    named &&
    (t.isObjectMethod(property)
      ? property.kind === 'method'
      : t.isIdentifier(property.value) || t.isFunction(property.value))
  );
}

function getImportedName(specifier: t.ImportSpecifier): string {
  return t.isIdentifier(specifier.imported)
    ? specifier.imported.name
    : specifier.imported.value;
}

function createEntryImport(
  imports: Iterable<ChunkTranslationsImport>,
  naming: ChunkTranslationsNaming = defaultChunkTranslationsNaming,
  splitsByModule = false
): t.ImportDeclaration {
  return t.importDeclaration(
    [...imports].map((kind) =>
      t.importSpecifier(
        t.identifier(CHUNK_TRANSLATIONS_IMPORTS[kind].local),
        t.identifier(getEntryExport(kind, naming, splitsByModule))
      )
    ),
    t.stringLiteral(CHUNK_TRANSLATIONS_SOURCE)
  );
}

/**
 * Wraps each dynamic import of a module so the translations of the chunks it
 * loads are requested with them: `import('./Home')` becomes
 * `__gt_chunk_load(() => import('./Home'), '<placeholder>')`, and the build
 * replaces the placeholder with those chunks once the bundler has named them.
 * Undefined when the module has no dynamic import to wrap.
 */
export function wrapDynamicImports(
  code: string,
  id: string,
  naming: ChunkTranslationsNaming = defaultChunkTranslationsNaming,
  splitsByModule = false
): { code: string; map: unknown } | undefined {
  const { local } = CHUNK_TRANSLATIONS_IMPORTS.load;
  if (!code.includes('import(') || code.includes(local)) return undefined;
  let ast: t.File;
  try {
    ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript', 'decorators-legacy'],
      allowImportExportEverywhere: true,
      allowReturnOutsideFunction: true,
    });
  } catch {
    return undefined;
  }
  if (!isEsModule(ast.program) && COMMONJS_REFERENCE.test(code)) {
    return undefined;
  }
  let wrapped = false;
  traverse(ast, {
    CallExpression(path) {
      const [specifier] = path.node.arguments;
      if (
        !t.isImport(path.node.callee) ||
        !(
          t.isStringLiteral(specifier) ||
          (t.isTemplateLiteral(specifier) && !specifier.expressions.length)
        )
      ) {
        return;
      }
      path.replaceWith(
        t.callExpression(t.identifier(local), [
          t.arrowFunctionExpression([], path.node),
          t.stringLiteral(IMPORTED_CHUNKS_PLACEHOLDER),
        ])
      );
      path.skip();
      wrapped = true;
    },
  });
  if (!wrapped) return undefined;
  ast.program.body.unshift(createEntryImport(['load'], naming, splitsByModule));
  const output = generate(
    ast,
    { retainLines: true, sourceMaps: true, sourceFileName: id },
    code
  );
  return { code: output.code, map: output.map };
}

function isEsModule(program: t.Program): boolean {
  return program.body.some(
    (statement) =>
      t.isImportDeclaration(statement) ||
      t.isExportNamedDeclaration(statement) ||
      t.isExportDefaultDeclaration(statement) ||
      t.isExportAllDeclaration(statement)
  );
}
