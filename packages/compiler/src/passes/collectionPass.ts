import { TraverseOptions } from '@babel/traverse';
import { TransformState } from '../state/types';
import { basePass } from './basePass';
import { processCallExpression } from '../processing/collection/processCallExpression';

/**
 * Collection pass — collect translation data without transforming.
 * Tracks imports, variable declarations, and <T> components.
 */
export function collectionPass(state: TransformState): TraverseOptions {
  return {
    ...basePass(state),
    CallExpression: processCallExpression(state),
  };
}
