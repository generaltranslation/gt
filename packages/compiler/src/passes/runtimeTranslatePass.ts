import { TraverseOptions } from '@babel/traverse';
import { TransformState } from '../state/types';
import {
  processImportDeclaration,
  ImportAnchor,
} from '../processing/runtime-translate/processImportDeclaration';
import { processProgram } from '../processing/runtime-translate/processProgram';

/**
 * Runtime translate pass — injects GtInternalRuntimeTranslateString and
 * GtInternalRuntimeTranslateJsx calls at the module level for dev hot reload.
 *
 * For each extracted string/JSX, injects:
 * await Promise.all([
 *   GtInternalRuntimeTranslateString("msg", { $context, $_hash, ... }),
 *   GtInternalRuntimeTranslateJsx(children, { $context, $id }),
 * ])
 *
 * This pass does NOT use basePass — it doesn't need scope tracking and must not
 * reset ScopeTracker/StringCollector state via processProgram.
 */
export function runtimeTranslatePass(state: TransformState): TraverseOptions {
  let alreadyImportedString = false;
  let alreadyImportedJsx = false;
  const importAnchor: ImportAnchor = { path: null };

  const onStringFound = () => {
    alreadyImportedString = true;
  };

  const onJsxFound = () => {
    alreadyImportedJsx = true;
  };

  return {
    ImportDeclaration: processImportDeclaration(
      onStringFound,
      onJsxFound,
      importAnchor
    ),
    Program: processProgram({
      state,
      isStringAlreadyImported: () => alreadyImportedString,
      isJsxAlreadyImported: () => alreadyImportedJsx,
      importAnchor,
    }),
  };
}
