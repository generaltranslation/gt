import type {
  FormattedNode,
  MessageBranches,
  MessageNode,
  MessageTree,
  PluralNode,
  SelectNode,
  TagNode,
} from './messageTree';

/** A node that names a variable: anything but text and `#`. */
export type PlaceholderNode = Exclude<MessageNode, string | 0>;

export function isPlaceholderNode(node: MessageNode): node is PlaceholderNode {
  return typeof node !== 'string' && node !== 0;
}

export function isFormattedNode(node: PlaceholderNode): node is FormattedNode {
  return node[1] === 'number' || node[1] === 'date' || node[1] === 'time';
}

export function isBranchingNode(
  node: PlaceholderNode
): node is SelectNode | PluralNode {
  return (
    node[1] === 'select' || node[1] === 'plural' || node[1] === 'selectordinal'
  );
}

export function isTagNode(node: PlaceholderNode): node is TagNode {
  return node[1] === 'tag';
}

/**
 * The nodes of a message tree, which a message, a branch and a tag's children
 * each are. A tree without placeholders is its text, and an empty one has no
 * nodes, so it adds no part when formatted. A string is iterable, so every
 * walk starts here.
 */
export function messageTreeNodes<Format>(
  tree: MessageTree<Format>
): MessageNode<Format>[] {
  if (typeof tree !== 'string') return tree;
  return tree ? [tree] : [];
}

/** Visits every placeholder in tree order, including those in branches and tags. */
export function forEachPlaceholder(
  tree: MessageTree,
  visit: (node: PlaceholderNode) => void
): void {
  for (const node of messageTreeNodes(tree)) {
    if (!isPlaceholderNode(node)) continue;
    visit(node);
    if (isBranchingNode(node)) {
      for (const branch of Object.values(node[2])) {
        forEachPlaceholder(branch, visit);
      }
    } else if (isTagNode(node)) {
      forEachPlaceholder(node[2], visit);
    }
  }
}

/** Copies branches in `keys` order, mapping each one. */
export function mapBranches(
  branches: MessageBranches,
  map: (branch: MessageTree) => MessageTree,
  keys = Object.keys(branches)
): MessageBranches {
  // Object.fromEntries defines own properties, so a `__proto__` branch stays one.
  return Object.fromEntries(keys.map((key) => [key, map(branches[key])]));
}
