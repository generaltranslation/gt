import {
  computeLineStarts,
  staticPropertyName,
  toLineColumn,
  TRANSPARENT_WRAPPERS,
  unwrapExpression,
  walk,
  type ESTree,
  type Node,
} from './ast.js';
import {
  evaluate,
  evaluateAll,
  isDynamic,
  requireSpecifier,
} from './evaluate.js';
import {
  modulesOf,
  type ModuleGraph,
  type ModuleRecord,
} from './module-graph.js';
import { holdsArguments, type Scope } from './scope.js';
import type {
  ParaglideUsage,
  TrackedSymbol,
  TrackedValue,
  UsageKind,
} from './types.js';

type Reference = Extract<Node, { type: 'Identifier' | 'MemberExpression' }>;

const NEVER_USAGES = new Set<Node['type']>([
  'ImportDeclaration',
  'ExportAllDeclaration',
  'TSImportEqualsDeclaration',
  'TSInterfaceDeclaration',
  'TSTypeAliasDeclaration',
  'TSModuleDeclaration',
  'TSDeclareFunction',
]);

/** The usages in a module loaded with `graph.loadPaths([file])`. */
export function analyzeModule(
  graph: ModuleGraph,
  file: string
): ParaglideUsage[] {
  const record = graph.getRecord(file);
  if (!record) return [];

  const usages = modulesOf(record).flatMap((module) =>
    new UsageCollector(module, graph.scopeOf(module)).collect()
  );

  return record.generated ? onePerSourceRange(usages) : usages;
}

class UsageCollector {
  private readonly usages: ParaglideUsage[] = [];
  private readonly lineStarts: number[];

  /** Alias initializers and assignment targets, which are not usages. */
  private readonly skipped = new Set<Node>();
  /** Recorded as part of a usage, e.g. a callee; their computed keys can still hold usages. */
  private readonly recorded = new Set<Node>();

  constructor(
    private readonly record: ModuleRecord,
    private readonly scope: Scope
  ) {
    this.lineStarts = computeLineStarts(record.code);
  }

  collect(): ParaglideUsage[] {
    walk(this.record.program, {
      enter: (node, ancestors) => this.enter(node, ancestors),
    });

    return this.usages;
  }

  /** Returns whether to visit the node's children. */
  private enter(node: Node, ancestors: readonly Node[]): boolean {
    if (this.skipped.has(node) || NEVER_USAGES.has(node.type)) return false;

    switch (node.type) {
      case 'ExportNamedDeclaration':
        // `export { a }` re-exports `a`.
        return node.declaration !== null;

      case 'VariableDeclarator':
        // A generated one, `const __VLS_1 = ParaglideMessage` for a tag, is not
        // an alias: its initializer is the usage.
        if (node.init && node.start >= 0) this.skipAlias(node.init);
        return true;

      case 'AssignmentExpression':
        this.skipAssignment(node);
        return true;

      case 'ExportDefaultDeclaration':
        this.skipAlias(node.declaration);
        return true;

      case 'CallExpression':
        this.recordCall(node);
        return true;

      case 'Identifier':
      case 'MemberExpression':
        return this.recordReference(node, ancestors);

      default:
        return true;
    }
  }

  private skipAlias(expression: Node): void {
    if (isAlias(expression, this.scope)) this.skipped.add(expression);
  }

  private skipAssignment(assignment: ESTree.AssignmentExpression): void {
    if (assignment.operator !== '=') return;

    const writesName = assignment.left.type !== 'MemberExpression';
    if (writesName) this.skipped.add(assignment.left);

    this.skipAlias(assignment.right);
  }

  private recordCall(call: ESTree.CallExpression): void {
    const callee = unwrapExpression(call.callee);
    const called = evaluateAll(callee, this.scope).filter(isValue);

    if (called.length > 0) {
      for (const value of called) {
        this.add(call, value, 'call');
      }

      this.markRecorded(callee);
      return;
    }

    if (callee.type !== 'MemberExpression') return;

    const method = staticPropertyName(callee);
    if (method === undefined) return;

    const receivers = evaluateAll(callee.object, this.scope)
      .filter(isValue)
      .filter((value) => value.methods.includes(method));
    if (receivers.length === 0) return;

    for (const value of receivers) {
      this.add(call, value, 'method');
    }
    this.markRecorded(callee);
  }

  private recordReference(
    node: Reference,
    ancestors: readonly Node[]
  ): boolean {
    if (this.recorded.has(node)) return true;
    if (node.type === 'Identifier' && !this.scope.isRead(node)) return false;

    const symbols = evaluateAll(node, this.scope);
    if (symbols.length === 0) return true;

    this.markRecorded(node);

    const values = symbols.filter(isValue);
    if (values.length === 0) return true;
    if (isPassedThroughOrInspected(node, ancestors, this.scope)) return true;

    for (const value of values) this.add(node, value, 'reference');

    return true;
  }

  /** With the objects it is a member of: `m.greeting` and `m` of `m.greeting()`. */
  private markRecorded(node: Node): void {
    let current = unwrapExpression(node);
    this.recorded.add(current);

    while (current.type === 'MemberExpression') {
      current = unwrapExpression(current.object);
      this.recorded.add(current);
    }
  }

  private add(node: Node, value: TrackedValue, kind: UsageKind): void {
    // Code a language tool generated is not in the file.
    if (node.start < 0) return;

    const start = toLineColumn(this.lineStarts, node.start);
    const lastLine = toLineColumn(this.lineStarts, node.end - 1).line;

    this.usages.push({
      target: value.target,
      name: value.name,
      ...(isDynamic(value) && { dynamic: true }),
      kind,
      start: node.start,
      end: node.end,
      line: start.line,
      column: start.column,
      endLine: lastLine,
      targetFile: value.file,
    });
  }
}

function isValue(symbol: TrackedSymbol): symbol is TrackedValue {
  return symbol.type === 'value';
}

/**
 * Language tools write some code twice (Vue's component props) or reference a
 * name next to its call (`[greeting]` and `greeting()` for `{{ greeting() }}`).
 * A call is kept rather than a reference.
 */
function onePerSourceRange(usages: ParaglideUsage[]): ParaglideUsage[] {
  const kept = new Map<string, ParaglideUsage>();
  const rank = (usage: ParaglideUsage) => (usage.kind === 'reference' ? 0 : 1);

  for (const usage of usages) {
    // Two outdirs can define a message of the same name: the target's file tells them apart.
    const key = `${usage.start}\0${usage.target}\0${usage.targetFile}\0${usage.name}`;
    const existing = kept.get(key);

    if (!existing || rank(usage) > rank(existing)) kept.set(key, usage);
  }

  return [...kept.values()].sort((a, b) => a.start - b.start);
}

/**
 * An expression that only names a tracked value, so that assigning it makes
 * an alias and not a usage: `m`, `m.greeting`, `await import(…)`, `require(…)`.
 * `{ title: m.title }` does not: it uses `m.title`.
 */
function isAlias(expression: Node, scope: Scope): boolean {
  const node = unwrapExpression(expression);

  const namesValue =
    node.type === 'Identifier' ||
    node.type === 'MemberExpression' ||
    node.type === 'AwaitExpression' ||
    (node.type === 'CallExpression' &&
      requireSpecifier(node, scope) !== undefined);

  return namesValue && evaluate(node, scope) !== undefined;
}

/**
 * A parameter's or prop's value, or a member of it, that is only returned
 * (`(value) => value`) or inspected (`if (!message.parts)`, `typeof message`,
 * `message && …`). Its call site is the reference.
 */
function isPassedThroughOrInspected(
  node: Node,
  ancestors: readonly Node[],
  scope: Scope
): boolean {
  const root = rootObjectOf(node);
  if (root.type !== 'Identifier') return false;
  if (!holdsArguments(scope.bindingAt(root))) return false;

  const { parent, child } = outsideWrappers(node, ancestors);

  switch (parent?.type) {
    case 'ReturnStatement':
      return parent.argument === child;
    case 'ArrowFunctionExpression':
      return parent.body === child;
    case 'MemberExpression':
      return parent.object === child;
    case 'UnaryExpression':
    case 'BinaryExpression':
    case 'LogicalExpression':
      return true;
    case 'IfStatement':
    case 'ConditionalExpression':
    case 'WhileStatement':
    case 'DoWhileStatement':
      return parent.test === child;
    default:
      return false;
  }
}

/** `props` of `props.message.parts` */
function rootObjectOf(node: Node): Node {
  let root = node;
  while (root.type === 'MemberExpression') root = unwrapExpression(root.object);

  return root;
}

/** The nearest ancestor that is not a wrapper like `(…)` or `… as T`, and its child on the way to `node`. */
function outsideWrappers(
  node: Node,
  ancestors: readonly Node[]
): { parent: Node | undefined; child: Node } {
  let child = node;
  let index = ancestors.length - 1;

  while (index >= 0 && TRANSPARENT_WRAPPERS.has(ancestors[index]!.type)) {
    child = ancestors[index]!;
    index--;
  }

  return { parent: ancestors[index], child };
}
