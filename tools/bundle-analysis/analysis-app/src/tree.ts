import type { ModuleSize } from '../shared/types.ts';

/**
 * The treemap hierarchy: bundle > package > folders > file. Each node knows
 * its size in the current and previous build so changes can be shown.
 */
export interface TreeNode {
  /** Unique path from the root, e.g. `gt-react/dist/index.mjs`. */
  key: string;
  name: string;
  pkg: string;
  gt: boolean;
  bytes: number;
  previousBytes: number | null;
  children: TreeNode[];
}

export function buildTree(
  modules: ModuleSize[],
  previous: ModuleSize[] | null
): TreeNode {
  const root: TreeNode = {
    key: '',
    name: 'bundle',
    pkg: '',
    gt: false,
    bytes: 0,
    previousBytes: null,
    children: [],
  };
  const index = new Map<string, TreeNode>([['', root]]);
  const before = previous
    ? new Map(previous.map((module) => [module.id, module.bytes]))
    : null;

  for (const module of modules) {
    const segments = [module.pkg, ...module.path.split('/').filter(Boolean)];
    let parent = root;
    let key = '';
    segments.forEach((segment, depth) => {
      key = key ? `${key}/${segment}` : segment;
      let node = index.get(key);
      if (!node) {
        node = {
          key,
          name: segment,
          pkg: module.pkg,
          gt: module.gt,
          bytes: 0,
          previousBytes: null,
          children: [],
        };
        index.set(key, node);
        parent.children.push(node);
      }
      node.bytes += module.bytes;
      if (depth === segments.length - 1) {
        node.previousBytes = before ? (before.get(module.id) ?? 0) : null;
      }
      parent = node;
    });
    root.bytes += module.bytes;
  }

  // Folder sizes in the previous build come from their files.
  const fillPrevious = (node: TreeNode): number | null => {
    if (node.children.length === 0) return node.previousBytes;
    if (!before) return null;
    node.previousBytes = node.children.reduce(
      (sum, child) => sum + (fillPrevious(child) ?? 0),
      0
    );
    return node.previousBytes;
  };
  fillPrevious(root);
  return collapse(root);
}

/**
 * Merges single-child folder chains (dist/esm/x.js) into one node. A package
 * whose files all sit in one folder lists the files directly.
 */
function collapse(node: TreeNode, depth = 0): TreeNode {
  node.children = node.children.map((child) => collapse(child, depth + 1));
  const only = node.children.length === 1 ? node.children[0]! : null;
  if (!only) return node;
  if (depth === 1 && only.children.length > 0) {
    return { ...node, children: only.children };
  }
  if (depth > 1) return { ...only, name: `${node.name}/${only.name}` };
  return node;
}

export function findNode(root: TreeNode, key: string): TreeNode | null {
  if (root.key === key) return root;
  for (const child of root.children) {
    if (key === child.key || key.startsWith(`${child.key}/`)) {
      const found = findNode(child, key);
      if (found) return found;
    }
  }
  return null;
}

/** Case-insensitive match against the node's full path. */
export function matchesQuery(node: TreeNode, query: string): boolean {
  return node.key.toLowerCase().includes(query);
}
