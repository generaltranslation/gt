import {
  isFunction,
  staticKeyName,
  TRANSPARENT_WRAPPERS,
  type ESTree,
  type FunctionNode,
  type Node,
} from './ast.js';

/** `weak` if it reaches the function through a wrapper: `const label = useMemo(() => …)`. */
type Name = { name: string; weak: boolean };

type ClassMember =
  | ESTree.MethodDefinition
  | ESTree.PropertyDefinition
  | ESTree.AccessorProperty;

/** What a value is assigned to once its wrappers are removed. */
type Holder = { index: number; value: Node; weak: boolean };

/** Their callbacks are prop defaults, which belong to the component. */
const PROP_DEFAULT_CALLS = new Set(['defineProps', 'withDefaults']);

/**
 * The name of the code around a usage, e.g. its component: the innermost
 * strong name, else the outermost weak one. So `const Button = memo(() => …)`
 * is `Button`, but a hook callback inside `function Hooks()` is `Hooks`.
 * A default export is named `defaultExportName`.
 */
export function enclosingScopeName(
  ancestors: readonly Node[],
  defaultExportName?: string
): string | undefined {
  let outermostWeak: string | undefined;

  for (let index = ancestors.length - 1; index >= 0; index--) {
    const name = scopeName(ancestors, index, defaultExportName);
    if (!name) continue;

    if (!name.weak) return name.name;
    outermostWeak = name.name;
  }

  return outermostWeak;
}

function scopeName(
  ancestors: readonly Node[],
  index: number,
  defaultExportName: string | undefined
): Name | undefined {
  const node = ancestors[index]!;
  const outer = ancestors.slice(0, index);

  // A language tool's generated wrapper, e.g. Vue's `__VLS_template`.
  if (node.start < 0) return undefined;

  if (isFunction(node)) return functionName(node, outer, defaultExportName);

  if (node.type === 'StaticBlock') {
    const className = classNameOf(outer, defaultExportName);
    return className === undefined
      ? undefined
      : { name: className, weak: false };
  }

  if (node.type === 'PropertyDefinition' || node.type === 'AccessorProperty') {
    const isInInitializer = ancestors[index + 1] !== node.key;
    return isInInitializer
      ? memberName(node, outer, defaultExportName)
      : undefined;
  }

  return undefined;
}

function functionName(
  fn: FunctionNode,
  ancestors: readonly Node[],
  defaultExportName: string | undefined
): Name | undefined {
  if (fn.id) return { name: fn.id.name, weak: false };

  return holderName(fn, ancestors, defaultExportName);
}

/** The name of the variable, key, class member or export that holds `value`. */
function holderName(
  value: Node,
  ancestors: readonly Node[],
  defaultExportName: string | undefined
): Name | undefined {
  const unwrapped = outsideWrappers(value, ancestors);
  if (!unwrapped) return undefined;

  const { index, weak } = unwrapped;
  const holder = ancestors[index];

  switch (holder?.type) {
    case 'VariableDeclarator':
      if (holder.id.type !== 'Identifier' || holder.init !== unwrapped.value)
        return undefined;
      return { name: holder.id.name, weak };

    case 'Property':
      return holder.value === unwrapped.value
        ? propertyName(holder, ancestors, index, weak, defaultExportName)
        : undefined;

    case 'MethodDefinition':
    case 'PropertyDefinition':
    case 'AccessorProperty':
      return memberName(
        holder,
        ancestors.slice(0, index),
        defaultExportName,
        weak
      );

    case 'ExportDefaultDeclaration':
      return defaultExportName === undefined
        ? undefined
        : { name: defaultExportName, weak };

    default:
      return undefined;
  }
}

/**
 * Through what wraps a value: `memo(…)`, `a().b(…)`, `(…) satisfies T`, `[…]`.
 * Undefined for a prop default.
 */
function outsideWrappers(
  value: Node,
  ancestors: readonly Node[]
): Holder | undefined {
  let index = ancestors.length - 1;
  let child = value;
  let weak = false;

  while (index >= 0) {
    const ancestor = ancestors[index]!;
    const methodCall = methodCallOn(ancestor, child, ancestors[index - 1]);

    if (methodCall) {
      child = methodCall;
      index -= 2;
      continue;
    }

    if (isCallWithArgument(ancestor, child)) {
      if (isPropDefaultsCall(ancestor)) return undefined;
      weak = true;
    } else if (isArrayWithElement(ancestor, child)) {
      weak = true;
    } else if (!isTransparentWrapperOf(ancestor, child)) {
      break;
    }

    child = ancestor;
    index--;
  }

  return { index, value: child, weak };
}

/** `createServerFn().validator(…)`: the call, when `object` is what the method is called on. */
function methodCallOn(
  member: Node,
  object: Node,
  call: Node | undefined
): Node | undefined {
  const isMemberOfObject =
    member.type === 'MemberExpression' && member.object === object;
  const isCalled = call?.type === 'CallExpression' && call.callee === member;

  return isMemberOfObject && isCalled ? call : undefined;
}

function isCallWithArgument(
  node: Node,
  argument: Node
): node is ESTree.CallExpression {
  return (
    node.type === 'CallExpression' && node.arguments.some((a) => a === argument)
  );
}

function isArrayWithElement(node: Node, element: Node): boolean {
  return (
    node.type === 'ArrayExpression' && node.elements.some((e) => e === element)
  );
}

function isTransparentWrapperOf(node: Node, expression: Node): boolean {
  const wrapped = (node as { expression?: Node }).expression;

  return TRANSPARENT_WRAPPERS.has(node.type) && wrapped === expression;
}

function propertyName(
  property: Extract<Node, { type: 'Property' }>,
  ancestors: readonly Node[],
  index: number,
  weak: boolean,
  defaultExportName: string | undefined
): Name | undefined {
  const key = staticKeyName(property);
  const object = ancestors[index - 1];

  // A language tool's object of attributes, `{ onclick: () => … }`: the
  // component is the name, not the attribute.
  if (object && object.start < 0) return undefined;

  if (key === 'setup' && object?.type === 'ObjectExpression') {
    // `defineComponent({ setup() {…} })` is named after what holds the component.
    const component = holderName(
      object,
      ancestors.slice(0, index - 1),
      defaultExportName
    );

    return component && { name: component.name, weak: false };
  }

  if (isPropDefaults(ancestors, index)) return undefined;

  return key === undefined ? undefined : { name: key, weak };
}

/** `Class.method`, `Class.field`, `Class.#private` */
function memberName(
  member: ClassMember,
  ancestors: readonly Node[],
  defaultExportName: string | undefined,
  weak = false
): Name | undefined {
  const key = staticKeyName(member);
  const className = classNameOf(ancestors, defaultExportName);

  const name = className && key ? `${className}.${key}` : (key ?? className);
  if (name === undefined) return undefined;

  // `static label` and `label` are different members.
  return { name: member.static ? `static ${name}` : name, weak };
}

function classNameOf(
  ancestors: readonly Node[],
  defaultExportName: string | undefined
): string | undefined {
  const index = ancestors.findLastIndex(
    (node) =>
      node.type === 'ClassDeclaration' || node.type === 'ClassExpression'
  );
  const classNode = ancestors[index] as ESTree.Class | undefined;
  if (!classNode) return undefined;

  if (classNode.id) return classNode.id.name;

  const isDefaultExport =
    ancestors[index - 1]?.type === 'ExportDefaultDeclaration';

  return isDefaultExport ? defaultExportName : undefined;
}

function isPropDefaultsCall(call: ESTree.CallExpression): boolean {
  return (
    call.callee.type === 'Identifier' &&
    PROP_DEFAULT_CALLS.has(call.callee.name)
  );
}

/** `withDefaults(defineProps(), { title: () => … })` */
function isPropDefaults(
  ancestors: readonly Node[],
  propertyIndex: number
): boolean {
  const object = ancestors[propertyIndex - 1];
  const call = ancestors[propertyIndex - 2];

  return (
    object?.type === 'ObjectExpression' &&
    call?.type === 'CallExpression' &&
    isPropDefaultsCall(call) &&
    call.arguments.some((argument) => argument === object)
  );
}
