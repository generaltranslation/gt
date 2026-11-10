import type { MessageNode, MessageTree } from './messageTree';
import {
  isBranchingNode,
  isFormattedNode,
  isPlaceholderNode,
  isTagNode,
  mapBranches,
  messageNodes,
} from './walk';

// Equal messages must have equal tree JSON, because keys are hashes of it.
// These are the only definitions of that form: buildMessageTree builds it
// directly, since it runs on every message, and normalizeTree rewrites any
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
 * A message from its nodes: without placeholders it is its text, the way it
 * was written, and `''` when empty. `messageNodes` reads it back.
 */
export function toMessage(nodes: MessageNode[]): MessageTree {
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
 * buildMessageTree builds: adjacent text merged and empty text dropped, a
 * message, branch or tag's children without placeholders as one string,
 * branch keys and Intl options sorted, and no zero plural offset or null
 * style. An empty style stays, so printing rejects it rather than
 * formatting it differently.
 */
export function normalizeTree(tree: MessageTree): MessageTree {
  const out: MessageNode[] = [];
  for (const node of messageNodes(tree)) {
    if (!isPlaceholderNode(node)) {
      if (typeof node === 'string') appendText(out, node);
      else out.push(node);
    } else if (isBranchingNode(node)) {
      const [name, kind, branches, offset] = node;
      const sorted = mapBranches(
        branches,
        normalizeTree,
        Object.keys(branches).sort(compareKeys)
      );
      out.push(
        (offset
          ? [name, kind, sorted, offset]
          : [name, kind, sorted]) as MessageNode
      );
    } else if (isTagNode(node)) {
      out.push([node[0], 'tag', normalizeTree(node[2])]);
    } else if (isFormattedNode(node)) {
      const [name, kind, options] = node;
      const style =
        options == null || typeof options === 'string'
          ? (options ?? undefined)
          : sortRecord(options);
      out.push(
        (style === undefined
          ? [name, kind]
          : [name, kind, style]) as MessageNode
      );
    } else {
      out.push(node);
    }
  }
  return toMessage(out);
}
