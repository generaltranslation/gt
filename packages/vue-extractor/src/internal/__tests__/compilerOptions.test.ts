import { describe, expect, it } from 'vitest';
import { hashSource } from 'generaltranslation/id';
import { extractFromVueSource } from '../../index.js';

describe('Vue compiler option parity', () => {
  it('changes extracted rich content when Vue preserves whitespace', async () => {
    const source = `
      <script setup>
      import { T } from 'gt-vue';
      </script>
      <template>
        <T>First
          second</T>
      </template>
    `;

    const condensed = await extractFromVueSource(source, 'Component.vue', {
      compilerOptions: { whitespace: 'condense' },
    });
    const preserved = await extractFromVueSource(source, 'Component.vue', {
      compilerOptions: { whitespace: 'preserve' },
    });

    expect(condensed.errors).toEqual([]);
    expect(preserved.errors).toEqual([]);
    expect(condensed.results).toHaveLength(1);
    expect(preserved.results).toHaveLength(1);
    expect(preserved.results[0].source).not.toEqual(
      condensed.results[0].source
    );
    expect(hashFor(preserved.results[0])).not.toBe(
      hashFor(condensed.results[0])
    );
  });

  it('uses the application interpolation delimiters', async () => {
    const source = `
      <script setup>
      import { T, Var } from 'gt-vue';
      const name = 'Ada';
      </script>
      <template><T>Hello <Var>[[ name ]]</Var></T></template>
    `;

    const result = await extractFromVueSource(source, 'Component.vue', {
      compilerOptions: { delimiters: ['[[', ']]'] },
    });

    expect(result.errors).toEqual([]);
    expect(result.results).toEqual([
      expect.objectContaining({
        dataFormat: 'JSX',
        source: ['Hello ', { i: 1, k: '_gt_value_1', v: 'v' }],
      }),
    ]);
  });

  it.each(['condense', 'preserve'] as const)(
    'rejects comment-driven %s whitespace that changes in production',
    async (whitespace) => {
      const source = `
        <script setup>import { T } from 'gt-vue';</script>
        <template>
          <T><i>First</i> <!-- separator --> <b>Second</b></T>
          <T><p><i>Nested</i> <!-- separator --> <b>content</b></p></T>
        </template>
      `;

      const result = await extractFromVueSource(source, 'Component.vue', {
        compilerOptions: { whitespace },
      });

      expect(result.results).toEqual([]);
      expect(result.errors.join('\n')).toContain(
        'comment adjacent to translatable whitespace'
      );
    }
  );

  it.each(['condense', 'preserve'] as const)(
    'allows comments that do not change %s translation content',
    async (whitespace) => {
      const source = `
        <script setup>import { T } from 'gt-vue';</script>
        <template><T>Hello<!-- translator note -->world</T></template>
      `;

      const result = await extractFromVueSource(source, 'Component.vue', {
        compilerOptions: { whitespace },
      });

      expect(result.errors).toEqual([]);
      expect(result.results.map(({ source }) => source)).toEqual([
        'Helloworld',
      ]);
    }
  );
});

function hashFor(
  result: Awaited<ReturnType<typeof extractFromVueSource>>['results'][number]
) {
  return hashSource({
    dataFormat: result.dataFormat,
    source: result.source,
    ...(result.metadata.context && { context: result.metadata.context }),
  });
}
