import { compileScript, compileTemplate, parse } from '@vue/compiler-sfc';
import { describe, expect, it } from 'vitest';
import { extractFromVueSource } from './testVueCompiler.js';

type AuditCase = {
  extension?: string;
  name: string;
  source: string;
  sources: string[];
  contexts?: Record<string, string>;
};

const positiveCases: AuditCase[] = [
  {
    name: 'mixed type and aliased value imports',
    source: setup(
      `import { type GTFunction, msg as defineMessage } from 'gt-vue';
       void (null as GTFunction | null);
       defineMessage('Mixed import');`
    ),
    sources: ['Mixed import'],
  },
  {
    name: 'string-named ESM import',
    source: setup(
      `import { 'msg' as defineMessage } from 'gt-vue';
       defineMessage('String named import');`
    ),
    sources: ['String named import'],
  },
  {
    name: 'nested translator destructuring',
    source: setup(
      `import { useGT } from 'gt-vue';
       const { nested: { translate } } = { nested: { translate: useGT() } };
       translate('Nested translator');`
    ),
    sources: ['Nested translator'],
  },
  {
    name: 'object destructuring default translator',
    source: setup(
      `import { useGT } from 'gt-vue';
       const { translate = useGT() } = {};
       translate('Object default translator');`
    ),
    sources: ['Object default translator'],
  },
  {
    name: 'array destructuring default translator',
    source: setup(
      `import { useGT } from 'gt-vue';
       const [translate = useGT()] = [];
       translate('Array default translator');`
    ),
    sources: ['Array default translator'],
  },
  {
    name: 'object translator default for explicit undefined',
    source: setup(
      `import { useGT } from 'gt-vue';
       const { translate = useGT() } = { translate: undefined };
       translate('Object explicit undefined translator');`
    ),
    sources: ['Object explicit undefined translator'],
  },
  {
    name: 'array translator default for void value',
    source: setup(
      `import { useGT } from 'gt-vue';
       const [translate = useGT()] = [void 0];
       translate('Array void translator');`
    ),
    sources: ['Array void translator'],
  },
  {
    name: 'object assignment default translator',
    source: setup(
      `import { useGT } from 'gt-vue';
       let translate;
       ({ translate = useGT() } = {});
       translate('Object assignment default');`
    ),
    sources: ['Object assignment default'],
  },
  {
    name: 'array assignment default translator',
    source: setup(
      `import { useGT } from 'gt-vue';
       let translate;
       [translate = useGT()] = [];
       translate('Array assignment default');`
    ),
    sources: ['Array assignment default'],
  },
  {
    name: 'nested destructured static source',
    source: setup(
      `import { msg } from 'gt-vue';
       const { nested: { title } } = { nested: { title: 'Nested static source' } };
       msg(title);`
    ),
    sources: ['Nested static source'],
  },
  {
    name: 'object destructuring default source',
    source: setup(
      `import { msg } from 'gt-vue';
       const { title = 'Object default source' } = {};
       msg(title);`
    ),
    sources: ['Object default source'],
  },
  {
    name: 'array destructuring default source',
    source: setup(
      `import { msg } from 'gt-vue';
       const [title = 'Array default source'] = [];
       msg(title);`
    ),
    sources: ['Array default source'],
  },
  {
    name: 'object source default for explicit undefined',
    source: setup(
      `import { msg } from 'gt-vue';
       const { title = 'Object explicit undefined source' } = { title: undefined };
       msg(title);`
    ),
    sources: ['Object explicit undefined source'],
  },
  {
    name: 'array source default for void value',
    source: setup(
      `import { msg } from 'gt-vue';
       const [title = 'Array void source'] = [void 0];
       msg(title);`
    ),
    sources: ['Array void source'],
  },
  {
    name: 'static computed context key',
    source: setup(
      `import { useGT } from 'gt-vue';
       const gt = useGT();
       gt('Computed context key', { ['$context']: 'computed' });`
    ),
    sources: ['Computed context key'],
    contexts: { 'Computed context key': 'computed' },
  },
  {
    name: 'shorthand static context value',
    source: setup(
      `import { useGT } from 'gt-vue';
       const gt = useGT();
       const $context = 'shorthand';
       gt('Shorthand context', { $context });`
    ),
    sources: ['Shorthand context'],
    contexts: { 'Shorthand context': 'shorthand' },
  },
  {
    name: 'static msg array identifiers',
    source: setup(
      `import { msg } from 'gt-vue';
       const first = 'Array identifier one';
       const second = 'Array identifier two';
       msg([first, second], { $context: 'array' });`
    ),
    sources: ['Array identifier one', 'Array identifier two'],
    contexts: {
      'Array identifier one': 'array',
      'Array identifier two': 'array',
    },
  },
  {
    name: 'optional namespace member call',
    source: setup(
      `import * as GT from 'gt-vue';
       GT?.msg?.('Optional namespace member');`
    ),
    sources: ['Optional namespace member'],
  },
  {
    name: 'statically computed namespace member call in a template',
    source: setup(
      `import * as GT from 'gt-vue';
       const key = 'msg';`,
      `{{ GT[key]('Computed namespace member') }} {{ GT['m' + 'sg']('Concatenated namespace member') }}`
    ),
    sources: ['Computed namespace member', 'Concatenated namespace member'],
  },
  {
    extension: '.cjs',
    name: 'direct CommonJS member hook chain',
    source: `require('gt-vue').useGT()('Direct require chain');`,
    sources: ['Direct require chain'],
  },
  {
    extension: '.cjs',
    name: 'computed CommonJS destructuring import',
    source: `const { ['msg']: defineMessage } = require('gt-vue');
             defineMessage('Computed require import');`,
    sources: ['Computed require import'],
  },
  {
    extension: '.cts',
    name: 'TypeScript import-equals member alias',
    source: `import GT = require('gt-vue');
             const defineMessage = GT.msg;
             defineMessage('Import equals alias');`,
    sources: ['Import equals alias'],
  },
  {
    name: 'TypeScript parameter decorator',
    source: setup(
      `import { msg } from 'gt-vue';
       function decorate(..._args: unknown[]) {}
       class Example { method(@decorate value: string) { return value; } }
       msg('Parameter decorator');`
    ),
    sources: ['Parameter decorator'],
  },
  {
    name: 'reverse cross-block import visibility',
    source: `<script>
      const gt = useGT();
      gt('Reverse cross-block import');
      export default {};
    </script>
    <script setup>import { useGT } from 'gt-vue';</script>
    <template><p>Valid</p></template>`,
    sources: ['Reverse cross-block import'],
  },
  {
    name: 'normal-script alias used by script setup',
    source: `<script>
      import { useGT } from 'gt-vue';
      const createTranslator = useGT;
      export { createTranslator };
    </script>
    <script setup>
      const gt = createTranslator();
      gt('Cross-block hook alias');
    </script>`,
    sources: ['Cross-block hook alias'],
  },
  {
    name: 'normal-script static source used by script setup',
    source: `<script>
      import { msg } from 'gt-vue';
      const title = 'Cross-block static source';
      export { msg, title };
    </script>
    <script setup>msg(title);</script>`,
    sources: ['Cross-block static source'],
  },
  {
    name: 'static setup identifier passed to useMessages in template',
    source: setup(
      `import { useMessages } from 'gt-vue';
       const messages = useMessages();
       const title = 'Template static messages';`,
      `{{ messages(title) }}`
    ),
    sources: ['Template static messages'],
  },
  {
    name: 'static setup source and context passed to gt in template',
    source: setup(
      `import { useGT } from 'gt-vue';
       const gt = useGT();
       const source = 'Template static gt';
       const context = 'template-static';`,
      `{{ gt(source, { $context: context }) }}`
    ),
    sources: ['Template static gt'],
    contexts: { 'Template static gt': 'template-static' },
  },
  {
    name: 'computed Options API component registration',
    source: options(
      `import { T } from 'gt-vue';
       export default { components: { ['LocalT']: T } };`,
      `<LocalT>Computed component registration</LocalT>`
    ),
    sources: ['Computed component registration'],
  },
  {
    name: 'consistent multiple Options API setup returns',
    source: options(
      `import { useGT } from 'gt-vue';
       export default {
         setup() {
           const translate = useGT();
           if (Math.random() > 0.5) return { translate };
           return { translate };
         },
       };`,
      `{{ translate('Consistent setup returns') }}`
    ),
    sources: ['Consistent setup returns'],
  },
  {
    name: 'Options API returned static useMessages source',
    source: options(
      `import { useMessages } from 'gt-vue';
       export default {
         setup() {
           const messages = useMessages();
           const title = 'Options static messages';
           return { messages, title };
         },
       };`,
      `{{ messages(title) }}`
    ),
    sources: ['Options static messages'],
  },
  {
    name: 'Options API returned static gt source and context',
    source: options(
      `import { useGT } from 'gt-vue';
       export default {
         setup() {
           const gt = useGT();
           return { gt, source: 'Options static gt', context: 'options-static' };
         },
       };`,
      `{{ gt(source, { $context: context }) }}`
    ),
    sources: ['Options static gt'],
    contexts: { 'Options static gt': 'options-static' },
  },
  {
    name: 'async concise Options API setup',
    source: options(
      `import { useGT } from 'gt-vue';
       export default { setup: async () => ({ gt: useGT() }) };`,
      `{{ gt('Async concise setup') }}`
    ),
    sources: ['Async concise setup'],
  },
  {
    name: 'computed Options API setup key',
    source: options(
      `import { useGT } from 'gt-vue';
       export default { ['setup']: () => ({ gt: useGT() }) };`,
      `{{ gt('Computed setup key') }}`
    ),
    sources: ['Computed setup key'],
  },
  {
    extension: '.mjs',
    name: 'standalone mjs extraction',
    source: `import { msg } from 'gt-vue'; msg('MJS source');`,
    sources: ['MJS source'],
  },
  {
    extension: '.mts',
    name: 'standalone mts extraction',
    source: `import { msg } from 'gt-vue'; msg('MTS source' satisfies string);`,
    sources: ['MTS source'],
  },
  {
    name: 'empty source with context',
    source: setup(
      `import { msg } from 'gt-vue';
       msg('', { $context: 'empty' });`
    ),
    sources: [''],
    contexts: { '': 'empty' },
  },
  {
    name: 'BigInt static concatenation',
    source: setup(
      `import { msg } from 'gt-vue';
       msg('BigInt ' + 12n);`
    ),
    sources: ['BigInt 12'],
  },
  {
    name: 'unquoted TypeScript SFC language',
    source: `<script setup lang=ts>
      import { useGT } from 'gt-vue';
      const gt = useGT();
    </script>
    <template><Card v-slot="{ value = gt!('Unquoted TypeScript') }" /></template>`,
    sources: ['Unquoted TypeScript'],
  },
  {
    name: 'unquoted TSX SFC language',
    source: `<script setup lang=tsx>
      import { useGT } from 'gt-vue';
      const gt = useGT();
    </script>
    <template><Card v-slot="{ value = gt!('Unquoted TSX') }" /></template>`,
    sources: ['Unquoted TSX'],
  },
  {
    name: 'uppercase unquoted TypeScript language value',
    source: `<script setup lang = TS>
      import { useGT } from 'gt-vue';
      const gt = useGT();
    </script>
    <template><Card v-slot="{ value = gt!('Uppercase TypeScript') }" /></template>`,
    sources: ['Uppercase TypeScript'],
  },
  {
    name: 'mixed-case quoted TSX language value',
    source: `<script setup lang = 'TsX'>
      import { useGT } from 'gt-vue';
      const gt = useGT();
    </script>
    <template><Card v-slot="{ value = gt!('Mixed-case TSX') }" /></template>`,
    sources: ['Mixed-case TSX'],
  },
];

const ignoredCases: AuditCase[] = [
  {
    name: 'object default bypassed by supplied non-GT value',
    source: setup(
      `import { useGT } from 'gt-vue';
       const { translate = useGT() } = { translate: String };
       translate('Supplied object value');`
    ),
    sources: [],
  },
  {
    name: 'array default bypassed by supplied non-GT value',
    source: setup(
      `import { useGT } from 'gt-vue';
       const [translate = useGT()] = [String];
       translate('Supplied array value');`
    ),
    sources: [],
  },
  {
    name: 'script-setup local shadows normal-script alias',
    source: `<script>
      import { msg } from 'gt-vue';
      const defineMessage = msg;
      export { defineMessage };
    </script>
    <script setup>
      const defineMessage = String;
      defineMessage('Cross-block shadow');
    </script>`,
    sources: [],
  },
  {
    extension: '.cjs',
    name: 'shadowed CommonJS require',
    source: `function run(require) {
      const { msg } = require('gt-vue');
      msg('Shadowed require');
    }
    void run;`,
    sources: [],
  },
  {
    name: 'default gt-vue import',
    source: setup(
      `import GT from 'gt-vue';
       GT.msg('Default import');`
    ),
    sources: [],
  },
  {
    name: 'multiple late assignments',
    source: setup(
      `import { useGT } from 'gt-vue';
       let translate;
       translate = useGT();
       translate = String;
       translate('Multiple assignments');`
    ),
    sources: [],
  },
];

const diagnosticCases: Array<AuditCase & { diagnostic: string }> = [
  {
    name: 'dynamic gt-vue import',
    source: setup(
      `const load = async () => {
         const GT = await import('gt-vue');
         GT.msg('Dynamic import');
       };
       void load;`
    ),
    sources: [],
    diagnostic: 'possible gt-vue string function alias',
  },
  {
    name: 'Options API setup may fall through without returning bindings',
    source: options(
      `import { useGT } from 'gt-vue';
       export default {
         setup() {
           if (Math.random() > 0.5) return { translate: useGT() };
         },
       };`,
      `{{ translate('Fallthrough return') }}`
    ),
    sources: [],
    diagnostic:
      'Could not statically resolve consistent Options API setup returns',
  },
  {
    name: 'inconsistent Options API setup return values',
    source: options(
      `import { useGT } from 'gt-vue';
       export default {
         setup() {
           if (Math.random() > 0.5) return { translate: useGT() };
           return { translate: String };
         },
       };`,
      `{{ translate('Inconsistent return') }}`
    ),
    sources: [],
    diagnostic:
      'Could not statically resolve consistent Options API setup returns',
  },
  {
    name: 'Options API setup key absent from one return',
    source: options(
      `import { useGT } from 'gt-vue';
       export default {
         setup() {
           if (Math.random() > 0.5) return { translate: useGT() };
           return {};
         },
       };`,
      `{{ translate('Missing return key') }}`
    ),
    sources: [],
    diagnostic:
      'Could not statically resolve consistent Options API setup returns',
  },
  {
    name: 'dynamic computed Options API component key',
    source: options(
      `import { T } from 'gt-vue';
       const key = String(Date.now());
       export default { components: { [key]: T } };`,
      `<LocalT>Dynamic registration key</LocalT>`
    ),
    sources: [],
    diagnostic: 'Could not statically resolve the Vue Options API components',
  },
  {
    name: 'msg without arguments',
    source: setup(`import { msg } from 'gt-vue'; msg();`),
    sources: [],
    diagnostic: 'dynamic content',
  },
  {
    name: 'gt without arguments',
    source: setup(`import { useGT } from 'gt-vue'; const gt = useGT(); gt();`),
    sources: [],
    diagnostic: 'dynamic content',
  },
  {
    name: 'sparse msg array',
    source: setup(`import { msg } from 'gt-vue'; msg(['One', , 'Three']);`),
    sources: [],
    diagnostic: 'dynamic entry',
  },
  {
    name: 'spread msg array',
    source: setup(
      `import { msg } from 'gt-vue'; const rest = ['Two']; msg(['One', ...rest]);`
    ),
    sources: [],
    diagnostic: 'dynamic entry',
  },
  {
    name: 'dynamic computed context key',
    source: setup(
      `import { useGT } from 'gt-vue';
       const gt = useGT();
       const key = '$context';
       gt('Dynamic context key', { [key]: 'context' });`
    ),
    sources: [],
    diagnostic: 'unsupported options',
  },
  {
    name: 'spread context options',
    source: setup(
      `import { useGT } from 'gt-vue';
       const gt = useGT();
       gt('Spread options', { ...{ $context: 'spread' } });`
    ),
    sources: [],
    diagnostic: 'unsupported options',
  },
  {
    name: 'extra msg-array argument',
    source: setup(`import { msg } from 'gt-vue'; msg(['One'], {}, 'extra');`),
    sources: [],
    diagnostic: 'unsupported arguments',
  },
  {
    name: 'tagged namespace alias',
    source: setup(
      `import * as GT from 'gt-vue'; const m = GT.msg; m\`Tagged\`;`
    ),
    sources: [],
    diagnostic: 'unsupported tagged template',
  },
  {
    name: 'numeric context value',
    source: setup(
      `import { msg } from 'gt-vue'; msg('Numeric context', { $context: 1 });`
    ),
    sources: [],
    diagnostic: 'dynamic $context',
  },
  {
    name: 'nested dynamic destructured source',
    source: setup(
      `import { msg } from 'gt-vue';
       const { nested: { title } } = { nested: { title: String(Date.now()) } };
       msg(title);`
    ),
    sources: [],
    diagnostic: 'dynamic content',
  },
];

describe('Vue script extraction independent audit wave 2', () => {
  it.each(positiveCases)('$name', async (testCase) => {
    assertVueValid(testCase);
    const output = await extractCase(testCase);

    expect(output.errors).toEqual([]);
    expect(output.results.map((result) => result.source)).toEqual(
      testCase.sources
    );
    for (const [source, context] of Object.entries(testCase.contexts ?? {})) {
      expect(
        output.results.find((result) => result.source === source)?.metadata
          .context
      ).toBe(context);
    }
  });

  it.each(ignoredCases)('$name', async (testCase) => {
    assertVueValid(testCase);
    const output = await extractCase(testCase);

    expect(output.errors).toEqual([]);
    expect(output.results.map((result) => result.source)).toEqual(
      testCase.sources
    );
  });

  it.each(diagnosticCases)('$name', async (testCase) => {
    assertVueValid(testCase);
    const output = await extractCase(testCase);

    expect(output.results.map((result) => result.source)).toEqual(
      testCase.sources
    );
    expect(output.errors).toHaveLength(1);
    expect(output.errors[0]).toContain(testCase.diagnostic);
  });

  it('reports a malformed script exactly once', async () => {
    const output = await extractFromVueSource(
      `<script setup>import { msg } from 'gt-vue'; msg(</script>`,
      '/fixtures/Malformed.vue',
      { projectRoot: '/fixtures' }
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toHaveLength(1);
    expect(output.errors[0]).toContain('Could not parse a gt-vue script block');
  });
});

function setup(script: string, template = ''): string {
  return `<script setup lang="ts">${script}</script>${template ? `<template>${template}</template>` : ''}`;
}

function options(script: string, template: string): string {
  return `<script lang="ts">${script}</script><template>${template}</template>`;
}

async function extractCase(testCase: AuditCase) {
  const extension = testCase.extension ?? '.vue';
  return extractFromVueSource(
    testCase.source,
    `/fixtures/${slug(testCase.name)}${extension}`,
    { projectRoot: '/fixtures' }
  );
}

function assertVueValid(testCase: AuditCase): void {
  if (testCase.extension && testCase.extension !== '.vue') return;
  const filename = `/fixtures/${slug(testCase.name)}.vue`;
  const parsed = parse(testCase.source, { filename });
  expect(parsed.errors, `${testCase.name}: SFC parse`).toEqual([]);
  const script = compileScript(parsed.descriptor, {
    id: `audit-${slug(testCase.name)}`,
  });
  const template = parsed.descriptor.template;
  if (!template) return;
  const compiled = compileTemplate({
    id: `audit-${slug(testCase.name)}`,
    filename,
    source: template.content,
    compilerOptions: { bindingMetadata: script.bindings },
  });
  expect(compiled.errors, `${testCase.name}: template compile`).toEqual([]);
}

function slug(value: string): string {
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-');
}
