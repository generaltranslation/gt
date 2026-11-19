import { TraverseOptions } from '@babel/traverse';
import { TransformState } from '../state/types';
import { basePass } from './basePass';
import { processCallExpression } from '../processing/injection/processCallExpression';

/**
 * Injection pass — inject the hashes collected for <T> components.
 */
export function injectionPass(state: TransformState): TraverseOptions {
  return {
    ...basePass(state),
    CallExpression: processCallExpression(state),
  };
}
