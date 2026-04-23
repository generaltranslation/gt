import type { ChoiceNode, ResolutionNode } from './types';
import { isChoiceNode } from './guards';

/**
 * Expands all ChoiceNodes in a ResolutionNode array into the
 * cross-product of all possible combinations.
 *
 * This is the core algorithm that replaces both the CLI's
 * `multiplyJsxTree()` (for JSX) and `nodeToStrings()` (for strings).
 *
 * ## How it works
 *
 * Given `[A, Choice([B, C]), D]`:
 * - Position 0: A (1 alternative)
 * - Position 1: B or C (2 alternatives)
 * - Position 2: D (1 alternative)
 * - Cross-product: [[A, B, D], [A, C, D]]
 *
 * For nested choices (inside ExtractionElement children), the
 * `recurseIntoLeaf` callback is used to find and expand them.
 * Each nested expansion multiplies with the outer expansion.
 *
 * ## Usage
 *
 * ```typescript
 * // Strings — no recursion needed
 * const variants = multiply<string>(stringNodes);
 *
 * // JSX — recurse into element children and GTProp branches
 * const variants = multiply<ExtractionChild>(
 *   jsxNodes,
 *   recurseIntoExtractionChild
 * );
 * ```
 *
 * @typeParam T - The leaf content type
 * @param nodes - The array of resolution nodes to expand
 * @param recurseIntoLeaf - Optional callback to find nested
 *   ResolutionNode arrays inside leaf values. Required for JSX
 *   where ExtractionElement.c can contain ChoiceNodes.
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
