import { describe, expect, it } from 'vitest';
import * as testVueCompiler from '#vue-compiler-sfc';
import type { RootNode } from '@vue/compiler-dom';
import { parse as parseTemplate } from '@vue/compiler-dom';
import { hashSource } from 'generaltranslation/id';
import type { VueCompiler } from '../../types.js';
import { shiftCompilerAstLocations } from '../extractFromVueSource.js';
import { extractFromVueSource } from './testVueCompiler.js';

describe('Vue compiler option parity', () => {
  it('fails closed for custom delimiters on an explicit legacy compiler', async () => {
    const legacyCompiler = {
      ...testVueCompiler,
      parse(source: string, options: Record<string, unknown> = {}) {
        const { templateParseOptions: _ignored, ...legacyOptions } = options;
        return testVueCompiler.parse(source, legacyOptions);
      },
      parseTemplate,
      version: '3.3.13',
    } as unknown as VueCompiler;
    const source = `<script setup>import { T } from 'gt-vue';</script><template><T>[[ '</template>' ]] after</T></template>`;

    const output = await extractFromVueSource(
      source,
      '/fixtures/explicit-legacy-delimiters.vue',
      {
        compiler: legacyCompiler,
        compilerOptions: { delimiters: ['[[', ']]'] },
      }
    );

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'Could not safely apply custom Vue template delimiters'
    );
  });

  it('rebases shared compiler positions only once across nested locations', () => {
    const sharedStart = { column: 2, line: 1, offset: 1 };
    const sharedEnd = { column: 4, line: 2, offset: 8 };
    const ast = {
      children: [
        {
          loc: { end: sharedEnd, source: 'outer', start: sharedStart },
          nested: {
            loc: { end: sharedEnd, source: 'inner', start: sharedStart },
          },
        },
      ],
      loc: {
        end: { column: 1, line: 3, offset: 9 },
        source: 'root',
        start: { column: 1, line: 1, offset: 0 },
      },
    } as unknown as RootNode;

    shiftCompilerAstLocations(ast, { column: 7, line: 5, offset: 100 });

    expect(sharedStart).toEqual({ column: 8, line: 5, offset: 101 });
    expect(sharedEnd).toEqual({ column: 4, line: 6, offset: 108 });
  });

  it('uses custom delimiters while locating the SFC template boundary', async () => {
    const source = `<script setup>import { T } from 'gt-vue';</script><template><T>[[ '</template>' ]] after</T></template>`;
    const custom = await extractFromVueSource(
      source,
      '/fixtures/structural-delimiters.vue',
      {
        compilerOptions: { delimiters: ['[[', ']]'] },
        projectRoot: '/fixtures',
      }
    );

    expect(custom.errors).toEqual([]);
    expect(custom.results.map(({ source }) => source)).toEqual([
      '</template> after',
    ]);
  });

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
