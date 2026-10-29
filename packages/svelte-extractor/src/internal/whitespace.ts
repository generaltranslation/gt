import type { SvelteNode } from './types.js';

/** Where a fragment sits, for Svelte's whitespace handling. */
export type FragmentWhitespace = {
  /**
   * Whether whitespace is kept as written: inside `<pre>` and `<textarea>`,
   * or with `<svelte:options preserveWhitespace />`.
   */
  preserve: boolean;
  /** Whether the fragment is in the SVG namespace. */
  svg: boolean;
  /** Whether the fragment is inside an SVG `<text>`. */
  svgText: boolean;
  /** The element the fragment is the children of, if any. */
  element?: string;
};

/** The rendered text of a text node, and how to write it in the source. */
export type RenderedText = {
  /**
   * The text the DOM holds, which is also what translations render: Svelte's
   * text after the HTML parser turns carriage returns into line feeds and
   * drops a line feed that opens a `<pre>`.
   */
  text: string;
  /**
   * Source text that renders `text` whether Svelte inserts it by parsing
   * HTML or by setting it directly, as it does for text next to an
   * expression or alone in a component.
   */
  markup: string;
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

/** Whitespace handling at the top level of a component. */
export function getRootWhitespace(
  options: { preserveWhitespace?: boolean; namespace?: string } | null
): FragmentWhitespace {
  return {
    preserve: options?.preserveWhitespace === true,
    svg: options?.namespace === 'svg',
    svgText: false,
  };
}

/**
 * Whitespace handling for the children of `node`, inside `outer`.
 *
 * Elements inside `<svg>` are treated as SVG until a `<foreignObject>`, an
 * approximation of Svelte's namespace inference, which also looks at
 * element names.
 */
export function getChildWhitespace(
  outer: FragmentWhitespace,
  node: SvelteNode
): FragmentWhitespace {
  if (node.type !== 'RegularElement') return { ...outer, element: undefined };
  const name = node.name as string;
  const svg = outer.svg || name === 'svg';
  return {
    preserve: outer.preserve || name === 'pre' || name === 'textarea',
    svg: svg && name !== 'foreignObject',
    svgText: outer.svgText || (svg && name === 'text'),
    element: name,
  };
}

/**
 * Returns the rendered text of each text node of a fragment, keyed by node.
 * Text Svelte removes has no entry.
 *
 * Svelte's whitespace rules are replicated from the compiler's `clean_nodes`:
 * - Whitespace at the start and end of the fragment is removed.
 * - Whitespace between text and an element, component, or block becomes a
 *   single space, or nothing after text that already ends with whitespace.
 * - Whitespace next to an expression tag, and whitespace within text, is
 *   kept as written.
 * - A lone space is dropped inside SVG and table-like elements.
 *
 * Comments are removed first, so text on both sides of one is adjacent.
 */
export function getRenderedText(
  nodes: SvelteNode[],
  whitespace: FragmentWhitespace
): Map<SvelteNode, RenderedText> {
  const regular = nodes.filter(
    (node) => node.type !== 'Comment' && !HOISTED_NODE_TYPES.has(node.type)
  );
  const markup = whitespace.preserve
    ? getPreservedMarkup(regular, whitespace)
    : getCleanedMarkup(regular, whitespace);

  const rendered = new Map<SvelteNode, RenderedText>();
  for (const [node, svelteText] of markup) {
    const text = svelteText.replace(/\r\n?/g, '\n');
    if (whitespace.element === 'pre' && node === regular[0]) {
      // Without its opening line feed, the text renders the same either way,
      // unless the text after it starts with another line feed.
      const parsed = text.replace(/^\n/, '');
      rendered.set(node, {
        text: parsed,
        markup: parsed.startsWith('\n') ? text : parsed,
      });
    } else {
      rendered.set(node, { text, markup: text });
    }
  }
  return rendered;
}

function getPreservedMarkup(
  regular: SvelteNode[],
  whitespace: FragmentWhitespace
): Map<SvelteNode, string> {
  const markup = new Map<SvelteNode, string>();
  regular.forEach((node, index) => {
    if (node.type !== 'Text') return;
    const data = node.data as string;
    // Svelte drops a line break that is all a <pre> starts with.
    if (
      whitespace.element === 'pre' &&
      index === 0 &&
      (data === '\n' || data === '\r\n')
    ) {
      return;
    }
    markup.set(node, data);
  });
  return markup;
}

function getCleanedMarkup(
  regular: SvelteNode[],
  whitespace: FragmentWhitespace
): Map<SvelteNode, string> {
  const markup = new Map<SvelteNode, string>();
  let start = 0;
  let end = regular.length;
  while (start < end && isWhitespaceText(regular[start])) start++;
  while (end > start && isWhitespaceText(regular[end - 1])) end--;
  if (start === end) return markup;

  const texts = new Map<SvelteNode, string>();
  for (let i = start; i < end; i++) {
    if (regular[i].type === 'Text') {
      texts.set(regular[i], regular[i].data as string);
    }
  }
  const first = regular[start];
  if (first.type === 'Text') {
    texts.set(first, texts.get(first)!.replace(STARTS_WITH_WHITESPACE, ''));
  }
  const last = regular[end - 1];
  if (last.type === 'Text') {
    texts.set(last, texts.get(last)!.replace(ENDS_WITH_WHITESPACE, ''));
  }

  const dropsSpaces =
    (whitespace.svg && !whitespace.svgText) ||
    SPACE_DROPPING_ELEMENTS.has(whitespace.element ?? '');
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
    if (text && (text !== ' ' || !dropsSpaces)) {
      markup.set(node, text);
    }
  }
  return markup;
}

function isWhitespaceText(node: SvelteNode): boolean {
  return node.type === 'Text' && !NOT_WHITESPACE.test(node.data as string);
}
