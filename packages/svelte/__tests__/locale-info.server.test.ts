import { render } from 'svelte/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { loadTranslations } from '../src/runtime/config';
import Harness from './fixtures/Harness.svelte';
import LocaleInfo from './fixtures/LocaleInfo.svelte';
import { setupGT, withoutComments } from './helpers';

/** Text of each `<p>` in the server render, by class. */
function shown(props: Record<string, unknown>): Record<string, string> {
  const body = withoutComments(
    render(Harness, {
      props: { component: LocaleInfo, ...props } as never,
    }).body
  );
  return Object.fromEntries(
    [...body.matchAll(/<p class="(\w+)">([^<]*)<\/p>/g)].map(
      ([, className, text]) => [className, text]
    )
  );
}

describe('locale helpers on the server', () => {
  beforeEach(() => setupGT());

  it('render the configured default locale and locales', () => {
    expect(shown({ locale: 'en' })).toMatchObject({
      default: 'en',
      locales: 'en,fr,de,ar,he,fa',
    });
  });

  it('render the active locale properties', async () => {
    expect(shown({ locale: 'en' }).active).toBe('en|English');
    expect(shown(await loadTranslations('fr')).active).toBe('fr|français');
    expect(shown(await loadTranslations('ar')).active).toBe('ar|العربية');
  });

  it('render the properties of an explicit locale', () => {
    expect(shown({ locale: 'en' }).fixed).toBe('fr|français');
  });

  it('render the default locale properties without a provider', () => {
    const body = render(LocaleInfo).body;
    expect(body).toContain('<p class="active">en|English</p>');
  });
});
