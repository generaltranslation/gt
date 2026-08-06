import { describe, expect, it } from 'vitest';
import { collectAnalyzerStats } from './analyzerPerformance.js';
import { extractFromVueSource } from './testVueCompiler.js';

const ANALYZER_PERFORMANCE_TEST_TIMEOUT_MS = 15_000;

function createContainerAliasScript(aliasCount: number): string {
  const declarations = [
    "import { T } from 'gt-vue';",
    'const components0 = [T];',
  ];
  for (let index = 1; index <= aliasCount; index += 1) {
    declarations.push(`const components${index} = components${index - 1};`);
  }
  declarations.push('const selected = getIndex();');
  return declarations.join('\n');
}
describe('Vue extractor performance', () => {
  it(
    'keeps analyzer visits linear for immutable container aliases',
    () => {
      const smaller = collectAnalyzerStats(createContainerAliasScript(500));
      const larger = collectAnalyzerStats(createContainerAliasScript(1_000));

      for (const key of Object.keys(larger) as Array<keyof typeof larger>) {
        expect(larger[key], key).toBeLessThanOrEqual(smaller[key] * 2 + 10);
      }

      expect(
        Object.values(larger).reduce((total, visits) => total + visits, 0)
      ).toBeLessThanOrEqual(4_000);
    },
    ANALYZER_PERFORMANCE_TEST_TIMEOUT_MS
  );

  it(
    'fails closed for a thousand container aliases',
    async () => {
      const source = `<script setup>${createContainerAliasScript(1_000)}</script>
        <template>
          <component :is="components1000[selected]">Hidden</component>
        </template>`;

      const output = await extractFromVueSource(source, '/tmp/AliasChain.vue', {
        projectRoot: '/tmp',
      });

      expect(output.results).toEqual([]);
      expect(output.errors.join('\n')).toContain(
        'Could not statically resolve possible gt-vue component alias'
      );
    },
    ANALYZER_PERFORMANCE_TEST_TIMEOUT_MS
  );
});
