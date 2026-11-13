import * as Vue from 'vue';
import { compileTemplate } from 'vue/compiler-sfc';
import { expect } from 'vitest';

// Kept apart from testUtils so suites that never compile templates do not
// pay for loading the SFC compiler.
/** Compiles a template through the same SFC compiler used by Vue tooling. */
export function compileSfcTemplate(
  template: string,
  comments = true
): ReturnType<typeof Vue.compile> {
  const result = compileTemplate({
    compilerOptions: { comments, mode: 'function' },
    filename: 'TestFixture.vue',
    id: 'test-fixture',
    source: template,
  });
  expect(result.errors).toEqual([]);
  return new Function('Vue', result.code)(Vue) as ReturnType<
    typeof Vue.compile
  >;
}
