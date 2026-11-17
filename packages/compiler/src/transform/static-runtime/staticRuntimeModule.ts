import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import type { MessageTree } from '@generaltranslation/icu';
import { forEachPlaceholder } from '@generaltranslation/icu/internal';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import type { TransformState } from '../../state/types';
import { createErrorLocation } from '../../utils/errors';
import {
  getStaticCountArguments,
  STATIC_HELPERS,
  STATIC_RUNTIME_SOURCE,
  type StaticHelperKind,
  type StaticScope,
} from './resolveStaticRuntime';
import {
  getUncompiledStaticCallSite,
  type UncompiledStaticCallSite,
} from './uncompiledStaticCallSites';

/** What a file needs from the static runtime, and what it could not compile. */
export type StaticRuntimeFile = {
  /** Why the file still needs the GT runtime, each with its location */
  errors: string[];
  /** The call sites among them that reached the compiler in a form it does not transform */
  uncompiled: UncompiledStaticCallSite[];
  /** Local name of each function of the static runtime a call site calls */
  helpers: Partial<Record<StaticHelperKind, string>>;
  /** The module-scope variable that holds each message tree, by the tree's JSON */
  trees: Map<string, string>;
  /** Whether the file was changed */
  changed: boolean;
};

// Imports the app must not keep: these load the GT runtime, which is not started
const RUNTIME_SOURCES =
  /^(gt-react|gt-i18n|@generaltranslation\/react-core)(\/|$)/;

// What the static entry provides under the name gt-react exports it by
const STATIC_EXPORTS = new Set(['initializeGTSPA']);

const HELPER_NAMES: Record<StaticHelperKind, string> = {
  value: 'gtValue',
  tree: 'gtFormat',
  intl: 'gtFormatIntl',
  or: 'gtOr',
};

function getFile(state: TransformState): StaticRuntimeFile {
  return (state.staticRuntime ??= {
    errors: [],
    uncompiled: [],
    helpers: {},
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

/** The local name of a function of the static runtime, imported once the file is done. */
export function getStaticHelper(
  state: TransformState,
  path: NodePath,
  kind: StaticHelperKind
): t.Identifier {
  const { helpers } = getFile(state);
  helpers[kind] ??= path.scope
    .getProgramParent()
    .generateUid(HELPER_NAMES[kind]);
  return t.identifier(helpers[kind]);
}

/**
 * What a call site passes a formatter of the static runtime after its own
 * arguments: the locales of `scope`, then what else formats `tree`. A call
 * site passes these itself, where a module-scope constant would hold them
 * once, because a function can be called before its module has run: through
 * an import cycle, or from a statement above an import.
 */
export function getStaticArguments(
  state: TransformState,
  kind: Exclude<StaticHelperKind, 'or'>,
  scope: StaticScope,
  tree?: MessageTree,
  formats?: t.Expression
): t.Expression[] {
  const runtime = state.settings.staticRuntime!;
  const { locales: scopeLocales, counts: scopeCounts } =
    scope === 'source' ? runtime.source : runtime;
  const timeZone =
    runtime.timeZone === undefined ? [] : [t.stringLiteral(runtime.timeZone)];
  const locales = t.stringLiteral(scopeLocales.join(','));
  if (kind === 'value') return [locales, ...timeZone];
  if (kind === 'intl') {
    return [
      locales,
      ...(formats || timeZone.length > 0
        ? [formats ?? t.unaryExpression('void', t.numericLiteral(0))]
        : []),
      ...timeZone,
    ];
  }
  const counts: (string | number)[] = getStaticCountArguments(
    scopeCounts,
    tree!
  );
  let readsTimeZone = false;
  forEachPlaceholder(tree!, (node) => {
    // A value may be a Date
    if (node[1] === undefined) readsTimeZone = true;
  });
  if (!readsTimeZone || timeZone.length === 0) {
    timeZone.length = 0;
    while (counts.length > 0 && !counts[counts.length - 1]) counts.pop();
  }
  return [
    locales,
    ...counts.map((count) => t.valueToNode(count) as t.Expression),
    ...timeZone,
  ];
}

/**
 * A message tree, built when a call site first formats it and kept in a
 * module-scope variable, so a render allocates none:
 *
 *   _gtTree || (_gtTree = [...])
 *
 * The variable is a `var` that each call site fills, since a `const` cannot
 * be read before its module has run; see `getStaticArguments`.
 */
export function hoistStaticTree(
  state: TransformState,
  path: NodePath,
  tree: MessageTree
): t.Expression {
  const file = getFile(state);
  const key = JSON.stringify(tree);
  let name = file.trees.get(key);
  if (!name) {
    name = path.scope.getProgramParent().generateUid('gtTree');
    file.trees.set(key, name);
  }
  return t.logicalExpression(
    '||',
    t.identifier(name),
    t.assignmentExpression('=', t.identifier(name), treeToNode(tree))
  );
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
 * provides at it, drops the GT imports nothing reads anymore, imports the
 * functions of the static runtime the file calls, declares the variables of
 * its trees, and records every import that still needs the GT runtime.
 * Returns whether the file changed.
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
      for (const reference of references) {
        const site = getUncompiledStaticCallSite(reference, imported, source);
        if (site) file.uncompiled.push(site);
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

  const imports = new Map<string, t.ImportSpecifier[]>(
    staticSpecifiers.length > 0
      ? [[STATIC_RUNTIME_SOURCE, staticSpecifiers]]
      : []
  );
  for (const kind of Object.keys(STATIC_HELPERS) as StaticHelperKind[]) {
    const local = file.helpers[kind];
    if (!local) continue;
    const { name, source } = STATIC_HELPERS[kind];
    imports.set(source, [
      ...(imports.get(source) ?? []),
      t.importSpecifier(t.identifier(local), t.identifier(name)),
    ]);
  }
  if (file.trees.size > 0) {
    let afterImports = 0;
    program.body.forEach((statement, index) => {
      if (t.isImportDeclaration(statement)) afterImports = index + 1;
    });
    program.body.splice(
      afterImports,
      0,
      t.variableDeclaration(
        'var',
        Array.from(file.trees.values(), (name) =>
          t.variableDeclarator(t.identifier(name))
        )
      )
    );
    file.changed = true;
  }
  if (imports.size > 0) {
    // First, so the static runtime has run before a module this one imports
    // calls back into this one through an import cycle
    program.body.unshift(
      ...Array.from(imports, ([source, specifiers]) =>
        t.importDeclaration(specifiers, t.stringLiteral(source))
      )
    );
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
