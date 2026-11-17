import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import type { MessageTree } from '@generaltranslation/icu';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import type { TransformState } from '../../state/types';
import { createErrorLocation } from '../../utils/errors';
import {
  STATIC_FORMATTERS,
  STATIC_RUNTIME_SOURCE,
  type StaticFormatterKind,
} from './resolveStaticRuntime';

/** What a file needs from the static runtime, and what it could not compile. */
export type StaticRuntimeFile = {
  /** Why the file still needs the GT runtime, each with its location */
  errors: string[];
  /** Local name of each formatter a call site formats with */
  formatters: Partial<Record<StaticFormatterKind, string>>;
  /** Module-scope declarations of message trees, by the tree's JSON */
  trees: Map<string, t.VariableDeclaration>;
  /** Whether the file was changed */
  changed: boolean;
};

// Imports the app must not keep: these load the GT runtime, which is not started
const RUNTIME_SOURCES =
  /^(gt-react|gt-i18n|@generaltranslation\/react-core)(\/|$)/;

// What the static entry provides under the name gt-react exports it by
const STATIC_EXPORTS = new Set(['initializeGTSPA']);

const FORMATTER_NAMES: Record<StaticFormatterKind, string> = {
  value: 'gtValue',
  tree: 'gtFormat',
  intl: 'gtFormatIntl',
};

function getFile(state: TransformState): StaticRuntimeFile {
  return (state.staticRuntime ??= {
    errors: [],
    formatters: {},
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

/** The local name of one of this file's formatters, declared once the file is done. */
export function getStaticFormatter(
  state: TransformState,
  path: NodePath,
  kind: StaticFormatterKind
): t.Identifier {
  const { formatters } = getFile(state);
  formatters[kind] ??= path.scope
    .getProgramParent()
    .generateUid(FORMATTER_NAMES[kind]);
  return t.identifier(formatters[kind]);
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
        treeToNode(tree)
      ),
    ]);
    file.trees.set(key, declaration);
  }
  return t.cloneNode(declaration.declarations[0].id as t.Identifier);
}

/** A message tree as a literal, its text printed as written, where the generator would escape non-ASCII text. */
function treeToNode(value: unknown): t.Expression {
  if (typeof value === 'string') {
    const literal = t.stringLiteral(value);
    literal.extra = { rawValue: value, raw: JSON.stringify(value) };
    return literal;
  }
  if (Array.isArray(value)) return t.arrayExpression(value.map(treeToNode));
  if (typeof value === 'object' && value !== null) {
    return t.objectExpression(
      Object.entries(value).map(([key, entry]) =>
        t.objectProperty(
          t.isValidIdentifier(key) ? t.identifier(key) : t.stringLiteral(key),
          treeToNode(entry)
        )
      )
    );
  }
  return t.valueToNode(value);
}

// import('gt-react') or require('gt-react'), as text
const LOADS_RUNTIME =
  /\b(?:import|require)\s*\(\s*['"`](?:gt-react|gt-i18n|@generaltranslation\/react-core)/;

/**
 * Whether a module has anything for `finishStaticRuntimeFile` to do, which
 * most modules of an app, its dependencies included, do not: something
 * compiled against the static runtime, or a mention of a GT runtime package.
 */
export function mayNeedStaticRuntime(
  program: t.Program,
  code: string,
  state: TransformState
): boolean {
  return (
    state.staticRuntime !== undefined ||
    LOADS_RUNTIME.test(code) ||
    program.body.some(
      (statement) =>
        (t.isImportDeclaration(statement) ||
          t.isExportNamedDeclaration(statement) ||
          t.isExportAllDeclaration(statement)) &&
        !!statement.source &&
        RUNTIME_SOURCES.test(statement.source.value)
    )
  );
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
      statement.source.value.startsWith(STATIC_RUNTIME_SOURCE)
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
        !argument.value.startsWith(STATIC_RUNTIME_SOURCE)
      ) {
        addStaticRuntimeError(
          state,
          path.node,
          `loading "${argument.value}" needs the GT runtime`
        );
      }
    },
  });

  // The imports of the static entries, then each formatter, then the trees
  const imports = new Map<string, t.ImportSpecifier[]>(
    staticSpecifiers.length > 0
      ? [[STATIC_RUNTIME_SOURCE, staticSpecifiers]]
      : []
  );
  const formatters: t.Statement[] = [];
  for (const kind of Object.keys(STATIC_FORMATTERS) as StaticFormatterKind[]) {
    const local = file.formatters[kind];
    if (!local) continue;
    const { create, source } = STATIC_FORMATTERS[kind];
    const createLocal = programPath.scope.generateUid(create);
    imports.set(source, [
      ...(imports.get(source) ?? []),
      t.importSpecifier(t.identifier(createLocal), t.identifier(create)),
    ]);
    const call = t.callExpression(t.identifier(createLocal), [
      t.valueToNode(runtime.locales),
      ...(runtime.timeZone === undefined
        ? []
        : [t.stringLiteral(runtime.timeZone)]),
    ]);
    // So a bundler drops the formatter of a module whose call sites it drops
    t.addComment(call, 'leading', ' @__PURE__ ');
    formatters.push(
      t.variableDeclaration('const', [
        t.variableDeclarator(t.identifier(local), call),
      ])
    );
  }
  const declarations: t.Statement[] = [
    ...Array.from(imports, ([source, specifiers]) =>
      t.importDeclaration(specifiers, t.stringLiteral(source))
    ),
    ...formatters,
    ...file.trees.values(),
  ];
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
