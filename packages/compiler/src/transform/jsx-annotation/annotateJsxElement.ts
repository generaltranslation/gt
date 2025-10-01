import * as t from '@babel/types';
import { TransformState } from '../../state/types';
import { getComponentType } from '../determineComponentType';
import { JSXElementWithCanonicalId } from './types';
import { GT_COMPONENT_TYPES } from '../../utils/constants/gt/constants';

/**
 * Recursively traverse and annotate JSX element names in-place
 */
function traverseAndAnnotateElement(
  element: t.JSXElement,
  state: TransformState
): void {
  // Recursively process only JSX element children
  for (const child of element.children) {
    if (t.isJSXElement(child)) {
      traverseAndAnnotateElement(child, state);
    }
  }

  // Check if the element is a GT component
  const componentType: GT_COMPONENT_TYPES | null = getComponentType(
    element,
    state.importTracker
  );
  if (!componentType) {
    return;
  }

  // Annotate element
  (element as JSXElementWithCanonicalId)._gt_canonical_identifier =
    componentType;
}

/**
 * @description Adds the _gt_canonical_identifier annotation to the element to resolve aliased gt components
 */
export function annotateJsxElement(
  element: t.JSXElement,
  state: TransformState
): t.JSXElement {
  // Recursively traverse and modify all elements in-place
  traverseAndAnnotateElement(element, state);

  return element;
}
