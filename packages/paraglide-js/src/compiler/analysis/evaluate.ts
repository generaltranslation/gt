import {
  staticKeyName,
  staticPropertyName,
  staticString,
  unwrapExpression,
  type ESTree,
  type Node,
} from './ast.js';
import type { Candidate } from './call-sites.js';
import { keyAlternatives } from './computed-keys.js';
import { aliasScope, readsProps, type Binding, type Scope } from './scope.js';
import type { TrackedNamespace, TrackedSymbol, TrackedValue } from './types.js';

/** A value an object holds under a name, or an object it spreads. */
export type Layer = { name: string; value: Node } | { spread: Node };

type ClassElement =
  | ESTree.PropertyDefinition
  | ESTree.AccessorProperty
  | ESTree.MethodDefinition;

const MAX_DEPTH = 64;

/** More distinct values than this, e.g. of a helper called with every message, become one `*`. */
const MAX_VALUES = 16;

const inProgress = new Set<object>();
let depth = 0;

const membersBeingRead = new WeakMap<ESTree.Class, Set<string>>();

/** What a node refers to; undefined if it is not tracked. */
export function evaluate(
  expression: Node,
  scope: Scope
): TrackedSymbol | undefined {
  const node = unwrapExpression(expression);

  switch (node.type) {
    case 'Identifier':
      return scope.lookupAt(node);
    case 'ThisExpression':
      return scope.thisAt(node);
    case 'MemberExpression':
      return evaluateMember(node, scope);
    case 'ObjectExpression':
      return layeredNamespace(
        () => node.properties.flatMap(propertyLayer),
        scope
      );
    case 'AwaitExpression':
      return evaluateAwait(node, scope);
    case 'CallExpression':
      return evaluateCall(node, scope);
    default:
      return undefined;
  }
}

/**
 * Every value a node may refer to: `m[cond ? "a" : "b"]` refers to two
 * messages. A key with unknown parts gives a `dynamic` value whose name is a
 * pattern: `m[key]` → "*", `` m[`err_${code}`] `` → "err_*".
 */
export function evaluateAll(expression: Node, scope: Scope): TrackedSymbol[] {
  const node = unwrapExpression(expression);

  if (node.type === 'Identifier') return scope.lookupAllAt(node);
  if (readsProps(node, scope)) return propsOf(scope);
  if (node.type !== 'MemberExpression') return toList(evaluate(node, scope));

  const name = staticPropertyName(node);

  if (name !== undefined) {
    const objects = evaluateAll(node.object, scope);
    return distinct(
      objects.flatMap((object) => toList(memberOf(object, name)))
    );
  }

  return node.computed ? distinct(computedMembers(node, scope)) : [];
}

/** Every value a binding may hold; `read` narrows a reassigned variable to the writes reaching it. */
export function resolveBinding(binding: Binding, read?: Node): TrackedSymbol[] {
  if (binding.type === 'shadow') return [];
  if (binding.type === 'lazy') return toList(binding.get());

  return guarded(binding, () => {
    if (binding.type === 'values') {
      const candidates =
        read && binding.at ? binding.at(read) : binding.candidates();
      return distinct(candidates.flatMap(evaluateCandidate));
    }

    const scope = aliasScope(binding);
    if (!scope) return [];

    return evaluateAll(binding.init, scope).flatMap((symbol) =>
      toList(followPath(symbol, binding.path))
    );
  });
}

export function followCandidate(
  candidate: Candidate,
  path: readonly string[]
): Candidate {
  if (path.length === 0) return candidate;

  if (candidate.type === 'expression') {
    return { ...candidate, path: [...candidate.path, ...path] };
  }

  return {
    type: 'computed',
    get: () =>
      candidate.get().flatMap((symbol) => toList(followPath(symbol, path))),
  };
}

export function followPath(
  symbol: TrackedSymbol | undefined,
  path: readonly string[]
): TrackedSymbol | undefined {
  return path.reduce(memberOf, symbol);
}

export function memberOf(
  symbol: TrackedSymbol | undefined,
  name: string
): TrackedSymbol | undefined {
  return symbol?.type === 'namespace' ? symbol.member(name) : undefined;
}

export function isDynamic(symbol: TrackedSymbol): boolean {
  return symbol.type === 'value' && symbol.dynamic === true;
}

/**
 * An object whose later layers override earlier ones: `{ title: m.title, ...m }`,
 * `<Show msgs={m} {...rest} />`, `Object.assign({}, m)`.
 */
export function layeredNamespace(
  layers: () => readonly Layer[],
  scope: Scope
): TrackedNamespace {
  return {
    type: 'namespace',
    member(name) {
      for (const layer of layers().toReversed()) {
        if ('spread' in layer) {
          const member = memberOf(evaluate(layer.spread, scope), name);
          if (member) return member;
          continue;
        }

        if (layer.name === name) return evaluate(layer.value, scope);
      }

      return undefined;
    },
  };
}

/** A class's fields and getters: `label = m.title`, `get label() { return m.title }`. */
export function classNamespace(
  classNode: ESTree.Class,
  scope: Scope
): TrackedNamespace {
  return {
    type: 'namespace',
    member(name) {
      let reading = membersBeingRead.get(classNode);
      if (!reading) membersBeingRead.set(classNode, (reading = new Set()));

      // `label = this.label` refers to itself.
      if (reading.has(name)) return undefined;

      reading.add(name);
      try {
        return classMember(classNode, name, scope);
      } finally {
        reading.delete(name);
      }
    },
  };
}

/** The specifier of `require("x")`; with a scope, only when `require` is the global one. */
export function requireSpecifier(
  call: ESTree.CallExpression,
  scope?: Scope
): string | undefined {
  const callee = unwrapExpression(call.callee);
  if (callee.type !== 'Identifier' || callee.name !== 'require')
    return undefined;

  const isShadowed = scope !== undefined && !scope.isGlobal(callee);
  if (isShadowed) return undefined;

  return staticString(call.arguments[0]);
}

function evaluateMember(
  node: ESTree.MemberExpression,
  scope: Scope
): TrackedSymbol | undefined {
  if (readsProps(node, scope)) return propsOf(scope)[0];

  const name = staticPropertyName(node);
  if (node.computed && name === undefined) return evaluateAll(node, scope)[0];

  const object = evaluate(node.object, scope);

  return name === undefined ? undefined : memberOf(object, name);
}

/** `await import("./messages.js")` */
function evaluateAwait(
  node: ESTree.AwaitExpression,
  scope: Scope
): TrackedSymbol | undefined {
  const awaited = unwrapExpression(node.argument);
  if (awaited.type !== 'ImportExpression') return undefined;

  const specifier = staticString(awaited.source);

  return specifier === undefined ? undefined : scope.host.namespace(specifier);
}

function evaluateCall(
  call: ESTree.CallExpression,
  scope: Scope
): TrackedSymbol | undefined {
  if (readsProps(call, scope)) return propsOf(scope)[0];

  const required = requireSpecifier(call, scope);
  if (required !== undefined) return scope.host.namespace(required);

  return objectMethodCall(call, scope);
}

/** `Object.assign({}, m)` merges its arguments; `Object.freeze(x)` and the like are `x`. */
function objectMethodCall(
  call: ESTree.CallExpression,
  scope: Scope
): TrackedSymbol | undefined {
  const callee = unwrapExpression(call.callee);
  if (callee.type !== 'MemberExpression') return undefined;

  const object = unwrapExpression(callee.object);
  const isGlobalObject =
    object.type === 'Identifier' &&
    object.name === 'Object' &&
    scope.isGlobal(object);
  if (!isGlobalObject) return undefined;

  const method = staticPropertyName(callee);
  const values = call.arguments.filter(
    (argument) => argument.type !== 'SpreadElement'
  );

  if (
    method === 'freeze' ||
    method === 'seal' ||
    method === 'preventExtensions'
  ) {
    return values[0] && evaluate(values[0], scope);
  }

  if (method !== 'assign') return undefined;

  return layeredNamespace(
    () => values.map((value) => ({ spread: value })),
    scope
  );
}

function computedMembers(
  node: ESTree.MemberExpression,
  scope: Scope
): TrackedSymbol[] {
  const members: TrackedSymbol[] = [];

  for (const object of evaluateAll(node.object, scope)) {
    if (object.type !== 'namespace') continue;

    for (const key of keyAlternatives(node.property, scope)) {
      const member = object.member(key.text);
      if (!member) continue;

      const isPattern = member.type === 'value' && key.dynamic;
      members.push(isPattern ? { ...member, dynamic: true } : member);
    }
  }

  return members;
}

/** Every props object the module's component may be rendered with. */
function propsOf(scope: Scope): TrackedSymbol[] {
  const props = scope.host.props;
  if (!props) return [];

  return guarded(props, () =>
    distinct(props.candidates().flatMap(evaluateCandidate))
  );
}

function evaluateCandidate(candidate: Candidate): TrackedSymbol[] {
  if (candidate.type === 'computed') return candidate.get();

  const symbols = evaluateAll(candidate.node, candidate.scope);

  return symbols.flatMap((symbol) =>
    toList(followPath(symbol, candidate.path))
  );
}

/** Ends cycles (`let a = b; b = a`) and bounds chains through call sites and assignments. */
function guarded(key: object, compute: () => TrackedSymbol[]): TrackedSymbol[] {
  if (inProgress.has(key) || depth >= MAX_DEPTH) return [];

  inProgress.add(key);
  depth++;
  try {
    return compute();
  } finally {
    depth--;
    inProgress.delete(key);
  }
}

/**
 * One value per name and origin, the first found; namespaces as they are. Two
 * outdirs can define a message of the same name: those are two values.
 */
function distinct(symbols: readonly TrackedSymbol[]): TrackedSymbol[] {
  const valuesByName = new Map<string, TrackedValue>();
  const namespaces: TrackedSymbol[] = [];

  for (const symbol of symbols) {
    if (symbol.type === 'namespace') {
      if (!namespaces.includes(symbol)) namespaces.push(symbol);
      continue;
    }

    const key = `${originOf(symbol)}\0${symbol.name}\0${symbol.dynamic === true}`;
    if (!valuesByName.has(key)) valuesByName.set(key, symbol);
  }

  const values = [...valuesByName.values()];
  const collapsed =
    values.length > MAX_VALUES ? anyValuePerOrigin(values) : values;

  return [...collapsed, ...namespaces.slice(0, MAX_VALUES)];
}

/** The target and its file that a value comes from, e.g. an outdir's `messages.js`. */
function originOf(value: TrackedValue): string {
  return `${value.target}\0${value.file}`;
}

function anyValuePerOrigin(values: readonly TrackedValue[]): TrackedValue[] {
  const byOrigin = new Map<string, TrackedValue>();

  for (const value of values) {
    const origin = originOf(value);
    if (byOrigin.has(origin)) continue;

    byOrigin.set(origin, { ...value, name: '*', dynamic: true });
  }

  return [...byOrigin.values()];
}

function toList(symbol: TrackedSymbol | undefined): TrackedSymbol[] {
  return symbol ? [symbol] : [];
}

function propertyLayer(property: ESTree.ObjectPropertyKind): Layer[] {
  if (property.type === 'SpreadElement') return [{ spread: property.argument }];

  const name = staticKeyName(property);
  const holdsValue = property.kind === 'init' && !property.method;

  return holdsValue && name !== undefined
    ? [{ name, value: property.value }]
    : [];
}

function classMember(
  classNode: ESTree.Class,
  name: string,
  scope: Scope
): TrackedSymbol | undefined {
  const element = classNode.body.body.find(
    (candidate): candidate is ClassElement =>
      isFieldOrMethod(candidate) && classElementName(candidate) === name
  );
  if (!element) return undefined;

  if (element.type === 'MethodDefinition') {
    return element.kind === 'get' ? getterValue(element, scope) : undefined;
  }

  return element.value ? evaluate(element.value, scope) : undefined;
}

function isFieldOrMethod(
  element: ESTree.ClassElement
): element is ClassElement {
  return (
    element.type === 'PropertyDefinition' ||
    element.type === 'AccessorProperty' ||
    element.type === 'MethodDefinition'
  );
}

function classElementName(element: ClassElement): string | undefined {
  if (element.key.type === 'PrivateIdentifier') return `#${element.key.name}`;
  if (element.computed) return undefined;

  return element.key.type === 'Identifier'
    ? element.key.name
    : staticString(element.key);
}

/** Of a getter that only returns: `get label() { return m.title }`. */
function getterValue(
  getter: ESTree.MethodDefinition,
  scope: Scope
): TrackedSymbol | undefined {
  const statements = getter.value.body?.body ?? [];
  const onlyStatement = statements.length === 1 ? statements[0] : undefined;
  const returned =
    onlyStatement?.type === 'ReturnStatement' ? onlyStatement.argument : null;

  return returned ? evaluate(returned, scope) : undefined;
}
