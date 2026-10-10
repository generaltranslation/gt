// One Lexical text element <-> a string with simple inline tags. Formats
// become tags, each link becomes <a data-gt-link-N=""> and text whose other
// settings (such as style) differ from the element's first text becomes
// <span data-gt-text-N="">, so those settings never leave Payload. Distinct
// attribute names let GT's HTML structure check pair them correctly when a
// translation reorders them.
import {
  escapeText,
  isElement,
  isText,
  parseHtml,
  type HtmlParent,
} from './html';

export type LexicalNode = {
  type: string;
  children?: LexicalNode[];
  [key: string]: unknown;
};

// Lexical text format bits, outermost tag first.
const FORMAT_TAGS: [number, string][] = [
  [1, 'strong'],
  [2, 'em'],
  [8, 'u'],
  [4, 's'],
  [16, 'code'],
  [32, 'sub'],
  [64, 'sup'],
];
const TAG_BITS = new Map(FORMAT_TAGS.map(([bit, tag]) => [tag, bit]));
const LINK_TYPES = new Set(['link', 'autolink']);
const LINK_ATTRIBUTE = 'data-gt-link-';
const TEXT_ATTRIBUTE = 'data-gt-text-';

export type EncodedElement = {
  html: string;
  // Each link node without its children, by the index in its attribute.
  links: LexicalNode[];
  // The text node whose settings translated text reuses.
  textTemplate: LexicalNode;
  // Text nodes with other settings, by the index in their attribute.
  textStyles: LexicalNode[];
};

const DEFAULT_TEXT: LexicalNode = {
  type: 'text',
  version: 1,
  detail: 0,
  mode: 'normal',
  style: '',
};

// The same string for equal values, whatever their key order.
function stableKey(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableKey).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${stableKey((value as Record<string, unknown>)[key])}`
      )
      .join(',')}}`;
  return JSON.stringify(value) ?? 'undefined';
}

// A text node's settings other than its text and format.
function settingsKey(node: LexicalNode): string {
  const { text: _text, format: _format, ...settings } = node;
  return stableKey(settings);
}

// What a link points to, which identifies it across locales.
const linkKey = (link: LexicalNode) => stableKey(link.fields ?? link.url);

type EncodeState = EncodedElement & {
  // The source encoding a target element is encoded against, if any.
  reference?: EncodedElement;
  usedLinks: Set<number>;
};

function encodeText(node: LexicalNode, state: EncodeState): string {
  let html = escapeText(String(node.text ?? ''));
  const format = Number(node.format ?? 0);
  for (const [bit, tag] of [...FORMAT_TAGS].reverse()) {
    if (format & bit) html = `<${tag}>${html}</${tag}>`;
  }
  const key = settingsKey(node);
  if (key === settingsKey(state.textTemplate)) return html;
  const styles = state.reference?.textStyles ?? state.textStyles;
  let index = styles.findIndex((style) => settingsKey(style) === key);
  if (index < 0) {
    // A translation's styling the source does not have is not kept, but its
    // text is.
    if (state.reference) return html;
    index = state.textStyles.push(node) - 1;
  }
  return `<span ${TEXT_ATTRIBUTE}${index}="">${html}</span>`;
}

function linkIndexFor(link: LexicalNode, state: EncodeState): number | null {
  if (!state.reference) return state.links.push(link) - 1;
  const index = state.reference.links.findIndex(
    (candidate, i) =>
      !state.usedLinks.has(i) && linkKey(candidate) === linkKey(link)
  );
  if (index < 0) return null;
  state.usedLinks.add(index);
  return index;
}

function encodeInline(node: LexicalNode, state: EncodeState): boolean {
  if (node.type === 'text') {
    state.html += encodeText(node, state);
    return true;
  }
  if (node.type === 'linebreak') {
    state.html += '<br>';
    return true;
  }
  if (node.type === 'tab') {
    state.html += '\t';
    return true;
  }
  if (!LINK_TYPES.has(node.type)) return false;
  const { children = [], ...link } = node;
  if (!children.every((child) => child.type === 'text')) return false;
  const texts = children.map((child) => encodeText(child, state)).join('');
  const index = linkIndexFor(link as LexicalNode, state);
  if (index === null) return false;
  state.html += `<a ${LINK_ATTRIBUTE}${index}="">${texts}</a>`;
  return true;
}

export function isInlineNode(node: LexicalNode): boolean {
  return (
    ['text', 'linebreak', 'tab'].includes(node.type) ||
    LINK_TYPES.has(node.type)
  );
}

// The element's inline content as a tagged string, or null when it holds a
// node this encoding does not cover. With a reference, the element is encoded
// as a translation of it: links take the index of the reference link they
// point to and styles the index of the reference's. Styles the reference lacks
// keep only their text, and links that differ from the reference's give null.
export function encodeElement(
  element: LexicalNode,
  reference?: EncodedElement
): EncodedElement | null {
  const firstText = (element.children ?? []).flatMap((c) =>
    c.type === 'text'
      ? [c]
      : (c.children?.filter((g) => g.type === 'text') ?? [])
  )[0];
  const state: EncodeState = {
    html: '',
    links: [],
    textTemplate: reference?.textTemplate ?? firstText ?? DEFAULT_TEXT,
    textStyles: [],
    reference,
    usedLinks: new Set(),
  };
  for (const child of element.children ?? []) {
    if (!encodeInline(child, state)) return null;
  }
  // A translation must keep every link of its source to be decoded later.
  if (reference && state.usedLinks.size !== reference.links.length) return null;
  return {
    html: state.html,
    links: state.links,
    textTemplate: state.textTemplate,
    textStyles: state.textStyles,
  };
}

type Run =
  | { text: string; format: number; link: number | null; style: number | null }
  | { lineBreak: true; link: number | null };

function markerIndex(
  element: { attrs: { name: string }[] },
  prefix: string
): number | null {
  const attribute = element.attrs.find((a) => a.name.startsWith(prefix));
  if (!attribute) return null;
  const index = Number(attribute.name.slice(prefix.length));
  return Number.isInteger(index) ? index : null;
}

type Context = {
  format: number;
  link: number | null;
  style: number | null;
};

type Limits = { links: number; styles: number };

function collectRuns(
  node: HtmlParent,
  context: Context,
  runs: Run[],
  problems: string[],
  limits: Limits
) {
  for (const child of node.childNodes) {
    if (isText(child)) {
      runs.push({ text: child.value, ...context });
    } else if (!isElement(child)) {
      continue;
    } else if (child.tagName === 'br') {
      runs.push({ lineBreak: true, link: context.link });
    } else if (child.tagName === 'a') {
      const index = markerIndex(child, LINK_ATTRIBUTE);
      const known = index !== null && index < limits.links;
      if (!known) problems.push('unknown link');
      collectRuns(
        child,
        { ...context, link: known ? index : context.link },
        runs,
        problems,
        limits
      );
    } else if (child.tagName === 'span') {
      const index = markerIndex(child, TEXT_ATTRIBUTE);
      const known = index !== null && index < limits.styles;
      if (!known) problems.push('unknown text style');
      collectRuns(
        child,
        { ...context, style: known ? index : context.style },
        runs,
        problems,
        limits
      );
    } else if (TAG_BITS.has(child.tagName)) {
      collectRuns(
        child,
        { ...context, format: context.format | TAG_BITS.get(child.tagName)! },
        runs,
        problems,
        limits
      );
    } else {
      problems.push(`unexpected <${child.tagName}>`);
    }
  }
}

const START: Context = { format: 0, link: null, style: null };
const ANY: Limits = {
  links: Number.MAX_SAFE_INTEGER,
  styles: Number.MAX_SAFE_INTEGER,
};

function runsIn(html: string): Run[] {
  const runs: Run[] = [];
  collectRuns(parseHtml(html), START, runs, [], ANY);
  return runs;
}

function formatsIn(runs: Run[]): Set<number> {
  return new Set(
    runs.flatMap((run) =>
      'text' in run && run.text.trim() ? [run.format] : []
    )
  );
}

// A run's Lexical leaves, with each tab character as Lexical's tab node.
function leavesOf(run: Run, encoded: EncodedElement): LexicalNode[] {
  if ('lineBreak' in run) return [{ type: 'linebreak', version: 1 }];
  const template =
    run.style === null ? encoded.textTemplate : encoded.textStyles[run.style];
  return run.text.split('\t').flatMap((part, index) => [
    ...(index > 0
      ? [
          {
            ...template,
            type: 'tab',
            text: '\t',
            format: run.format,
            detail: 2,
          },
        ]
      : []),
    ...(part ? [{ ...template, format: run.format, text: part }] : []),
  ]);
}

export type DecodedElement =
  | { children: LexicalNode[] }
  | { problems: string[] };

// Rebuilds the element's children from a translated string. Every link must
// come back and every format the source used must still be present; text
// styles may be dropped, and no other tags may appear.
export function decodeElement(
  html: string,
  encoded: EncodedElement
): DecodedElement {
  const runs: Run[] = [];
  const problems: string[] = [];
  collectRuns(parseHtml(html), START, runs, problems, {
    links: encoded.links.length,
    styles: encoded.textStyles.length,
  });
  const links = new Set(runs.map((run) => run.link));
  encoded.links.forEach((_, index) => {
    if (!links.has(index)) problems.push(`link ${index} missing`);
  });
  const translatedFormats = [...formatsIn(runs)];
  for (const format of formatsIn(runsIn(encoded.html))) {
    if (format && !translatedFormats.some((f) => (f & format) === format))
      problems.push(`format ${format} missing`);
  }
  if (problems.length) return { problems };

  const children: LexicalNode[] = [];
  let openLink: { index: number; node: LexicalNode } | null = null;
  for (const run of runs) {
    for (const leaf of leavesOf(run, encoded)) {
      if (run.link === null) {
        openLink = null;
        children.push(leaf);
      } else if (openLink && openLink.index === run.link) {
        openLink.node.children!.push(leaf);
      } else {
        openLink = {
          index: run.link,
          node: { ...encoded.links[run.link], children: [leaf] },
        };
        children.push(openLink.node);
      }
    }
  }
  return { children };
}
