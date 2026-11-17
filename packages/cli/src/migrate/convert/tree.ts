import type {
  MessageBranches,
  MessageFormats,
  MessageNode,
  MessageTree,
} from '@generaltranslation/icu';
import type { RenameMap } from '../types.js';

type PlaceholderNode = Exclude<MessageNode, string | 0>;

export function compareKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function treeNodes(tree: MessageTree): MessageNode[] {
  if (typeof tree !== 'string') return tree;
  return tree ? [tree] : [];
}

export function isPlaceholder(node: MessageNode): node is PlaceholderNode {
  return typeof node !== 'string' && node !== 0;
}

export function sortedJson(value: unknown): string {
  return JSON.stringify(value, (_key, inner: unknown) =>
    inner && typeof inner === 'object' && !Array.isArray(inner)
      ? Object.fromEntries(
          Object.entries(inner).sort(([a], [b]) => compareKeys(a, b))
        )
      : inner
  );
}

function sortRecord<T extends object>(record: T): T {
  return Object.fromEntries(
    Object.entries(record).sort(([a], [b]) => compareKeys(a, b))
  ) as T;
}

function toTree(nodes: MessageNode[]): MessageTree {
  if (nodes.length === 0) return '';
  return nodes.length === 1 && typeof nodes[0] === 'string' ? nodes[0] : nodes;
}

export function mapTree(
  tree: MessageTree,
  mapNode: (node: PlaceholderNode) => MessageNode
): MessageTree {
  if (typeof tree === 'string') return tree;
  return tree.map((node) => (isPlaceholder(node) ? mapNode(node) : node));
}

export function mapBranches(
  branches: MessageBranches,
  map: (branch: MessageTree) => MessageTree,
  keys = Object.keys(branches)
): MessageBranches {
  return Object.fromEntries(keys.map((key) => [key, map(branches[key])]));
}

/** The one form `templateToMessage` and `icuToMessage` build for this message, so it hashes the same. */
export function canonicalizeTree(tree: MessageTree): MessageTree {
  const out: MessageNode[] = [];
  for (const node of treeNodes(tree)) {
    if (typeof node === 'string') {
      if (!node) continue;
      const last = out.length - 1;
      if (typeof out[last] === 'string') out[last] += node;
      else out.push(node);
    } else if (!isPlaceholder(node)) {
      out.push(node);
    } else {
      out.push(canonicalNode(node));
    }
  }
  return toTree(out);
}

function canonicalNode(node: PlaceholderNode): MessageNode {
  switch (node[1]) {
    case undefined:
      return node;
    case 'select':
      return [node[0], 'select', canonicalBranches(node[2])];
    case 'plural':
    case 'selectordinal':
      return node[3]
        ? [node[0], node[1], canonicalBranches(node[2]), node[3]]
        : [node[0], node[1], canonicalBranches(node[2])];
    case 'tag':
      return [node[0], 'tag', canonicalizeTree(node[2])];
    case 'number':
      if (node[2] === undefined) return [node[0], 'number'];
      return typeof node[2] === 'string'
        ? node
        : [node[0], 'number', sortRecord(node[2])];
    case 'date':
      if (node[2] === undefined) return [node[0], 'date'];
      return typeof node[2] === 'string'
        ? node
        : [node[0], 'date', sortRecord(node[2])];
    case 'time':
      if (node[2] === undefined) return [node[0], 'time'];
      return typeof node[2] === 'string'
        ? node
        : [node[0], 'time', sortRecord(node[2])];
  }
}

function canonicalBranches(branches: MessageBranches): MessageBranches {
  return mapBranches(
    branches,
    canonicalizeTree,
    Object.keys(branches).sort(compareKeys)
  );
}

/** Trees with equal shapes differ only in variable names; zip their `variables` to rename one to the other. */
export function treeShape(tree: MessageTree): {
  shape: string;
  variables: string[];
} {
  const variables: string[] = [];
  const indexOf = (name: string): number => {
    const index = variables.indexOf(name);
    if (index !== -1) return index;
    variables.push(name);
    return variables.length - 1;
  };
  const shapeOf = (branch: MessageTree): unknown =>
    typeof branch === 'string'
      ? branch
      : branch.map((node) => (isPlaceholder(node) ? nodeShape(node) : node));
  const nodeShape = (node: PlaceholderNode): unknown => {
    if (node[1] === 'tag') return [node[0], 'tag', shapeOf(node[2])];
    const index = indexOf(node[0]);
    switch (node[1]) {
      case undefined:
        return [index];
      case 'select':
      case 'plural':
      case 'selectordinal':
        return [
          index,
          node[1],
          Object.keys(node[2])
            .sort(compareKeys)
            .map((key) => [key, shapeOf(node[2][key])]),
          node[1] === 'select' ? 0 : (node[3] ?? 0),
        ];
      default:
        return [index, node[1], node[2] ?? null];
    }
  };
  const shape = JSON.stringify(shapeOf(canonicalizeTree(tree)));
  return { shape, variables };
}

export function alphaRenameMap(
  fromTree: MessageTree,
  toTree: MessageTree
): RenameMap | undefined {
  const from = treeShape(fromTree);
  const to = treeShape(toTree);
  if (from.shape !== to.shape) return undefined;
  const map: RenameMap = {};
  from.variables.forEach((name, index) => {
    if (name !== to.variables[index]) map[name] = to.variables[index];
  });
  return map;
}

function renamed(name: string, map: RenameMap): string {
  return Object.prototype.hasOwnProperty.call(map, name) ? map[name] : name;
}

/** Renames every variable at every depth; tag names are markup, not variables, so they stay. */
export function renameVariables(
  tree: MessageTree,
  map: RenameMap
): MessageTree {
  return mapTree(tree, (node): MessageNode => {
    const name = renamed(node[0], map);
    switch (node[1]) {
      case undefined:
        return [name];
      case 'tag':
        return [node[0], 'tag', renameVariables(node[2], map)];
      case 'select':
        return [
          name,
          'select',
          mapBranches(node[2], (branch) => renameVariables(branch, map)),
        ];
      case 'plural':
      case 'selectordinal': {
        const branches = mapBranches(node[2], (branch) =>
          renameVariables(branch, map)
        );
        return node[3] === undefined
          ? [name, node[1], branches]
          : [name, node[1], branches, node[3]];
      }
      case 'number':
        return node[2] === undefined
          ? [name, 'number']
          : [name, 'number', node[2]];
      case 'date':
        return node[2] === undefined ? [name, 'date'] : [name, 'date', node[2]];
      case 'time':
        return node[2] === undefined ? [name, 'time'] : [name, 'time', node[2]];
    }
  });
}

export function renameFormats(
  formats: MessageFormats,
  map: RenameMap
): MessageFormats {
  return Object.fromEntries(
    Object.entries(formats).map(([name, context]) => [
      renamed(name, map),
      context,
    ])
  );
}
