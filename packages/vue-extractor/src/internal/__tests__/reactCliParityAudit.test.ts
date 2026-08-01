import { compileScript, compileTemplate, parse } from '@vue/compiler-sfc';
import type { JsxChildren } from '@generaltranslation/format/types';
import { describe, expect, it } from 'vitest';
import { extractFromVueSource } from '../../index.js';

describe('React CLI parity audit: rich Vue content', () => {
  it('serializes nested branches and public formatter value props', async () => {
    const source = createSfc(
      `
        import {
          Branch,
          Currency,
          DateTime,
          Num,
          Plural,
          T,
          Var,
        } from 'gt-vue';
        const count = 2;
        const name = 'Ada';
        const price = 12;
        const createdAt = new Date();
      `,
      `<T><Branch branch="formal"><template #formal><section><Plural :n="count"><template #one>One <Var>{{ name }}</Var><Num :value="count" /></template><template #other><Currency :value="price" /> on <DateTime :value="createdAt" /></template>Plural fallback</Plural></section></template><template #casual>Casual</template>Branch fallback</Branch><hr /><br /></T>`
    );
    assertVueCompiles(source, 'nested-formatters');

    const output = await extract(source, 'nested-formatters');

    expect(output.errors).toEqual([]);
    expect(richSources(output.results)).toEqual([
      [
        {
          t: 'Branch',
          i: 1,
          d: {
            b: {
              formal: {
                t: 'section',
                i: 2,
                c: {
                  t: 'Plural',
                  i: 3,
                  d: {
                    b: {
                      one: [
                        'One ',
                        { i: 4, k: '_gt_value_4', v: 'v' },
                        { i: 5, k: '_gt_n_5', v: 'n' },
                      ],
                      other: [
                        { i: 4, k: '_gt_cost_4', v: 'c' },
                        ' on ',
                        { i: 5, k: '_gt_date_5', v: 'd' },
                      ],
                    },
                    t: 'p',
                  },
                  c: 'Plural fallback',
                },
              },
              casual: 'Casual',
            },
            t: 'b',
          },
          c: 'Branch fallback',
        },
        { t: 'hr', i: 2 },
        { t: 'br', i: 3 },
      ],
    ]);
  });

  it('keeps numeric, empty, Unicode, and control branch values static', async () => {
    const source = createSfc(
      `import { Branch, T } from 'gt-vue';`,
      `<T><Branch branch="hex" :hex="0x10" :octal="0o10" :binary="0b10" :scientific="1e2" :negative="-3.5" :smallest="5e-324" :underflow="1e-324" :largest="1.7976931348623157e308" :negativeZero="-0" :epsilon="2.220446049250313e-16" empty="" :disabled="false" :nothing="null" unicode="你好" :control="'\\n\\t'">Fallback</Branch></T>`
    );
    assertVueCompiles(source, 'primitive-branches');

    const output = await extract(source, 'primitive-branches');

    expect(output.errors).toEqual([]);
    expect(richSources(output.results)).toEqual([
      {
        t: 'Branch',
        i: 1,
        d: {
          b: {
            hex: '16',
            octal: '8',
            binary: '2',
            scientific: '100',
            negative: '-3.5',
            smallest: '5e-324',
            underflow: '0',
            largest: '1.7976931348623157e+308',
            negativeZero: '0',
            epsilon: '2.220446049250313e-16',
            empty: '',
            disabled: [],
            nothing: [],
            unicode: '你好',
            control: '\n\t',
          },
          t: 'b',
        },
        c: 'Fallback',
      },
    ]);
  });

  it('extracts legacy and CLDR plural forms together', async () => {
    const source = createSfc(
      `import { Plural, T } from 'gt-vue';`,
      `<T><Plural :n="2" singular="Single" dual="Double" plural="Plural" zero="Zero" one="One" two="Two" few="Few" many="Many" other="Other">Fallback</Plural></T>`
    );
    assertVueCompiles(source, 'plural-forms');

    const output = await extract(source, 'plural-forms');

    expect(output.errors).toEqual([]);
    expect(richSources(output.results)).toEqual([
      {
        t: 'Plural',
        i: 1,
        d: {
          b: {
            singular: 'Single',
            dual: 'Double',
            plural: 'Plural',
            zero: 'Zero',
            one: 'One',
            two: 'Two',
            few: 'Few',
            many: 'Many',
            other: 'Other',
          },
          t: 'p',
        },
        c: 'Fallback',
      },
    ]);
  });

  it('preserves entities, built-ins, custom components, and void elements', async () => {
    const source = createSfc(
      `import { T } from 'gt-vue'; import Card from './Card.vue';`,
      `<T>Hello&nbsp;<Suspense><Card title="Heading">Custom &amp; deep</Card></Suspense><Transition><p>Motion</p></Transition><img alt="Portrait" /><br /></T>`
    );
    assertVueCompiles(source, 'elements');

    const output = await extract(source, 'elements');

    expect(output.errors).toEqual([]);
    expect(richSources(output.results)).toEqual([
      [
        'Hello\u00a0',
        {
          t: 'Suspense',
          i: 1,
          c: {
            t: 'Card',
            i: 2,
            d: { ti: 'Heading' },
            c: 'Custom & deep',
          },
        },
        {
          t: 'Transition',
          i: 3,
          c: { t: 'p', i: 4, c: 'Motion' },
        },
        { t: 'img', i: 5, d: { alt: 'Portrait' } },
        { t: 'br', i: 6 },
      ],
    ]);
  });

  it('preserves empty translations and empty named branches', async () => {
    const source = createSfc(
      `import { Branch, T } from 'gt-vue';`,
      `<T></T><T><Branch branch="formal"><template #formal></template><template #casual>Casual</template></Branch></T>`
    );
    assertVueCompiles(source, 'empty-content');

    const output = await extract(source, 'empty-content');

    expect(output.errors).toEqual([]);
    expect(richSources(output.results)).toEqual([
      [],
      {
        t: 'Branch',
        i: 1,
        d: { b: { formal: [], casual: 'Casual' }, t: 'b' },
      },
    ]);
  });

  it('continues to reject value props on Var', async () => {
    const source = createSfc(
      `import { T, Var } from 'gt-vue'; const name = 'Ada';`,
      `<T><Var :value="name">{{ name }}</Var></T>`
    );
    assertVueCompiles(source, 'var-value');

    const output = await extract(source, 'var-value');

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain('unsupported value prop');
  });

  it('diagnoses special global interpolations instead of hashing them incorrectly', async () => {
    const source = createSfc(
      `import { T } from 'gt-vue';`,
      `<T>{{ undefined }}{{ NaN }}{{ Infinity }}</T>`
    );
    assertVueCompiles(source, 'special-globals');

    const output = await extract(source, 'special-globals');

    expect(output.results).toEqual([]);
    expect(output.errors).toHaveLength(3);
    expect(
      output.errors.every((error) => error.includes('dynamic template content'))
    ).toBe(true);
  });
});

describe('React CLI parity audit: string calls', () => {
  it('handles encoded nesting, decode exclusions, arrays, and Unicode', async () => {
    const source = createSfc(
      `
        import { msg, useMessages } from 'gt-vue';
        const m = useMessages();
        const raw = 'Raw identifier';
        const encoded = msg('Encoded', { $context: 'encoded' });
        m(raw);
        m(encoded);
        m(msg('Nested', { $context: 'nested' }));
        msg.decode(encoded);
        msg['decode'](encoded);
        msg(['First', \`Second\`], { $context: 'list' });
        msg([]);
        msg(['Only']);
        msg('こんにちは\\n世界', { $context: 'unicode' });
      `,
      `<div />`
    );
    assertVueCompiles(source, 'string-parity');

    const output = await extract(source, 'string-parity');

    expect(output.errors).toEqual([]);
    expect(
      output.results.map((result) => ({
        source: result.source,
        context: result.metadata.context,
      }))
    ).toEqual([
      { source: 'Encoded', context: 'encoded' },
      { source: 'Raw identifier', context: undefined },
      { source: 'Nested', context: 'nested' },
      { source: 'First', context: 'list' },
      { source: 'Second', context: 'list' },
      { source: 'Only', context: undefined },
      { source: 'こんにちは\n世界', context: 'unicode' },
    ]);
  });
});

describe('Vue catalog safety', () => {
  it.each([
    {
      name: 'unclosed translation element',
      source: `<script setup>import { msg, T } from 'gt-vue'; msg('Script');</script><template><T>Broken`,
    },
    {
      name: 'invalid closing element',
      source: `<script setup>import { msg, T } from 'gt-vue'; msg('Script');</script><template><T>First</T></Wrong></template>`,
    },
    {
      name: 'duplicate template blocks',
      source: `<script setup>import { msg, T } from 'gt-vue'; msg('Script');</script><template><T>First</T></template><template><T>Second</T></template>`,
    },
  ])('emits no partial catalog for $name', async ({ name, source }) => {
    const output = await extract(source, `malformed-${slug(name)}`);

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'Could not parse a gt-vue single-file component'
    );
  });

  it.each([
    {
      name: 'malformed normal script with valid setup',
      source: `<script>import { msg } from 'gt-vue'; msg(</script><script setup>import { T } from 'gt-vue';</script><template><T>Template</T></template>`,
      diagnostic: 'Could not parse a gt-vue script block',
    },
    {
      name: 'valid normal script with malformed setup',
      source: `<script>import { msg } from 'gt-vue'; msg('Normal');</script><script setup>import { T } from 'gt-vue'; const broken = ;</script><template><T>Template</T></template>`,
      diagnostic: 'Could not parse a gt-vue script block',
    },
    {
      name: 'external script block',
      source: `<script src="./logic.ts"></script><template><div /></template>`,
      diagnostic: 'externally sourced Vue script block',
    },
    {
      name: 'unsupported script language',
      source: `<script lang="coffee">msg 'Script'</script><template><div /></template>`,
      diagnostic: 'unsupported Vue script language "coffee"',
    },
    {
      name: 'external template block',
      source: `<script setup>import { msg } from 'gt-vue'; msg('Script');</script><template src="./view.html"></template>`,
      diagnostic: 'externally sourced Vue template',
    },
    {
      name: 'unsupported template language',
      source: `<script setup>import { msg } from 'gt-vue'; msg('Script');</script><template lang="pug">p Template</template>`,
      diagnostic: 'unsupported Vue template language "pug"',
    },
  ])('fails closed for $name', async ({ diagnostic, name, source }) => {
    const output = await extract(source, `unsupported-${slug(name)}`);

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(diagnostic);
  });

  it('keeps valid entries alongside a per-entry semantic diagnostic', async () => {
    const source = createSfc(
      `
        import { msg, T } from 'gt-vue';
        const runtime = String(Date.now());
        msg('Script valid');
      `,
      `<T>Template valid</T><T>{{ runtime }}</T>`
    );
    assertVueCompiles(source, 'semantic-partial');

    const output = await extract(source, 'semantic-partial');

    expect(output.results.map((result) => result.source)).toEqual([
      'Script valid',
      'Template valid',
    ]);
    expect(output.errors).toHaveLength(1);
    expect(output.errors[0]).toContain('dynamic template content');
  });
});

function createSfc(script: string, template: string): string {
  return `<script setup lang="ts">${script}</script><template>${template}</template>`;
}

function extract(source: string, name: string) {
  return extractFromVueSource(source, `/project/src/${name}.vue`, {
    projectRoot: '/project',
  });
}

function richSources(
  results: Awaited<ReturnType<typeof extractFromVueSource>>['results']
): JsxChildren[] {
  return results
    .filter((result) => result.dataFormat === 'JSX')
    .map((result) => result.source);
}

function assertVueCompiles(source: string, name: string): void {
  const filename = `/project/src/${name}.vue`;
  const parsed = parse(source, { filename });
  expect(parsed.errors, `${name}: SFC parse`).toEqual([]);
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
  expect(compiled.errors, `${name}: template compile`).toEqual([]);
}

function slug(value: string): string {
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-');
}
