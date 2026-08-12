import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { extractFromVueSource } from './testVueCompiler.js';

let fixtureRoot: string;

beforeEach(() => {
  fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-vue-t-'));
});

afterEach(() => {
  fs.rmSync(fixtureRoot, { force: true, recursive: true });
});

describe('module-level t() extraction', () => {
  it('tracks direct, aliased, namespaced, forwarded, and template calls', async () => {
    const output = await extract(
      'App.vue',
      `<script setup lang="ts">
        import { t, t as translateImmediately } from 'gt-vue';
        import * as GT from 'gt-vue';

        const alias = translateImmediately as typeof translateImmediately;
        const context = 'module-level';
        const source = 'Static';
        t('Direct t', { $context: 'navigation' });
        alias(source + ' expression', { $context: context });
        GT.t('Namespace t');
        GT['t']('Computed namespace t');

        const { msg: _msg, ...runtime } = GT;

        function invoke(translate: typeof t) {
          return translate('Forwarded t', { $context: 'callback' });
        }
        invoke(t);
      </script>
      <template>
        {{ runtime.t('Namespace rest t') }}
        {{ t('Template t') }}
      </template>`
    );

    expect(output.errors).toEqual([]);
    expect(output.results.map(({ source }) => source)).toEqual([
      'Direct t',
      'Static expression',
      'Namespace t',
      'Computed namespace t',
      'Forwarded t',
      'Namespace rest t',
      'Template t',
    ]);
    expect(contexts(output)).toEqual({
      'Direct t': 'navigation',
      'Forwarded t': 'callback',
      'Static expression': 'module-level',
    });
  });

  it('resolves renamed, star, and namespace reexports plus imported callbacks', async () => {
    write('runtime.ts', `export { t as translateImmediately } from 'gt-vue';`);
    write(
      'normalized.ts',
      `export { translateImmediately as t } from './runtime.js';`
    );
    write(
      'barrel.ts',
      `export { t as translateNow } from './normalized';
       export * as GT from './normalized';
       export * from './normalized';`
    );
    write(
      'callback.ts',
      `export function invoke(translate) {
         return translate('Cross-file callback', { $context: 'helper' });
       }`
    );

    const output = await extract(
      'consumer.ts',
      `import { GT, t, translateNow } from './barrel';
       import { invoke } from './callback';
       translateNow('Renamed reexport');
       t('Star reexport');
       GT.t('Namespace reexport');
       invoke(t);`
    );

    expect(output.errors).toEqual([]);
    expect(output.results.map(({ source }) => source)).toEqual([
      'Renamed reexport',
      'Star reexport',
      'Namespace reexport',
      'Cross-file callback',
    ]);
    expect(contexts(output)).toEqual({
      'Cross-file callback': 'helper',
    });
  });

  it('supports proven CommonJS and TypeScript import-equals identities', async () => {
    const commonJS = await extract(
      'messages.cjs',
      `const { t: translate } = require('gt-vue');
       const GT = require('gt-vue');
       translate('CommonJS destructure');
       GT.t('CommonJS namespace');`
    );
    const importEquals = await extract(
      'messages.cts',
      `import GT = require('gt-vue');
       const translate = GT.t;
       translate('Import equals alias');`
    );

    expect(commonJS.errors).toEqual([]);
    expect(commonJS.results.map(({ source }) => source)).toEqual([
      'CommonJS destructure',
      'CommonJS namespace',
    ]);
    expect(importEquals.errors).toEqual([]);
    expect(importEquals.results.map(({ source }) => source)).toEqual([
      'Import equals alias',
    ]);
  });

  it('treats statically proven undefined string options as omitted', async () => {
    const output = await extract(
      'UndefinedOptions.vue',
      `<script setup>
        import { msg, t, useGT, useMessages } from 'gt-vue';

        const omitted = undefined;
        const gt = useGT();
        const messages = useMessages();

        t('t explicit undefined', undefined);
        t('t aliased undefined', omitted);
        t('t undefined context', { $context: undefined });
        gt('useGT explicit undefined', undefined);
        gt('useGT undefined context', { $context: omitted });
        msg('msg explicit undefined', undefined);
        msg(['msg array first', 'msg array second'], omitted);
        messages('useMessages explicit undefined', undefined);
        messages('useMessages undefined context', { $context: omitted });
      </script>
      <template>
        {{ t('template explicit undefined', undefined) }}
        {{ t('template undefined context', { $context: omitted }) }}
      </template>`
    );

    expect(output.errors).toEqual([]);
    expect(output.results.map(({ source }) => source)).toEqual([
      't explicit undefined',
      't aliased undefined',
      't undefined context',
      'useGT explicit undefined',
      'useGT undefined context',
      'msg explicit undefined',
      'msg array first',
      'msg array second',
      'useMessages explicit undefined',
      'useMessages undefined context',
      'template explicit undefined',
      'template undefined context',
    ]);
    expect(output.results.every(({ metadata }) => !metadata.context)).toBe(
      true
    );
  });

  it('keeps lexically shadowed template undefined options fail-closed', async () => {
    const output = await extract(
      'ShadowedUndefined.vue',
      `<script setup>import { t } from 'gt-vue';</script>
       <template>
         {{ ((undefined) => t('Shadowed template options', undefined))(getValue()) }}
       </template>`
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([expect.stringContaining('dynamic options')]);
  });

  it.each([
    {
      diagnostic: 'dynamic content in a gt-vue t() call',
      name: 'dynamic source',
      statement: `const source = String(Date.now()); t(source);`,
    },
    {
      diagnostic: 'dynamic options',
      name: 'non-inline options',
      statement: `const options = { $context: 'module' }; t('Options', options);`,
    },
    {
      diagnostic: 'dynamic options',
      name: 'shadowed undefined options',
      statement: `const undefined = getValue(); t('Options', undefined);`,
    },
    {
      diagnostic: 'dynamic $context',
      name: 'dynamic context',
      statement: `t('Context', { $context: String(Date.now()) });`,
    },
    {
      diagnostic: 'dynamic $context',
      name: 'shadowed undefined context',
      statement: `const undefined = getValue(); t('Context', { $context: undefined });`,
    },
    {
      diagnostic: 'unsupported gt-vue string option "$maxChars"',
      name: 'maxChars',
      statement: `t('Max chars', { $maxChars: 10 });`,
    },
    {
      diagnostic: 'unsupported gt-vue string option "$format"',
      name: 'format',
      statement: `t('Format', { $format: 'ICU' });`,
    },
    {
      diagnostic: 'unsupported gt-vue string option "$id"',
      name: 'id',
      statement: `t('Identifier', { $id: 'id' });`,
    },
    {
      diagnostic: 'unsupported arguments',
      name: 'extra argument',
      statement: `t('Extra', {}, 'argument');`,
    },
    {
      diagnostic: 'dynamic content in a gt-vue t() call',
      name: 'message array',
      statement: `t(['One', 'Two']);`,
    },
    {
      diagnostic: 'unsupported tagged template',
      name: 'tagged template',
      statement: 't`Tagged`;',
    },
  ])('rejects $name', async ({ diagnostic, statement }) => {
    const output = await extract(
      'invalid.ts',
      `import { t } from 'gt-vue'; ${statement}`
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toHaveLength(1);
    expect(output.errors[0]).toContain(diagnostic);
  });

  it('requires proven gt-vue provenance and respects reassignment', async () => {
    write('react-runtime.ts', `export { t } from 'gt-react';`);
    const output = await extract(
      'ordinary.ts',
      `import { t as reactT } from 'gt-react';
       import { t as unknownT } from 'another-package';
       import { t as reexportedReactT } from './react-runtime';
       const t = String;
       reactT('React t');
       unknownT('Unknown t');
       reexportedReactT('Reexported React t');
       t('Local t');`
    );
    const reassigned = await extract(
      'reassigned.ts',
      `import { t } from 'gt-vue';
       let translate = t;
       translate('Before reassignment');
       translate = String;
       translate('After reassignment');`
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([]);
    expect(reassigned.errors).toEqual([]);
    expect(reassigned.results.map(({ source }) => source)).toEqual([
      'Before reassignment',
    ]);
  });

  it('fails closed when a proven local t reexport becomes mutable', async () => {
    write(
      'mutable.ts',
      `import { t } from 'gt-vue';
       let translate = t;
       translate = String;
       export { translate };`
    );
    const output = await extract(
      'mutable-consumer.ts',
      `import { translate } from './mutable'; translate('Unsafe mutable t');`
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([
      expect.stringContaining('possible gt-vue string function alias'),
    ]);
  });

  it.each([
    {
      name: 'conditional t callee',
      statement: `(flag ? t : String)('Conditional t');`,
      setup: `import { t } from 'gt-vue'; const flag = Boolean(Date.now());`,
    },
    {
      name: 'array-selected msg callee',
      statement: `[msg, String][index]('Selected msg');`,
      setup: `import { msg } from 'gt-vue'; const index = Number(Date.now());`,
    },
    {
      name: 'object-selected useGT callee',
      statement: `({ translated: useGT(), ordinary: String })[key]('Selected useGT');`,
      setup: `import { useGT } from 'gt-vue'; const key = String(Date.now());`,
    },
    {
      name: 'forwarded conditional t callee',
      statement: `invoke(flag ? t : String);`,
      setup: `import { t } from 'gt-vue';
        const flag = Boolean(Date.now());
        function invoke(translate) { translate('Forwarded conditional t'); }`,
    },
  ])('fails closed for a $name', async ({ setup, statement }) => {
    const output = await extract('dynamic-callee.ts', `${setup} ${statement}`);

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([
      expect.stringContaining('possible gt-vue string function alias'),
    ]);
  });

  it.each([
    `import('gt-vue').then(({ t }) => t('Then dynamic import'));`,
    `(await import('gt-vue')).t('Awaited dynamic import');`,
  ])('fails closed for a non-declarator dynamic import', async (statement) => {
    const output = await extract('dynamic-import.ts', statement);

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([
      expect.stringContaining('string function alias from a dynamic import'),
    ]);
  });

  it.each([
    ['t', `runtime.t('Namespace rest t')`],
    ['msg', `runtime.msg('Namespace rest msg')`],
    ['useGT', `runtime.useGT()('Namespace rest useGT')`],
  ])('fails closed for a namespace-rest %s call', async (_name, statement) => {
    const output = await extract(
      'namespace-rest.ts',
      `import * as GT from 'gt-vue';
       const { T: _T, ...runtime } = GT;
       ${statement};`
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([
      expect.stringContaining('possible gt-vue string function alias'),
    ]);
  });

  it.each([
    ['t', `({ ...GT }).t('Namespace spread t')`],
    ['msg', `({ ...GT }).msg('Namespace spread msg')`],
    ['useGT', `({ ...GT }).useGT()('Namespace spread useGT')`],
  ])(
    'fails closed for a namespace-spread %s call',
    async (_name, statement) => {
      const output = await extract(
        'namespace-spread.ts',
        `import * as GT from 'gt-vue'; ${statement};`
      );

      expect(output.results).toEqual([]);
      expect(output.errors).toEqual([
        expect.stringContaining('possible gt-vue string function alias'),
      ]);
    }
  );

  it('keeps statically ordinary dynamic callees isolated', async () => {
    const output = await extract(
      'ordinary-dynamic-callees.ts',
      `import { t } from 'gt-vue';
       import * as GT from 'gt-vue';
       (false ? t : String)('Dead translated branch');
       (false ? t : String)\`Dead translated tag\`;
       (String || t)('Ordinary OR');
       (t && String)('Ordinary AND');
       (String ?? t)('Ordinary nullish');
       (false && t)('Dead logical branch');
       (undefined && t)('Undefined logical branch');
       ((() => String) || t)('Arrow OR');
       ((() => String) ?? t)('Arrow nullish');
       function ordinary(value) { return value; }
       (ordinary || t)('Function OR');
       (ordinary ?? t)('Function nullish');
       ({ ...GT, t: String }).t('Overridden namespace spread');
       const { t: _removedT, ...withoutT } = GT;
       withoutT.t('Excluded namespace-rest export');`
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([]);
  });

  it.each([
    [`(false || t)('False OR')`, 'False OR'],
    [`(true && t)('True AND')`, 'True AND'],
    [`(null ?? t)('Nullish')`, 'Nullish'],
    [`(undefined || t)('Undefined OR')`, 'Undefined OR'],
    [`(undefined ?? t)('Undefined nullish')`, 'Undefined nullish'],
    [`(t || String)('Translator OR')`, 'Translator OR'],
    [`(t ?? String)('Translator nullish')`, 'Translator nullish'],
  ])(
    'extracts a statically selected logical translator',
    async (call, text) => {
      const output = await extract(
        'logical-translator.ts',
        `import { t } from 'gt-vue'; ${call};`
      );

      expect(output.errors).toEqual([]);
      expect(output.results.map((result) => result.source)).toEqual([text]);
    }
  );

  it.each(['let', 'var'])(
    'fails closed for a mutable CommonJS destructure declared with %s',
    async (declaration) => {
      const output = await extract(
        'mutable-commonjs.cjs',
        `${declaration} { t } = require('gt-vue');
         t('Before reassignment');
         t = String;
         t('After reassignment');`
      );

      expect(output.results).toEqual([]);
      expect(output.errors).toEqual([
        expect.stringContaining('possible gt-vue string function alias'),
      ]);
    }
  );

  it('fails closed for mutable CommonJS msg and useGT destructures', async () => {
    const output = await extract(
      'mutable-commonjs-functions.cjs',
      `let { msg, useGT } = require('gt-vue');
       msg('Mutable CommonJS msg');
       useGT()('Mutable CommonJS useGT');
       msg = String;
       useGT = () => String;`
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toHaveLength(2);
    expect(output.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('possible gt-vue string function alias "msg"'),
        expect.stringContaining(
          'possible gt-vue string function alias "useGT"'
        ),
      ])
    );
  });

  it.each([
    `const choices = [t, String]; choices[index]('Alias array');`,
    `const choices = { a: t, b: String }; choices[key]('Alias object');`,
  ])('fails closed for an aliased dynamic container', async (statement) => {
    const output = await extract(
      'aliased-container.ts',
      `import { t } from 'gt-vue';
       const index = Math.random() > 0.5 ? 0 : 1;
       const key = Math.random() > 0.5 ? 'a' : 'b';
       ${statement}`
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([
      expect.stringContaining('possible gt-vue string function alias'),
    ]);
  });

  it('keeps statically ordinary aliased container entries isolated', async () => {
    const output = await extract(
      'static-aliased-container.ts',
      `import { t } from 'gt-vue';
       const array = [t, String];
       const object = { a: t, b: String };
       array[1]('Static array entry');
       object.b('Static object entry');`
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([]);
  });

  it.each([
    `const spread = { ...GT }; spread.t('Spread alias');`,
    `const { T: _T, ...rest } = GT;
     const alias = rest;
     alias.t('Rest alias');`,
    `const { T: _T, ...rest } = GT;
     const { T: _T2, ...rest2 } = rest;
     rest2.t('Nested rest');`,
  ])('fails closed for an aliased namespace copy', async (statement) => {
    const output = await extract(
      'aliased-namespace.ts',
      `import * as GT from 'gt-vue'; ${statement}`
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([
      expect.stringContaining('possible gt-vue string function alias'),
    ]);
  });

  it('keeps overridden and excluded namespace copies isolated', async () => {
    const output = await extract(
      'ordinary-namespace-copy.ts',
      `import * as GT from 'gt-vue';
       const spread = { ...GT, t: String };
       const { t: _removed, ...withoutT } = GT;
       spread.t('Overridden spread alias');
       withoutT.t('Excluded rest alias');`
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([]);
  });

  it.each([
    `const alias = fn; alias('Forward alias');`,
    `const first = fn; const second = first; second('Chained forward alias');`,
  ])('fails closed for a forwarded parameter alias', async (body) => {
    const output = await extract(
      'forwarded-alias.ts',
      `import { t } from 'gt-vue';
       const flag = Math.random() > 0.5;
       function invoke(fn) { ${body} }
       invoke(flag ? t : String);`
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([
      expect.stringContaining('possible gt-vue string function alias'),
    ]);
  });

  it('keeps an ordinary forwarded parameter alias isolated', async () => {
    const output = await extract(
      'ordinary-forwarded-alias.ts',
      `function invoke(fn) { const alias = fn; alias('Ordinary alias'); }
       invoke(String);`
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([]);
  });

  it.each([
    `const source = 'gt-vue'; import(source).then(({ t }) => t('Const import'));`,
    "import(`gt-vue`).then(({ t }) => t('Template import'));",
  ])(
    'fails closed for a statically resolved dynamic import',
    async (source) => {
      const output = await extract('static-dynamic-import.ts', source);

      expect(output.results).toEqual([]);
      expect(output.errors).toEqual([
        expect.stringContaining('string function alias from a dynamic import'),
      ]);
    }
  );

  it.each([
    `const source = 'gt-react'; import(source).then(({ t }) => t('React const import'));`,
    "import(`gt-react`).then(({ t }) => t('React template import'));",
  ])(
    'keeps a statically resolved React dynamic import isolated',
    async (source) => {
      const output = await extract('static-react-dynamic-import.ts', source);

      expect(output.results).toEqual([]);
      expect(output.errors).toEqual([]);
    }
  );

  it.each([
    `[useGT, () => String][index]()('Inline hook selection');`,
    `const choices = [useGT, () => String];
     choices[index]()('Aliased hook selection');`,
  ])('fails closed for an uncertain hook identity', async (statement) => {
    const output = await extract(
      'uncertain-hook.ts',
      `import { useGT } from 'gt-vue';
       const index = Math.random() > 0.5 ? 0 : 1;
       ${statement}`
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([
      expect.stringContaining('possible gt-vue string function alias'),
    ]);
  });

  it.each(['t', 'candidate'])(
    'does not leak mutable CommonJS uncertainty into a shadowed %s parameter',
    async (localName) => {
      const imported = localName === 't' ? 't' : `t: ${localName}`;
      const output = await extract(
        'commonjs-shadow.cjs',
        `let { ${imported} } = require('gt-vue');
         ${localName} = String;
         function ordinary(${localName}) { ${localName}('Ordinary shadow'); }
         ordinary(String);`
      );

      expect(output.results).toEqual([]);
      expect(output.errors).toEqual([]);
    }
  );

  it.each([
    `[useGT, String][index]('Not a translation');`,
    `[useGT, () => String][index]();`,
    `const value = [useGT, () => String][index](); void value;`,
  ])('does not diagnose an unconsumed uncertain hook', async (statement) => {
    const output = await extract(
      'unused-hook.ts',
      `import { useGT } from 'gt-vue';
       const index = Math.random() > 0.5 ? 0 : 1;
       ${statement}`
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([]);
  });

  it.each([
    `const choices = [String, String]; choices[0] = t; choices[index]('Live array');`,
    `const outer = [[t, String], [String, String]]; outer[index][index]('Nested');`,
    `Object.values({ a: t, b: String })[index]('Values');`,
    `[t, String].map((value) => value)[index]('Map');`,
    `[() => t, () => String][index]()('Factory');`,
    `function invoke(fn) { let alias = String; alias = fn; alias('Mutable alias'); }
     invoke(flag ? t : String);`,
    `const c = [String];
     function mutate(box, value) { box[0] = value; }
     mutate(c, t); c[index]('Parameter value');`,
    `const c = { a: String };
     function mutate(box, value) { box.a = value; }
     mutate(c, t); c[flag ? 'a' : 'b']('Object parameter value');`,
    `const c = [String];
     function mutate(box, callback) { box[0] = callback(); }
     mutate(c, () => t); c[index]('Callback value');`,
  ])(
    'fails closed for an expanded uncertain callee shape',
    async (statement) => {
      const output = await extract(
        'expanded-uncertain-callee.ts',
        `import { t } from 'gt-vue';
       const flag = Math.random() > 0.5;
       const index = flag ? 0 : 1;
       ${statement}`
      );

      expect(output.results).toEqual([]);
      expect(output.errors).toEqual([
        expect.stringContaining('possible gt-vue string function alias'),
      ]);
    }
  );

  it.each([
    `(flag ? t : String)\`Conditional tag\``,
    `[t, String][index]\`Member tag\``,
    `const choices = [t, String]; choices[index]\`Alias tag\``,
  ])('rejects an uncertain gt-vue tagged template', async (statement) => {
    const output = await extract(
      'uncertain-tag.ts',
      `import { t } from 'gt-vue';
       const flag = Math.random() > 0.5;
       const index = flag ? 0 : 1;
       ${statement}`
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([
      expect.stringContaining('unsupported tagged template translation'),
    ]);
  });

  it.each([
    `const source = 'gt-vue'; const { t } = require(source); t('Const require');`,
    "const { t } = require(`gt-vue`); t('Template require');",
  ])(
    'extracts from a statically sourced CommonJS namespace',
    async (source) => {
      const output = await extract('static-require.cjs', source);

      expect(output.errors).toEqual([]);
      expect(output.results).toHaveLength(1);
    }
  );

  it.each([
    `const flag = Math.random() > 0.5;
     const source = flag ? 'gt-vue' : 'gt-react';`,
    `const flag = Math.random() > 0.5;
     const source = flag ? 'gt-vue' : 'ordinary';`,
    `let source = 'gt-react';
     if (Math.random() > 0.5) source = 'gt-vue';`,
  ])('fails closed for a mixed CommonJS source', async (setup) => {
    const output = await extract(
      'mixed-commonjs.cjs',
      `${setup} const { t } = require(source); t('Mixed require');`
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([
      expect.stringContaining(
        'string function alias from a dynamic import or require()'
      ),
    ]);
  });

  it('keeps uncertain React tags and static CommonJS sources isolated', async () => {
    const output = await extract(
      'react-controls.ts',
      `import { t } from 'gt-react';
       const flag = Math.random() > 0.5;
       const index = flag ? 0 : 1;
       (flag ? t : String)\`React tag\`;
       [t, String][index]\`React member tag\`;
       const source = 'gt-react';
       const { t: requiredT } = require(source);
       requiredT('React require');`
    );

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([]);
  });
});

function contexts(
  output: Awaited<ReturnType<typeof extractFromVueSource>>
): Record<string, string> {
  return Object.fromEntries(
    output.results.flatMap((result) =>
      result.metadata.context
        ? [[String(result.source), result.metadata.context]]
        : []
    )
  );
}

function extract(relativePath: string, source: string) {
  const filePath = write(relativePath, source);
  return extractFromVueSource(source, filePath, {
    projectRoot: fixtureRoot,
  });
}

function write(relativePath: string, source: string): string {
  const filePath = path.join(fixtureRoot, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, source);
  return filePath;
}
