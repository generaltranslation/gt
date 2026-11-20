import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyzeSvelteSource } from '@generaltranslation/svelte-extractor';
import { parse } from 'svelte/compiler';
import { render } from 'svelte/server';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Content, JsxElement } from '@generaltranslation/format';
import BarePlural from './fixtures/BarePlural.svelte';
import ExactPluralBranch from './fixtures/ExactPluralBranch.svelte';
import Harness from './fixtures/Harness.svelte';
import NestedPluralForms from './fixtures/NestedPluralForms.svelte';
import PluralCount from './fixtures/PluralCount.svelte';
import PluralN from './fixtures/PluralN.svelte';
import PluralNChild from './fixtures/PluralNChild.svelte';
import { initializeGT } from '../src/runtime/config';
import { setupGT, withoutComments } from './helpers';

const analyze = (fixture: string) =>
  analyzeSvelteSource(
    readFileSync(join(process.cwd(), '__tests__/fixtures', fixture), 'utf8'),
    { parse }
  ).translations[0];

const { hash, source } = analyze('NestedPluralForms.svelte');

/** Rendered body with Svelte's hydration comments removed. */
function html(props: Record<string, unknown>): string {
  return withoutComments(
    render(Harness, { props: props as never }).body
  ).trim();
}

describe('plural forms a translation leaves out', () => {
  beforeEach(() => setupGT());

  it('render a translated form with its same-named source form', () => {
    // Keep only "other": its nested plural uses snippets, unlike the one
    // in the source "one" form, which uses string forms.
    const plural = source as JsxElement;
    const branches = plural.d!.b as Record<string, Content>;
    const translation = {
      ...plural,
      d: { ...plural.d, b: { other: branches.other } },
    } as Content;
    expect(
      html({
        component: NestedPluralForms,
        props: { n: 1, m: 1 },
        locale: 'fr',
        translations: { [hash]: translation },
      })
    ).toBe('<p>Many <b>x</b></p>');
  });

  it('render a translated form the source lacks with the source other form', () => {
    // French has no =0 form and counts 0 as "one", which the source lacks.
    const exact = analyze('ExactPluralBranch.svelte');
    const plural = exact.source as JsxElement;
    const { other } = plural.d!.b as Record<string, Content>;
    const translation = {
      ...plural,
      d: { ...plural.d, b: { one: other, other } },
    } as Content;
    expect(
      html({
        component: ExactPluralBranch,
        props: { n: 0 },
        locale: 'fr',
        translations: { [exact.hash]: translation },
      })
    ).toBe('<p><b>Items</b></p>');
  });

  it('render a count the source form does not show', () => {
    // French counts 0 as "one", so its form shows the count, which the
    // source "one" form leaves out. That form has a size under another id.
    const sized = analyze('PluralCount.svelte');
    const plural = sized.source as JsxElement;
    const branches = plural.d!.b as Record<string, Content>;
    const count = { i: 3, v: '#' };
    const render = (n: number, forms: Record<string, unknown>) =>
      html({
        component: PluralCount,
        props: { count: n, size: 100 },
        locale: 'fr',
        translations: {
          [sized.hash]: {
            ...plural,
            d: { ...plural.d, b: { ...branches, ...forms } },
          } as Content,
        },
      });

    expect(render(0, { one: [count, ' fichier'] })).toBe('<p>0 fichier</p>');
    expect(
      render(0, {
        one: {
          ...(branches.one as JsxElement),
          c: [count, ' fichier, ', { i: 3, v: 'n' }, ' Mo'],
        },
      })
    ).toBe('<p>0 fichier, 100 Mo</p>');
    expect(
      render(5, { other: [{ t: 'b', i: 2, c: count }, ' fichiers'] })
    ).toBe('<p><b>5</b> fichiers</p>');
  });
});

describe('<N>, the count of its <Plural>', () => {
  beforeEach(() => setupGT());

  const [files, inner] = analyzeSvelteSource(
    readFileSync(
      join(process.cwd(), '__tests__/fixtures', 'PluralN.svelte'),
      'utf8'
    ),
    { parse }
  ).translations;
  const render = (props: object, translations?: Record<string, unknown>) =>
    html({
      component: PluralN,
      props,
      ...(translations && { locale: 'fr', translations }),
    });

  it('is the same source and hash as in gt-react and gt-vue', () => {
    expect(files.source).toEqual({
      t: 'Plural',
      i: 1,
      d: {
        b: {
          one: 'One file',
          other: [{ t: 'b', i: 2, c: { i: 3, v: '#' } }, ' files'],
        },
        t: 'p',
      },
    });
    expect(files.hash).toBe('754c50698a0e7d3a');
  });

  it('renders the count in the source, inside and outside <T>', () => {
    expect(render({ count: 1234 })).toBe('<p><b>1,234</b> files</p>');
    expect(render({ count: 1 })).toBe('<p>One file</p>');
    expect(render({ count: 1234, wrap: 'none' })).toBe(
      '<p><b>1,234</b> files</p>'
    );
  });

  it('renders the count where a translation puts it', () => {
    // French counts 0 as "one", so it shows the count there.
    const count = { i: 3, v: '#' };
    const plural = files.source as JsxElement;
    const translations = {
      [files.hash]: {
        ...plural,
        d: {
          ...plural.d,
          b: {
            one: [count, ' fichier'],
            other: [{ t: 'b', i: 2, c: count }, ' fichiers'],
          },
        },
      },
    };

    expect(render({ count: 0 }, translations)).toBe('<p>0 fichier</p>');
    expect(render({ count: 5 }, translations)).toBe('<p><b>5</b> fichiers</p>');
  });

  it('renders the count through another component, in source and translation', () => {
    const child = analyze('PluralNChild.svelte');
    const plural = child.source as JsxElement;
    const { other } = plural.d!.b as Record<string, Content>;
    const props = { component: PluralNChild, props: { count: 1234 } };

    expect(html(props)).toBe('<p>1,234 files</p>');
    expect(
      html({
        ...props,
        locale: 'fr',
        translations: {
          [child.hash]: { ...plural, d: { ...plural.d, b: { other } } },
        },
      })
    ).toBe('<p>1\u202f234 files</p>');
  });

  it('renders the count in the translation of a <T> inside its <Plural>', () => {
    expect(
      render(
        { count: 5, wrap: 'outside' },
        { [inner.hash]: [{ i: 1, v: '#' }, ' fichiers'] }
      )
    ).toBe('<p>5 fichiers</p>');
  });
});

describe('a <Plural> outside <T>', () => {
  it('selects its form in the active locale alone', () => {
    delete (globalThis as { __generaltranslation?: unknown })
      .__generaltranslation;
    initializeGT({
      defaultLocale: 'fr',
      locales: ['fr', 'co'],
      loadTranslations: async () => ({}),
    });
    // Intl has no plural rules for Corsican, so it selects in the host's
    // locale. Zero is "one" in French, the default locale, which is not
    // tried.
    const form = new Intl.PluralRules('co').select(0);
    expect(
      html({
        component: BarePlural,
        props: { n: 0 },
        locale: 'co',
        // Without translations the provider renders the default locale.
        translations: {},
      })
    ).toBe(form === 'one' ? 'one item' : 'many items');
  });
});
