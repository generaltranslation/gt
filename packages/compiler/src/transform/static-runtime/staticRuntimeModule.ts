import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import type { MessageTree } from '@generaltranslation/icu';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import type { TransformState } from '../../state/types';
import { createErrorLocation } from '../../utils/errors';
import { STATIC_RUNTIME_SOURCE } from './resolveStaticRuntime';

/** What a file needs from the static runtime, and what it could not compile. */
export type StaticRuntimeFile = {
  /** Why the file still needs the GT runtime, each with its location */
  errors: string[];
  /** Local name of the formatter, once a call site formats with it */
  formatter?: string;
  /** Module-scope declarations of message trees, by the tree's JSON */
  trees: Map<string, t.VariableDeclaration>;
  /** Whether the file was changed */
  changed: boolean;
};

const CREATE_FORMATTER = 'createStaticFormatter';

// Imports the app must not keep: these load the GT runtime, which is not started
const RUNTIME_SOURCES =
  /^(gt-react|gt-i18n|@generaltranslation\/react-core)(\/|$)/;

// What the static entry provides under the name gt-react exports it by
const STATIC_EXPORTS = new Set(['initializeGTSPA']);

function getFile(state: TransformState): StaticRuntimeFile {
  return (state.staticRuntime ??= {
    errors: [],
    trees: new Map(),
    changed: false,
  });
}

function locate(state: TransformState, node: t.Node): string {
  return createErrorLocation(node)
    .replace('{filename}', state.settings.filename ?? '')
    .trim();
}

/** Records why a call site still needs the GT runtime; the build fails with every reason. */
export function addStaticRuntimeError(
  state: TransformState,
  node: t.Node,
  reason: string
): void {
  getFile(state).errors.push(`${locate(state, node)}: ${reason}`);
}

export function addStaticRuntimeWarning(
  state: TransformState,
  node: t.Node,
  reason: string
): void {
  state.logger.logWarning(`${locate(state, node)}: ${reason}`);
}

/** The local name of this file's formatter, declared once the file is done. */
export function getStaticFormatter(
  state: TransformState,
  path: NodePath
): t.Identifier {
  const file = getFile(state);
  file.formatter ??= path.scope.getProgramParent().generateUid('gtFormat');
  return t.identifier(file.formatter);
}

/** Declares a message tree once per file at module scope, so a render allocates none. */
export function hoistStaticTree(
  state: TransformState,
  path: NodePath,
  tree: MessageTree
): t.Identifier {
  const file = getFile(state);
  const key = JSON.stringify(tree);
  let declaration = file.trees.get(key);
  if (!declaration) {
    declaration = t.variableDeclaration('const', [
      t.variableDeclarator(
        path.scope.getProgramParent().generateUidIdentifier('gtTree'),
        t.valueToNode(tree)
      ),
    ]);
    file.trees.set(key, declaration);
  }
  return t.cloneNode(declaration.declarations[0].id as t.Identifier);
}

/**
 * Finishes a file of a static-runtime build: points what the static entry
 * provides at it, drops the GT imports nothing reads anymore, declares the
 * file's formatter and trees, and records every import that still needs the
 * GT runtime. Returns whether the file changed.
 */
export function finishStaticRuntimeFile(
  programPath: NodePath<t.Program>,
  state: TransformState
): boolean {
  const runtime = state.settings.staticRuntime;
  if (!runtime) return false;
  const file = getFile(state);
  const program = programPath.node;
  // Earlier passes rewrote call sites without updating the bindings
  programPath.scope.crawl();

  const staticSpecifiers: t.ImportSpecifier[] = [];
  // A copy, since a declaration left without specifiers is removed
  for (const statement of program.body.slice()) {
    if (
      (t.isExportNamedDeclaration(statement) ||
        t.isExportAllDeclaration(statement)) &&
      statement.source &&
      RUNTIME_SOURCES.test(statement.source.value) &&
      statement.exportKind !== 'type'
    ) {
      addStaticRuntimeError(
        state,
        statement,
        `re-exporting from "${statement.source.value}" needs the GT runtime`
      );
      continue;
    }
    if (
      !t.isImportDeclaration(statement) ||
      statement.importKind === 'type' ||
      !RUNTIME_SOURCES.test(statement.source.value) ||
      statement.source.value === STATIC_RUNTIME_SOURCE
    ) {
      continue;
    }
    const source = statement.source.value;
    if (statement.specifiers.length === 0) {
      addStaticRuntimeError(
        state,
        statement,
        `importing "${source}" for its side effects needs the GT runtime`
      );
      continue;
    }
    statement.specifiers = statement.specifiers.filter((specifier) => {
      if (t.isImportSpecifier(specifier) && specifier.importKind === 'type') {
        return true;
      }
      const binding = programPath.scope.getBinding(specifier.local.name);
      const references =
        binding?.path.node === specifier ? binding.referencePaths : [];
      const imported = t.isImportSpecifier(specifier)
        ? t.isIdentifier(specifier.imported)
          ? specifier.imported.name
          : specifier.imported.value
        : undefined;
      if (references.length === 0) {
        file.changed = true;
        return false;
      }
      if (
        source === 'gt-react' &&
        imported !== undefined &&
        STATIC_EXPORTS.has(imported)
      ) {
        staticSpecifiers.push(specifier as t.ImportSpecifier);
        file.changed = true;
        return false;
      }
      addStaticRuntimeError(
        state,
        references[0].node,
        `${imported ?? specifier.local.name} from "${source}" needs the GT runtime`
      );
      return true;
    });
    if (statement.specifiers.length === 0) {
      program.body.splice(program.body.indexOf(statement), 1);
    }
  }

  programPath.traverse({
    // import('gt-react') and require('gt-react')
    CallExpression(path) {
      const [argument] = path.node.arguments;
      if (
        (t.isImport(path.node.callee) ||
          t.isIdentifier(path.node.callee, { name: 'require' })) &&
        t.isStringLiteral(argument) &&
        RUNTIME_SOURCES.test(argument.value) &&
        argument.value !== STATIC_RUNTIME_SOURCE
      ) {
        addStaticRuntimeError(
          state,
          path.node,
          `loading "${argument.value}" needs the GT runtime`
        );
      }
    },
  });

  const declarations: t.Statement[] = [];
  if (file.formatter) {
    const create = programPath.scope.generateUid(CREATE_FORMATTER);
    staticSpecifiers.push(
      t.importSpecifier(t.identifier(create), t.identifier(CREATE_FORMATTER))
    );
    const call = t.callExpression(t.identifier(create), [
      t.valueToNode(runtime.locales),
      ...(runtime.timeZone === undefined
        ? []
        : [t.stringLiteral(runtime.timeZone)]),
    ]);
    // So a bundler drops the formatter of a module whose call sites it drops
    t.addComment(call, 'leading', ' @__PURE__ ');
    declarations.push(
      t.variableDeclaration('const', [
        t.variableDeclarator(t.identifier(file.formatter), call),
      ]),
      ...file.trees.values()
    );
  }
  if (staticSpecifiers.length > 0) {
    declarations.unshift(
      t.importDeclaration(
        staticSpecifiers,
        t.stringLiteral(STATIC_RUNTIME_SOURCE)
      )
    );
  }
  if (declarations.length > 0) {
    let afterImports = 0;
    program.body.forEach((statement, index) => {
      if (t.isImportDeclaration(statement)) afterImports = index + 1;
    });
    program.body.splice(afterImports, 0, ...declarations);
    file.changed = true;
  }
  return file.changed;
}

/** The build error for the call sites of a file that still need the GT runtime. */
export function createStaticRuntimeError(errors: string[]): string {
  return createDiagnosticMessage({
    source: '@generaltranslation/compiler',
    severity: 'Error',
    whatHappened:
      'experimentalStaticRuntime is set, but this module still needs the GT runtime',
    why: 'a static-runtime build leaves the runtime out, so everything it would do has to be resolved at build time',
    fix: 'Change these call sites to a `t` template from gt-react/unstable or a static <T>, or turn off experimentalStaticRuntime. With logLevel: "debug" the compiler logs why a <T> was kept',
    details: errors,
  });
}
