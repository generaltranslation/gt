import type { ChoiceNode, ResolutionNode, ExtractionChild } from './types';
import { isChoiceNode, isExtractionElement } from './guards';

/**
 * Checks whether a ResolutionNode array contains any ChoiceNode
 * at any depth. For strings, only checks the top-level array.
 * For JSX, recurses into ExtractionElement children and GTProp branches.
 *
 * Use this as a fast gate before running multiplication — if there
 * are no choices, multiplication is a no-op.
 */
export function containsChoiceNode<T>(
  nodes: ResolutionNode<T>[],
  recurseIntoLeaf?: (leaf: T) => ResolutionNode<T>[] | null
): boolean {
  for (const node of nodes) {
    if (isChoiceNode(node)) return true;
    if (recurseIntoLeaf) {
      const nested = recurseIntoLeaf(node as T);
      if (nested && containsChoiceNode(nested, recurseIntoLeaf)) return true;
    }
  }
  return false;
}

/**
 * Finds all ChoiceNode instances in a ResolutionNode array,
 * including those nested inside ExtractionElement children
 * and ExtractionGTProp branches.
 *
 * Returns an array of { path, node } objects where `path` describes
 * the location of the ChoiceNode in the tree (for debugging/error reporting).
 */
export function findChoiceNodes<T>(
  nodes: ResolutionNode<T>[],
  recurseIntoLeaf?: (leaf: T) => ResolutionNode<T>[] | null,
  basePath: string = ''
): { path: string; node: ChoiceNode<T> }[] {
  const results: { path: string; node: ChoiceNode<T> }[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const currentPath = basePath ? `${basePath}[${i}]` : `[${i}]`;

    if (isChoiceNode(node)) {
      results.push({ path: currentPath, node });
      results.push(
        ...findChoiceNodes(
          node.branches,
          recurseIntoLeaf,
          `${currentPath}.branches`
        )
      );
    } else if (recurseIntoLeaf) {
      const nested = recurseIntoLeaf(node as T);
      if (nested) {
        results.push(
          ...findChoiceNodes(nested, recurseIntoLeaf, `${currentPath}.c`)
        );
      }
    }
  }

  return results;
}

/**
 * Callback for recursing into ExtractionChild leaves to find
 * nested ResolutionNode arrays inside ExtractionElement children
 * and ExtractionGTProp branches.
 *
 * Pass this as the `recurseIntoLeaf` parameter to `containsChoiceNode`,
 * `findChoiceNodes`, and `multiply` when working with JSX content.
 */
export function recurseIntoExtractionChild(
  leaf: ExtractionChild
): ResolutionNode<ExtractionChild>[] | null {
  if (isExtractionElement(leaf)) {
    if (leaf.c) return leaf.c;
    if (leaf.d && leaf.d.b) {
      const allChildren: ResolutionNode<ExtractionChild>[] = [];
      for (const branchChildren of Object.values(leaf.d.b)) {
        allChildren.push(...branchChildren);
      }
      if (allChildren.length > 0) return allChildren;
    }
  }
  return null;
}
