import {
  isFunction,
  staticPropertyName,
  staticString,
  unwrapExpression,
  walk,
  type ESTree,
  type Node,
} from './ast.js';

/** What a CommonJS module exports, as expressions of its own code. */
export type CommonJsExports = {
  /** `module.exports = …`; the last one wins. */
  whole?: Node;
  /** `exports.x = …`, `Object.defineProperty(exports, "x", …)` */
  named: Map<string, Node>;
  /** The modules it re-exports everything of: `__exportStar(require("./a"), exports)`. */
  stars: Node[];
};

const cache = new WeakMap<ESTree.Program, CommonJsExports | undefined>();

export function commonJsExports(
  program: ESTree.Program
): CommonJsExports | undefined {
  if (cache.has(program)) return cache.get(program);

  const exports: CommonJsExports = { named: new Map(), stars: [] };

  for (const statement of program.body) {
    if (statement.type !== 'ExpressionStatement') continue;

    for (const expression of sequenceOf(statement.expression))
      readExport(expression, exports);
  }

  const hasExports =
    exports.whole !== undefined ||
    exports.named.size > 0 ||
    exports.stars.length > 0;
  const found = hasExports ? exports : undefined;

  cache.set(program, found);

  return found;
}

/** `a, b` → a, b */
function sequenceOf(expression: Node): Node[] {
  const node = unwrapExpression(expression);

  return node.type === 'SequenceExpression'
    ? node.expressions.flatMap(sequenceOf)
    : [node];
}

function readExport(node: Node, exports: CommonJsExports): void {
  if (node.type === 'AssignmentExpression' && node.operator === '=') {
    readAssignment(node, exports);
  } else if (node.type === 'CallExpression') {
    readCall(node, exports);
  }
}

function readAssignment(
  assignment: ESTree.AssignmentExpression,
  exports: CommonJsExports
): void {
  const target = exportTarget(assignment.left);
  const value = unwrapExpression(assignment.right);

  // TypeScript declares the names before it assigns them: `exports.b = exports.a = void 0`.
  const isDeclarationOnly = isVoid(value);

  if (target === 'whole') {
    exports.whole = assignment.right;
  } else if (target !== undefined && !isDeclarationOnly) {
    exports.named.set(target, assignment.right);
  }

  if (value.type === 'AssignmentExpression') readExport(value, exports);
}

function readCall(call: ESTree.CallExpression, exports: CommonJsExports): void {
  const callee = unwrapExpression(call.callee);
  const name = calleeName(callee);
  const [first, second, third] = call.arguments;

  if (name === 'defineProperty' && first && isExportsObject(first)) {
    const key = staticString(second);
    const value = third && propertyDescriptorValue(third);

    if (key !== undefined && value) exports.named.set(key, value);
    return;
  }

  // TypeScript and tslib: `__exportStar(require("./a"), exports)`, `__export(require("./a"))`
  const isExportStar = name === '__exportStar' || name === '__export';

  if (isExportStar && first && first.type !== 'SpreadElement') {
    exports.stars.push(first);
    return;
  }

  if (name === 'forEach' && callee.type === 'MemberExpression') {
    const source = babelExportStarSource(callee, first);
    if (source) exports.stars.push(source);
  }
}

function calleeName(callee: Node): string | undefined {
  if (callee.type === 'Identifier') return callee.name;

  return callee.type === 'MemberExpression'
    ? staticPropertyName(callee)
    : undefined;
}

/** `Object.keys(_a).forEach(function (key) { … exports[key] = _a[key] … })` → `_a` */
function babelExportStarSource(
  forEach: ESTree.MemberExpression,
  callback: ESTree.Argument | undefined
): Node | undefined {
  const keys = unwrapExpression(forEach.object);

  const isKeysCall =
    keys.type === 'CallExpression' &&
    keys.callee.type === 'MemberExpression' &&
    staticPropertyName(keys.callee) === 'keys';
  if (!isKeysCall) return undefined;

  const source = keys.arguments[0];
  if (!source || source.type === 'SpreadElement') return undefined;

  const copiesToExports =
    callback !== undefined &&
    isFunction(callback as Node) &&
    mentionsExports(callback as Node);

  return copiesToExports ? source : undefined;
}

/** `module.exports` → "whole"; `exports.x`, `module.exports.x`, `exports["x"]` → "x" */
function exportTarget(target: Node): 'whole' | string | undefined {
  if (target.type !== 'MemberExpression') return undefined;
  if (isModuleExports(target)) return 'whole';

  return isExportsObject(target.object)
    ? staticPropertyName(target)
    : undefined;
}

function isModuleExports(node: Node): boolean {
  const member = unwrapExpression(node);
  if (
    member.type !== 'MemberExpression' ||
    staticPropertyName(member) !== 'exports'
  )
    return false;

  const object = unwrapExpression(member.object);

  return object.type === 'Identifier' && object.name === 'module';
}

function isExportsObject(node: Node): boolean {
  const target = unwrapExpression(node);
  const isExportsName =
    target.type === 'Identifier' && target.name === 'exports';

  return isExportsName || isModuleExports(target);
}

/** `{ get: function () { return a.x; } }`, `{ get: () => a.x }`, `{ value: a.x }` → `a.x` */
function propertyDescriptorValue(descriptor: Node): Node | undefined {
  const node = unwrapExpression(descriptor);
  if (node.type !== 'ObjectExpression') return undefined;

  for (const property of node.properties) {
    if (property.type !== 'Property' || property.computed) continue;
    if (property.key.type !== 'Identifier') continue;

    if (property.key.name === 'value') return property.value;
    if (property.key.name !== 'get' || !isFunction(property.value)) continue;

    const body = property.value.body;
    if (!body) continue;

    return body.type === 'BlockStatement' ? returnedValue(body) : body;
  }

  return undefined;
}

function returnedValue(body: ESTree.FunctionBody): Node | undefined {
  const returned = body.body.find(
    (statement) => statement.type === 'ReturnStatement'
  );

  return returned?.type === 'ReturnStatement'
    ? (returned.argument ?? undefined)
    : undefined;
}

function mentionsExports(root: Node): boolean {
  let found = false;

  walk(root, {
    enter(node) {
      if (node.type === 'Identifier' && node.name === 'exports') found = true;

      return !found;
    },
  });

  return found;
}

function isVoid(node: Node): boolean {
  return node.type === 'UnaryExpression' && node.operator === 'void';
}
