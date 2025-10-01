import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { GT_COMPONENT_TYPES } from '../../utils/constants/gt/constants';
import { getComponentType } from '../../transform/determineComponentType';
import { registerHash } from '../../transform/registration/registerHash';
import { TransformState } from '../../state/types';

/**
 * Process JSX elements to detect GT components and collect content
 *
 * TODO: this function may actually never be invoked... perhaps should remove it?
 */
export function processJSXElement(
  path: NodePath<t.JSXElement>,
  state: TransformState
) {
  const element = path.node;

  const componentType = getComponentType(element, state.importTracker);
  if (componentType === GT_COMPONENT_TYPES.T) {
    state.statistics.jsxElementCount += 1;
    if (state.settings.compileTimeHash) {
      registerHash(path, state);
    }
  }
}
