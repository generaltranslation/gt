import * as testVueCompiler from '#vue-compiler-sfc';
import {
  compile as compileTemplate,
  parse as parseTemplate,
} from '@vue/compiler-dom';
import type { VueExtractionOptions } from '../../types.js';
import { extractFromVueSource as extract } from '../extractFromVueSource.js';

/** Exact consumer Vue compiler version selected by the compatibility matrix. */
export const testVueCompilerVersion = testVueCompiler.version;

/** Extracts virtual fixtures with the exact compiler installed for this test. */
export function extractFromVueSource(
  sourceCode: string,
  filePath: string,
  options: VueExtractionOptions = {}
) {
  return extract(sourceCode, filePath, {
    compiler: {
      ...testVueCompiler,
      parseTemplate,
      templateCompiler: { compile: compileTemplate, parse: parseTemplate },
    },
    ...options,
  });
}
