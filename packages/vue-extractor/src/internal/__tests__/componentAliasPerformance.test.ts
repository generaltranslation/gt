import { describe, expect, it } from 'vitest';
import { extractFromVueSource } from '../../index.js';

describe('direct component alias performance', () => {
  it('keeps a long scalar alias chain bounded', async () => {
    const aliasCount = 500;
    const declarations = [
      "import { T } from 'gt-vue';",
      'const Component0 = T;',
    ];
    for (let index = 1; index <= aliasCount; index += 1) {
      declarations.push(`const Component${index} = Component${index - 1};`);
    }
    declarations.push(`const registry = [Component${aliasCount}];`);
    declarations.push('const key = getIndex();');
    const source = `<script setup>${declarations.join('\n')}</script>
        <template>
          <component :is="registry[key]">Hidden</component>
        </template>`;

    const start = performance.now();
    const output = await extractFromVueSource(
      source,
      '/fixtures/ComponentAliasPerformance.vue',
      { projectRoot: '/fixtures' }
    );
    const duration = performance.now() - start;

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'Could not statically resolve possible gt-vue component alias'
    );
    expect(duration).toBeLessThan(5_000);
  }, 10_000);
});
