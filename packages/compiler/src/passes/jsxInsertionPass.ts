import { TraverseOptions } from '@babel/traverse';
import { TransformState } from '../state/types';
import { processCallExpression } from '../processing/jsx-insertion/processCallExpression';
import { processImportDeclaration } from '../processing/jsx-insertion/processImportDeclaration';
import { processProgram } from '../processing/jsx-insertion/processProgram';

/**
 * The purpose of this pass is to insert the translation component (GtInternalTranslateJsx)
 * and variable component (GtInternalVar) automatically into the Jsx tree.
 * This is specifically for browser builds only.
 *
 * <div>Hello</div> -> <div><GtInternalTranslateJsx>Hello</GtInternalTranslateJsx></div>
 */
export function jsxInsertionPass(state: TransformState): TraverseOptions {
  let alreadyImported = false;
  const countBefore = state.statistics.jsxInsertionsCount;

  const onImportFound = () => {
    alreadyImported = true;
  };

  return {
    ImportDeclaration: processImportDeclaration(onImportFound),
    CallExpression: processCallExpression(state),
    Program: processProgram({
      state,
      countBefore,
      isAlreadyImported: () => alreadyImported,
    }),
  };
}
