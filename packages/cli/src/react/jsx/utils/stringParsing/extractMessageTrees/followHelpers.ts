import fs from 'node:fs';
import nodePath from 'node:path';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import type { Binding, NodePath, Scope } from '@babel/traverse';
import * as t from '@babel/types';
import { isGTMessageImportSource } from 'generaltranslation/internal';
import type { MessageTreeHashMetadata } from 'generaltranslation/id';
import type { ParsingConfigOptions } from '../../../../../types/parsing.js';
import { resolveImportPath } from '../../resolveImportPath.js';
import { getSourceParserPlugins } from '../../sourceParserPlugins.js';
import { getImportedName } from './imports.js';
import type { TagOptions } from './types.js';

// Handle CommonJS/ESM interop
const traverse = traverseModule.default || traverseModule;

/** A parameter of a function that receives a useGT() or getGT() tag. */
export type FollowedParameter = {
  binding: Binding;
  options: TagOptions | undefined;
  /** The file the options are written in. */
  optionsFile: string;
  /** The file the function is written in. */
  file: string;
};

/**
 * State of one extraction run for following a useGT() or getGT() tag into
 * the functions it is passed to, also in other files.
 */
export type HelperFollower = {
  parsingOptions: ParsingConfigOptions;
  resolvedImports: Map<string, string | null>;
  /** The names each file exports, which decide whether to traverse it. */
  exportSummaries: Map<string, ExportSummary | null>;
  /** Recently traversed files, bounded because a traversed file is large. */
  programs: Map<string, NodePath<t.Program> | null>;
  /** Option keys followed per parameter, keyed by file and position. */
  followed: Map<string, Set<string>>;
  /**
   * The parameter an imported function receives an argument in, by resolved
   * export and argument position, so a followed one is not traversed again.
   */
  importedParameters: Map<string, { paramKey: string; followable: boolean }>;
  /** Parameters whose uses are extracted once their file's types load. */
  pending: FollowedParameter[];
};

type ExportSummary = { names: Set<string>; stars: string[] };

const maxCachedPrograms = 8;

export function createHelperFollower(
  parsingOptions: ParsingConfigOptions
): HelperFollower {
  return {
    parsingOptions,
    resolvedImports: new Map(),
    exportSummaries: new Map(),
    programs: new Map(),
    followed: new Map(),
    importedParameters: new Map(),
    pending: [],
  };
}

/** `reassigned` is set when the name may later hold another function. */
type FoundFunction = {
  fn: NodePath<t.Function>;
  file: string;
  reassigned?: boolean;
};

/** Key of a tag that is not configured, which a helper can still configure. */
export const unconfiguredTagKey = 'unconfigured';

/** Key of a configured tag, equal whatever order its options are written in. */
export function getConfiguredTagKey(metadata: MessageTreeHashMetadata): string {
  return `configured:${JSON.stringify(
    Object.entries(metadata).sort(([a], [b]) => (a < b ? -1 : 1))
  )}`;
}

/**
 * Queues the parameter of the function that `call` passes `arg`, a tag, to.
 * Returns false when that parameter cannot be found statically.
 */
export function followTagArgument(
  call: NodePath,
  arg: t.Node,
  options: TagOptions | undefined,
  optionsFile: string,
  file: string,
  follower: HelperFollower,
  /** Parses `options` into a key, or reports them and returns undefined. */
  getOptionsKey: () => string | undefined
): boolean {
  if (!call.isCallExpression() || !t.isIdentifier(call.node.callee)) {
    return false;
  }
  const index = getArgumentIndex(call.node.arguments, arg);
  if (index === undefined) return false;
  const binding = call.scope.getBinding(call.node.callee.name);
  const importKey = getImportKey(binding, file, follower);
  const imported =
    importKey && follower.importedParameters.get(`${importKey}\0${index}`);
  if (imported) {
    const key = getOptionsKey();
    if (key === undefined) return true;
    if (follower.followed.get(imported.paramKey)?.has(key)) {
      return imported.followable;
    }
  }
  const found = findBindingFunction(binding, file, follower, new Set());
  if (!found) return false;
  const param = getParameter(found.fn, index);
  if (param === undefined) return false;
  // A function can also read the tag through `arguments`, which is not followed.
  const followable = !found.reassigned && !readsArguments(found.fn);
  if (param === null) return followable;
  const key = getOptionsKey();
  if (key === undefined) return true;
  const paramKey = `${toPathKey(found.file)}\0${param.identifier.start}`;
  if (importKey) {
    follower.importedParameters.set(`${importKey}\0${index}`, {
      paramKey,
      followable,
    });
  }
  const followedOptions = follower.followed.get(paramKey) ?? new Set();
  if (!followedOptions.has(key)) {
    followedOptions.add(key);
    follower.followed.set(paramKey, followedOptions);
    follower.pending.push({
      binding: param,
      options,
      optionsFile,
      file: found.file,
    });
  }
  return followable;
}

/**
 * The position of `arg` among the parameters, counting the elements of array
 * literals spread before it, or undefined when another spread hides it.
 */
function getArgumentIndex(
  args: t.CallExpression['arguments'],
  arg: t.Node
): number | undefined {
  let index = 0;
  for (const current of args) {
    if (current === arg) return index;
    if (!t.isSpreadElement(current)) {
      index++;
      continue;
    }
    const spread = current.argument;
    if (
      !t.isArrayExpression(spread) ||
      spread.elements.some((element) => !element || t.isSpreadElement(element))
    ) {
      return;
    }
    index += spread.elements.length;
  }
}

/**
 * Binding of the parameter that receives the argument at `index`, null when
 * the function declares none there, or undefined when it cannot be followed.
 */
function getParameter(
  fn: NodePath<t.Function>,
  index: number
): Binding | null | undefined {
  const params = fn.node.params.filter(
    (param) => !t.isIdentifier(param, { name: 'this' })
  );
  for (const param of params.slice(0, index + 1)) {
    if (t.isRestElement(param)) return;
  }
  const param = params[index];
  if (!param) return null;
  const id = t.isAssignmentPattern(param) ? param.left : param;
  if (!t.isIdentifier(id)) return;
  return fn.scope.getOwnBinding(id.name);
}

const argumentReads = new WeakMap<t.Function, boolean>();

/** Whether `fn` reads its own `arguments` object. */
function readsArguments(fn: NodePath<t.Function>): boolean {
  if (fn.isArrowFunctionExpression()) return false;
  const cached = argumentReads.get(fn.node);
  if (cached !== undefined) return cached;
  let reads = false;
  fn.traverse({
    Function(inner) {
      if (!inner.isArrowFunctionExpression()) inner.skip();
    },
    Identifier(id) {
      if (id.node.name === 'arguments' && id.isReferencedIdentifier()) {
        reads = true;
        id.stop();
      }
    },
  });
  argumentReads.set(fn.node, reads);
  return reads;
}

function findLocalFunction(
  scope: Scope,
  name: string,
  file: string,
  follower: HelperFollower,
  seen: Set<string>
): FoundFunction | undefined {
  return findBindingFunction(scope.getBinding(name), file, follower, seen);
}

/**
 * `file` as a cache key: platform separators (on Windows, scanned paths use /
 * and resolved ones use \), without `.` or empty segments. `..` is kept
 * because after a symlink it can lead to a different file.
 */
function toPathKey(file: string): string {
  return file
    .split(nodePath.posix.sep)
    .join(nodePath.sep)
    .split(nodePath.sep)
    .filter(
      (segment, index) => index === 0 || (segment !== '' && segment !== '.')
    )
    .join(nodePath.sep);
}

/** The resolved file and export name of an imported value binding. */
function getImportKey(
  binding: Binding | undefined,
  file: string,
  follower: HelperFollower
): string | undefined {
  const path = binding?.path;
  if (
    !path ||
    !(path.isImportSpecifier() || path.isImportDefaultSpecifier()) ||
    !path.parentPath.isImportDeclaration()
  ) {
    return;
  }
  const source = path.parentPath.node.source.value;
  if (isGTMessageImportSource(source)) return;
  let resolved: string | null;
  try {
    resolved = resolveImportPath(
      file,
      source,
      follower.parsingOptions,
      follower.resolvedImports
    );
  } catch {
    return;
  }
  if (!resolved) return;
  const name = path.isImportSpecifier()
    ? getImportedName(path.node)
    : 'default';
  return `${toPathKey(resolved)}\0${name}`;
}

/** The function a binding declares, defines as a const, or imports. */
function findBindingFunction(
  binding: Binding | undefined,
  file: string,
  follower: HelperFollower,
  seen: Set<string>
): FoundFunction | undefined {
  const path = binding?.path;
  if (!path) return;
  if (path.isFunctionDeclaration()) {
    return { fn: path, file, reassigned: !binding.constant };
  }
  // The name of a function expression, inside its own body.
  if (path.isFunctionExpression()) return { fn: path, file };
  if (path.isVariableDeclarator()) {
    const init = path.get('init');
    if (init.isArrowFunctionExpression() || init.isFunctionExpression()) {
      return { fn: init, file, reassigned: !binding.constant };
    }
    return;
  }
  if (
    (path.isImportSpecifier() || path.isImportDefaultSpecifier()) &&
    path.parentPath.isImportDeclaration() &&
    path.parentPath.node.importKind !== 'type' &&
    !(path.isImportSpecifier() && path.node.importKind === 'type')
  ) {
    const name = path.isImportSpecifier()
      ? getImportedName(path.node)
      : 'default';
    return findExport(
      path.parentPath.node.source.value,
      name,
      file,
      follower,
      seen
    );
  }
}

/** The function `source`, imported from `fromFile`, exports as `name`. */
function findExport(
  source: string,
  name: string,
  fromFile: string,
  follower: HelperFollower,
  seen: Set<string>
): FoundFunction | undefined {
  if (isGTMessageImportSource(source)) return;
  let file: string | null;
  try {
    file = resolveImportPath(
      fromFile,
      source,
      follower.parsingOptions,
      follower.resolvedImports
    );
  } catch {
    // A malformed tsconfig.json leaves the import unresolved.
    return;
  }
  if (!file || file.split(nodePath.sep).includes('node_modules')) return;
  const key = `${file}\0${name}`;
  if (seen.has(key)) return;
  seen.add(key);
  const summary = loadExportSummary(file, follower);
  if (!summary) return;
  if (!summary.names.has(name)) {
    // export * never re-exports a default.
    if (name === 'default') return;
    for (const starSource of summary.stars) {
      const found = findExport(starSource, name, file, follower, seen);
      if (found) return found;
    }
    return;
  }
  const program = loadProgram(file, follower);
  if (!program) return;
  const starSources: string[] = [];
  for (const statement of program.get('body')) {
    if (statement.isExportDefaultDeclaration()) {
      if (name !== 'default') continue;
      const declaration = statement.get('declaration');
      // An overload signature, followed by the implementation.
      if (declaration.isTSDeclareFunction()) continue;
      if (declaration.isIdentifier()) {
        return findLocalFunction(
          program.scope,
          declaration.node.name,
          file,
          follower,
          seen
        );
      }
      if (declaration.isFunctionDeclaration()) {
        const id = declaration.node.id;
        const reassigned = !!id && !program.scope.getBinding(id.name)?.constant;
        return { fn: declaration, file, reassigned };
      }
      if (
        declaration.isArrowFunctionExpression() ||
        declaration.isFunctionExpression()
      ) {
        return { fn: declaration, file };
      }
      return;
    }
    if (statement.isExportAllDeclaration()) {
      if (statement.node.exportKind !== 'type') {
        starSources.push(statement.node.source.value);
      }
      continue;
    }
    if (
      !statement.isExportNamedDeclaration() ||
      statement.node.exportKind === 'type'
    ) {
      continue;
    }
    const { declaration, specifiers } = statement.node;
    if (
      (t.isFunctionDeclaration(declaration) && declaration.id?.name === name) ||
      (t.isVariableDeclaration(declaration) &&
        declaration.declarations.some((d) => t.isIdentifier(d.id, { name })))
    ) {
      return findLocalFunction(program.scope, name, file, follower, seen);
    }
    for (const specifier of specifiers) {
      if (
        !t.isExportSpecifier(specifier) ||
        specifier.exportKind === 'type' ||
        (t.isIdentifier(specifier.exported)
          ? specifier.exported.name
          : specifier.exported.value) !== name
      ) {
        continue;
      }
      return statement.node.source
        ? findExport(
            statement.node.source.value,
            specifier.local.name,
            file,
            follower,
            seen
          )
        : findLocalFunction(
            program.scope,
            specifier.local.name,
            file,
            follower,
            seen
          );
    }
  }
  // export * never re-exports a default.
  if (name === 'default') return;
  for (const starSource of starSources) {
    const found = findExport(starSource, name, file, follower, seen);
    if (found) return found;
  }
}

function parseFile(file: string): t.File | undefined {
  try {
    return parse(fs.readFileSync(file, 'utf8'), {
      sourceType: 'module',
      plugins: getSourceParserPlugins(file),
    });
  } catch {
    // A file that cannot be read or parsed has no function to follow.
  }
}

/** The value names a file exports and the sources it re-exports with `export *`. */
function loadExportSummary(
  file: string,
  follower: HelperFollower
): ExportSummary | undefined {
  if (!follower.exportSummaries.has(file)) {
    const ast = parseFile(file);
    let summary: ExportSummary | null = null;
    if (ast) {
      summary = { names: new Set(), stars: [] };
      for (const statement of ast.program.body) {
        if (t.isExportDefaultDeclaration(statement)) {
          summary.names.add('default');
        } else if (t.isExportAllDeclaration(statement)) {
          if (statement.exportKind !== 'type') {
            summary.stars.push(statement.source.value);
          }
        } else if (
          t.isExportNamedDeclaration(statement) &&
          statement.exportKind !== 'type'
        ) {
          const { declaration, specifiers } = statement;
          if (t.isFunctionDeclaration(declaration) && declaration.id) {
            summary.names.add(declaration.id.name);
          } else if (t.isVariableDeclaration(declaration)) {
            for (const declarator of declaration.declarations) {
              if (t.isIdentifier(declarator.id)) {
                summary.names.add(declarator.id.name);
              }
            }
          }
          for (const specifier of specifiers) {
            if (t.isExportSpecifier(specifier)) {
              summary.names.add(
                t.isIdentifier(specifier.exported)
                  ? specifier.exported.name
                  : specifier.exported.value
              );
            }
          }
        }
      }
    }
    follower.exportSummaries.set(file, summary);
  }
  return follower.exportSummaries.get(file) ?? undefined;
}

/** The traversed program of a file that exports a followed function. */
function loadProgram(
  file: string,
  follower: HelperFollower
): NodePath<t.Program> | undefined {
  const { programs } = follower;
  if (programs.has(file)) {
    const cached = programs.get(file)!;
    programs.delete(file);
    programs.set(file, cached);
    return cached ?? undefined;
  }
  let program: NodePath<t.Program> | null = null;
  const ast = parseFile(file);
  if (ast) {
    try {
      traverse(ast, {
        Program(path) {
          program = path;
          path.stop();
        },
      });
    } catch {
      // Babel parses some files whose scopes it cannot build.
      program = null;
    }
  }
  programs.set(file, program);
  if (programs.size > maxCachedPrograms) {
    programs.delete(programs.keys().next().value!);
  }
  return program ?? undefined;
}
