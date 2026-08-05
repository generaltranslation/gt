import fs from 'node:fs';
import path from 'node:path';
import { compileScript, compileTemplate, parse } from '@vue/compiler-sfc';
import { describe, expect, it } from 'vitest';
import { extractFromVueSource } from './testVueCompiler.js';

describe('Vue script extraction', () => {
  it('resolves static TypeScript expressions and safe binding flows', async () => {
    const result = await extractFixture('script-static.vue');

    expect(result.errors).toEqual([]);
    expect(result.results.map(({ source }) => source)).toEqual([
      'AB',
      'BigInt 1',
      'Typed context',
      'Satisfies context',
      'Static satisfies',
      'Static message',
      'Direct hook call',
      'Optional call',
      'Non-null call',
      'Assigned hook result',
      'Array destructured hook result',
      'Object destructured hook result',
      'Typed component alias',
      'Digit component alias',
    ]);
    expect(
      result.results.find(({ source }) => source === 'Typed context')?.metadata
    ).toMatchObject({ context: 'typed' });
    expect(
      result.results.find(({ source }) => source === 'Satisfies context')
        ?.metadata
    ).toMatchObject({ context: 'satisfies' });
    expect(result.results.map(({ source }) => source)).not.toContain(
      'Not a GT message'
    );
  });

  it('supports ESM namespaces and their component aliases', async () => {
    const result = await extractFixture('script-namespace.vue');

    expect(result.errors).toEqual([]);
    expect(result.results.map(({ source }) => source)).toEqual([
      'Namespace hook',
      'Namespace message',
      'Computed namespace hook',
      'Computed namespace message',
      'Namespace alias component',
      'Namespace component',
    ]);
  });

  it('ports applicable React alias, scope, wrapper, and call-form cases', async () => {
    const result = await extractFixture('script-react-parity.vue');

    expect(result.errors).toEqual([]);
    expect(result.results.map(({ source }) => source)).toEqual([
      'Hello, Vue parity',
      'Count -2 / true / null',
      'Wrapped static',
      'Aliased msg',
      'Raw messages identifier',
      'Wrapped direct hook call',
      'Optional direct hook call',
      'Object assignment flow',
      'Array assignment flow',
      'Wrapped component alias',
    ]);
    expect(result.results.map(({ source }) => source)).not.toEqual(
      expect.arrayContaining([
        'Shadowed local binding',
        'Shadowed parameter binding',
        'Reassigned alias',
      ])
    );
  });

  it('diagnoses dynamic calls without following unsupported callbacks', async () => {
    const result = await extractFixture('script-react-parity-dynamic.vue');

    expect(result.errors).toHaveLength(3);
    expect(result.errors[0]).toContain('dynamic content');
    expect(result.errors[1]).toContain('dynamic options');
    expect(result.errors[2]).toContain(
      'Could not statically resolve possible gt-vue string function alias'
    );
    expect(result.results.map(({ source }) => source)).toEqual([
      'Optional direct msg',
    ]);
  });

  it('shares imports between normal script and script setup', async () => {
    const result = await extractFixture('script-cross-block.vue');

    expect(result.errors).toEqual([]);
    expect(result.results.map(({ source }) => source)).toEqual([
      'Cross-block script call',
      'Cross-block component',
      'Cross-block template call',
    ]);
  });

  it('exposes direct, spread, and concise Options API setup returns', async () => {
    const files = [
      'options-direct-return.vue',
      'options-spread-return.vue',
      'options-concise-return.vue',
    ];
    const results = await Promise.all(files.map(extractFixture));

    expect(results.flatMap(({ errors }) => errors)).toEqual([]);
    expect(
      results.flatMap(({ results: entries }) =>
        entries.map(({ source }) => source)
      )
    ).toEqual([
      'Direct setup return',
      'Spread setup return',
      'Concise setup return',
    ]);
  });

  it('follows a secondary defineComponent alias', async () => {
    const result = await extractFixture('options-define-alias.vue');

    expect(result.errors).toEqual([]);
    expect(result.results.map(({ source }) => source)).toEqual([
      'Aliased defineComponent',
    ]);
  });

  it('ports React-style aliases through an Options API object', async () => {
    const result = await extractFixture('options-react-parity.vue');

    expect(result.errors).toEqual([]);
    expect(result.results.map(({ source }) => source)).toEqual([
      'Options registered alias',
      'Options returned alias',
    ]);
  });

  it('accepts TypeScript decorators supported by Vue', async () => {
    const result = await extractFixture('script-decorators.vue');

    expect(result.errors).toEqual([]);
    expect(result.results.map(({ source }) => source)).toEqual([
      'Decorated script',
    ]);
  });

  it('supports static CommonJS and TypeScript import-equals forms', async () => {
    const results = await Promise.all([
      extractFixture('script-commonjs.cjs'),
      extractFixture('script-commonjs.cts'),
    ]);

    expect(results.flatMap(({ errors }) => errors)).toEqual([]);
    expect(
      results.flatMap(({ results: entries }) =>
        entries.map(({ source }) => source)
      )
    ).toEqual([
      'CommonJS message',
      'CommonJS translation',
      'CTS namespace message',
      'CTS namespace translation',
    ]);
  });

  it('keeps every SFC fixture valid in the Vue compiler', () => {
    const files = [
      'script-static.vue',
      'script-namespace.vue',
      'script-react-parity.vue',
      'script-react-parity-dynamic.vue',
      'script-cross-block.vue',
      'options-direct-return.vue',
      'options-spread-return.vue',
      'options-concise-return.vue',
      'options-define-alias.vue',
      'options-react-parity.vue',
      'script-decorators.vue',
    ];

    for (const file of files) {
      const filename = fixturePath(file);
      const parsed = parse(fs.readFileSync(filename, 'utf8'), { filename });
      expect(parsed.errors, file).toEqual([]);
      const script = compileScript(parsed.descriptor, {
        id: `script-extraction-${file}`,
        babelParserPlugins: ['decorators-legacy'],
      });
      if (parsed.descriptor.template) {
        const template = compileTemplate({
          id: `script-extraction-${file}`,
          filename,
          source: parsed.descriptor.template.content,
          compilerOptions: { bindingMetadata: script.bindings },
        });
        expect(template.errors, file).toEqual([]);
      }
    }
  });
});

type ScriptMatrixCase = {
  name: string;
  script: string;
  sources: string[];
  template?: string;
  contexts?: Record<string, string>;
};

const positiveScriptCases: ScriptMatrixCase[] = [
  {
    name: 'direct msg call',
    script: `import { msg } from 'gt-vue'; msg('Direct msg');`,
    sources: ['Direct msg'],
  },
  {
    name: 'aliased msg import',
    script: `import { msg as message } from 'gt-vue'; message('Import alias');`,
    sources: ['Import alias'],
  },
  {
    name: 'useGT result',
    script: `import { useGT } from 'gt-vue'; const gt = useGT(); gt('Hook result');`,
    sources: ['Hook result'],
  },
  {
    name: 'aliased useGT import',
    script: `import { useGT as createTranslator } from 'gt-vue'; const gt = createTranslator(); gt('Hook import alias');`,
    sources: ['Hook import alias'],
  },
  {
    name: 'hook function alias',
    script: `import { useGT } from 'gt-vue'; const hook = useGT; const gt = hook(); gt('Hook function alias');`,
    sources: ['Hook function alias'],
  },
  {
    name: 'deep translator aliases',
    script: `import { useGT } from 'gt-vue'; const gt = useGT(); const a = gt; const b = a; const c = b; c('Deep alias');`,
    sources: ['Deep alias'],
  },
  {
    name: 'useMessages literal',
    script: `import { useMessages } from 'gt-vue'; const m = useMessages(); m('Messages literal');`,
    sources: ['Messages literal'],
  },
  {
    name: 'useMessages const identifier',
    script: `import { useMessages } from 'gt-vue'; const m = useMessages(); const title = 'Messages identifier'; m(title);`,
    sources: ['Messages identifier'],
  },
  {
    name: 'namespace msg call',
    script: `import * as GT from 'gt-vue'; GT.msg('Namespace msg');`,
    sources: ['Namespace msg'],
  },
  {
    name: 'computed namespace msg call',
    script: `import * as GT from 'gt-vue'; GT['msg']('Computed namespace msg');`,
    sources: ['Computed namespace msg'],
  },
  {
    name: 'namespace hook call',
    script: `import * as GT from 'gt-vue'; GT.useGT()('Namespace hook call');`,
    sources: ['Namespace hook call'],
  },
  {
    name: 'direct hook-result call',
    script: `import { useGT } from 'gt-vue'; useGT()('Direct hook-result call');`,
    sources: ['Direct hook-result call'],
  },
  {
    name: 'optional translator call',
    script: `import { useGT } from 'gt-vue'; const gt = useGT(); gt?.('Optional translator');`,
    sources: ['Optional translator'],
  },
  {
    name: 'non-null translator call',
    script: `import { useGT } from 'gt-vue'; const gt = useGT(); gt!('Non-null translator');`,
    sources: ['Non-null translator'],
  },
  {
    name: 'type-cast translator call',
    script: `import { useGT } from 'gt-vue'; const gt = useGT(); (gt as typeof gt)('Type-cast translator');`,
    sources: ['Type-cast translator'],
  },
  {
    name: 'satisfies-wrapped translator call',
    script: `import { useGT } from 'gt-vue'; const gt = useGT(); (gt satisfies typeof gt)('Satisfies translator');`,
    sources: ['Satisfies translator'],
  },
  {
    name: 'const source identifier',
    script: `import { msg } from 'gt-vue'; const source = 'Const source'; msg(source);`,
    sources: ['Const source'],
  },
  {
    name: 'chained const source identifiers',
    script: `import { msg } from 'gt-vue'; const first = 'Const chain'; const second = first; msg(second);`,
    sources: ['Const chain'],
  },
  {
    name: 'static concatenation',
    script: `import { msg } from 'gt-vue'; const first = 'Static '; const second = 'concat'; msg(first + second);`,
    sources: ['Static concat'],
  },
  {
    name: 'static template expression',
    script:
      "import { msg } from 'gt-vue'; const value = 'template'; msg(`Static ${value}`);",
    sources: ['Static template'],
  },
  {
    name: 'static primitive coercion',
    script: `import { msg } from 'gt-vue'; msg('Primitive ' + -2 + true + null);`,
    sources: ['Primitive -2truenull'],
  },
  {
    name: 'as-const source wrapper',
    script: `import { msg } from 'gt-vue'; msg('As const source' as const);`,
    sources: ['As const source'],
  },
  {
    name: 'satisfies source wrapper',
    script: `import { msg } from 'gt-vue'; msg('Satisfies source' satisfies string);`,
    sources: ['Satisfies source'],
  },
  {
    name: 'as-const options wrapper',
    script: `import { useGT } from 'gt-vue'; const gt = useGT(); gt('Context cast', { $context: 'cast' } as const);`,
    sources: ['Context cast'],
    contexts: { 'Context cast': 'cast' },
  },
  {
    name: 'satisfies options wrapper',
    script: `import { useGT } from 'gt-vue'; const gt = useGT(); gt('Context satisfies', { $context: 'satisfies' } satisfies { $context: string });`,
    sources: ['Context satisfies'],
    contexts: { 'Context satisfies': 'satisfies' },
  },
  {
    name: 'const context value',
    script: `import { useGT } from 'gt-vue'; const gt = useGT(); const context = 'identifier'; gt('Context identifier', { $context: context });`,
    sources: ['Context identifier'],
    contexts: { 'Context identifier': 'identifier' },
  },
  {
    name: 'single late assignment',
    script: `import { useGT } from 'gt-vue'; let gt; gt = useGT(); gt('Late assignment');`,
    sources: ['Late assignment'],
  },
  {
    name: 'object destructuring declaration',
    script: `import { useGT } from 'gt-vue'; const { gt } = { gt: useGT() }; gt('Object declaration');`,
    sources: ['Object declaration'],
  },
  {
    name: 'array destructuring declaration',
    script: `import { useGT } from 'gt-vue'; const [gt] = [useGT()]; gt('Array declaration');`,
    sources: ['Array declaration'],
  },
  {
    name: 'object destructuring assignment',
    script: `import { useGT } from 'gt-vue'; let gt; ({ gt } = { gt: useGT() }); gt('Object assignment');`,
    sources: ['Object assignment'],
  },
  {
    name: 'array destructuring assignment',
    script: `import { useGT } from 'gt-vue'; let gt; [gt] = [useGT()]; gt('Array assignment');`,
    sources: ['Array assignment'],
  },
  {
    name: 'static msg array',
    script:
      "import { msg } from 'gt-vue'; msg(['Array one', `Array ${'two'}`]);",
    sources: ['Array one', 'Array two'],
  },
  {
    name: 'type-wrapped component alias',
    script: `import { T as SourceT } from 'gt-vue'; const LocalT = (SourceT as typeof SourceT)!;`,
    template: '<LocalT>Wrapped component</LocalT>',
    sources: ['Wrapped component'],
  },
  {
    name: 'digit-normalized component alias',
    script: `import { T as T2 } from 'gt-vue';`,
    template: '<t-2>Digit component</t-2>',
    sources: ['Digit component'],
  },
  {
    name: 'namespace component',
    script: `import * as GT from 'gt-vue';`,
    template: '<GT.T>Namespace component matrix</GT.T>',
    sources: ['Namespace component matrix'],
  },
];

const ignoredScriptCases: ScriptMatrixCase[] = [
  {
    name: 'lexically shadowed msg import',
    script: `import { msg } from 'gt-vue'; { const msg = String; msg('Local shadow'); }`,
    sources: [],
  },
  {
    name: 'parameter-shadowed msg import',
    script: `import { msg } from 'gt-vue'; function run(msg: typeof String) { msg('Parameter shadow'); } void run;`,
    sources: [],
  },
  {
    name: 'reassigned callback alias',
    script: `import { msg } from 'gt-vue'; let callback = msg; callback = String; callback('Reassigned callback');`,
    sources: [],
  },
  {
    name: 'unrelated same-named function',
    script: `const useGT = () => String; useGT()('Unrelated function');`,
    sources: [],
  },
  {
    name: 'type-only import',
    script: `import type { GTFunction } from 'gt-vue'; const gt = null as unknown as GTFunction; gt('Type-only import');`,
    sources: [],
  },
  {
    name: 'translator passed as callback',
    script: `import { useGT } from 'gt-vue'; const gt = useGT(); function helper(translator: typeof gt) { translator('Passed callback'); } helper(gt);`,
    sources: [],
  },
  {
    name: 'dynamic useMessages input',
    script: `import { useMessages } from 'gt-vue'; const m = useMessages(); const value = String(Date.now()); m(value);`,
    sources: [],
  },
  {
    name: 'same exports from another package',
    script: `import { msg, useGT } from 'another-package'; msg('Other msg'); useGT()('Other hook');`,
    sources: [],
  },
];

const diagnosticScriptCases: Array<ScriptMatrixCase & { diagnostic: string }> =
  [
    {
      name: 'dynamic gt source',
      script: `import { useGT } from 'gt-vue'; const gt = useGT(); const value = String(Date.now()); gt(value);`,
      sources: [],
      diagnostic: 'dynamic content',
    },
    {
      name: 'dynamic msg source',
      script: `import { msg } from 'gt-vue'; const value = String(Date.now()); msg(value);`,
      sources: [],
      diagnostic: 'dynamic content',
    },
    {
      name: 'dynamic template expression',
      script:
        "import { useGT } from 'gt-vue'; const gt = useGT(); gt(`Now ${String(Date.now())}`);",
      sources: [],
      diagnostic: 'dynamic content',
    },
    {
      name: 'dynamic options object',
      script: `import { useGT } from 'gt-vue'; const gt = useGT(); const options = { $context: 'named' }; gt('Named options', options);`,
      sources: [],
      diagnostic: 'dynamic options',
    },
    {
      name: 'dynamic context value',
      script: `import { useGT } from 'gt-vue'; const gt = useGT(); gt('Dynamic context', { $context: String(Date.now()) });`,
      sources: [],
      diagnostic: 'dynamic $context',
    },
    {
      name: 'unsupported option',
      script: `import { useGT } from 'gt-vue'; const gt = useGT(); gt('Unsupported option', { $id: 'id' });`,
      sources: [],
      diagnostic: 'unsupported gt-vue string option',
    },
    {
      name: 'excess call argument',
      script: `import { useGT } from 'gt-vue'; const gt = useGT(); gt('Excess argument', {}, 'extra');`,
      sources: [],
      diagnostic: 'unsupported arguments',
    },
    {
      name: 'dynamic msg array entry',
      script: `import { msg } from 'gt-vue'; const value = String(Date.now()); msg(['Static', value]);`,
      sources: [],
      diagnostic: 'dynamic entry',
    },
    {
      name: 'tagged template translation',
      script: "import { msg } from 'gt-vue'; msg`Tagged`;",
      sources: [],
      diagnostic: 'unsupported tagged template',
    },
  ];

describe('Vue script extraction parity matrix', () => {
  it.each(positiveScriptCases)('$name', async (testCase) => {
    const result = await extractInlineScript(testCase);

    expect(result.errors).toEqual([]);
    expect(result.results.map(({ source }) => source)).toEqual(
      testCase.sources
    );
    for (const [source, expectedContext] of Object.entries(
      testCase.contexts ?? {}
    )) {
      expect(
        result.results.find((entry) => entry.source === source)?.metadata
      ).toMatchObject({ context: expectedContext });
    }
  });

  it.each(ignoredScriptCases)('$name', async (testCase) => {
    const result = await extractInlineScript(testCase);

    expect(result.errors).toEqual([]);
    expect(result.results.map(({ source }) => source)).toEqual(
      testCase.sources
    );
  });

  it.each(diagnosticScriptCases)('$name', async (testCase) => {
    const result = await extractInlineScript(testCase);

    expect(result.results.map(({ source }) => source)).toEqual(
      testCase.sources
    );
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain(testCase.diagnostic);
  });

  it('diagnoses a call before a late assignment and extracts the later call', async () => {
    const result = await extractInlineScript({
      name: 'call before a late assignment',
      script: `import { useGT } from 'gt-vue'; let gt; gt('Before assignment'); gt = useGT(); gt('After unsafe assignment');`,
      sources: [],
    });

    expect(result.results.map(({ source }) => source)).toEqual([
      'After unsafe assignment',
    ]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'Could not statically resolve possible gt-vue string function alias'
        ),
      ])
    );
  });

  it('fails closed for a conditional translator selection', async () => {
    const result = await extractInlineScript({
      name: 'conditional translator selection',
      script: `import { useGT } from 'gt-vue'; const gt = useGT(); const callback = Date.now() > 0 ? gt : String; callback('Conditional callback');`,
      sources: [],
    });

    expect(result.results).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain(
      'Could not statically resolve possible gt-vue string function alias'
    );
  });
});

async function extractFixture(name: string) {
  const file = fixturePath(name);
  return extractFromVueSource(fs.readFileSync(file, 'utf8'), file, {
    projectRoot: path.dirname(file),
  });
}

function fixturePath(name: string): string {
  return path.join(__dirname, 'fixtures', name);
}

async function extractInlineScript(testCase: ScriptMatrixCase) {
  const file = path.join(__dirname, 'fixtures', 'inline-script-matrix.vue');
  const source = `<script setup lang="ts">\n${testCase.script}\n</script>\n${
    testCase.template ? `<template>${testCase.template}</template>` : ''
  }`;
  return extractFromVueSource(source, file, {
    projectRoot: path.dirname(file),
  });
}
