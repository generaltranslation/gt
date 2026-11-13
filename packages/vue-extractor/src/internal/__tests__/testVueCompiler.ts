import * as testVueCompiler from '#vue-compiler-sfc';
import {
  compile as compileTemplate,
  parse as parseTemplate,
} from '@vue/compiler-dom';
import { expect } from 'vitest';
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

/**
 * Asserts that a TypeScript SFC fixture is valid for the installed Vue
 * compiler, so an extraction expectation never rests on an invalid component.
 */
export function assertVueCompiles(source: string, name: string): void {
  const filename = `/project/src/${name}.vue`;
  const parsed = testVueCompiler.parse(source, { filename });
  expect(parsed.errors, `${name}: SFC parse`).toEqual([]);
  const script = testVueCompiler.compileScript(parsed.descriptor, {
    babelParserPlugins: ['typescript'],
    id: `fixture-${name}`,
  });
  const template = parsed.descriptor.template;
  if (!template) return;
  const compiled = testVueCompiler.compileTemplate({
    compilerOptions: {
      bindingMetadata: script.bindings,
      expressionPlugins: ['typescript'],
    },
    filename,
    id: `fixture-${name}`,
    source: template.content,
  });
  expect(compiled.errors, `${name}: template compile`).toEqual([]);
}
