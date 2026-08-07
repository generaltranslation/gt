import { hashSource } from 'generaltranslation/id';
import type { JsxChildren } from 'generaltranslation/types';
import { compile, createSSRApp, defineComponent, type Component } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { describe, expect, it } from 'vitest';
import { isBranchAttribute } from '../components/utils';
import { Branch, Plural, T, createGT } from '../index';

describe('Branch and Plural attributes', () => {
  it.each([
    ['formal', 'Welcome'],
    ['count', 12],
    ['large', 12n],
    ['flag', false],
    ['enabled', true],
    ['empty', null],
    ['one', 'Singular'],
  ])('accepts the primitive branch attribute %s', (name, value) => {
    expect(isBranchAttribute(name, value)).toBe(true);
  });

  it.each([
    ['branch', 'formal'],
    ['class', 'secret'],
    ['style', 'color: red'],
    ['style', { color: 'red' }],
    ['n', 2],
    ['locales', 'fr'],
    ['key', 'stable'],
    ['ref', 'component'],
    ['ref-for', true],
    ['ref-key', 'component'],
    ['ref_for', true],
    ['ref_key', 'component'],
    ['onClick', 'not a branch'],
    ['on-click', 'not a branch'],
    ['onVnodeMounted', 'not a branch'],
    ['data-note', 'private'],
    ['aria-label', 'Greeting'],
    ['formal', { label: 'Welcome' }],
    ['formal', ['Welcome']],
    ['formal', () => 'Welcome'],
    ['formal', undefined],
    ['formal', Symbol('Welcome')],
  ])('rejects non-content attribute %s', (name, value) => {
    expect(isBranchAttribute(name, value)).toBe(false);
  });

  it.each([
    [
      'class',
      '<Branch branch="class" class="secret">Class fallback</Branch>',
      'Class fallback',
    ],
    [
      'style',
      '<Branch branch="style" :style="{ color: \'red\' }">Style fallback</Branch>',
      'Style fallback',
    ],
    [
      'listener',
      '<Branch branch="onClick" @click="handler">Listener fallback</Branch>',
      'Listener fallback',
    ],
    [
      'object',
      '<Branch branch="formal" :formal="payload">Object fallback</Branch>',
      'Object fallback',
    ],
    [
      'function',
      '<Branch branch="callback" :callback="handler">Function fallback</Branch>',
      'Function fallback',
    ],
    [
      'data attribute',
      '<Branch branch="data-note" data-note="secret">Data fallback</Branch>',
      'Data fallback',
    ],
    [
      'ARIA attribute',
      '<Branch branch="aria-label" aria-label="secret">ARIA fallback</Branch>',
      'ARIA fallback',
    ],
  ])(
    'does not render a standalone %s value as branch content',
    async (_label, template, fallback) => {
      const html = await renderTemplate(template, () => ({
        handler: () => 'secret listener',
        payload: { label: 'secret object' },
      }));

      expect(html).toContain(fallback);
      expect(html).not.toContain('secret listener');
      expect(html).not.toContain('[object Object]');
    }
  );

  it.each([
    ['string', 'formal', 'formal="Welcome"', 'Welcome'],
    ['number', 'count', ':count="12"', '12'],
    ['bigint', 'large', ':large="12n"', '12'],
  ])(
    'renders a standalone %s branch attribute as text',
    async (_label, branch, attribute, expected) => {
      const html = await renderTemplate(
        `<Branch branch="${branch}" ${attribute}>Fallback</Branch>`
      );

      expect(html).toContain(expected);
      expect(html).not.toContain('Fallback');
    }
  );

  it.each([
    ['false', ':flag="false"'],
    ['true', ':flag="true"'],
    ['null', ':flag="null"'],
  ])(
    'treats a standalone %s attribute as a present empty branch',
    async (label, attribute) => {
      const html = await renderTemplate(
        `<div>before<Branch branch="flag" ${attribute}>Fallback</Branch>after</div>`
      );

      expect(html).toContain('beforeafter');
      expect(html).not.toContain('Fallback');
      expect(html).not.toContain(`>${label}<`);
    }
  );

  it('prefers a named Branch slot over an attribute with the same name', async () => {
    const html = await renderTemplate(
      '<Branch branch="formal" formal="Attribute"><template #formal>Slot</template>Fallback</Branch>'
    );

    expect(html).toContain('Slot');
    expect(html).not.toContain('Attribute');
    expect(html).not.toContain('Fallback');
  });

  it('selects a data-* named slot without treating the matching attribute as content', async () => {
    const html = await renderTemplate(
      '<Branch branch="data-note" data-note="Attribute"><template #data-note>Named slot</template>Fallback</Branch>'
    );

    expect(html).toContain('Named slot');
    expect(html).not.toContain('Attribute');
    expect(html).not.toContain('Fallback');
  });

  it('selects a data-* named slot inside default-locale rich content', async () => {
    const html = await renderTemplate(
      '<T><Branch branch="data-note" data-note="Attribute"><template #data-note>Source named slot</template>Source fallback</Branch></T>'
    );

    expect(html).toContain('Source named slot');
    expect(html).not.toContain('Attribute');
    expect(html).not.toContain('Source fallback');
  });

  it('selects a translated data-* named slot inside rich content', async () => {
    const source: JsxChildren = {
      t: 'Branch',
      i: 1,
      d: { b: { 'data-note': 'Source named slot' }, t: 'b' },
      c: 'Source fallback',
    };
    const target: JsxChildren = {
      t: 'Branch',
      i: 1,
      d: { b: { 'data-note': 'Translated named slot' }, t: 'b' },
      c: 'Translated fallback',
    };
    const plugin = createGT({
      loadTranslations: async () => ({ [jsxHash(source)]: target }),
    });
    await plugin.setLocale('fr');

    const html = await renderTemplate(
      '<T><Branch branch="data-note" data-note="Attribute"><template #data-note>Source named slot</template>Source fallback</Branch></T>',
      undefined,
      plugin
    );

    expect(html).toContain('Translated named slot');
    expect(html).not.toContain('Attribute');
    expect(html).not.toContain('Source named slot');
    expect(html).not.toContain('Translated fallback');
  });

  it('uses the same filtered inputs for a rich Branch hash', async () => {
    const source: JsxChildren = {
      t: 'Branch',
      i: 1,
      d: {
        b: {
          formal: 'Slot source',
          count: '12',
          large: '12',
          flag: [],
          empty: [],
        },
        t: 'b',
      },
      c: 'Fallback',
    };
    const target: JsxChildren = {
      t: 'Branch',
      i: 1,
      d: {
        b: {
          formal: 'Slot traduit',
          count: 'douze',
          large: 'grand',
          flag: [],
          empty: [],
        },
        t: 'b',
      },
      c: 'Repli',
    };
    const plugin = createGT({
      loadTranslations: async () => ({ [jsxHash(source)]: target }),
    });
    await plugin.setLocale('fr');

    const html = await renderTemplate(
      '<T><Branch branch="formal" class="secret" :style="{ color: \'red\' }" @click="handler" formal="Attribute" :count="12" :large="12n" :flag="false" :empty="null" :payload="payload" :callback="handler" data-note="private" aria-label="Greeting"><template #formal>Slot source</template>Fallback</Branch></T>',
      () => ({
        handler: () => 'secret listener',
        payload: { label: 'secret object' },
      }),
      plugin
    );

    expect(html).toContain('Slot traduit');
    expect(html).not.toContain('Slot source');
    expect(html).not.toContain('Attribute');
    expect(html).not.toContain('secret');
    expect(html).not.toContain('[object Object]');
  });

  it('filters standalone Plural attributes and keeps primitive forms', async () => {
    const html = await renderTemplate(
      '<div><Plural :n="1" :one="payload">Object fallback</Plural>|<Plural :n="1" one="One">Fallback</Plural>|<Plural :n="1" :one="1">Fallback</Plural></div>',
      () => ({ payload: { label: 'secret object' } })
    );

    expect(html).toContain('Object fallback|One|1');
    expect(html).not.toContain('[object Object]');
  });

  it.each([
    ['false', ':one="false"'],
    ['null', ':one="null"'],
  ])(
    'treats a standalone Plural %s form as present and empty',
    async (label, attribute) => {
      const html = await renderTemplate(
        `<div>before<Plural :n="1" ${attribute}>Fallback</Plural>after</div>`
      );

      expect(html).toContain('beforeafter');
      expect(html).not.toContain('Fallback');
      expect(html).not.toContain(`>${label}<`);
    }
  );

  it('prefers a named Plural slot over an attribute with the same name', async () => {
    const html = await renderTemplate(
      '<Plural :n="1" one="Attribute"><template #one>Slot</template>Fallback</Plural>'
    );

    expect(html).toContain('Slot');
    expect(html).not.toContain('Attribute');
    expect(html).not.toContain('Fallback');
  });

  it('uses the default plural rules when the default locale is active', async () => {
    const html = await renderTemplate(
      '<Plural :n="0" :locales="[\'fr\']"><template #one>French one</template><template #other>English other</template></Plural>',
      () => ({}),
      createGT({ defaultLocale: 'en' })
    );

    expect(html).toContain('English other');
    expect(html).not.toContain('French one');
  });

  it('uses the active locale plural rules before the default locale', async () => {
    const plugin = createGT({ defaultLocale: 'en' });
    await plugin.setLocale('fr');
    const html = await renderTemplate(
      '<Plural :n="0"><template #one>French one</template><template #other>English other</template></Plural>',
      () => ({}),
      plugin
    );

    expect(html).toContain('French one');
    expect(html).not.toContain('English other');
  });

  it('uses the same filtered inputs for a rich Plural hash', async () => {
    const source: JsxChildren = {
      t: 'Plural',
      i: 1,
      d: { b: { other: 'Other' }, t: 'p' },
      c: 'Fallback',
    };
    const target: JsxChildren = {
      t: 'Plural',
      i: 1,
      d: { b: { other: 'Autres' }, t: 'p' },
      c: 'Repli',
    };
    const plugin = createGT({
      loadTranslations: async () => ({ [jsxHash(source)]: target }),
    });
    await plugin.setLocale('fr');

    const html = await renderTemplate(
      '<T><Plural :n="2" class="secret" :style="{ color: \'red\' }" @click="handler" :one="payload" other="Other" data-note="private" aria-label="Items">Fallback</Plural></T>',
      () => ({
        handler: () => 'secret listener',
        payload: { label: 'secret object' },
      }),
      plugin
    );

    expect(html).toContain('Autres');
    expect(html).not.toContain('Other');
    expect(html).not.toContain('secret');
    expect(html).not.toContain('[object Object]');
  });
});

/** Renders a compiled Vue template through the server renderer. */
async function renderTemplate(
  template: string,
  setup: () => Record<string, unknown> = () => ({}),
  plugin = createGT()
): Promise<string> {
  const Root = defineComponent({
    components: { Branch, Plural, T } satisfies Record<string, Component>,
    render: compile(template),
    setup,
  });
  const app = createSSRApp(Root);
  app.use(plugin);
  return stripFragmentMarkers(await renderToString(app));
}

function jsxHash(source: JsxChildren): string {
  return hashSource({ dataFormat: 'JSX', source });
}

function stripFragmentMarkers(html: string): string {
  return html.replaceAll('<!--[-->', '').replaceAll('<!--]-->', '');
}
