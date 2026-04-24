import type { ChoiceNode, ResolutionNode } from './types';
import { isChoiceNode } from './guards';

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
  const alternativesPerPosition: T[][] = [];

  for (const node of nodes) {
    if (isChoiceNode(node)) {
      alternativesPerPosition.push(expandChoiceBranches(node));
    } else {
      alternativesPerPosition.push([node as T]);
    }
  }

  return cartesianProduct(alternativesPerPosition);
}

function expandChoiceBranches<T>(choice: ChoiceNode<T>): T[] {
  const results: T[] = [];
  for (const branch of choice.branches) {
    if (isChoiceNode(branch)) {
      results.push(...expandChoiceBranches(branch));
    } else {
      results.push(branch as T);
    }
  }
  return results;
}

/**
 * Computes the cartesian product of an array of arrays.
 *
 * Given `[[A, B], [X, Y]]`, returns `[[A, X], [A, Y], [B, X], [B, Y]]`.
 *
 * Used internally by `multiply` to combine alternatives from
 * independent choice points.
 */
export function cartesianProduct<T>(arrays: T[][]): T[][] {
  if (arrays.length === 0) return [[]];

  let result: T[][] = [[]];
  for (const alternatives of arrays) {
    const next: T[][] = [];
    for (const partial of result) {
      for (const item of alternatives) {
        next.push([...partial, item]);
      }
    }
    result = next;
  }
  return result;
}
