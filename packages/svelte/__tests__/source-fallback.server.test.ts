import { render } from 'svelte/server';
import { beforeEach, describe, expect, it } from 'vitest';
import Harness from './fixtures/Harness.svelte';
import SourceFallback from './fixtures/SourceFallback.svelte';
import { hashesOf, setupGT, withoutComments } from './helpers';

const [pluralHash, numHash, ordinalHash] = hashesOf('SourceFallback.svelte');

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

  it('picks an ordinal plural branch in the source and in a translation', () => {
    const second = (translations: Record<string, unknown>) =>
      html({
        component: SourceFallback,
        props: { n: 2 },
        locale: 'fr',
        translations,
      });
    expect(second({})).toContain('<p class="ordinal">second</p>');
    // French has no ordinal "two": 2 is "other".
    expect(
      second({
        [ordinalHash]: {
          t: 'Plural',
          i: 1,
          d: { t: 'o', b: { one: 'premier', other: 'suivant' } },
        },
      })
    ).toContain('<p class="ordinal">suivant</p>');
  });

  it('formats variables in the default locale without a translation', () => {
    expect(
      html({ component: SourceFallback, locale: 'fr', translations: {} })
    ).toContain('<p class="num">Total: 1,234.5</p>');
  });

  it('formats translated variables in the active locale', () => {
    const translated = html({
      component: SourceFallback,
      locale: 'fr',
      translations: {
        [numHash]: ['Total : ', { i: 1, k: '_gt_n_1', v: 'n' }],
      },
    });
    expect(translated).toMatch(/<p class="num">Total : 1\s234,5<\/p>/u);
  });
});
