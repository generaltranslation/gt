import type { FormattedNode, MessageNode, MessageTree } from './messageTree';
import {
  isBranchingNode,
  isFormattedNode,
  isPlaceholderNode,
  isTagNode,
  mapBranches,
  messageTreeNodes,
} from './walk';

// Equal messages must have equal tree JSON, because keys are hashes of it.
// These are the only definitions of that form: templateToMessage builds it
// directly, since it runs on every message, and normalizeMessageTree rewrites any
// other tree to it.

/** Code-unit order, the same in every engine, so keys sort the same everywhere. */
export function compareKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** A copy with keys sorted. Object.fromEntries keeps a `__proto__` key an own property. */
export function sortRecord<T extends object>(record: T): T {
  return Object.fromEntries(
    Object.entries(record).sort(([a], [b]) => compareKeys(a, b))
  ) as T;
}

/** Appends text, merging it into text just before it and dropping empty text. */
export function appendText(out: MessageNode[], text: string): void {
  if (!text) return;
  const last = out.length - 1;
  if (typeof out[last] === 'string') out[last] += text;
  else out.push(text);
}

/**
 * A message tree from its nodes: without placeholders it is its text, the way it
 * was written, and `''` when empty. `messageTreeNodes` reads it back.
 */
export function toMessage<Format>(
  nodes: MessageNode<Format>[]
): MessageTree<Format> {
  if (nodes.length === 0) return '';
  return nodes.length === 1 && typeof nodes[0] === 'string' ? nodes[0] : nodes;
}

/**
 * A formatted placeholder's canonical style from its fields: sorted, and no
 * style when there are none, so builders never write `{}`, which a tree does
 * not hold.
 */
export function canonicalStyle<T extends object>(fields: T): T | undefined {
  return Object.keys(fields).length ? sortRecord(fields) : undefined;
}

/**
 * Rewrites a tree, such as one converted from an ICU string, to the form
 * templateToMessage builds: adjacent text merged and empty text dropped, a
 * message, branch or tag's children without placeholders as one string,
 * branch keys and Intl options sorted, and no zero plural offset or
 * `undefined` style. An empty style stays, so printing rejects it rather than
 * formatting it differently.
 */
export function normalizeMessageTree(tree: MessageTree): MessageTree {
  const out: MessageNode[] = [];
  for (const node of messageTreeNodes(tree)) {
    if (!isPlaceholderNode(node)) {
      if (typeof node === 'string') appendText(out, node);
      else out.push(node);
    } else if (isBranchingNode(node)) {
      const sorted = mapBranches(
        node[2],
        normalizeTree,
        Object.keys(node[2]).sort(compareKeys)
      );
      out.push(
        node[1] !== 'select' && node[3]
          ? [node[0], node[1], sorted, node[3]]
          : [node[0], node[1], sorted]
      );
    } else if (isTagNode(node)) {
      out.push([node[0], 'tag', normalizeMessageTree(node[2])]);
    } else if (isFormattedNode(node)) {
      out.push(sortStyle(node));
    } else {
      out.push(node);
    }
  }
  return toMessageTree(out);
}

// Each kind is its own case, so the node keeps the type of its style.
function sortStyle(node: FormattedNode): FormattedNode {
  if (node[2] === undefined) return [node[0], node[1]];
  if (typeof node[2] === 'string') return node;
  switch (node[1]) {
    case 'number':
      return [node[0], 'number', sortRecord(node[2])];
    case 'date':
      return [node[0], 'date', sortRecord(node[2])];
    case 'time':
      return [node[0], 'time', sortRecord(node[2])];
  }
}
