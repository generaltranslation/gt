import type { ChoiceNode, ResolutionNode } from './types';

/**
 * Expands top-level ChoiceNodes in a ResolutionNode array into the
 * cross-product of all possible combinations.
 *
 * Given `[A, Choice([B, C]), D]`:
 * - Position 0: A (1 alternative)
 * - Position 1: B or C (2 alternatives)
 * - Position 2: D (1 alternative)
 * - Cross-product: [[A, B, D], [A, C, D]]
 *
 * Nested ChoiceNodes within a branch are flattened (a Choice inside
 * a Choice is treated as additional alternatives). However, this
 * does NOT recurse into leaf values — ChoiceNodes inside
 * ExtractionElement.c or ExtractionGTProp.b are passed through
 * unexpanded. Leaf-level expansion will require a recurseIntoLeaf
 * callback (not yet implemented).
 *
 * @typeParam T - The leaf content type
 * @param nodes - The array of resolution nodes to expand
 * @returns Array of all possible combinations. Each inner array
 *   is one variant with all ChoiceNodes resolved to a single branch.
 *   Returns `[nodes as T[]]` if no ChoiceNodes are found.
 */
export function multiply<T>(nodes: ResolutionNode<T>[]): T[][] {
  const alternativesByPosition = nodes.map(expandNode);
  return alternativesByPosition.reduce<T[][]>(
    (variants, alternatives) =>
      variants.flatMap((variant) =>
        alternatives.map((alternative) => [...variant, alternative])
      ),
    [[]]
  );
}

function expandNode<T>(node: ResolutionNode<T>): T[] {
  if (!isChoiceNode(node)) {
    return [node as T];
  }

  return node.branches.flatMap(expandNode);
}

function isChoiceNode<T>(node: ResolutionNode<T>): node is ChoiceNode<T> {
  return (
    typeof node === 'object' &&
    node !== null &&
    (node as ChoiceNode<T>).__gt_node_type === 'choice' &&
    Array.isArray((node as ChoiceNode<T>).branches)
  );
}
