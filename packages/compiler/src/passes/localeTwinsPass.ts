import { TraverseOptions } from '@babel/traverse';
import { TransformState } from '../state/types';
import { processProgram } from '../processing/locale-twins/processProgram';

/**
 * Locale twins pass — for the `'locale-twins'` translation splitting
 * strategy, marks call sites: an unfilled placeholder per attributed entry in
 * client production builds (with its source text stripped), and a source
 * marker on entries the compiler cannot attribute. Reads the entries recorded
 * by the collection pass; does not use basePass.
 */
export function localeTwinsPass(state: TransformState): TraverseOptions {
  return {
    Program: processProgram(state),
  };
}
