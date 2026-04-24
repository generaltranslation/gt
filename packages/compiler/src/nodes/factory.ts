import type {
  ChoiceNode,
  ResolutionNode,
  ExtractionChild,
  ExtractionElement,
  ExtractionGTProp,
} from './types';

/**
 * Creates a ChoiceNode from an array of alternative branches.
 *
 * @typeParam T - The leaf content type
 * @param branches - The alternative branches (at least 2)
 * @returns A ChoiceNode with the `__gt_node_type: 'choice'` discriminator
 */
export function createChoiceNode<T>(
  branches: ResolutionNode<T>[]
): ChoiceNode<T> {
  return {
    __gt_node_type: 'choice',
    branches,
  };
}

/**
 * Creates an ExtractionElement from its constituent parts.
 *
 * This is a convenience function that mirrors the structure of
 * core's JsxElement but uses extraction types. Includes the
 * `__gt_type: 'element'` discriminator tag.
 */
export function createExtractionElement(
  tag: string | undefined,
  id: number,
  children?: ResolutionNode<ExtractionChild>[],
  data?: ExtractionGTProp
): ExtractionElement {
  const element: ExtractionElement = { __gt_type: 'element', i: id };
  if (tag !== undefined) element.t = tag;
  if (children !== undefined) element.c = children;
  if (data !== undefined) element.d = data;
  return element;
}

/**
 * Creates an ExtractionGTProp from its constituent parts.
 *
 * Includes the `__gt_type: 'gt_prop'` discriminator tag.
 */
export function createExtractionGTProp(
  branches?: Record<string, ResolutionNode<ExtractionChild>[]>,
  transformation?: 'p' | 'b'
): ExtractionGTProp {
  const prop: ExtractionGTProp = { __gt_type: 'gt_prop' };
  if (branches !== undefined) prop.b = branches;
  if (transformation !== undefined) prop.t = transformation;
  return prop;
}
