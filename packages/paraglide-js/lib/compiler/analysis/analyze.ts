import path from 'node:path';
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
  memberOf,
  requireSpecifier,
} from './evaluate.js';
import { jsxElementContext } from './jsx-context.js';
import type { ModuleGraph, ModuleRecord } from './module-graph.js';
import { holdsArguments, type Scope } from './scope.js';
import { enclosingScopeName } from './scope-name.js';
import type {
  ElementContext,
  ElementRange,
  ParaglideUsage,
  SourceRange,
  TrackedSymbol,
  TrackedValue,
  UsageKind,
} from './types.js';
import { componentTagAt, elementContextAt } from '../languages/elements.js';
import { displayPath } from '../utils/paths.js';

type NewUsage = {
  node: Node;
  value: TrackedValue;
  kind: UsageKind;
  ancestors: readonly Node[];
  method?: string;
  /** Reported instead of the node's, e.g. a component's whole opening tag. */
  range?: SourceRange;
};

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

/** The usages in a module loaded with `graph.loadPath(file)`. */
export function analyzeModule({
  graph,
  file,
  root,
}: {
  graph: ModuleGraph;
  file: string;
  root: string;
}): ParaglideUsage[] {
  const record = graph.getRecord(file);
  const scope = graph.moduleScope(file);
  if (!record || !scope) return [];

  const usages = new UsageCollector(record, scope, root).collect();

  return record.generated ? onePerSourceRange(usages) : usages;
}

class UsageCollector {
  private readonly usages: ParaglideUsage[] = [];
  private readonly lineStarts: number[];
  private readonly defaultExportName: string;

  /** Alias initializers and assignment targets, which are not usages. */
  private readonly skipped = new Set<Node>();
  /** Recorded as part of a usage, e.g. a callee; their computed keys can still hold usages. */
  private readonly recorded = new Set<Node>();

  constructor(
    private readonly record: ModuleRecord,
    private readonly scope: Scope,
    private readonly root: string
  ) {
    this.lineStarts = computeLineStarts(record.code);
    this.defaultExportName = record.component ?? scriptName(record.file);
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
        this.recordCall(node, ancestors);
        return true;

      case 'JSXOpeningElement':
        this.recordJsxElement(node, ancestors);
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

  private recordCall(
    call: ESTree.CallExpression,
    ancestors: readonly Node[]
  ): void {
    const callee = unwrapExpression(call.callee);
    const called = evaluateAll(callee, this.scope).filter(isValue);

    if (called.length > 0) {
      for (const value of called)
        this.add({ node: call, value, kind: 'call', ancestors });
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
      this.add({ node: call, value, kind: 'method', method, ancestors });
    }
    this.markRecorded(callee);
  }

  private recordJsxElement(
    element: ESTree.JSXOpeningElement,
    ancestors: readonly Node[]
  ): void {
    const value = evaluateJsxName(element.name, this.scope);
    if (value?.type !== 'value') return;

    this.add({ node: element, value, kind: 'component', ancestors });
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

    const tagRange = this.componentTagRange(node);

    if (tagRange) {
      for (const value of values) {
        this.add({
          node,
          value,
          kind: 'component',
          ancestors,
          range: tagRange,
        });
      }
      return true;
    }

    if (isPassedThroughOrInspected(node, ancestors, this.scope)) return true;

    for (const value of values)
      this.add({ node, value, kind: 'reference', ancestors });

    return true;
  }

  /** The opening tag `node` is the name of, in a file with markup: `<Card title="t">`. */
  private componentTagRange(node: Reference): SourceRange | undefined {
    const { sourceElements, code } = this.record;
    const tag =
      sourceElements && componentTagAt(sourceElements, node.start, node.end);
    if (!tag) return undefined;

    // Pug tags have no `<`.
    const startsWithBracket = code[tag.nameStart - 1] === '<';
    const start = startsWithBracket ? tag.nameStart - 1 : tag.nameStart;

    return { start, end: tag.openEnd };
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

  private add({
    node,
    value,
    kind,
    ancestors,
    method,
    range = node,
  }: NewUsage): void {
    // Code a language tool generated is not in the file.
    if (node.start < 0) return;

    const { record, lineStarts } = this;
    const start = toLineColumn(lineStarts, range.start);
    const lastLine = toLineColumn(lineStarts, range.end - 1).line;

    const element = record.sourceElements
      ? elementContextAt(record.sourceElements, range.start)
      : (jsxElementContext(ancestors) ??
        templateElementAt(record.elements, node.start));

    this.usages.push({
      target: value.target,
      name: value.name,
      ...(isDynamic(value) && { dynamic: true }),
      kind,
      method,
      expression: record.code.slice(range.start, range.end),
      start: range.start,
      end: range.end,
      line: start.line,
      column: start.column,
      endLine: lastLine,
      scope:
        enclosingScopeName(ancestors, this.defaultExportName) ??
        record.component,
      element,
      resolution: value.via.map((via) => displayPath(this.root, via)),
    });
  }
}

/** `counter.svelte.ts` → "counter", `greeting.get.ts` → "greeting.get" */
function scriptName(file: string): string {
  return path
    .basename(file)
    .replace(/\.[cm]?[jt]sx?$/, '')
    .replace(/\.svelte$/, '');
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
    const key = `${usage.start}\0${usage.target}\0${usage.name}`;
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

function templateElementAt(
  elements: readonly ElementRange[] | undefined,
  offset: number
): ElementContext | undefined {
  // Nested ranges come after their parent, so the last match is the innermost.
  const innermost = elements?.findLast(
    (range) => range.start <= offset && offset < range.end
  );

  return innermost?.context;
}

function evaluateJsxName(
  name: ESTree.JSXElementName | ESTree.JSXMemberExpressionObject,
  scope: Scope
): TrackedSymbol | undefined {
  if (name.type === 'JSXIdentifier') {
    const isComponent = /^[A-Z_$]/.test(name.name);
    return isComponent ? scope.lookupAt(name) : undefined;
  }

  if (name.type === 'JSXMemberExpression') {
    const object = evaluateJsxName(name.object, scope);
    return memberOf(object, name.property.name);
  }

  return undefined;
}
