import fs from 'node:fs';
import path from 'node:path';
import { compileScript, compileTemplate, parse } from '@vue/compiler-sfc';
import { describe, expect, it } from 'vitest';
import { extractFromVueSource } from './testVueCompiler.js';

describe('Vue script extraction', () => {
  describe('fixtures', () => {
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
        result.results.find(({ source }) => source === 'Typed context')
          ?.metadata
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
      sources: ['Passed callback'],
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

  const diagnosticScriptCases: Array<
    ScriptMatrixCase & { diagnostic: string }
  > = [
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

  describe('parity matrix', () => {
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
});

describe('Vue script extraction audit cases', () => {
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
      source: setup(
        `import { useGT } from 'gt-vue'; const gt = useGT(); gt();`
      ),
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
    const language =
      parsed.descriptor.scriptSetup?.lang ?? parsed.descriptor.script?.lang;
    const compiled = compileTemplate({
      id: `audit-${slug(testCase.name)}`,
      filename,
      source: template.content,
      compilerOptions: {
        bindingMetadata: script.bindings,
        ...(language &&
          /^(?:ts|tsx)$/i.test(language) && {
            expressionPlugins: ['typescript'],
          }),
      },
    });
    expect(compiled.errors, `${testCase.name}: template compile`).toEqual([]);
  }

  function slug(value: string): string {
    return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-');
  }
});
