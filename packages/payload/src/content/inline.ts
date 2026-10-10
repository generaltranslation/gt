// One Lexical text element <-> a string with simple inline tags. Formats
// become tags and each link becomes <a data-gt-link-N="">, so link settings
// never leave Payload. A distinct attribute name per link lets GT's HTML
// structure check pair links correctly when a translation reorders them.
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

export type EncodedElement = {
  html: string;
  // Each link node without its children, by the index in its attribute.
  links: LexicalNode[];
  // A source text node whose settings translated text reuses.
  textTemplate: LexicalNode;
};

const DEFAULT_TEXT: LexicalNode = {
  type: 'text',
  version: 1,
  detail: 0,
  mode: 'normal',
  style: '',
};

function encodeText(node: LexicalNode): string {
  let html = escapeText(String(node.text ?? ''));
  const format = Number(node.format ?? 0);
  for (const [bit, tag] of [...FORMAT_TAGS].reverse()) {
    if (format & bit) html = `<${tag}>${html}</${tag}>`;
  }
  return html;
}

function encodeInline(node: LexicalNode, state: EncodedElement): boolean {
  if (node.type === 'text') {
    state.html += encodeText(node);
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
  const index = state.links.push(link as LexicalNode) - 1;
  state.html += `<a ${LINK_ATTRIBUTE}${index}="">${children.map(encodeText).join('')}</a>`;
  return true;
}

export function isInlineNode(node: LexicalNode): boolean {
  return (
    ['text', 'linebreak', 'tab'].includes(node.type) ||
    LINK_TYPES.has(node.type)
  );
}

// The element's inline content as a tagged string, or null when it holds a
// node this encoding does not cover.
export function encodeElement(element: LexicalNode): EncodedElement | null {
  const state: EncodedElement = {
    html: '',
    links: [],
    textTemplate: DEFAULT_TEXT,
  };
  const firstText = (element.children ?? []).flatMap((c) =>
    c.type === 'text'
      ? [c]
      : (c.children?.filter((g) => g.type === 'text') ?? [])
  )[0];
  if (firstText) state.textTemplate = firstText;
  for (const child of element.children ?? []) {
    if (!encodeInline(child, state)) return null;
  }
  return state;
}

type Run =
  | { text: string; format: number; link: number | null }
  | { lineBreak: true; link: number | null };

function linkIndex(element: { attrs: { name: string }[] }): number | null {
  const attribute = element.attrs.find((a) =>
    a.name.startsWith(LINK_ATTRIBUTE)
  );
  if (!attribute) return null;
  const index = Number(attribute.name.slice(LINK_ATTRIBUTE.length));
  return Number.isInteger(index) ? index : null;
}

function collectRuns(
  node: HtmlParent,
  format: number,
  link: number | null,
  runs: Run[],
  problems: string[],
  links: number
) {
  for (const child of node.childNodes) {
    if (isText(child)) {
      runs.push({ text: child.value, format, link });
    } else if (!isElement(child)) {
      continue;
    } else if (child.tagName === 'br') {
      runs.push({ lineBreak: true, link });
    } else if (child.tagName === 'a') {
      const index = linkIndex(child);
      if (index === null || index >= links) problems.push('unknown link');
      collectRuns(
        child,
        format,
        index !== null && index < links ? index : link,
        runs,
        problems,
        links
      );
    } else if (TAG_BITS.has(child.tagName)) {
      collectRuns(
        child,
        format | TAG_BITS.get(child.tagName)!,
        link,
        runs,
        problems,
        links
      );
    } else {
      problems.push(`unexpected <${child.tagName}>`);
    }
  }
}

function formatsIn(html: string): Set<number> {
  const runs: Run[] = [];
  collectRuns(parseHtml(html), 0, null, runs, [], Number.MAX_SAFE_INTEGER);
  return new Set(
    runs.flatMap((run) =>
      'text' in run && run.text.trim() ? [run.format] : []
    )
  );
}

// A run's Lexical leaves, with each tab character as Lexical's tab node.
function leavesOf(run: Run, template: LexicalNode): LexicalNode[] {
  if ('lineBreak' in run) return [{ type: 'linebreak', version: 1 }];
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
// come back, every format the source used must still be present, and no
// other tags may appear.
export function decodeElement(
  html: string,
  encoded: EncodedElement
): DecodedElement {
  const runs: Run[] = [];
  const problems: string[] = [];
  collectRuns(parseHtml(html), 0, null, runs, problems, encoded.links.length);
  const seen = new Set(runs.map((run) => run.link));
  encoded.links.forEach((_, index) => {
    if (!seen.has(index)) problems.push(`link ${index} missing`);
  });
  const translatedFormats = [...formatsIn(html)];
  for (const format of formatsIn(encoded.html)) {
    if (format && !translatedFormats.some((f) => (f & format) === format))
      problems.push(`format ${format} missing`);
  }
  if (problems.length) return { problems };

  const children: LexicalNode[] = [];
  let openLink: { index: number; node: LexicalNode } | null = null;
  for (const run of runs) {
    for (const leaf of leavesOf(run, encoded.textTemplate)) {
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
