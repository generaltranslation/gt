import { TraverseOptions } from '@babel/traverse';
import { TransformState } from '../state/types';
import {
  processImportDeclaration,
  ImportAnchor,
} from '../processing/runtime-translate/processImportDeclaration';
import { processProgram } from '../processing/runtime-translate/processProgram';

/**
 * Runtime translate pass — injects GtInternalRuntimeTranslateJsx calls at the
 * module level for dev hot reload.
 *
 * For each extracted <T>, injects:
 * await Promise.all([
 *   GtInternalRuntimeTranslateJsx(children, { $context, $id }),
 * ])
 *
 * This pass does NOT use basePass — it doesn't need scope tracking and must not
 * reset ScopeTracker/StringCollector state via processProgram.
 */
export function runtimeTranslatePass(state: TransformState): TraverseOptions {
  let alreadyImported = false;
  const importAnchor: ImportAnchor = { path: null };

  const onImportFound = () => {
    alreadyImported = true;
  };

  return {
    ImportDeclaration: processImportDeclaration(onImportFound, importAnchor),
    Program: processProgram({
      state,
      isAlreadyImported: () => alreadyImported,
      importAnchor,
    }),
  };
}
