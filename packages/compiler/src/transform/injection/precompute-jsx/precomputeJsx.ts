import type { NodePath, Scope } from '@babel/traverse';
import * as t from '@babel/types';
import { isVariable } from 'generaltranslation/internal';
import type { TransformState } from '../../../state/types';
import { getTrackedVariable } from '../../getTrackedVariable';
import { getCalleeNameFromJsxExpressionParam } from '../../jsx-children/utils/getCalleeNameFromJsxExpressionParam';
import { getBranchComponentParameters } from '../../jsx-children/utils/getBranchComponentParameters';
import { validateChildrenPropertyFromObjectExpression } from '../../../utils/validation/validateChildrenFromObjectExpression';
import { objectPropertyMatchesName } from '../../../utils/parsing/getObjectPropertyFromObjectExpression';
import {
  GT_COMPONENT_TYPES,
  GT_IMPORT_SOURCES,
} from '../../../utils/constants/gt/constants';
import { isVariableComponent } from '../../../utils/constants/gt/helpers';
import { REACT_COMPONENTS } from '../../../utils/constants/react/constants';
import { isSideEffectFree } from '../inline-translations/isSideEffectFree';
import {
  LOCALE_PROPS,
  VARIABLE_PROPS,
} from '../inline-translations/replaceJsxSource';

/** The runtime components a precomputed `<T>` call renders with. */
export const PRECOMPUTED_TEXT_COMPONENT = 'GtInternalPrecomputedText';
export const PRECOMPUTED_JSX_COMPONENT = 'GtInternalPrecomputedJsx';

// Sources that export the runtime components
const PRECOMPUTED_SOURCES: ReadonlySet<string> = new Set([
  GT_IMPORT_SOURCES.GT_REACT,
]);

// Props of <T> that only its hash and its dev-time requests read
const HASH_PROPS = ['_hash', 'id', 'context', 'maxChars', 'requiresReview'];

const SOURCE_MISMATCH = 'the children do not match the collected source';

/** A variable or element of the source children, as the runtime reads it. */
type PrecomputedNode = {
  i?: number;
  k?: string;
  x?: number;
  t?: 'p' | 'b' | 'f';
  c?: PrecomputedChildren;
  b?: Record<string, PrecomputedChildren>;
};
type PrecomputedChild = string | boolean | null | PrecomputedNode;
type PrecomputedChildren = PrecomputedChild | PrecomputedChild[];

type Context = {
  state: TransformState;
  scope: Scope;
  /** The expression of each slot, in the order the source evaluates them */
  slots: t.Expression[];
  /** Changes to the source nodes, applied once the whole call is known to precompute */
  changes: (() => void)[];
};

class Fallback extends Error {}

function fail(reason: string): never {
  throw new Fallback(reason);
}

/**
 * Rewrites a `<T>` call into a precomputed component: the source children
 * become static data, and the values of a render fill its slots. Returns why
 * the call was left alone when it cannot be precomputed.
 */
export function precomputeJsx(
  callExprPath: NodePath<t.CallExpression>,
  sourceChildren: unknown,
  hash: string,
  state: TransformState
): string | undefined {
  try {
    precompute(callExprPath, sourceChildren, hash, state);
    return undefined;
  } catch (error) {
    if (error instanceof Fallback) return error.message;
    throw error;
  }
}

function precompute(
  callExprPath: NodePath<t.CallExpression>,
  sourceChildren: unknown,
  hash: string,
  state: TransformState
): void {
  const callExpr = callExprPath.node;
  const [typeArg, propsArg, keyArg, ...rest] = callExpr.arguments;
  if (
    rest.length > 0 ||
    !t.isIdentifier(typeArg) ||
    !t.isObjectExpression(propsArg) ||
    (keyArg && !t.isExpression(keyArg))
  ) {
    fail('the <T> call has unexpected arguments');
  }
  const importSource = getImportSource(callExprPath.scope, typeArg.name);
  if (!importSource || !PRECOMPUTED_SOURCES.has(importSource)) {
    fail('<T> is not imported from a package with precomputed components');
  }
  // An enclosing <T> renders this one as part of its own content
  if (
    [...(state.openTranslationCalls ?? [])].some((open) => open !== callExpr)
  ) {
    fail('the <T> is inside another <T>');
  }

  const ctx: Context = {
    state,
    scope: callExprPath.scope,
    slots: [],
    changes: [],
  };
  let inline: t.Expression | undefined;
  for (const property of propsArg.properties) {
    if (!t.isObjectProperty(property) || property.computed) {
      fail('<T> has spread or computed props');
    }
    if (objectPropertyMatchesName(property, 'children')) continue;
    if (objectPropertyMatchesName(property, 'inline')) {
      if (!t.isExpression(property.value) || !isFree(property.value)) {
        fail('the inline prop of <T> has side effects');
      }
      inline = property.value;
      continue;
    }
    if (!HASH_PROPS.some((name) => objectPropertyMatchesName(property, name))) {
      fail('<T> has a prop that changes how it renders');
    }
  }

  const propsPath = callExprPath.get(
    'arguments'
  )[1] as NodePath<t.ObjectExpression>;
  const childrenPath =
    validateChildrenPropertyFromObjectExpression(propsPath).value;
  const source = buildChildren(childrenPath, sourceChildren, ctx);
  if (source === undefined) fail('<T> has no children');

  ctx.changes.forEach((change) => change());
  const isText = typeof source === 'string';
  const properties = [
    t.objectProperty(t.identifier('h'), t.stringLiteral(hash)),
    t.objectProperty(
      t.identifier('s'),
      isText
        ? t.stringLiteral(source)
        : hoistSource(source, callExprPath, state)
    ),
  ];
  if (!isText) {
    properties.push(
      t.objectProperty(t.identifier('v'), t.arrayExpression(ctx.slots))
    );
  }
  if (inline) properties.push(t.objectProperty(t.identifier('i'), inline));
  callExpr.arguments = [
    getComponent(
      isText ? PRECOMPUTED_TEXT_COMPONENT : PRECOMPUTED_JSX_COMPONENT,
      importSource,
      callExprPath,
      state
    ),
    t.objectExpression(properties),
    ...(keyArg ? [keyArg] : []),
  ];
}

// ===== Source children ===== //

/** The children at `path` as static data, aligned with the collected JsxChildren `entry` that carries their ids and names. */
function buildChildren(
  path: NodePath<t.Expression> | undefined,
  entry: unknown,
  ctx: Context
): PrecomputedChildren | undefined {
  if (!path) {
    if (entry !== undefined) fail(SOURCE_MISMATCH);
    return undefined;
  }
  if (path.isArrayExpression()) {
    if (!Array.isArray(entry)) fail(SOURCE_MISMATCH);
    const calls = path
      .get('elements')
      .filter((element): element is NodePath<t.CallExpression> =>
        element.isCallExpression()
      );
    let next = 0;
    const children = entry.map((child): PrecomputedChild => {
      if (typeof child === 'string') return child;
      const call = calls[next++];
      if (!isRecord(child) || !call) fail(SOURCE_MISMATCH);
      return buildChild(call, child, ctx);
    });
    if (next !== calls.length) fail(SOURCE_MISMATCH);
    return children;
  }
  if (path.isCallExpression()) {
    if (!isRecord(entry)) fail(SOURCE_MISMATCH);
    return buildChild(path, entry, ctx);
  }
  if (
    entry !== undefined &&
    entry !== null &&
    typeof entry !== 'string' &&
    typeof entry !== 'boolean'
  ) {
    fail(SOURCE_MISMATCH);
  }
  return entry;
}

function buildChild(
  path: NodePath<t.CallExpression>,
  entry: Record<string, unknown>,
  ctx: Context
): PrecomputedNode {
  const { arguments: args } = path.node;
  const [typeArg, propsArg, keyArg] = args;
  if (
    args.length < 2 ||
    args.length > 3 ||
    !t.isExpression(typeArg) ||
    !t.isObjectExpression(propsArg) ||
    (keyArg && !t.isExpression(keyArg))
  ) {
    fail('a <T> child is not a production JSX element');
  }
  const propsPath = path.get('arguments')[1] as NodePath<t.ObjectExpression>;
  const { namespaceName, functionName } =
    getCalleeNameFromJsxExpressionParam(typeArg);
  const { canonicalName, type } = getTrackedVariable(
    ctx.state.scopeTracker,
    namespaceName,
    functionName
  );
  const isGT = type === 'generaltranslation' && canonicalName !== undefined;

  if (isGT && isVariableComponent(canonicalName)) {
    const allowed = VARIABLE_PROPS[canonicalName as GT_COMPONENT_TYPES];
    if (
      !allowed ||
      !propsArg.properties.every(
        (property) =>
          t.isObjectProperty(property) &&
          !property.computed &&
          allowed.some((name) => objectPropertyMatchesName(property, name))
      )
    ) {
      fail(`<${canonicalName}> has props it formats differently outside <T>`);
    }
    if (!isVariable(entry)) fail(SOURCE_MISMATCH);
    return { k: entry.k, x: ctx.slots.push(path.node) - 1 };
  }

  if (typeof entry.i !== 'number' || isVariable(entry)) fail(SOURCE_MISMATCH);
  if (
    propsArg.properties.some(
      (property) =>
        t.isObjectMethod(property) ||
        (t.isObjectProperty(property) && property.computed)
    )
  ) {
    fail('a <T> child has computed props');
  }
  if (isGT) {
    if (
      canonicalName !== GT_COMPONENT_TYPES.Plural &&
      canonicalName !== GT_COMPONENT_TYPES.Branch
    ) {
      fail(`<${canonicalName}> inside <T> cannot be precomputed`);
    }
    return buildBranches(path, propsPath, entry, canonicalName, ctx);
  }

  const childrenPath =
    validateChildrenPropertyFromObjectExpression(propsPath).value;
  if (type === 'react' && canonicalName === REACT_COMPONENTS.Fragment) {
    if (
      !propsArg.properties.every((property) =>
        objectPropertyMatchesName(property, 'children')
      ) ||
      !isFree(keyArg)
    ) {
      fail('a fragment has props');
    }
    const children = buildChildren(childrenPath, entry.c, ctx);
    return {
      i: entry.i,
      t: 'f',
      ...(children !== undefined && { c: children }),
    };
  }

  // The element takes its slot before its children take theirs
  const slot = ctx.slots.push(path.node) - 1;
  const children = buildChildren(childrenPath, entry.c, ctx);
  if (!children) {
    if (ctx.slots.length > slot + 1) fail(SOURCE_MISMATCH);
    return { i: entry.i, x: slot };
  }
  // react-core reads the children at runtime, where the number 0 is no content
  const childrenNode = childrenPath?.node;
  if (
    (t.isNumericLiteral(childrenNode) || t.isUnaryExpression(childrenNode)) &&
    Number(children) === 0
  ) {
    fail('an element has the number 0 as its children');
  }
  const { properties } = propsArg;
  const childrenIndex = properties.findIndex((property) =>
    objectPropertyMatchesName(property, 'children')
  );
  const after = properties.slice(childrenIndex + 1);
  // A later children prop or spread could replace the children that move out
  if (
    after.some(
      (property) =>
        t.isSpreadElement(property) ||
        objectPropertyMatchesName(property, 'children')
    )
  ) {
    fail('an element sets its children more than once');
  }
  // The slot evaluates the rest of the element before the slots of its children
  if (
    ctx.slots.length > slot + 1 &&
    !(
      after.every(
        (property) => t.isObjectProperty(property) && isFree(property.value)
      ) && isFree(keyArg)
    )
  ) {
    fail('an element has side effects after its children');
  }
  ctx.changes.push(() => {
    properties.splice(childrenIndex, 1);
  });
  return { i: entry.i, x: slot, c: children };
}

/** A `<Plural>` or `<Branch>`: its slot is the value it selects with, and its branches are static. */
function buildBranches(
  path: NodePath<t.CallExpression>,
  propsPath: NodePath<t.ObjectExpression>,
  entry: Record<string, unknown>,
  canonicalName: string,
  ctx: Context
): PrecomputedNode {
  const isPlural = canonicalName === GT_COMPONENT_TYPES.Plural;
  const control = isPlural ? 'n' : 'branch';
  const { properties } = propsPath.node;
  const branchPaths = new Map(
    getBranchComponentParameters(propsPath, canonicalName)
  );
  const sourceBranches =
    isRecord(entry.d) && isRecord(entry.d.b) ? entry.d.b : {};
  if (!isFree(path.node.arguments[2])) {
    fail(`<${canonicalName}> has a key with side effects`);
  }

  const slot =
    ctx.slots.push(t.unaryExpression('void', t.numericLiteral(0))) - 1;
  const branches: Record<string, PrecomputedChildren> = {};
  let children: PrecomputedChildren | undefined;
  properties.forEach((property, index) => {
    if (!t.isObjectProperty(property)) {
      fail(`<${canonicalName}> has spread props`);
    }
    if (!t.isIdentifier(property.key) && !t.isStringLiteral(property.key)) {
      fail(`<${canonicalName}> has a prop without a name`);
    }
    const name = t.isIdentifier(property.key)
      ? property.key.name
      : property.key.value;
    if (LOCALE_PROPS.includes(name)) {
      fail(`<${canonicalName}> sets its locale`);
    }
    // In the object the branches are written as, this key is the prototype
    if (name === '__proto__') {
      fail(`<${canonicalName}> has a branch named __proto__`);
    }
    if (name === control) {
      if (!t.isExpression(property.value)) fail(SOURCE_MISMATCH);
      // The slot evaluates it before the slots of the branches
      if (index > 0 && !isFree(property.value)) {
        fail(`<${canonicalName}> has side effects after its branches`);
      }
      ctx.slots[slot] = property.value;
      return;
    }
    if (name === 'children') {
      children = buildChildren(
        propsPath
          .get('properties')
          [index].get('value') as NodePath<t.Expression>,
        entry.c,
        ctx
      );
      return;
    }
    const branchPath = branchPaths.get(name);
    if (!branchPath) fail(`<${canonicalName}> has a ${name} prop`);
    const branch = buildChildren(branchPath, sourceBranches[name], ctx);
    if (branch == null || typeof branch === 'boolean') {
      fail(`<${canonicalName}> has an empty branch`);
    }
    branches[name] = branch;
  });
  if (
    Object.keys(sourceBranches).some((name) => branches[name] === undefined)
  ) {
    fail(SOURCE_MISMATCH);
  }

  return {
    i: entry.i as number,
    t: isPlural ? 'p' : 'b',
    x: slot,
    ...(Object.keys(branches).length > 0 && { b: branches }),
    ...(children !== undefined && { c: children }),
  };
}

// ===== Helpers ===== //

function isFree(node: t.Node | null | undefined): boolean {
  return isSideEffectFree(node, { isPureCall: () => false });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The module a named import binds `name` from, read from the program since the JSX insertion pass adds imports without bindings. */
function getImportSource(scope: Scope, name: string): string | undefined {
  const program = scope.getProgramParent().path.node as t.Program;
  for (const statement of program.body) {
    if (!t.isImportDeclaration(statement) || statement.importKind === 'type') {
      continue;
    }
    for (const specifier of statement.specifiers) {
      if (!t.isImportSpecifier(specifier) || specifier.local.name !== name) {
        continue;
      }
      const binding = scope.getBinding(name);
      // A local binding of the same name shadows the import
      return binding && binding.path.node !== specifier
        ? undefined
        : statement.source.value;
    }
  }
  return undefined;
}

/** The local name of a runtime component, imported once per file and source. */
function getComponent(
  component: string,
  source: string,
  path: NodePath,
  state: TransformState
): t.Identifier {
  state.precomputedJsxImports ??= new Map();
  const key = JSON.stringify([source, component]);
  let local = state.precomputedJsxImports.get(key);
  if (!local) {
    local = path.scope.getProgramParent().generateUid(component);
    state.precomputedJsxImports.set(key, local);
  }
  return t.identifier(local);
}

/** Declares the static source children once at module scope, so a render allocates none of them. */
function hoistSource(
  source: PrecomputedChildren,
  path: NodePath,
  state: TransformState
): t.Identifier {
  const local = path.scope.getProgramParent().generateUid('gtSource');
  state.precomputedJsxSources ??= [];
  state.precomputedJsxSources.push(
    t.variableDeclaration('const', [
      t.variableDeclarator(t.identifier(local), t.valueToNode(source)),
    ])
  );
  return t.identifier(local);
}

/** Adds the imports and module-scope declarations of a file's precomputed calls, ahead of the code that reads them. */
export function addPrecomputedJsxDeclarations(
  program: t.Program,
  state: TransformState
): void {
  const specifiers = new Map<string, t.ImportSpecifier[]>();
  for (const [key, local] of state.precomputedJsxImports ?? []) {
    const [source, component] = JSON.parse(key) as [string, string];
    specifiers.set(source, [
      ...(specifiers.get(source) ?? []),
      t.importSpecifier(t.identifier(local), t.identifier(component)),
    ]);
  }
  const imports = Array.from(specifiers, ([source, names]) =>
    t.importDeclaration(names, t.stringLiteral(source))
  );
  let afterImports = 0;
  program.body.forEach((statement, index) => {
    if (t.isImportDeclaration(statement)) afterImports = index + 1;
  });
  program.body.splice(
    afterImports,
    0,
    ...imports,
    ...(state.precomputedJsxSources ?? [])
  );
}
