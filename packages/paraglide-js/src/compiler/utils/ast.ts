import type * as ESTree from '@oxc-project/types';
import { visitorKeys } from 'oxc-parser';

export type { ESTree };
export type Node = ESTree.Node;
export type Pattern =
  | ESTree.BindingPattern
  | ESTree.ParamPattern
  | ESTree.BindingRestElement;

export type Visitor = {
  /** Return `false` to skip the node's children. */
  enter(node: Node, ancestors: readonly Node[]): boolean;
};

const TYPE_ANNOTATION_KEYS = new Set([
  'typeAnnotation',
  'typeArguments',
  'typeParameters',
  'returnType',
  'superTypeArguments',
  'superTypeParameters',
  'implements',
]);

const CHILD_KEYS: ReadonlyMap<string, readonly string[]> = new Map(
  Object.entries(visitorKeys).map(([type, keys]) => [
    type,
    keys.filter((key) => !TYPE_ANNOTATION_KEYS.has(key)),
  ])
);

/** Depth-first; type annotations are not visited. */
export function walk(root: Node, visitor: Visitor): void {
  const ancestors: Node[] = [];

  const visit = (node: Node) => {
    const visitsChildren = visitor.enter(node, ancestors);
    if (!visitsChildren) return;

    ancestors.push(node);

    for (const key of childKeysOf(node)) {
      const value = (node as unknown as Record<string, unknown>)[key];

      if (Array.isArray(value)) {
        for (const item of value) if (isNode(item)) visit(item);
      } else if (isNode(value)) {
        visit(value);
      }
    }

    ancestors.pop();
  };

  visit(root);
}

/** Unlike `walk`, visits type annotations too. */
export function forEachNode(
  root: Node,
  visit: (node: Node, parent: Node | undefined) => void,
  parent?: Node
): void {
  visit(root, parent);

  for (const key of visitorKeys[root.type] ?? Object.keys(root)) {
    const value = (root as unknown as Record<string, unknown>)[key];

    if (Array.isArray(value)) {
      for (const item of value)
        if (isNode(item)) forEachNode(item, visit, root);
    } else if (isNode(value)) {
      forEachNode(value, visit, root);
    }
  }
}

function childKeysOf(node: Node): readonly string[] {
  return (
    CHILD_KEYS.get(node.type) ??
    Object.keys(node).filter((key) => !TYPE_ANNOTATION_KEYS.has(key))
  );
}

function isNode(value: unknown): value is Node {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { type?: unknown }).type === 'string'
  );
}

export function staticString(
  node: Node | null | undefined
): string | undefined {
  if (node?.type === 'Literal' && typeof node.value === 'string') {
    return node.value;
  }

  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked ?? undefined;
  }

  return undefined;
}

export function staticKeyName(property: {
  key: ESTree.PropertyKey;
  computed: boolean;
}): string | undefined {
  const { key } = property;

  if (property.computed) return staticString(key);
  if (key.type === 'PrivateIdentifier') return `#${key.name}`;

  return key.type === 'Identifier' ? key.name : staticString(key);
}

export function moduleExportName(name: ESTree.ModuleExportName): string {
  return name.type === 'Literal' ? name.value : name.name;
}

/** The names a pattern binds: `{ a, b: [c] }` → a, c. */
function boundNames(pattern: Pattern): string[] {
  switch (pattern.type) {
    case 'Identifier':
      return [pattern.name];

    case 'ObjectPattern':
      return pattern.properties.flatMap((property) =>
        boundNames(
          property.type === 'RestElement' ? property.argument : property.value
        )
      );

    case 'ArrayPattern':
      return pattern.elements.flatMap((element) =>
        element ? boundNames(element) : []
      );

    case 'AssignmentPattern':
      return boundNames(pattern.left);

    case 'RestElement':
      return boundNames(pattern.argument);

    case 'TSParameterProperty':
      return boundNames(pattern.parameter);
  }
}

/** The names a declaration gives values to: `const { a, b } = …` → a, b. */
export function declaredNames(declaration: ESTree.Declaration): string[] {
  switch (declaration.type) {
    case 'VariableDeclaration':
      return declaration.declarations.flatMap((declarator) =>
        boundNames(declarator.id)
      );

    case 'FunctionDeclaration':
    // `declare function f(): void`, as in a `.d.ts` file.
    case 'TSDeclareFunction':
    case 'ClassDeclaration':
    case 'TSEnumDeclaration':
      return declaration.id ? [declaration.id.name] : [];

    default:
      return [];
  }
}

/** Declared or exported at the top level of a module. */
export function topLevelClasses(program: ESTree.Program): ESTree.Class[] {
  const classes: ESTree.Class[] = [];

  for (const statement of program.body) {
    const isExport =
      statement.type === 'ExportNamedDeclaration' ||
      statement.type === 'ExportDefaultDeclaration';
    const declaration = isExport ? statement.declaration : statement;

    if (
      declaration?.type === 'ClassDeclaration' ||
      declaration?.type === 'ClassExpression'
    ) {
      classes.push(declaration);
    }
  }

  return classes;
}

export function computeLineStarts(code: string): number[] {
  const starts = [0];

  for (let index = 0; index < code.length; index++) {
    if (code[index] === '\n') starts.push(index + 1);
  }

  return starts;
}
