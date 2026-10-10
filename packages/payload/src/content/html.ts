import { parseFragment } from 'parse5';
import type { DefaultTreeAdapterMap } from 'parse5';

export type HtmlNode = DefaultTreeAdapterMap['childNode'];
export type HtmlElement = DefaultTreeAdapterMap['element'];
export type HtmlParent = DefaultTreeAdapterMap['parentNode'];

export function escapeText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function escapeAttribute(text: string): string {
  return escapeText(text).replace(/"/g, '&quot;');
}

export function parseHtml(html: string): HtmlParent {
  return parseFragment(html);
}

export function isElement(node: HtmlNode): node is HtmlElement {
  return 'tagName' in node;
}

export function isText(
  node: HtmlNode
): node is DefaultTreeAdapterMap['textNode'] {
  return node.nodeName === '#text';
}

// A plain text value as HTML text, with line breaks as <br>.
export function encodePlainText(text: string): string {
  return escapeText(text).replace(/\r?\n/g, '<br>');
}

// The plain text of a value sent with encodePlainText, or null when it came
// back with other markup in it.
export function readPlainText(html: string): string | null {
  const fragment = parseHtml(html);
  let text = '';
  for (const node of fragment.childNodes) {
    if (isText(node)) text += node.value;
    else if (isElement(node) && node.tagName === 'br') text += '\n';
    else return null;
  }
  return text;
}
