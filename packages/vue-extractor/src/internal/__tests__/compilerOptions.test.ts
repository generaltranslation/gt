import { describe, expect, it } from 'vitest';
import * as testVueCompiler from '#vue-compiler-sfc';
import { parse as parseTemplate } from '@vue/compiler-dom';
import { hashSource } from 'generaltranslation/id';
import type { VueCompiler } from '../../types.js';
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

  it('recovers v-for scopes when compiler metadata is absent', async () => {
    const compiler = {
      ...testVueCompiler,
      parseTemplate: parseTemplateWithoutForMetadata,
    } as unknown as VueCompiler;
    const source = `<script setup>import { Fragment as F } from 'vue'; import { T } from 'gt-vue'; const choices = [String];</script><template><div v-for="F in choices"><T><component :is="F"><span>Opaque child</span></component><b>After</b></T></div></template>`;

    const output = await extractFromVueSource(
      source,
      '/fixtures/vue-3.3-v-for.vue',
      { compiler }
    );

    expect(output.errors).toHaveLength(1);
    expect(output.errors[0]).toContain(
      'Found a dynamic <component> inside a gt-vue <T> component'
    );
    expect(output.results).toEqual([]);
  });

  it('recovers v-for sources, defaults, and iterators without metadata', async () => {
    const compiler = {
      ...testVueCompiler,
      parseTemplate: parseTemplateWithoutForMetadata,
    } as unknown as VueCompiler;
    const source = `<script setup>import { useGT } from 'gt-vue'; const gt = useGT(); const rows = [];</script><template><div v-for="{ value = gt('VFor default') } in gt('VFor source')" :title="value" /><div v-for="(value, gt, index) in rows" :title="gt('Shadowed iterator')" /></template>`;

    const output = await extractFromVueSource(
      source,
      '/fixtures/vue-3.3-v-for-expressions.vue',
      { compiler }
    );

    expect(output.errors).toEqual([]);
    expect(
      output.results
        .filter((result) => result.dataFormat === 'STRING')
        .map((result) => result.source)
    ).toEqual(['VFor default', 'VFor source']);
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
    'rejects whitespace-free comment boundaries with %s whitespace',
    async (whitespace) => {
      const source = `
        <script setup>import { T } from 'gt-vue';</script>
        <template><T>Hello<!-- translator note -->world</T></template>
      `;

      const result = await extractFromVueSource(source, 'Component.vue', {
        compilerOptions: { whitespace },
      });

      expect(result.results).toEqual([]);
      expect(result.errors.join('\n')).toContain(
        'hash changes between development and production'
      );
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

/** Simulates Vue 3.3's compiler AST without installing a second Vue copy. */
function parseTemplateWithoutForMetadata(
  ...args: Parameters<typeof parseTemplate>
): ReturnType<typeof parseTemplate> {
  const ast = parseTemplate(...args);
  removeForParseResults(ast);
  return ast;
}

/** Removes only the normalized field that Vue added after the 3.3 line. */
function removeForParseResults(value: unknown, seen = new WeakSet<object>()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  if ('forParseResult' in value) delete value.forParseResult;
  for (const child of Object.values(value)) {
    removeForParseResults(child, seen);
  }
}
