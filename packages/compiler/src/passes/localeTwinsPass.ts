import { TraverseOptions } from '@babel/traverse';
import { TransformState } from '../state/types';
import { processProgram } from '../processing/locale-twins/processProgram';

/**
 * Locale twins pass — for the `'locale-twins'` translation splitting
 * strategy, inserts one registration call per module carrying an unfilled
 * placeholder (the module's attributed hashes and source-locale content) and
 * injects `$_hash` into attributed msg() calls. Reads the entries recorded by
 * the collection pass; does not use basePass.
 */
export function localeTwinsPass(state: TransformState): TraverseOptions {
  return {
    Program: processProgram(state),
  };
}
