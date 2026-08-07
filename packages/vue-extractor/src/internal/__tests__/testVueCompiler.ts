import * as testVueCompiler from '#vue-compiler-sfc';
import { parse as parseTemplate } from '@vue/compiler-dom';
import type { VueExtractionOptions } from '../../types.js';
import { extractFromVueSource as extract } from '../extractFromVueSource.js';

/** Extracts virtual fixtures with the exact compiler installed for this test. */
export function extractFromVueSource(
  sourceCode: string,
  filePath: string,
  options: VueExtractionOptions = {}
) {
  return extract(sourceCode, filePath, {
    compiler: { ...testVueCompiler, parseTemplate },
    ...options,
  });
}
