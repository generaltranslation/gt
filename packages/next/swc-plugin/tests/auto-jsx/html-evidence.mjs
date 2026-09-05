import { parse } from 'parse5';

/** Extract assertion evidence from the HTML tree, excluding non-content nodes. */
export function readHtmlEvidence(html) {
  const parts = [];
  const hashes = [];
  const ignored = new Set(['head', 'script', 'style', 'template']);
  function visit(node) {
    if (ignored.has(node.nodeName)) return;
    if (node.nodeName === '#text') parts.push(node.value);
    if ('attrs' in node) {
      for (const attribute of node.attrs) {
        if (attribute.name === 'data-_gt-hash') hashes.push(attribute.value);
      }
    }
    if ('childNodes' in node) node.childNodes.forEach(visit);
  }
  visit(parse(html));
  return { text: parts.join('').replace(/\s+/g, ' '), hashes };
}
