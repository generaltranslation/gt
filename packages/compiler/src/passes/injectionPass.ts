import { TraverseOptions } from '@babel/traverse';
import { TransformState } from '../state/types';
import { basePass } from './basePass';
import { processCallExpression } from '../processing/injection/processCallExpression';
import { processVariableDeclarator } from '../processing/injection/processVariableDeclarator';

/**
 * Injection pass — apply collected data to generate hashes and content arrays.
 */
export function injectionPass(state: TransformState): TraverseOptions {
  return {
    ...basePass(state),
    CallExpression: processCallExpression(state),
    VariableDeclarator: processVariableDeclarator(state),
  };
}
