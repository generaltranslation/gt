import type {
  DateTimeNode,
  MessageBranches,
  MessageNode,
  MessageTree,
  NumberNode,
  PluralNode,
  SelectNode,
  TagNode,
} from './messageTree';

/** A node that names a variable: anything but text and `#`. */
export type PlaceholderNode = Exclude<MessageNode, string | 0>;

// `switch (node[1])` does not narrow a tuple union, so code narrows with these.
export function isPlaceholderNode(node: MessageNode): node is PlaceholderNode {
  return typeof node !== 'string' && node !== 0;
}

export function isFormattedNode(
  node: PlaceholderNode
): node is NumberNode | DateTimeNode {
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
 * The nodes of a branch. A branch without placeholders is its text, and an
 * empty one has no nodes, so it adds no part when formatted.
 */
export function branchNodes(branch: string | MessageTree): MessageTree {
  if (typeof branch !== 'string') return branch;
  return branch ? [branch] : [];
}

/** Visits every placeholder in tree order, including those in branches and tags. */
export function forEachPlaceholder(
  tree: MessageTree,
  visit: (node: PlaceholderNode) => void
): void {
  for (const node of tree) {
    if (!isPlaceholderNode(node)) continue;
    visit(node);
    if (isBranchingNode(node)) {
      for (const branch of Object.values(node[2])) {
        forEachPlaceholder(branchNodes(branch), visit);
      }
    } else if (isTagNode(node)) {
      forEachPlaceholder(node[2], visit);
    }
  }
}

/**
 * Copies the tree with each placeholder replaced by `map(placeholder)`. The
 * branches and tag children of the result are mapped the same way.
 */
export function mapPlaceholders(
  tree: MessageTree,
  map: (node: PlaceholderNode) => PlaceholderNode
): MessageTree {
  return tree.map((node) => {
    if (!isPlaceholderNode(node)) return node;
    const mapped = map(node);
    if (isBranchingNode(mapped)) {
      const [name, kind, branches, ...rest] = mapped;
      return [
        name,
        kind,
        mapBranches(branches, (branch) =>
          typeof branch === 'string' ? branch : mapPlaceholders(branch, map)
        ),
        ...rest,
      ] as MessageNode;
    }
    if (isTagNode(mapped)) {
      return [mapped[0], 'tag', mapPlaceholders(mapped[2], map)];
    }
    return mapped;
  });
}

/** Copies branches in `keys` order, mapping each one. */
export function mapBranches(
  branches: MessageBranches,
  map: (branch: string | MessageTree) => string | MessageTree,
  keys = Object.keys(branches)
): MessageBranches {
  // Object.fromEntries defines own properties, so a `__proto__` branch stays one.
  return Object.fromEntries(keys.map((key) => [key, map(branches[key])]));
}
