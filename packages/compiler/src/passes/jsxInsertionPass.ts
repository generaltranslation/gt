import { TraverseOptions } from '@babel/traverse';
import { TransformState } from '../state/types';
import { processCallExpression } from '../processing/jsx-insertion/processCallExpression';

/**
 * The purpose of this pass is to insert the translation component (T and Var) automatically into the Jsx tree.
 * This is specifically for browser builds only.
 *
 * <div>Hello</div> -> <div><T>Hello</T></div>
 *
 *
 */
export function jsxInsertionPass(state: TransformState): TraverseOptions {
  return {
    CallExpression: processCallExpression(state),
  };
}
