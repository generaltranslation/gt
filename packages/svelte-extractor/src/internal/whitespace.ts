import type { SvelteNode } from './types.js';

/** How Svelte treats whitespace in one fragment. */
export type FragmentWhitespace = {
  /**
   * Whether whitespace is kept as written: inside `<pre>` and `<textarea>`,
   * or with `<svelte:options preserveWhitespace />`.
   */
  preserve: boolean;
  /** Whether the fragment is the children of a `<pre>`. */
  pre: boolean;
  /** Whether a lone space between nodes is dropped, as inside `<table>`. */
  dropsSpaces: boolean;
};

const STARTS_WITH_WHITESPACE = /^[ \t\r\n]+/;
const ENDS_WITH_WHITESPACE = /[ \t\r\n]+$/;
const NOT_WHITESPACE = /[^ \t\r\n]/;

/** Nodes Svelte moves out of the rendered sequence. */
const HOISTED_NODE_TYPES = new Set([
  'ConstTag',
  'DeclarationTag',
  'DebugTag',
  'SvelteBody',
  'SvelteWindow',
  'SvelteDocument',
  'SvelteHead',
  'TitleElement',
  'SnippetBlock',
]);

/** Elements whose children drop a lone space between nodes. */
const SPACE_DROPPING_ELEMENTS = new Set([
  'select',
  'tr',
  'table',
  'tbody',
  'thead',
  'tfoot',
  'colgroup',
  'datalist',
]);

/** Whitespace handling for the children of `parent`, inside `outer`. */
export function getChildWhitespace(
  outer: FragmentWhitespace,
  parent: SvelteNode
): FragmentWhitespace {
  const isElement = parent.type === 'RegularElement';
  const name = parent.name as string;
  return {
    preserve:
      outer.preserve || (isElement && (name === 'pre' || name === 'textarea')),
    pre: isElement && name === 'pre',
    dropsSpaces: isElement && SPACE_DROPPING_ELEMENTS.has(name),
  };
}

/**
 * Returns the text Svelte renders for each text node of a fragment, keyed by
 * node, replicating the compiler's `clean_nodes`. Text Svelte removes has no
 * entry.
 *
 * - Whitespace at the start and end of the fragment is removed.
 * - Whitespace between text and an element, component, or block becomes a
 *   single space, or nothing after text that already ends with whitespace.
 * - Whitespace next to an expression tag, and whitespace within text, is
 *   kept as written.
 *
 * Comments are removed first, so text on both sides of one is adjacent.
 * Whitespace in SVG is not dropped as Svelte drops it.
 */
export function getRenderedText(
  nodes: SvelteNode[],
  whitespace: FragmentWhitespace
): Map<SvelteNode, string> {
  const regular = nodes.filter(
    (node) => node.type !== 'Comment' && !HOISTED_NODE_TYPES.has(node.type)
  );
  const rendered = new Map<SvelteNode, string>();

  if (whitespace.preserve) {
    regular.forEach((node, index) => {
      if (node.type !== 'Text') return;
      const data = node.data as string;
      // The HTML parser drops a newline that opens a <pre>.
      if (whitespace.pre && index === 0 && (data === '\n' || data === '\r\n')) {
        return;
      }
      rendered.set(node, data);
    });
    return rendered;
  }

  let start = 0;
  let end = regular.length;
  while (start < end && isWhitespaceText(regular[start])) start++;
  while (end > start && isWhitespaceText(regular[end - 1])) end--;

  const texts = new Map<SvelteNode, string>();
  for (let i = start; i < end; i++) {
    if (regular[i].type === 'Text') {
      texts.set(regular[i], regular[i].data as string);
    }
  }
  if (start === end) return rendered;
  const first = regular[start];
  if (first.type === 'Text') {
    texts.set(first, texts.get(first)!.replace(STARTS_WITH_WHITESPACE, ''));
  }
  const last = regular[end - 1];
  if (last.type === 'Text') {
    texts.set(last, texts.get(last)!.replace(ENDS_WITH_WHITESPACE, ''));
  }

  for (let i = start; i < end; i++) {
    const node = regular[i];
    if (node.type !== 'Text') continue;
    const previous = i > start ? regular[i - 1] : undefined;
    const next = i < end - 1 ? regular[i + 1] : undefined;
    let text = texts.get(node)!;
    if (previous?.type !== 'ExpressionTag') {
      const previousEndsWithWhitespace =
        previous?.type === 'Text' &&
        ENDS_WITH_WHITESPACE.test(texts.get(previous)!);
      text = text.replace(
        STARTS_WITH_WHITESPACE,
        previousEndsWithWhitespace ? '' : ' '
      );
    }
    if (next?.type !== 'ExpressionTag') {
      text = text.replace(ENDS_WITH_WHITESPACE, ' ');
    }
    texts.set(node, text);
    if (text && (text !== ' ' || !whitespace.dropsSpaces)) {
      rendered.set(node, text);
    }
  }
  return rendered;
}

function isWhitespaceText(node: SvelteNode): boolean {
  return node.type === 'Text' && !NOT_WHITESPACE.test(node.data as string);
}
