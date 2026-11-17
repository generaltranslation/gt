import type { NodePath, Scope } from '@babel/traverse';
import * as t from '@babel/types';
import { HTML_CONTENT_PROPS } from '@generaltranslation/format';
import { isAcceptedPluralForm, isVariable } from 'generaltranslation/internal';
import type { TransformState } from '../../../state/types';
import { getTrackedVariable } from '../../getTrackedVariable';
import { getCalleeNameFromJsxExpressionParam } from '../../jsx-children/utils/getCalleeNameFromJsxExpressionParam';
import { getBranchComponentParameters } from '../../jsx-children/utils/getBranchComponentParameters';
import { validateChildrenPropertyFromObjectExpression } from '../../../utils/validation/validateChildrenFromObjectExpression';
import { objectPropertyMatchesName } from '../../../utils/parsing/getObjectPropertyFromObjectExpression';
import { GT_COMPONENT_TYPES } from '../../../utils/constants/gt/constants';
import {
  isTranslationComponent,
  isVariableComponent,
} from '../../../utils/constants/gt/helpers';
import { REACT_COMPONENTS } from '../../../utils/constants/react/constants';
import {
  type Evaluation,
  isSideEffectFree,
  keepsEvaluationOrder,
} from './isSideEffectFree';
import { PLURAL_SCENARIOS, selectPluralForm } from './pluralScenarios';

/**
 * Replaces a `<T>` call with the JSX react-core's renderTranslatedChildren
 * renders for `translation`, so no source text or lookup ships; returns why
 * the call was left alone when the output could differ from that render.
 */
export function replaceJsxSource(
  callExprPath: NodePath<t.CallExpression>,
  sourceChildren: unknown,
  translation: unknown,
  state: TransformState
): string | undefined {
  try {
    replace(callExprPath, sourceChildren, translation, state);
    return undefined;
  } catch (error) {
    if (error instanceof Fallback) return error.message;
    throw error;
  }
}

class Fallback extends Error {}

function fail(reason: string): never {
  throw new Fallback(reason);
}

/** Children as react-core sees them: nothing, text, one node, or an array. */
type Slot =
  | { kind: 'empty' }
  | { kind: 'text' }
  | { kind: 'item'; item: Item }
  | { kind: 'array'; items: Item[] };

type VariableItem = {
  type: 'variable';
  key: string;
  /** The minified type it formats as, such as `n` for <Num> */
  variableType: string;
  path: NodePath<t.CallExpression>;
  /** Whether its own expressions are free of side effects */
  free: boolean;
};

type ElementItem = {
  type: 'element';
  kind: 'element' | 'fragment' | 'plural' | 'branch';
  id: number;
  path: NodePath<t.CallExpression>;
  props: t.ObjectExpression;
  children: Slot;
  /** Branch props in source order */
  branches: Map<string, Slot>;
  /** Minified content props the source sets, such as `ti` for title */
  contentProps: string[];
  /** Whether its own expressions are free of side effects */
  free: boolean;
};

type Item = VariableItem | ElementItem;

/** Imports from the JSX runtime the `<T>` call was compiled against. */
type JsxRuntime = {
  source: string;
  jsx?: string;
  jsxs?: string;
  fragment?: string;
};

type Context = {
  state: TransformState;
  scope: Scope;
  runtime: JsxRuntime;
  items: Item[];
  uses: Map<Item, number>;
  emitted: Item[];
};

/** What a slot renders: an expression, an array of children, or nothing. */
type Rendered = t.Expression | t.Expression[] | null;

const EMPTY: Slot = { kind: 'empty' };

const SOURCE_MISMATCH = 'the translation does not match the source children';

// Props each variable component formats with outside <T> as it does inside
const VARIABLE_PROPS: Partial<Record<GT_COMPONENT_TYPES, string[]>> = {
  [GT_COMPONENT_TYPES.Var]: ['children', 'name'],
  [GT_COMPONENT_TYPES.GtInternalVar]: ['children', 'name'],
  [GT_COMPONENT_TYPES.Num]: ['children', 'name', 'options'],
  [GT_COMPONENT_TYPES.GtInternalNum]: ['children', 'name', 'options'],
  [GT_COMPONENT_TYPES.DateTime]: ['children', 'name', 'options'],
  [GT_COMPONENT_TYPES.GtInternalDateTime]: ['children', 'name', 'options'],
  [GT_COMPONENT_TYPES.Currency]: ['children', 'name', 'options', 'currency'],
  [GT_COMPONENT_TYPES.GtInternalCurrency]: [
    'children',
    'name',
    'options',
    'currency',
  ],
};

// Props that would change how a component renders outside <T>
const LOCALE_PROPS = ['locales', '_locale', '_enableI18n'];

// Keys a translated <Branch> branch cannot take without clashing with a prop
const RESERVED_BRANCH_KEYS = new Set([
  'children',
  'branch',
  'key',
  'ref',
  '__proto__',
  ...LOCALE_PROPS,
]);

function replace(
  callExprPath: NodePath<t.CallExpression>,
  sourceChildren: unknown,
  translation: unknown,
  state: TransformState
): void {
  const callExpr = callExprPath.node;
  const runtime = getJsxRuntime(callExpr.callee, callExprPath.scope);
  if (!runtime) fail('the <T> call is not from an imported JSX runtime');
  const [, propsArg, keyArg, ...rest] = callExpr.arguments;
  if (
    rest.length > 0 ||
    !t.isObjectExpression(propsArg) ||
    (keyArg && !t.isExpression(keyArg))
  ) {
    fail('the <T> call has unexpected arguments');
  }
  const propsPath = callExprPath.get(
    'arguments'
  )[1] as NodePath<t.ObjectExpression>;
  const ctx: Context = {
    state,
    scope: callExprPath.scope,
    runtime,
    items: [],
    uses: new Map(),
    emitted: [],
  };

  for (const property of propsArg.properties) {
    if (!t.isObjectProperty(property) || property.computed) {
      fail('<T> has spread or computed props');
    }
    if (objectPropertyMatchesName(property, 'children')) continue;
    if (
      LOCALE_PROPS.some((name) => objectPropertyMatchesName(property, name))
    ) {
      fail('<T> sets its locale');
    }
    if (!isFree(property.value, ctx)) {
      fail('a <T> prop has side effects');
    }
  }

  const childrenPath =
    validateChildrenPropertyFromObjectExpression(propsPath).value;
  const slot = buildSlot(childrenPath, sourceChildren, ctx);
  const rendered = renderSlot(slot, translation, ctx);
  checkUses(ctx);

  const fragment = getFragment(runtime, callExprPath, state);
  callExpr.callee = getJsxCallee(runtime, Array.isArray(rendered));
  callExpr.arguments = [
    fragment,
    t.objectExpression(rendered === null ? [] : [childrenProperty(rendered)]),
    ...(keyArg ? [keyArg] : []),
  ];
}

// ===== Source model ===== //

/** The source children at `path`, aligned with the collected JsxChildren `entry` that carries their ids and keys. */
function buildSlot(
  path: NodePath<t.Expression> | undefined,
  entry: unknown,
  ctx: Context
): Slot {
  if (!path) return EMPTY;
  const node = path.node;
  if (t.isArrayExpression(node)) {
    if (!Array.isArray(entry)) fail(SOURCE_MISMATCH);
    const calls: NodePath<t.CallExpression>[] = [];
    for (const elementPath of path.get('elements')) {
      const element = elementPath.node;
      if (elementPath.isCallExpression()) calls.push(elementPath);
      else if (!element || !isArrayText(element, ctx.scope)) {
        fail('a <T> child is not static');
      }
    }
    const objects = entry.filter(isObjectEntry);
    if (objects.length !== calls.length) fail(SOURCE_MISMATCH);
    return {
      kind: 'array',
      items: calls.map((call, index) => buildItem(call, objects[index], ctx)),
    };
  }
  if (path.isCallExpression()) {
    if (!isObjectEntry(entry)) fail(SOURCE_MISMATCH);
    return { kind: 'item', item: buildItem(path, entry, ctx) };
  }
  return isTruthyText(node, ctx.scope) ? { kind: 'text' } : EMPTY;
}

function buildItem(
  path: NodePath<t.CallExpression>,
  entry: Record<string, unknown>,
  ctx: Context
): Item {
  const { arguments: args } = path.node;
  const [typeArg, propsArg, keyArg] = args;
  if (
    args.length < 2 ||
    args.length > 3 ||
    !t.isExpression(typeArg) ||
    !t.isObjectExpression(propsArg) ||
    (keyArg && !t.isExpression(keyArg)) ||
    !isJsxCall(path.node, ctx)
  ) {
    fail('a <T> child is not a production JSX element');
  }
  const propsPath = path.get('arguments')[1] as NodePath<t.ObjectExpression>;
  const { canonicalName, type } = getComponent(typeArg, ctx);
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
    return addItem(ctx, {
      type: 'variable',
      key: entry.k,
      variableType: entry.v || 'v',
      path,
      free: isFree(path.node, ctx),
    });
  }

  let kind: ElementItem['kind'] = 'element';
  if (isGT) {
    if (canonicalName === GT_COMPONENT_TYPES.Plural) kind = 'plural';
    else if (canonicalName === GT_COMPONENT_TYPES.Branch) kind = 'branch';
    else fail(`<${canonicalName}> inside <T> cannot be replaced`);
  } else if (type === 'react' && canonicalName === REACT_COMPONENTS.Fragment) {
    kind = 'fragment';
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

  const childrenPath =
    validateChildrenPropertyFromObjectExpression(propsPath).value;
  const element: ElementItem = {
    type: 'element',
    kind,
    id: entry.i,
    path,
    props: propsArg,
    children: EMPTY,
    branches: new Map(),
    contentProps: Object.keys(HTML_CONTENT_PROPS).filter(
      (min) => isRecord(entry.d) && entry.d[min] !== undefined
    ),
    free: false,
  };
  addItem(ctx, element);
  element.children = buildSlot(childrenPath, entry.c, ctx);

  if (kind === 'plural' || kind === 'branch') {
    if (propsArg.properties.some((property) => t.isSpreadElement(property))) {
      fail(`<${canonicalName}> has spread props`);
    }
    if (
      LOCALE_PROPS.some((name) =>
        propsArg.properties.some((property) =>
          objectPropertyMatchesName(property, name)
        )
      )
    ) {
      fail(`<${canonicalName}> sets its locale`);
    }
    const sourceBranches =
      isRecord(entry.d) && isRecord(entry.d.b) ? entry.d.b : {};
    for (const [name, valuePath] of getBranchComponentParameters(
      propsPath,
      canonicalName as string
    )) {
      if (
        t.isNullLiteral(valuePath.node) ||
        t.isBooleanLiteral(valuePath.node) ||
        (t.isIdentifier(valuePath.node, { name: 'undefined' }) &&
          !ctx.scope.getBinding('undefined'))
      ) {
        fail(`<${canonicalName}> has an empty branch`);
      }
      element.branches.set(
        name,
        buildSlot(valuePath, sourceBranches[name], ctx)
      );
    }
  }
  element.free = isElementFree(element, ctx);
  return element;
}

function addItem<T extends Item>(ctx: Context, item: T): T {
  ctx.items.push(item);
  return item;
}

// ===== Rendering a translation ===== //

/** What renderTranslatedChildren renders for `target` over `slot`. */
function renderSlot(slot: Slot, target: unknown, ctx: Context): Rendered {
  if (target === null || target === undefined) {
    // react-core renders the source here
    if (slot.kind === 'empty') return null;
    fail('the translation leaves out source content');
  }
  if (typeof target === 'string') return t.stringLiteral(target);
  if (Array.isArray(target)) {
    if (slot.kind === 'empty') fail(SOURCE_MISMATCH);
    const items =
      slot.kind === 'array'
        ? slot.items
        : slot.kind === 'item'
          ? [slot.item]
          : [];
    return target.map((child) => renderArrayChild(items, child, ctx));
  }
  if (isRecord(target) && slot.kind === 'item') {
    const { item } = slot;
    if (isVariable(target)) {
      if (item.type !== 'variable' || item.key !== target.k) {
        fail(SOURCE_MISMATCH);
      }
      return emitVariable(item, ctx);
    }
    if (item.type !== 'element' || item.id !== target.i) fail(SOURCE_MISMATCH);
    return renderElement(item, target, ctx);
  }
  fail(SOURCE_MISMATCH);
}

function renderArrayChild(
  items: Item[],
  child: unknown,
  ctx: Context
): t.Expression {
  if (typeof child === 'string') return t.stringLiteral(child);
  if (isVariable(child)) {
    // react-core binds a name to its last sibling, and formats it as the translation's type
    const variable = [...items]
      .reverse()
      .find(
        (item): item is VariableItem =>
          item.type === 'variable' && item.key === child.k
      );
    if (!variable) fail(SOURCE_MISMATCH);
    if ((child.v || 'v') !== variable.variableType) {
      fail('the translation formats a variable as another type');
    }
    return emitVariable(variable, ctx);
  }
  if (!isRecord(child) || typeof child.i !== 'number') fail(SOURCE_MISMATCH);
  const element = items.find(
    (item): item is ElementItem =>
      item.type === 'element' && item.id === child.i
  );
  if (!element) fail(SOURCE_MISMATCH);
  return renderElement(element, child, ctx);
}

function renderElement(
  element: ElementItem,
  target: Record<string, unknown>,
  ctx: Context
): t.Expression {
  switch (element.kind) {
    case 'plural':
      return renderPlural(element, target, ctx);
    case 'branch':
      return renderBranch(element, target, ctx);
    case 'fragment':
      if (isTruthy(target.c)) {
        const own = use(element, ctx);
        const children = renderSlot(element.children, target.c, ctx);
        return createElement(element, own, [], children, ctx);
      }
      break;
    case 'element':
      if (element.children.kind !== 'empty' && isTruthy(target.c)) {
        const own = use(element, ctx);
        const props = getTranslatedProps(element, target, own, ctx);
        const children = renderSlot(element.children, target.c, ctx);
        return createElement(element, own, props, children, ctx);
      }
      break;
  }
  // react-core renders the source element here, which only matches when it has no content
  if (element.children.kind !== 'empty') {
    fail('the translation leaves out the children of an element');
  }
  if (element.contentProps.length > 0) {
    fail('an element without children keeps its source content props');
  }
  const own = use(element, ctx);
  return own(element.path.node);
}

/** Source props merged with the translated content props, as react-core's cloneElement does. */
function getTranslatedProps(
  element: ElementItem,
  target: Record<string, unknown>,
  own: <N extends t.Node>(node: N) => N,
  ctx: Context
): t.ObjectExpression['properties'] {
  const translated = isRecord(target.d) ? target.d : {};
  const properties = element.props.properties
    .filter((property) => !objectPropertyMatchesName(property, 'children'))
    .map(own);
  for (const [min, name] of Object.entries(HTML_CONTENT_PROPS)) {
    const value = translated[min];
    if (!value) {
      if (element.contentProps.includes(min)) {
        fail(`the translation leaves out the ${name} prop`);
      }
      continue;
    }
    if (typeof value !== 'string') fail(SOURCE_MISMATCH);
    let lastSpread = -1;
    properties.forEach((property, index) => {
      if (t.isSpreadElement(property)) lastSpread = index;
    });
    let matches = 0;
    properties.forEach((property, index) => {
      if (!objectPropertyMatchesName(property, name)) return;
      // A later spread could override a replaced value, as it would the source
      if (index < lastSpread) fail(`a spread follows the ${name} prop`);
      const { key, value: sourceValue } = property as t.ObjectProperty;
      if (!isFree(sourceValue, ctx)) {
        fail(`the ${name} prop has side effects`);
      }
      // A new node, since a later fallback must leave the source props as they were
      properties[index] = t.objectProperty(
        t.cloneNode(key, true),
        t.stringLiteral(value)
      );
      matches += 1;
    });
    if (matches === 0) {
      properties.push(
        t.objectProperty(t.stringLiteral(name), t.stringLiteral(value))
      );
    }
  }
  return properties;
}

/** Inside `<T>` a translated branch matches the source branch `n` selects, which must be the same one for every count. */
function renderPlural(
  element: ElementItem,
  target: Record<string, unknown>,
  ctx: Context
): t.Expression {
  const branches = getTargetBranches(target);
  const sourceForms = [...element.branches.keys()];
  const targetForms = Object.keys(branches).filter(isAcceptedPluralForm);
  const pairs = new Map<string, Set<string>>();
  for (const scenario of PLURAL_SCENARIOS) {
    const sourceForm = selectPluralForm(scenario, sourceForms);
    const form = selectPluralForm(scenario, targetForms);
    // A null branch falls back to the children, inside <T> and out
    const targetForm = form && branches[form] != null ? form : '';
    addPair(pairs, targetForm, sourceForm);
  }
  checkRebuiltProps(element, 'n', ctx);
  const own = use(element, ctx);
  const props: t.ObjectProperty[] = [];
  const n = element.props.properties.find((property) =>
    objectPropertyMatchesName(property, 'n')
  );
  if (n) props.push(own(n as t.ObjectProperty));
  for (const form of orderKeys(sourceForms, targetForms)) {
    if (branches[form] === null) {
      props.push(branchProperty(form, null));
    } else if (pairs.has(form)) {
      props.push(
        branchProperty(
          form,
          renderPaired(element, pairs.get(form)!, branches[form], ctx)
        )
      );
    }
  }
  const children = pairs.has('')
    ? renderPaired(element, pairs.get('')!, target.c, ctx)
    : null;
  return createElement(element, own, props, children, ctx);
}

/** Inside `<T>` a translated branch matches the source branch with its key, or the source children. */
function renderBranch(
  element: ElementItem,
  target: Record<string, unknown>,
  ctx: Context
): t.Expression {
  const branches = getTargetBranches(target);
  // An empty key never selects a branch, inside <T> or out
  const targetKeys = Object.keys(branches).filter((key) => key !== '');
  for (const key of targetKeys) {
    if (RESERVED_BRANCH_KEYS.has(key) || key.startsWith('data-')) {
      fail(`the translation has a <Branch> branch named ${key}`);
    }
  }
  const sourceKeys = [...element.branches.keys()];
  const pairs = new Map<string, Set<string>>();
  // Every key either side has, plus one neither has
  for (const key of new Set([...sourceKeys, ...targetKeys, ''])) {
    addPair(
      pairs,
      key && key in branches ? key : '',
      key && element.branches.has(key) ? key : ''
    );
  }
  checkRebuiltProps(element, 'branch', ctx);
  const own = use(element, ctx);
  const props: t.ObjectProperty[] = [];
  const branch = element.props.properties.find((property) =>
    objectPropertyMatchesName(property, 'branch')
  );
  if (branch) props.push(own(branch as t.ObjectProperty));
  for (const key of orderKeys(sourceKeys, targetKeys)) {
    props.push(
      branchProperty(
        key,
        renderPaired(element, pairs.get(key)!, branches[key], ctx)
      )
    );
  }
  const children = pairs.has('')
    ? renderPaired(element, pairs.get('')!, target.c, ctx)
    : null;
  return createElement(element, own, props, children, ctx);
}

function addPair(
  pairs: Map<string, Set<string>>,
  targetKey: string,
  sourceKey: string
): void {
  const sources = pairs.get(targetKey) ?? new Set<string>();
  sources.add(sourceKey);
  pairs.set(targetKey, sources);
}

/** A translated branch over the source branches it pairs with (`''` is the children); several pairings need text only. */
function renderPaired(
  element: ElementItem,
  sourceKeys: Set<string>,
  target: unknown,
  ctx: Context
): Rendered {
  const slots = [...sourceKeys].map((key) =>
    key === '' ? element.children : element.branches.get(key)!
  );
  if (slots.length === 1) return renderSlot(slots[0], target, ctx);
  const isText =
    typeof target === 'string' ||
    (Array.isArray(target) &&
      target.every((child) => typeof child === 'string') &&
      slots.every((slot) => slot.kind !== 'empty')) ||
    (target == null && slots.every((slot) => slot.kind === 'empty'));
  if (!isText) {
    fail('a translated branch pairs with different source branches');
  }
  return renderSlot(slots[0], target, ctx);
}

function getTargetBranches(
  target: Record<string, unknown>
): Record<string, unknown> {
  if (target.d === undefined) return {};
  if (!isRecord(target.d)) fail(SOURCE_MISMATCH);
  if (target.d.b === undefined) return {};
  if (!isRecord(target.d.b)) fail(SOURCE_MISMATCH);
  return target.d.b;
}

/** Source branch order first, so props still evaluate in source order. */
function orderKeys(sourceKeys: string[], targetKeys: string[]): string[] {
  return [
    ...sourceKeys.filter((key) => targetKeys.includes(key)),
    ...targetKeys.filter((key) => !sourceKeys.includes(key)),
  ];
}

function branchProperty(key: string, rendered: Rendered): t.ObjectProperty {
  return t.objectProperty(
    t.isValidIdentifier(key) ? t.identifier(key) : t.stringLiteral(key),
    toExpression(rendered)
  );
}

function emitVariable(item: VariableItem, ctx: Context): t.Expression {
  return use(item, ctx)(item.path.node);
}

/** Records a use of a source item; its nodes move on the first use and are copied after. */
function use(item: Item, ctx: Context): <N extends t.Node>(node: N) => N {
  const count = ctx.uses.get(item) ?? 0;
  ctx.uses.set(item, count + 1);
  ctx.emitted.push(item);
  return (node) => (count === 0 ? node : t.cloneNode(node, true));
}

function createElement(
  element: ElementItem,
  own: <N extends t.Node>(node: N) => N,
  props: t.ObjectExpression['properties'],
  children: Rendered,
  ctx: Context
): t.CallExpression {
  const [type, , key] = element.path.node.arguments as t.Expression[];
  const call = t.callExpression(
    getJsxCallee(ctx.runtime, Array.isArray(children)),
    [
      own(type),
      t.objectExpression(
        children === null ? props : [...props, childrenProperty(children)]
      ),
      ...(key ? [own(key)] : []),
    ]
  );
  // Like compiled JSX, so bundlers can drop elements nothing uses
  return t.addComment(call, 'leading', ' @__PURE__ ');
}

function childrenProperty(rendered: t.Expression | t.Expression[]) {
  return t.objectProperty(t.identifier('children'), toExpression(rendered));
}

function toExpression(rendered: Rendered): t.Expression {
  if (rendered === null) return t.nullLiteral();
  return Array.isArray(rendered) ? t.arrayExpression(rendered) : rendered;
}

// ===== Side effects ===== //

/** Items must be emitted so their expressions see the values they see in the source. */
function checkUses(ctx: Context): void {
  const evaluations = new Map<Item, Evaluation>(
    ctx.items.map((item) => [
      item,
      { start: getStart(item.path.node), free: item.free },
    ])
  );
  if (
    !keepsEvaluationOrder(
      [...evaluations.values()],
      ctx.emitted.map((item) => evaluations.get(item)!)
    )
  ) {
    fail(
      'the translation drops, repeats or reorders an element with side effects, or moves another across one'
    );
  }
}

/** Whether an element's type, key and props, apart from its content, are free of side effects. */
function isElementFree(element: ElementItem, ctx: Context): boolean {
  const [type, , key] = element.path.node.arguments;
  return (
    isFree(type, ctx) &&
    isFree(key, ctx) &&
    element.props.properties.every((property) => {
      if (t.isSpreadElement(property)) return isFree(property.argument, ctx);
      if (isContentProp(element, property)) return true;
      return t.isObjectProperty(property) && isFree(property.value, ctx);
    })
  );
}

/** The children, or a branch of a <Plural> or <Branch>, which are rendered from the translation. */
function isContentProp(
  element: ElementItem,
  property: t.ObjectExpression['properties'][number]
): boolean {
  return (
    objectPropertyMatchesName(property, 'children') ||
    [...element.branches.keys()].some((name) =>
      objectPropertyMatchesName(property, name)
    )
  );
}

/**
 * Props a <Plural> or <Branch> replacement leaves out must be free to drop, and
 * the one it keeps, which it moves ahead of the branches, free to move there.
 */
function checkRebuiltProps(
  element: ElementItem,
  kept: string,
  ctx: Context
): void {
  let afterContent = false;
  for (const property of element.props.properties) {
    if (isContentProp(element, property)) {
      afterContent = true;
      continue;
    }
    if (
      (afterContent || !objectPropertyMatchesName(property, kept)) &&
      !(t.isObjectProperty(property) && isFree(property.value, ctx))
    ) {
      fail('a <Plural> or <Branch> prop has side effects');
    }
  }
}

function isFree(node: t.Node | null | undefined, ctx: Context): boolean {
  return isSideEffectFree(node, {
    isPureCall: (call) =>
      isJsxCall(call, ctx) &&
      t.isExpression(call.arguments[0]) &&
      !isTranslationCall(call.arguments[0], ctx),
  });
}

function isTranslationCall(type: t.Expression, ctx: Context): boolean {
  const { canonicalName, type: kind } = getComponent(type, ctx);
  return (
    kind === 'generaltranslation' &&
    canonicalName !== undefined &&
    isTranslationComponent(canonicalName)
  );
}

function getStart(node: t.Node): number {
  if (node.start != null) return node.start;
  let start = Infinity;
  t.traverseFast(node, (child) => {
    if (child.start != null) start = Math.min(start, child.start);
  });
  return start;
}

// ===== Helpers ===== //

function getComponent(type: t.Expression, ctx: Context) {
  const { namespaceName, functionName } =
    getCalleeNameFromJsxExpressionParam(type);
  return getTrackedVariable(
    ctx.state.scopeTracker,
    namespaceName,
    functionName
  );
}

/** A call to `jsx` or `jsxs` imported from the same runtime as `<T>`. */
function isJsxCall(call: t.CallExpression, ctx: Context): boolean {
  const runtime = getJsxRuntime(call.callee, ctx.scope);
  return runtime?.source === ctx.runtime.source;
}

/** The JSX runtime a `jsx` or `jsxs` callee is imported from, read from the program since the JSX insertion pass adds imports without bindings. */
function getJsxRuntime(
  callee: t.Expression | t.V8IntrinsicIdentifier,
  scope: Scope
): JsxRuntime | undefined {
  if (!t.isIdentifier(callee)) return;
  const imports = getValueImports(scope);
  const calleeImport = imports.get(callee.name);
  if (calleeImport?.imported !== 'jsx' && calleeImport?.imported !== 'jsxs') {
    return;
  }
  const runtime: JsxRuntime = { source: calleeImport.source };
  for (const [local, { source, imported }] of imports) {
    if (source !== runtime.source) continue;
    if (imported === 'jsx') runtime.jsx ??= local;
    if (imported === 'jsxs') runtime.jsxs ??= local;
    if (imported === REACT_COMPONENTS.Fragment) runtime.fragment ??= local;
  }
  return runtime;
}

/** Named value imports visible at `scope`, by local name. */
function getValueImports(
  scope: Scope
): Map<string, { source: string; imported: string }> {
  const imports = new Map<string, { source: string; imported: string }>();
  const program = scope.getProgramParent().path.node as t.Program;
  for (const statement of program.body) {
    if (!t.isImportDeclaration(statement) || statement.importKind === 'type') {
      continue;
    }
    for (const specifier of statement.specifiers) {
      if (!t.isImportSpecifier(specifier) || specifier.importKind === 'type') {
        continue;
      }
      const binding = scope.getBinding(specifier.local.name);
      // A local binding of the same name shadows the import
      if (binding && binding.path.node !== specifier) continue;
      imports.set(specifier.local.name, {
        source: statement.source.value,
        imported: t.isIdentifier(specifier.imported)
          ? specifier.imported.name
          : specifier.imported.value,
      });
    }
  }
  return imports;
}

// In production builds jsx and jsxs are the same function; jsxs only marks static arrays
function getJsxCallee(runtime: JsxRuntime, isArray: boolean): t.Identifier {
  const name = isArray
    ? (runtime.jsxs ?? runtime.jsx)
    : (runtime.jsx ?? runtime.jsxs);
  return t.identifier(name!);
}

/** The runtime's Fragment, imported once per file if the file lacks it. */
function getFragment(
  runtime: JsxRuntime,
  path: NodePath,
  state: TransformState
): t.Identifier {
  if (runtime.fragment) return t.identifier(runtime.fragment);
  state.sourceReplacementImports ??= new Map();
  let local = state.sourceReplacementImports.get(runtime.source);
  if (!local) {
    local = path.scope
      .getProgramParent()
      .generateUid(REACT_COMPONENTS.Fragment);
    state.sourceReplacementImports.set(runtime.source, local);
  }
  return t.identifier(local);
}

/** Text children in an array, which react-core renders from the translation. */
function isArrayText(node: t.Node, scope: Scope): boolean {
  return (
    t.isStringLiteral(node) ||
    t.isNumericLiteral(node) ||
    (t.isTemplateLiteral(node) && node.expressions.length === 0) ||
    t.isNullLiteral(node) ||
    t.isBooleanLiteral(node) ||
    (t.isUnaryExpression(node) && t.isNumericLiteral(node.argument)) ||
    isUndefined(node, scope)
  );
}

/** Whether single text children are truthy, which decides if react-core renders an element from its translation. */
function isTruthyText(node: t.Node, scope: Scope): boolean {
  if (t.isStringLiteral(node)) return node.value !== '';
  if (t.isTemplateLiteral(node) && node.expressions.length === 0) {
    return node.quasis[0].value.cooked !== '';
  }
  if (t.isNumericLiteral(node) && node.value !== 0) return true;
  if (
    t.isNullLiteral(node) ||
    t.isBooleanLiteral(node, { value: false }) ||
    isUndefined(node, scope)
  ) {
    return false;
  }
  fail('a <T> child is not static');
}

function isUndefined(node: t.Node, scope: Scope): boolean {
  return (
    t.isIdentifier(node, { name: 'undefined' }) &&
    !scope.getBinding('undefined')
  );
}

function isObjectEntry(entry: unknown): entry is Record<string, unknown> {
  return isRecord(entry);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** react-core's `&&` checks on translated children. */
function isTruthy(value: unknown): boolean {
  return Boolean(value);
}

/** Imports the Fragment that replaced `<T>` calls render into, where a file lacked one. */
export function addFragmentImports(
  program: t.Program,
  imports: Map<string, string>
): void {
  program.body.unshift(
    ...Array.from(imports, ([source, local]) =>
      t.importDeclaration(
        [
          t.importSpecifier(
            t.identifier(local),
            t.identifier(REACT_COMPONENTS.Fragment)
          ),
        ],
        t.stringLiteral(source)
      )
    )
  );
}
