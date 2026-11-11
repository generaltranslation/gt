import type * as SvelteCompiler from 'svelte/compiler';
import type { ESTree } from '../../analysis/ast.js';
import {
  openingTagEnd,
  SPREAD_ATTRIBUTE,
  type SourceAttribute,
  type SourceElement,
} from '../elements.js';

/** What element nodes have in both of Svelte's ASTs, the modern (5) and the legacy (3, 4). */
type ElementNode = {
  type: string;
  name: string;
  start: number;
  end: number;
  attributes: AttributeNode[];
};

type AttributeNode = {
  type: string;
  name?: string;
  start: number;
  end: number;
};

type ComponentAst = {
  instance?: { content?: { body?: readonly ESTree.Statement[] } };
};

// In either AST; `<svelte:component>` and `<svelte:self>` render a component too.
const COMPONENT_TYPES = new Set([
  'Component',
  'InlineComponent',
  'SvelteComponent',
  'SvelteSelf',
]);

const SCRIPT_AND_STYLE_KEYS = new Set(['instance', 'module', 'css', 'js']);

/**
 * Throws on a file Svelte rejects. Svelte 5 parses `loose`ly, as editors do, so
 * that a template expression with a syntax error does not reject the file.
 */
export function parseComponent(
  compiler: typeof SvelteCompiler,
  source: string
): unknown {
  return isSvelte5(compiler)
    ? compiler.parse(source, { modern: true, loose: true })
    : compiler.parse(source);
}

export function svelteElements(ast: unknown, source: string): SourceElement[] {
  const elements: SourceElement[] = [];

  const visit = (value: unknown) => {
    if (typeof value !== 'object' || value === null) return;
    if (Array.isArray(value)) return value.forEach(visit);

    if (isElement(value)) elements.push(sourceElement(value, source));

    for (const [key, child] of Object.entries(value)) {
      if (!SCRIPT_AND_STYLE_KEYS.has(key)) visit(child);
    }
  };

  visit(ast);

  return elements;
}

/** Where the instance script's `export let message` declare their names: Svelte 4's props. */
export function propDeclarationOffsets(ast: unknown): number[] {
  const statements = (ast as ComponentAst).instance?.content?.body ?? [];

  return statements.flatMap(exportedVariableOffsets);
}

function isSvelte5(compiler: typeof SvelteCompiler): boolean {
  return Number(compiler.VERSION?.split('.')[0]) >= 5;
}

function isElement(value: object): value is ElementNode {
  const node = value as Partial<ElementNode>;

  return (
    typeof node.type === 'string' &&
    typeof node.name === 'string' &&
    typeof node.start === 'number' &&
    Array.isArray(node.attributes)
  );
}

function sourceElement(node: ElementNode, source: string): SourceElement {
  const nameStart = node.start + 1;
  const nameEnd = nameStart + node.name.length;
  const attributeEnds = node.attributes.map(({ end }) => end);

  return {
    name: node.name,
    start: nameEnd,
    end: node.end,
    nameStart,
    nameEnd,
    openEnd: openingTagEnd(source, nameEnd, attributeEnds),
    component: COMPONENT_TYPES.has(node.type),
    attributes: node.attributes.map((attribute) =>
      sourceAttribute(attribute, source)
    ),
  };
}

function sourceAttribute(
  attribute: AttributeNode,
  source: string
): SourceAttribute {
  const { start, end } = attribute;
  const text = source.slice(start, end);
  if (text.startsWith('{'))
    return { name: bracedName(text, attribute.name), start, end };

  const equals = text.indexOf('=');
  if (equals === -1) return { name: text.trim(), start, end };

  const name = text.slice(0, equals).trim();
  const valueStart = start + equals + 1;

  return { name, start: valueStart, end };
}

/** `{title}` → "title", `{...props}` → "{...}", `{@attach tip}` → "{@attach}" */
function bracedName(text: string, shorthandName: string | undefined): string {
  if (/^\{\s*\.\.\./.test(text)) return SPREAD_ATTRIBUTE;

  const tag = /^\{\s*(@\w+)/.exec(text)?.[1];
  if (tag) return `{${tag}}`;

  return shorthandName ?? '{…}';
}

function exportedVariableOffsets(statement: ESTree.Statement): number[] {
  const declaration =
    statement.type === 'ExportNamedDeclaration' ? statement.declaration : null;
  if (
    declaration?.type !== 'VariableDeclaration' ||
    declaration.kind === 'const'
  )
    return [];

  const offsets: number[] = [];

  for (const declarator of declaration.declarations) {
    if (declarator.id.type === 'Identifier') offsets.push(declarator.id.start);
  }

  return offsets;
}
