import { render } from 'svelte/server';
import { beforeEach, describe, expect, it } from 'vitest';
import BarePlural from './fixtures/BarePlural.svelte';
import Harness from './fixtures/Harness.svelte';
import SourceFallback from './fixtures/SourceFallback.svelte';
import { initializeGT } from '../src/runtime/config';
import { hashesOf, setupGT, withoutComments } from './helpers';

const [pluralHash, numHash] = hashesOf('SourceFallback.svelte');

/** Rendered body with Svelte's hydration comments removed. */
function html(props: Record<string, unknown>): string {
  return withoutComments(
    render(Harness, { props: props as never }).body
  ).trim();
}

describe('<T> source content in a translated locale', () => {
  // An empty catalog renders French without a translation for these <T>s.
  beforeEach(() => setupGT());

  it('uses the default locale plural rules without a translation', () => {
    // French counts 0 as "one"; English, the source locale, as "other".
    expect(
      html({
        component: SourceFallback,
        props: { n: 0 },
        locale: 'fr',
        translations: {},
      })
    ).toContain('<p class="plural">many items</p>');
  });

  it('picks an exact plural branch in the source and in a translation', () => {
    const pair = (translations: Record<string, unknown>) =>
      html({
        component: SourceFallback,
        props: { n: 2 },
        locale: 'fr',
        translations,
      });
    expect(pair({})).toContain('<p class="plural">a pair</p>');
    expect(
      pair({
        [pluralHash]: {
          t: 'Plural',
          i: 1,
          d: { t: 'p', b: { '=2': 'une paire', other: 'plusieurs' } },
        },
      })
    ).toContain('<p class="plural">une paire</p>');
  });

  it('formats variables in the default locale without a translation', () => {
    expect(
      html({ component: SourceFallback, locale: 'fr', translations: {} })
    ).toContain('<p class="num">Total: 1,234.5</p>');
  });

  it('formats variables in a locale of the default language without a translation', () => {
    // Mexican Spanish reads Spanish source as it is, with its own separators.
    initializeGT({
      defaultLocale: 'es',
      locales: ['es', 'es-MX'],
      loadTranslations: async () => ({}),
    });
    const body = html({
      component: SourceFallback,
      locale: 'es-MX',
      translations: {},
    });
    expect(body).toContain('<p class="num">Total: 1,234.5</p>');
    expect(body).toContain('<p class="str">Total: 1,234.5</p>');
  });

  it('selects a plural in the code of a locale alias Intl cannot read', () => {
    initializeGT({
      defaultLocale: 'en',
      locales: ['en', 'portal_uk', 'portal_fr'],
      customMapping: {
        portal_uk: { code: 'en-GB' },
        portal_fr: { code: 'fr' },
      },
      loadTranslations: async () => ({}),
    });
    const uk = { props: { n: 1 }, locale: 'portal_uk', translations: {} };
    expect(html({ component: SourceFallback, ...uk })).toContain(
      '<p class="plural">one item</p>'
    );
    expect(html({ component: BarePlural, ...uk })).toBe('one item');
    // French counts 0 as "one".
    expect(
      html({
        component: SourceFallback,
        props: { n: 0 },
        locale: 'portal_fr',
        translations: {
          [pluralHash]: {
            t: 'Plural',
            i: 1,
            d: { t: 'p', b: { one: 'un', other: 'plusieurs' } },
          },
        },
      })
    ).toContain('<p class="plural">un</p>');
  });

  it('formats translated variables in the active locale', () => {
    const translated = html({
      component: SourceFallback,
      locale: 'fr',
      translations: {
        [numHash]: ['Total : ', { i: 1, v: 'n' }],
      },
    });
    expect(translated).toMatch(/<p class="num">Total : 1\s234,5<\/p>/u);
  });
});
