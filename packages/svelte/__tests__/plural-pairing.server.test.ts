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
});

// Zero is "one" in French and "other" in English, so a host with either
// locale fails a row if the form is left to the host's rules.
describe.each([
  ['fr', 'one'],
  ['en', 'other'],
])(
  'a locale Intl has no data for, with the default locale %s',
  (defaultLocale, form) => {
    beforeEach(() => {
      delete (globalThis as { __generaltranslation?: unknown })
        .__generaltranslation;
      initializeGT({
        defaultLocale,
        locales: [defaultLocale, 'qaa'],
        loadTranslations: async () => ({}),
      });
    });

    it('selects the form of a <Plural> outside <T> in the default locale', () => {
      expect(
        html({
          component: BarePlural,
          props: { n: 0 },
          locale: 'qaa',
          translations: {},
        })
      ).toBe(form === 'one' ? 'one item' : 'many items');
    });

    it('selects the form of a translated <Plural> in the default locale', () => {
      const exact = analyze('ExactPluralBranch.svelte');
      const plural = exact.source as JsxElement;
      const translation = {
        ...plural,
        d: { ...plural.d, b: { one: 'one', other: 'other' } },
      } as Content;
      expect(
        html({
          component: ExactPluralBranch,
          props: { n: 0 },
          locale: 'qaa',
          translations: { [exact.hash]: translation },
        })
      ).toBe(`<p>${form}</p>`);
    });
  }
);
