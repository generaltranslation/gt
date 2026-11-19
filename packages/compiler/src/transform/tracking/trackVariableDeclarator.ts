import { TransformState } from '../../state/types';
import * as t from '@babel/types';
import { extractIdentifiersFromLVal } from '../../utils/parsing/extractIdentifiersFromLVal';

/**
 * Track declared variables, which shadow any GT import of the same name.
 * - const T = "Hello"
 */
export function trackVariableDeclarator(
  varDeclarator: t.VariableDeclarator,
  state: TransformState
): void {
  // Ignore non-LVal assignments
  if (!t.isLVal(varDeclarator.id)) {
    return;
  }

  for (const identifier of extractIdentifiersFromLVal(varDeclarator.id)) {
    state.scopeTracker.trackRegularVariable(identifier, 'other');
  }
}
