import {
  analyze,
  type Reference,
  type ScopeManager,
} from '@typescript-eslint/scope-manager';
import type MagicString from 'magic-string';

/** An ESTree or Svelte template node as both parsers produce it. */
export type AnyNode = {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
};

const skippedKeys = new Set([
  'loc',
  'range',
  'parent',
  'metadata',
  'name_loc',
  'leadingComments',
  'trailingComments',
]);

const decoratedTypes = new Set([
  'Identifier',
  'ObjectPattern',
  'ArrayPattern',
  'AssignmentPattern',
  'RestElement',
  'ClassDeclaration',
  'ClassExpression',
  'PropertyDefinition',
  'MethodDefinition',
  'AccessorProperty',
  'TSParameterProperty',
]);

export function isNode(value: unknown): value is AnyNode {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { type?: unknown }).type === 'string'
  );
}

export function forEachChild(
  node: AnyNode,
  visit: (child: AnyNode) => void
): void {
  for (const key of Object.keys(node)) {
    if (skippedKeys.has(key)) continue;
    const value = node[key];
    if (Array.isArray(value)) {
      for (const item of value) if (isNode(item)) visit(item);
    } else if (isNode(value)) {
      visit(value);
    }
  }
}

export function walk(root: AnyNode, visit: (node: AnyNode) => void): void {
  const stack = [root];
  while (stack.length) {
    const node = stack.pop()!;
    visit(node);
    forEachChild(node, (child) => stack.push(child));
  }
}

/**
 * Adds the TypeScript-ESTree fields that scope-manager reads but acorn, which
 * both Svelte and Vite parse with, leaves out.
 */
export function prepareForScopeAnalysis(root: AnyNode): void {
  walk(root, (node) => {
    if (decoratedTypes.has(node.type) && !Array.isArray(node.decorators)) {
      node.decorators = [];
    }
    if (!Array.isArray(node.range)) node.range = [node.start, node.end];
  });
}

export function parentMap(root: AnyNode): Map<AnyNode, AnyNode> {
  const parents = new Map<AnyNode, AnyNode>();
  walk(root, (node) =>
    forEachChild(node, (child) => {
      parents.set(child, node);
    })
  );
  return parents;
}

export function analyzeProgram(program: AnyNode): ScopeManager {
  return analyze(program as never, { sourceType: 'module' });
}

/**
 * Value references in a template expression, declaration or pattern list that
 * the fragment itself does not bind.
 */
export function freeReferences(node: AnyNode | AnyNode[]): Reference[] {
  const span = Array.isArray(node)
    ? { start: node[0]!.start, end: node.at(-1)!.end }
    : { start: node.start, end: node.end };
  const synthetic = (fields: Record<string, unknown>): AnyNode => ({
    ...fields,
    ...span,
    range: [span.start, span.end],
    type: fields.type as string,
  });
  const statement = Array.isArray(node)
    ? synthetic({
        type: 'ExpressionStatement',
        expression: synthetic({
          type: 'ArrowFunctionExpression',
          params: node,
          body: synthetic({ type: 'Literal', value: null, raw: 'null' }),
          expression: true,
          async: false,
          generator: false,
        }),
      })
    : node.type === 'VariableDeclaration'
      ? node
      : synthetic({ type: 'ExpressionStatement', expression: node });
  const manager = analyzeProgram(
    synthetic({ type: 'Program', sourceType: 'module', body: [statement] })
  );
  return manager.globalScope!.through.filter(
    (reference) => reference.isValueReference
  );
}

/** Adds every name a binding pattern declares to `names`. */
export function patternNames(pattern: unknown, names: Set<string>): void {
  if (!isNode(pattern)) return;
  switch (pattern.type) {
    case 'Identifier':
      names.add(pattern.name as string);
      return;
    case 'ObjectPattern':
      for (const property of pattern.properties as AnyNode[]) {
        patternNames(
          property.type === 'RestElement' ? property.argument : property.value,
          names
        );
      }
      return;
    case 'ArrayPattern':
      for (const element of pattern.elements as unknown[]) {
        patternNames(element, names);
      }
      return;
    case 'AssignmentPattern':
      patternNames(pattern.left, names);
      return;
    case 'RestElement':
      patternNames(pattern.argument, names);
      return;
  }
}

/** Replacements that may nest, such as a `gt()` call inside a rewritten `<T>`. */
export class EditSet {
  readonly #edits: { start: number; end: number; text: string }[] = [];

  constructor(readonly code: string) {}

  replace(start: number, end: number, text: string): void {
    this.#edits.push({ start, end, text });
  }

  /** The original text of `[start, end)` with every edit inside it applied. */
  text(start: number, end: number): string {
    let output = '';
    let position = start;
    for (const edit of this.#outermost(start, end)) {
      output += this.code.slice(position, edit.start) + edit.text;
      position = edit.end;
    }
    return output + this.code.slice(position, end);
  }

  apply(target: MagicString): void {
    for (const edit of this.#outermost(0, this.code.length)) {
      if (edit.text) target.overwrite(edit.start, edit.end, edit.text);
      else target.remove(edit.start, edit.end);
    }
  }

  #outermost(start: number, end: number) {
    const within = this.#edits
      .filter((edit) => edit.start >= start && edit.end <= end)
      .sort((a, b) => a.start - b.start || b.end - a.end);
    const outermost: typeof within = [];
    let reach = -1;
    for (const edit of within) {
      if (edit.start >= reach) {
        outermost.push(edit);
        reach = edit.end;
      }
    }
    return outermost;
  }
}
