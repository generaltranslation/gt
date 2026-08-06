import { describe, expect, it } from 'vitest';
import { collectAnalyzerStats } from './analyzerPerformance.js';
import { extractFromVueSource } from './testVueCompiler.js';

const ANALYZER_PERFORMANCE_TEST_TIMEOUT_MS = 15_000;

function createScalarAliasScript(aliasCount: number): string {
  const declarations = ["import { T } from 'gt-vue';", 'const Component0 = T;'];
  for (let index = 1; index <= aliasCount; index += 1) {
    declarations.push(`const Component${index} = Component${index - 1};`);
  }
  declarations.push(`const registry = [Component${aliasCount}];`);
  declarations.push('const key = getIndex();');
  return declarations.join('\n');
}
describe('direct component alias performance', () => {
  it(
    'keeps analyzer visits linear for a long scalar alias chain',
    () => {
      const smaller = collectAnalyzerStats(createScalarAliasScript(500));
      const larger = collectAnalyzerStats(createScalarAliasScript(1_000));

      for (const key of Object.keys(larger) as Array<keyof typeof larger>) {
        expect(larger[key], key).toBeLessThanOrEqual(smaller[key] * 2 + 10);
      }

      expect(
        Object.values(larger).reduce((total, visits) => total + visits, 0)
      ).toBeLessThanOrEqual(10_000);
    },
    ANALYZER_PERFORMANCE_TEST_TIMEOUT_MS
  );

  it(
    'fails closed for a thousand aliases without a timing assertion',
    async () => {
      const source = `<script setup>${createScalarAliasScript(1_000)}</script>
        <template>
          <component :is="registry[key]">Hidden</component>
        </template>`;

      const output = await extractFromVueSource(
        source,
        '/fixtures/ComponentAliasPerformance.vue',
        { projectRoot: '/fixtures' }
      );

      expect(output.results).toEqual([]);
      expect(output.errors.join('\n')).toContain(
        'Could not statically resolve possible gt-vue component alias'
      );
    },
    ANALYZER_PERFORMANCE_TEST_TIMEOUT_MS
  );

  it.each([
    {
      name: 'mutable assignment',
      source: `import { msg } from 'gt-vue'; let candidate = {}; candidate = msg; const alias = candidate; alias('Mutable translator');`,
      translation: 'Mutable translator',
    },
    {
      name: 'local callback return',
      source: `import { msg } from 'gt-vue'; const factory = () => msg; const alias = factory(); alias('Callback translator');`,
      translation: 'Callback translator',
    },
  ])('does not hide translator provenance through $name', async (testCase) => {
    const output = await extractFromVueSource(
      testCase.source,
      `/fixtures/${testCase.name}.ts`,
      { projectRoot: '/fixtures' }
    );

    expect(output.errors).toEqual([]);
    expect(output.results.map(({ source }) => source)).toEqual([
      testCase.translation,
    ]);
  });
});
