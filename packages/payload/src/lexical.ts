import type {
  JsxChild,
  JsxChildren,
  JsxElement,
} from 'generaltranslation/types';

export type LexicalNode = {
  type: string;
  text?: string;
  children?: LexicalNode[];
  tag?: string;
  listType?: string;
  [key: string]: unknown;
};

export type LexicalState = { root: LexicalNode };

export const isLexicalState = (value: unknown): value is LexicalState => {
  if (typeof value !== 'object' || value === null) return false;
  const root = (value as { root?: LexicalNode }).root;
  return typeof root === 'object' && root !== null && root.type === 'root';
};

const tagFor = (node: LexicalNode): string => {
  switch (node.type) {
    case 'paragraph':
      return 'p';
    case 'heading':
      return typeof node.tag === 'string' ? node.tag : 'h2';
    case 'list':
      return node.listType === 'number' ? 'ol' : 'ul';
    case 'listitem':
      return 'li';
    case 'quote':
      return 'blockquote';
    case 'link':
    case 'autolink':
      return 'a';
    case 'linebreak':
      return 'br';
    case 'horizontalrule':
      return 'hr';
    case 'text':
      return 'span';
    default:
      return node.type;
  }
};

// Both directions share one walk so ids always line up: every node gets an id
// in depth-first document order, and visit() receives each text node with its id.
// Ids start at 1 because the runtime API rejects a tree containing id 0.
const walk = (
  root: LexicalNode,
  visit: (node: LexicalNode, id: number) => void
): void => {
  let nextId = 1;
  const step = (node: LexicalNode): void => {
    const id = nextId++;
    if (node.type === 'text') visit(node, id);
    for (const child of node.children ?? []) step(child);
  };
  step(root);
};

export type GtTreeResult = { textIds: number[]; tree: JsxChild };

export const buildGtTree = (state: LexicalState): GtTreeResult => {
  const textIds: number[] = [];
  let nextId = 1;
  const build = (node: LexicalNode): JsxChild => {
    const id = nextId++;
    if (node.type === 'text') {
      textIds.push(id);
      return { t: 'span', i: id, c: node.text ?? '' };
    }
    const element: JsxElement = { t: tagFor(node), i: id };
    const children = (node.children ?? []).map(build);
    if (children.length > 0) element.c = children;
    return element;
  };
  return { textIds, tree: build(state.root) };
};

export const collectTranslations = (
  children: JsxChildren
): Map<number, string> => {
  const found = new Map<number, string>();
  const textOf = (child: JsxChildren | undefined): string => {
    if (child === undefined || child === null || typeof child === 'boolean')
      return '';
    if (Array.isArray(child)) return child.map(textOf).join('');
    if (typeof child === 'string') return child;
    if (typeof child === 'object' && 'c' in child)
      return textOf((child as JsxElement).c);
    return '';
  };
  const visit = (child: JsxChildren | undefined): void => {
    if (child === undefined || child === null || typeof child !== 'object')
      return;
    if (Array.isArray(child)) {
      child.forEach(visit);
      return;
    }
    if (!('i' in child)) return;
    const element = child as JsxElement;
    if (typeof element.i === 'number' && element.c !== undefined) {
      found.set(element.i, textOf(element.c));
    }
    if (element.c !== undefined) visit(element.c);
  };
  visit(children);
  return found;
};

export type ApplyResult = { missingIds: number[]; state: LexicalState };

// Writes translated strings into a clone, keyed by walk id. Only the `text`
// property of text nodes changes; everything else is untouched by construction.
export const applyGtTree = (
  state: LexicalState,
  translated: JsxChildren
): ApplyResult => {
  const translations = collectTranslations(translated);
  const clone = structuredClone(state);
  const missingIds: number[] = [];
  walk(clone.root, (node, id) => {
    const text = translations.get(id);
    if (text === undefined) missingIds.push(id);
    else node.text = text;
  });
  return { missingIds, state: clone };
};
