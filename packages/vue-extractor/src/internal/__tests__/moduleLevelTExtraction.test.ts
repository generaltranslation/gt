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
