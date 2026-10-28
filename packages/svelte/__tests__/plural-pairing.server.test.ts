import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyzeSvelteSource } from '@generaltranslation/svelte-extractor';
import { parse } from 'svelte/compiler';
import { render } from 'svelte/server';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Content, JsxElement } from '@generaltranslation/format/types';
import Harness from './fixtures/Harness.svelte';
import NestedPluralForms from './fixtures/NestedPluralForms.svelte';
import { setupGT, withoutComments } from './helpers';

const [{ hash, source }] = analyzeSvelteSource(
  readFileSync(
    join(process.cwd(), '__tests__/fixtures/NestedPluralForms.svelte'),
    'utf8'
  ),
  { parse }
).translations;

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
});
