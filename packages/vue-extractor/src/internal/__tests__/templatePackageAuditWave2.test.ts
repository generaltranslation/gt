import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compileScript, compileTemplate, parse } from '@vue/compiler-sfc';
import type { JsxChildren } from '@generaltranslation/format/types';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveVueCompilerOptions } from '../../config.js';
import { extractFromVueSource } from '../../index.js';
import type { VueCompilerOptions, VueExtractionOutput } from '../../types.js';

type TemplateAuditCase = {
  name: string;
  script: string;
  sources: JsxChildren[];
  template: string;
};

const templateExpressionCases: TemplateAuditCase[] = [
  {
    name: 'namespace member call',
    script: `import * as GT from 'gt-vue';`,
    template: `{{ GT.msg('Namespace member') }}`,
    sources: ['Namespace member'],
  },
  {
    name: 'computed namespace member call',
    script: `import * as GT from 'gt-vue';`,
    template: `{{ GT['msg']('Computed namespace member') }}`,
    sources: ['Computed namespace member'],
  },
  {
    name: 'optional namespace member call',
    script: `import * as GT from 'gt-vue';`,
    template: `{{ GT?.msg('Optional namespace member') }}`,
    sources: ['Optional namespace member'],
  },
  {
    name: 'optional computed namespace member call',
    script: `import * as GT from 'gt-vue';`,
    template: `{{ GT?.['msg']('Optional computed member') }}`,
    sources: ['Optional computed member'],
  },
  {
    name: 'optional translator call',
    script: `import { useGT } from 'gt-vue'; const gt = useGT();`,
    template: `{{ gt?.('Optional translator') }}`,
    sources: ['Optional translator'],
  },
  {
    name: 'non-null translator call',
    script: `import { useGT } from 'gt-vue'; const gt = useGT();`,
    template: `{{ gt!('Non-null translator') }}`,
    sources: ['Non-null translator'],
  },
  {
    name: 'type-cast translator call',
    script: `import { useGT } from 'gt-vue'; const gt = useGT();`,
    template: `{{ (gt as typeof gt)('Type-cast translator') }}`,
    sources: ['Type-cast translator'],
  },
  {
    name: 'satisfies-wrapped translator call',
    script: `import { useGT } from 'gt-vue'; const gt = useGT();`,
    template: `{{ (gt satisfies typeof gt)('Satisfies translator') }}`,
    sources: ['Satisfies translator'],
  },
  {
    name: 'script-exposed source identifier',
    script: `import { useGT } from 'gt-vue'; const gt = useGT(); const title = 'Static title';`,
    template: `{{ gt(title) }}`,
    sources: ['Static title'],
  },
  {
    name: 'script-exposed concatenation',
    script: `import { useGT } from 'gt-vue'; const gt = useGT(); const first = 'Static '; const second = 'concat';`,
    template: `{{ gt(first + second) }}`,
    sources: ['Static concat'],
  },
  {
    name: 'script-exposed context identifier',
    script: `import { useGT } from 'gt-vue'; const gt = useGT(); const context = 'audit';`,
    template: `{{ gt('Context source', { $context: context }) }}`,
    sources: ['Context source'],
  },
  {
    name: 'useMessages source identifier',
    script: `import { useMessages } from 'gt-vue'; const m = useMessages(); const title = 'Messages title';`,
    template: `{{ m(title) }}`,
    sources: ['Messages title'],
  },
  {
    name: 'outer translator in a v-for default',
    script: `import { useGT } from 'gt-vue'; const gt = useGT(); const rows = [{}];`,
    template: `<div v-for="{ value = gt('VFor outer') } in rows" />`,
    sources: ['VFor outer'],
  },
  {
    name: 'same-pattern v-for shadow',
    script: `import { useGT } from 'gt-vue'; const gt = useGT(); const rows = [{}];`,
    template: `<div v-for="{ gt, value = gt('VFor shadow') } in rows" />`,
    sources: [],
  },
  {
    name: 'outer translator in a slot default',
    script: `import { useGT } from 'gt-vue'; const gt = useGT();`,
    template: `<Card v-slot="{ value = gt('Slot outer') }" />`,
    sources: ['Slot outer'],
  },
  {
    name: 'same-pattern slot shadow',
    script: `import { useGT } from 'gt-vue'; const gt = useGT();`,
    template: `<Card v-slot="{ gt, value = gt('Slot shadow') }" />`,
    sources: [],
  },
  {
    name: 'nested expression callback shadow',
    script: `import { useGT } from 'gt-vue'; const gt = useGT(); const rows = [gt];`,
    template: `{{ rows.map((gt) => gt('Callback shadow')) }}`,
    sources: [],
  },
  {
    name: 'namespace v-for shadow',
    script: `import * as GT from 'gt-vue'; const rows = [{}];`,
    template: `<div v-for="GT in rows" :title="GT.msg('Namespace shadow')" />`,
    sources: [],
  },
  {
    name: 'computed namespace dynamic component',
    script: `import * as GT from 'gt-vue';`,
    template: `<component :is="GT['T']">Computed dynamic T</component>`,
    sources: ['Computed dynamic T'],
  },
  {
    name: 'optional namespace dynamic component',
    script: `import * as GT from 'gt-vue';`,
    template: `<component :is="GT?.T">Optional dynamic T</component>`,
    sources: ['Optional dynamic T'],
  },
  {
    name: 'optional computed namespace dynamic component',
    script: `import * as GT from 'gt-vue';`,
    template: `<component :is="GT?.['T']">Optional computed T</component>`,
    sources: ['Optional computed T'],
  },
  {
    name: 'setup-only static-string dynamic component is not registered',
    script: `import { T } from 'gt-vue';`,
    template: `<component :is="'T'">String dynamic T</component>`,
    sources: [],
  },
  {
    name: 'setup-only static-attribute dynamic component is not registered',
    script: `import { T } from 'gt-vue';`,
    template: `<component is="T">Static dynamic T</component>`,
    sources: [],
  },
  {
    name: 'setup identifier dynamic component',
    script: `import { T } from 'gt-vue';`,
    template: `<component :is="T">Identifier dynamic T</component>`,
    sources: ['Identifier dynamic T'],
  },
  {
    name: 'type-wrapped dynamic component',
    script: `import { T } from 'gt-vue';`,
    template: `<component :is="T as typeof T">Wrapped dynamic T</component>`,
    sources: ['Wrapped dynamic T'],
  },
];

describe('template/package audit wave 2: expressions and scopes', () => {
  it.each(templateExpressionCases)('$name', async (testCase) => {
    const source = createSfc(testCase.script, testCase.template);
    assertVueCompiles(source, testCase.name);

    const output = await extractAuditSource(source, testCase.name);

    expect(output.errors).toEqual([]);
    expect(
      output.results.map(({ source: resultSource }) => resultSource)
    ).toEqual(testCase.sources);
  });

  it.each([
    ['static attribute', `is="LocalT"`],
    ['bound static string', `:is="'LocalT'"`],
  ])(
    'resolves an Options API alias through a %s selector',
    async (_name, selector) => {
      const source = `<script lang="ts">import { T } from 'gt-vue'; export default { components: { LocalT: T } };</script><template><component ${selector}>Registered dynamic T</component></template>`;
      assertVueCompiles(source, `options-${_name}`);

      const output = await extractAuditSource(source, `options-${_name}`);

      expect(output.errors).toEqual([]);
      expect(output.results.map((result) => result.source)).toEqual([
        'Registered dynamic T',
      ]);
    }
  );
});

type RichAuditCase = {
  name: string;
  script: string;
  source?: JsxChildren;
  template: string;
  context?: string;
};

const richCases: RichAuditCase[] = [
  {
    name: 'depth-first native and variable numbering',
    script: `import { Num, T, Var } from 'gt-vue';`,
    template: `<T><b>A</b><i><Var>x</Var><Num>1</Num></i></T>`,
    source: [
      { t: 'b', i: 1, c: 'A' },
      {
        t: 'i',
        i: 2,
        c: [
          { i: 3, k: '_gt_value_3', v: 'v' },
          { i: 4, k: '_gt_n_4', v: 'n' },
        ],
      },
    ],
  },
  {
    name: 'comments do not consume element ids',
    script: `import { T, Var } from 'gt-vue';`,
    template: `<T>A<!-- note --><Var>x</Var></T>`,
    source: ['A', { i: 1, k: '_gt_value_1', v: 'v' }],
  },
  {
    name: 'branch slots number independently from fallback and siblings',
    script: `import { Branch, T, Var } from 'gt-vue';`,
    template: `<T><Branch branch="formal"><template #formal><b><Var>x</Var></b></template><template #casual><i><Var>y</Var></i></template>Fallback <Var>z</Var></Branch><strong>After</strong></T>`,
    source: [
      {
        t: 'Branch',
        i: 1,
        d: {
          b: {
            formal: {
              t: 'b',
              i: 2,
              c: { i: 3, k: '_gt_value_3', v: 'v' },
            },
            casual: {
              t: 'i',
              i: 2,
              c: { i: 3, k: '_gt_value_3', v: 'v' },
            },
          },
          t: 'b',
        },
        c: ['Fallback ', { i: 2, k: '_gt_value_2', v: 'v' }],
      },
      { t: 'strong', i: 3, c: 'After' },
    ],
  },
  {
    name: 'plural slots number independently',
    script: `import { Plural, T, Var } from 'gt-vue';`,
    template: `<T><Plural :n="2"><template #one>One <Var>x</Var></template><template #other>Other <Var>y</Var></template>Fallback <Var>z</Var></Plural></T>`,
    source: {
      t: 'Plural',
      i: 1,
      d: {
        b: {
          one: ['One ', { i: 2, k: '_gt_value_2', v: 'v' }],
          other: ['Other ', { i: 2, k: '_gt_value_2', v: 'v' }],
        },
        t: 'p',
      },
      c: ['Fallback ', { i: 2, k: '_gt_value_2', v: 'v' }],
    },
  },
  {
    name: 'named branch slot overrides the same prop',
    script: `import { Branch, T } from 'gt-vue';`,
    template: `<T><Branch branch="formal" formal="Prop"><template #formal>Slot</template>Fallback</Branch></T>`,
    source: {
      t: 'Branch',
      i: 1,
      d: { b: { formal: 'Slot' }, t: 'b' },
      c: 'Fallback',
    },
  },
  {
    name: 'script-exposed rich interpolation',
    script: `import { T } from 'gt-vue'; const title = 'Static rich title';`,
    template: `<T>{{ title }}</T>`,
    source: 'Static rich title',
  },
  {
    name: 'script-exposed T context',
    script: `import { T } from 'gt-vue'; const context = 'rich-audit';`,
    template: `<T :context="context">Context body</T>`,
    source: 'Context body',
    context: 'rich-audit',
  },
  {
    name: 'script-exposed translatable HTML prop',
    script: `import { T } from 'gt-vue'; const placeholder = 'Static placeholder';`,
    template: `<T><input :placeholder="placeholder" /></T>`,
    source: { t: 'input', i: 1, d: { pl: 'Static placeholder' } },
  },
  {
    name: 'script-exposed primitive expression',
    script: `import { T } from 'gt-vue'; const first = 'A'; const second = 'B';`,
    template: `<T>{{ first + second }}</T>`,
    source: 'AB',
  },
  {
    name: 'comments and whitespace before explicit default are omitted',
    script: `import { T } from 'gt-vue';`,
    template: `<T><!-- note --> <template #default>Explicit</template></T>`,
    source: 'Explicit',
  },
];

describe('template/package audit wave 2: rich tree parity', () => {
  it.each(richCases)('$name', async (testCase) => {
    const source = createSfc(testCase.script, testCase.template);
    assertVueCompiles(source, testCase.name);

    const output = await extractAuditSource(source, testCase.name);

    expect(output.errors).toEqual([]);
    expect(output.results).toHaveLength(1);
    expect(output.results[0]).toMatchObject({
      dataFormat: 'JSX',
      source: testCase.source,
    });
    expect(output.results[0]?.metadata.context).toBe(testCase.context);
  });
});

const richDiagnosticCases = [
  {
    name: 'runtime interpolation',
    script: `import { T } from 'gt-vue'; const value = String(Date.now());`,
    template: `<T>{{ value }}</T>`,
    diagnostic: 'dynamic template content',
  },
  {
    name: 'v-for shadow masks a static context',
    script: `import { T } from 'gt-vue'; const context = 'static'; const rows = ['runtime'];`,
    template: `<T v-for="context in rows" :context="context">Body</T>`,
    diagnostic: 'dynamic context',
  },
  {
    name: 'nested T',
    script: `import { T } from 'gt-vue';`,
    template: `<T>Outer <T>Inner</T></T>`,
    diagnostic: 'nested gt-vue <T>',
  },
  {
    name: 'named T slot',
    script: `import { T } from 'gt-vue';`,
    template: `<T><template #other>Named</template></T>`,
    diagnostic: 'named slot on a gt-vue <T>',
  },
  {
    name: 'source-shaping v-if',
    script: `import { T } from 'gt-vue'; const visible = true;`,
    template: `<T><b v-if="visible">Conditional</b></T>`,
    diagnostic: 'source-shaping directive v-if',
  },
  {
    name: 'dynamic content prop',
    script: `import { T } from 'gt-vue'; const label = String(Date.now());`,
    template: `<T><input :placeholder="label" /></T>`,
    diagnostic: 'dynamic translatable prop "placeholder"',
  },
  {
    name: 'Var value prop',
    script: `import { T, Var } from 'gt-vue'; const value = 'runtime';`,
    template: `<T><Var :value="value">Child</Var></T>`,
    diagnostic: 'unsupported value prop',
  },
  {
    name: 'scoped branch slot',
    script: `import { Branch, T } from 'gt-vue';`,
    template: `<T><Branch branch="formal"><template #formal="{ value }">{{ value }}</template></Branch></T>`,
    diagnostic: 'scoped slot',
  },
  {
    name: 'dynamic branch slot name',
    script: `import { Branch, T } from 'gt-vue'; const slotName = 'formal';`,
    template: `<T><Branch branch="formal"><template #[slotName]>Dynamic</template></Branch></T>`,
    diagnostic: 'dynamic slot name',
  },
  {
    name: 'duplicate T context',
    script: `import { T } from 'gt-vue';`,
    template: `<T context="first" $context="second">Body</T>`,
    diagnostic: 'duplicate context props',
  },
] as const;

describe('template/package audit wave 2: rich diagnostics', () => {
  it.each(richDiagnosticCases)('$name', async (testCase) => {
    const source = createSfc(testCase.script, testCase.template);
    const output = await extractAuditSource(source, testCase.name);

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(testCase.diagnostic);
  });
});

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { force: true, recursive: true });
  }
});

type ConfigAuditCase = {
  name: string;
  file: string;
  source: string;
  options?: VueCompilerOptions;
  expected: VueCompilerOptions;
  diagnostic?: string;
};

const configCases: ConfigAuditCase[] = [
  {
    name: 'Vite immutable plugin alias',
    file: 'vite.config.ts',
    source: `import vue from '@vitejs/plugin-vue'; const plugin = vue; export default { plugins: [plugin({ template: { compilerOptions: { whitespace: 'preserve' } } })] };`,
    expected: { whitespace: 'preserve' },
  },
  {
    name: 'Vite deep plugin alias',
    file: 'vite.config.ts',
    source: `import vue from '@vitejs/plugin-vue'; const first = vue; const second = first; export default { plugins: [second({ template: { compilerOptions: { delimiters: ['[[', ']]'] } } })] };`,
    expected: { delimiters: ['[[', ']]'] },
  },
  {
    name: 'Vite CJS destructured default',
    file: 'vite.config.cjs',
    source: `const { default: vue } = require('@vitejs/plugin-vue'); module.exports = { plugins: [vue({ template: { compilerOptions: { whitespace: 'preserve' } } })] };`,
    expected: { whitespace: 'preserve' },
  },
  {
    name: 'Vite TS import-equals namespace',
    file: 'vite.config.cts',
    source: `import pluginVue = require('@vitejs/plugin-vue'); export default { plugins: [pluginVue.default({ template: { compilerOptions: { whitespace: 'preserve' } } })] };`,
    expected: { whitespace: 'preserve' },
  },
  {
    name: 'Vite optional plugin call',
    file: 'vite.config.ts',
    source: `import vue from '@vitejs/plugin-vue'; export default { plugins: [vue?.({ template: { compilerOptions: { whitespace: 'preserve' } } })] };`,
    expected: { whitespace: 'preserve' },
  },
  {
    name: 'Vite namespace default alias',
    file: 'vite.config.mjs',
    source: `import * as pluginVue from '@vitejs/plugin-vue'; const vue = pluginVue.default; export default { plugins: [vue({ template: { compilerOptions: { whitespace: 'preserve' } } })] };`,
    expected: { whitespace: 'preserve' },
  },
  {
    name: 'Vite computed namespace default',
    file: 'vite.config.mjs',
    source: `import * as pluginVue from '@vitejs/plugin-vue'; export default { plugins: [pluginVue['default']({ template: { compilerOptions: { whitespace: 'preserve' } } })] };`,
    expected: { whitespace: 'preserve' },
  },
  {
    name: 'Vite optional namespace default',
    file: 'vite.config.mjs',
    source: `import * as pluginVue from '@vitejs/plugin-vue'; export default { plugins: [pluginVue?.default({ template: { compilerOptions: { whitespace: 'preserve' } } })] };`,
    expected: { whitespace: 'preserve' },
  },
  {
    name: 'Vite optional computed namespace default and call',
    file: 'vite.config.mjs',
    source: `import * as pluginVue from '@vitejs/plugin-vue'; export default { plugins: [pluginVue?.['default']?.({ template: { compilerOptions: { delimiters: ['[[', ']]'] } } })] };`,
    expected: { delimiters: ['[[', ']]'] },
  },
  {
    name: 'Vite computed CJS namespace default',
    file: 'vite.config.cjs',
    source: `const vue = require('@vitejs/plugin-vue')['default']; module.exports = { plugins: [vue({ template: { compilerOptions: { whitespace: 'preserve' } } })] };`,
    expected: { whitespace: 'preserve' },
  },
  {
    name: 'Vite computed TS import-equals default',
    file: 'vite.config.cts',
    source: `import pluginVue = require('@vitejs/plugin-vue'); export default { plugins: [pluginVue['default']({ template: { compilerOptions: { whitespace: 'preserve' } } })] };`,
    expected: { whitespace: 'preserve' },
  },
  {
    name: 'Vite mutated plugin alias fails closed',
    file: 'vite.config.ts',
    source: `import vue from '@vitejs/plugin-vue'; const other = vue; let plugin = vue; plugin = other; export default { plugins: [plugin({ template: { compilerOptions: { whitespace: 'preserve' } } })] };`,
    expected: {},
    diagnostic: 'Could not statically resolve Vue compiler options',
  },
  {
    name: 'unrelated Vite function is ignored',
    file: 'vite.config.ts',
    source: `const plugin = (value) => value; export default { plugins: [plugin({ template: { compilerOptions: { whitespace: 'preserve' } } })] };`,
    expected: {},
  },
  {
    name: 'Nuxt imported helper alias',
    file: 'nuxt.config.ts',
    source: `import { defineNuxtConfig as define } from 'nuxt/config'; export default define({ vue: { compilerOptions: { whitespace: 'preserve' } } });`,
    expected: { whitespace: 'preserve' },
  },
  {
    name: 'Nuxt immutable helper alias chain',
    file: 'nuxt.config.ts',
    source: `import { defineNuxtConfig } from 'nuxt/config'; const first = defineNuxtConfig; const define = first; export default define({ vue: { compilerOptions: { delimiters: ['[[', ']]'] } } });`,
    expected: { delimiters: ['[[', ']]'] },
  },
  {
    name: 'Nuxt module.exports object',
    file: 'nuxt.config.cjs',
    source: `module.exports = { vue: { compilerOptions: { whitespace: 'preserve' } } };`,
    expected: { whitespace: 'preserve' },
  },
  {
    name: 'Nuxt exports.default object',
    file: 'nuxt.config.cjs',
    source: `exports.default = { vue: { compilerOptions: { delimiters: ['[[', ']]'] } } };`,
    expected: { delimiters: ['[[', ']]'] },
  },
  {
    name: 'Nuxt mutated helper alias fails closed',
    file: 'nuxt.config.ts',
    source: `import { defineNuxtConfig } from 'nuxt/config'; let define = defineNuxtConfig; define = (value) => value; export default define({ vue: { compilerOptions: { whitespace: 'preserve' } } });`,
    expected: {},
    diagnostic: 'Could not statically resolve Vue compiler options',
  },
  {
    name: 'matching explicit and Vite options remain valid',
    file: 'vite.config.ts',
    source: `import vue from '@vitejs/plugin-vue'; export default { plugins: [vue({ template: { compilerOptions: { whitespace: 'preserve' } } })] };`,
    options: { whitespace: 'preserve' },
    expected: { whitespace: 'preserve' },
  },
];

describe('template/package audit wave 2: compiler config boundary', () => {
  it.each(configCases)('$name', (testCase) => {
    const root = createConfigProject(testCase.file, testCase.source);

    const result = resolveVueCompilerOptions(root, testCase.options);

    expect(result.compilerOptions).toEqual(testCase.expected);
    if (testCase.diagnostic) {
      expect(result.errors.join('\n')).toContain(testCase.diagnostic);
    } else {
      expect(result.errors).toEqual([]);
    }
  });
});

describe('template/package audit wave 2: metadata and public boundary', () => {
  it('captures exact source context for script, rich, and template calls', async () => {
    const source = `<script setup>\nimport { T, useGT } from 'gt-vue';\nconst gt = useGT();\ngt('Script source');\n</script>\n<template>\n  <T>Template source</T>\n  {{ gt('Template call') }}\n</template>`;
    const output = await extractFromVueSource(
      source,
      '/project/src/Context.vue',
      {
        includeSourceCodeContext: true,
        projectRoot: '/project',
        surroundingLineCount: 1,
      }
    );

    expect(output.errors).toEqual([]);
    expect(output.results.map(({ metadata }) => metadata.sourceCode)).toEqual([
      {
        'src/Context.vue': [
          {
            before: 'const gt = useGT();',
            target: `gt('Script source');`,
            after: '</script>',
          },
        ],
      },
      {
        'src/Context.vue': [
          {
            before: '<template>',
            target: '  <T>Template source</T>',
            after: `  {{ gt('Template call') }}`,
          },
        ],
      },
      {
        'src/Context.vue': [
          {
            before: '  <T>Template source</T>',
            target: `  {{ gt('Template call') }}`,
            after: '</template>',
          },
        ],
      },
    ]);
  });

  it('supports zero surrounding source lines', async () => {
    const source = createSfc(`import { T } from 'gt-vue';`, `<T>Zero</T>`);
    const output = await extractFromVueSource(source, '/project/Zero.vue', {
      includeSourceCodeContext: true,
      projectRoot: '/project',
      surroundingLineCount: 0,
    });
    const context = output.results[0]?.metadata.sourceCode?.['Zero.vue']?.[0];

    expect(context).toMatchObject({ before: '', after: '' });
  });

  it('omits source context unless explicitly enabled', async () => {
    const output = await extractAuditSource(
      createSfc(`import { T } from 'gt-vue';`, `<T>No context</T>`),
      'no-context'
    );

    expect(output.results[0]?.metadata.sourceCode).toBeUndefined();
    expect(output.results[0]?.metadata.filePaths).toEqual([
      'src/no-context.vue',
    ]);
  });

  it('honors custom interpolation delimiters through the public API', async () => {
    const source = createSfc(
      `import { T, Var } from 'gt-vue'; const name = 'Ada';`,
      `<T>Hello <Var>[[ name ]]</Var></T>`
    );
    const output = await extractAuditSource(source, 'delimiters', {
      delimiters: ['[[', ']]'],
    });

    expect(output.errors).toEqual([]);
    expect(output.results[0]?.source).toEqual([
      'Hello ',
      { i: 1, k: '_gt_value_1', v: 'v' },
    ]);
  });

  it('honors preserve versus condense whitespace through the public API', async () => {
    const source = createSfc(
      `import { T } from 'gt-vue';`,
      `<T>First\n    second</T>`
    );
    const condensed = await extractAuditSource(source, 'condense', {
      whitespace: 'condense',
    });
    const preserved = await extractAuditSource(source, 'preserve', {
      whitespace: 'preserve',
    });

    expect(condensed.errors).toEqual([]);
    expect(preserved.errors).toEqual([]);
    expect(condensed.results[0]?.source).not.toEqual(
      preserved.results[0]?.source
    );
  });

  it('exports both public runtime functions from source entry points', () => {
    expect(extractFromVueSource).toBeTypeOf('function');
    expect(resolveVueCompilerOptions).toBeTypeOf('function');
  });

  it('declares root, config, and types package exports', () => {
    const packageRoot = path.resolve(__dirname, '../../..');
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8')
    ) as { exports: Record<string, unknown> };

    expect(Object.keys(packageJson.exports)).toEqual([
      '.',
      './config',
      './types',
    ]);
  });

  it('contains no source import from the CLI package', () => {
    const packageRoot = path.resolve(__dirname, '../../..');
    const sourceFiles = listFiles(path.join(packageRoot, 'src')).filter(
      (file) => /\.[cm]?[jt]sx?$/.test(file)
    );

    for (const file of sourceFiles) {
      const source = fs.readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(
        /(?:from\s+|require\s*\()['"][^'"]*(?:packages\/cli|\/cli\/src)/
      );
    }
  });
});

function createSfc(script: string, template: string): string {
  return `<script setup lang="ts">${script}</script><template>${template}</template>`;
}

async function extractAuditSource(
  source: string,
  name: string,
  compilerOptions?: VueCompilerOptions
): Promise<VueExtractionOutput> {
  return extractFromVueSource(source, `/project/src/${name}.vue`, {
    compilerOptions,
    projectRoot: '/project',
  });
}

function assertVueCompiles(source: string, name: string): void {
  const filename = `/project/src/${name}.vue`;
  const parsed = parse(source, { filename });
  expect(parsed.errors, name).toEqual([]);
  const script = compileScript(parsed.descriptor, {
    babelParserPlugins: ['typescript'],
    id: `audit-${name}`,
  });
  const template = parsed.descriptor.template;
  if (!template) return;
  const compiled = compileTemplate({
    compilerOptions: {
      bindingMetadata: script.bindings,
      expressionPlugins: ['typescript'],
    },
    filename,
    id: `audit-${name}`,
    source: template.content,
  });
  expect(compiled.errors, name).toEqual([]);
}

function createConfigProject(filename: string, source: string): string {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'gt-vue-wave-two-config-')
  );
  temporaryDirectories.push(directory);
  fs.writeFileSync(path.join(directory, filename), source);
  return directory;
}

function listFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(file) : [file];
  });
}
