import type {
  ChoiceNode,
  ResolutionNode,
  ExtractionChild,
  ExtractionElement,
  ExtractionGTProp,
} from './types';

/**
 * Type guard for ChoiceNode.
 *
 * Checks for the `__gt_node_type: 'choice'` discriminator, which
 * is a high-entropy key that won't collide with any existing types
 * (JsxElement uses `t`, `i`, `d`, `c`; Variable uses `k`, `i`, `v`).
 */
export function isChoiceNode<T>(
  node: ResolutionNode<T>
): node is ChoiceNode<T> {
  return (
    typeof node === 'object' &&
    node !== null &&
    '__gt_node_type' in node &&
    (node as ChoiceNode<T>).__gt_node_type === 'choice'
  );
}

/**
 * Type guard for ExtractionElement.
 * Checks for the `__gt_type: 'element'` discriminator tag.
 */
export function isExtractionElement(
  node: ResolutionNode<ExtractionChild>
): node is ExtractionElement {
  return (
    typeof node === 'object' &&
    node !== null &&
    '__gt_type' in node &&
    (node as ExtractionElement).__gt_type === 'element'
  );
}

/**
 * Type guard for ExtractionGTProp.
 * Checks for the `__gt_type: 'gt_prop'` discriminator tag.
 */
export function isExtractionGTProp(node: unknown): node is ExtractionGTProp {
  return (
    typeof node === 'object' &&
    node !== null &&
    '__gt_type' in node &&
    (node as ExtractionGTProp).__gt_type === 'gt_prop'
  );
}
