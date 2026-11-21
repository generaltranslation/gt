import fs from 'node:fs';
import nodePath from 'node:path';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import type { Binding, NodePath, Scope } from '@babel/traverse';
import * as t from '@babel/types';
import { isGTMessageImportSource } from 'generaltranslation/internal';
import type { ParsingConfigOptions } from '../../../../../types/parsing.js';
import { resolveImportPath } from '../../resolveImportPath.js';
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
  programs: Map<string, NodePath<t.Program> | null>;
  followed: Map<Binding, Set<string>>;
  /** Parameters whose uses are extracted once their file's types load. */
  pending: FollowedParameter[];
};

export function createHelperFollower(
  parsingOptions: ParsingConfigOptions
): HelperFollower {
  return {
    parsingOptions,
    resolvedImports: new Map(),
    programs: new Map(),
    followed: new Map(),
    pending: [],
  };
}

type FoundFunction = { fn: NodePath<t.Function>; file: string };

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
  follower: HelperFollower
): boolean {
  if (!call.isCallExpression() || !t.isIdentifier(call.node.callee)) {
    return false;
  }
  const args = call.node.arguments;
  const index = args.indexOf(arg as (typeof args)[number]);
  if (index < 0 || args.slice(0, index).some((a) => t.isSpreadElement(a))) {
    return false;
  }
  const found = findBindingFunction(
    call.scope.getBinding(call.node.callee.name),
    file,
    follower,
    new Set()
  );
  if (!found) return false;
  const param = getParameter(found.fn, index);
  if (param === undefined) return false;
  if (param === null) return !readsArguments(found.fn);
  const followedOptions = follower.followed.get(param) ?? new Set();
  const key = optionsKey(options);
  if (!followedOptions.has(key)) {
    followedOptions.add(key);
    follower.followed.set(param, followedOptions);
    follower.pending.push({
      binding: param,
      options,
      optionsFile,
      file: found.file,
    });
  }
  return true;
}

const positionKeys = new Set([
  'loc',
  'start',
  'end',
  'range',
  'extra',
  'leadingComments',
  'trailingComments',
  'innerComments',
]);

/** Equal for options written the same way at different call sites. */
function optionsKey(options: TagOptions | undefined): string {
  return options
    ? JSON.stringify(options, (key, value: unknown) =>
        positionKeys.has(key) ? undefined : value
      )
    : '';
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

/** Whether `fn` reads its own `arguments` object. */
function readsArguments(fn: NodePath<t.Function>): boolean {
  if (fn.isArrowFunctionExpression()) return false;
  let reads = false;
  fn.get('body').traverse({
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
    return binding.constant ? { fn: path, file } : undefined;
  }
  if (path.isVariableDeclarator() && binding.constant) {
    const init = path.get('init');
    if (init.isArrowFunctionExpression() || init.isFunctionExpression()) {
      return { fn: init, file };
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
  const file = resolveImportPath(
    fromFile,
    source,
    follower.parsingOptions,
    follower.resolvedImports
  );
  if (!file || file.split(nodePath.sep).includes('node_modules')) return;
  const key = `${file}\0${name}`;
  if (seen.has(key)) return;
  seen.add(key);
  const program = loadProgram(file, follower);
  if (!program) return;
  const starSources: string[] = [];
  for (const statement of program.get('body')) {
    if (statement.isExportDefaultDeclaration()) {
      if (name !== 'default') continue;
      const declaration = statement.get('declaration');
      if (declaration.isIdentifier()) {
        return findLocalFunction(
          program.scope,
          declaration.node.name,
          file,
          follower,
          seen
        );
      }
      if (
        declaration.isFunctionDeclaration() ||
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

/** The parsed program of a file the run follows a tag into, read once. */
function loadProgram(
  file: string,
  follower: HelperFollower
): NodePath<t.Program> | undefined {
  if (!follower.programs.has(file)) {
    let program: NodePath<t.Program> | null = null;
    try {
      const ast = parse(fs.readFileSync(file, 'utf8'), {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });
      traverse(ast, {
        Program(path) {
          program = path;
        },
      });
    } catch {
      // A file that cannot be read or parsed has no function to follow.
    }
    follower.programs.set(file, program);
  }
  return follower.programs.get(file) ?? undefined;
}
