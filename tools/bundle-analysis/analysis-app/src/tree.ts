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

  for (const module of modules) {
    const segments = segmentsOf(module);
    let parent = root;
    let key = '';
    segments.forEach((segment) => {
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
      parent = node;
    });
    root.bytes += module.bytes;
  }

  // Previous sizes are summed over every previous module, including files
  // that no longer exist, so a package's delta counts what was removed.
  if (previous) {
    const totals = new Map<string, number>();
    for (const module of previous) {
      let key = '';
      totals.set('', (totals.get('') ?? 0) + module.bytes);
      for (const segment of segmentsOf(module)) {
        key = key ? `${key}/${segment}` : segment;
        totals.set(key, (totals.get(key) ?? 0) + module.bytes);
      }
    }
    for (const node of index.values()) {
      node.previousBytes = totals.get(node.key) ?? 0;
    }
  }
  return collapse(root);
}

function segmentsOf(module: ModuleSize): string[] {
  return [module.pkg, ...module.path.split('/').filter(Boolean)];
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
