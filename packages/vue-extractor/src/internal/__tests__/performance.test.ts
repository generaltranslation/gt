import { describe, expect, it } from 'vitest';
import { extractFromVueSource } from '../extractFromVueSource.js';

describe('Vue extractor performance', () => {
  it('keeps long immutable alias chains bounded', async () => {
    const aliasCount = 200;
    const declarations = [
      "import { T } from 'gt-vue';",
      'const components0 = [T];',
    ];
    for (let index = 1; index <= aliasCount; index += 1) {
      declarations.push(`const components${index} = components${index - 1};`);
    }
    declarations.push('const selected = getIndex();');
    const source = `<script setup>${declarations.join('\n')}</script>
        <template>
          <component :is="components${aliasCount}[selected]">Hidden</component>
        </template>`;

    const start = performance.now();
    const output = await extractFromVueSource(source, '/tmp/AliasChain.vue', {
      projectRoot: '/tmp',
    });
    const duration = performance.now() - start;

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'Could not statically resolve possible gt-vue component alias'
    );
    expect(duration).toBeLessThan(5_000);
  }, 10_000);
});
