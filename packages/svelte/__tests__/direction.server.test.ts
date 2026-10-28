import { render } from 'svelte/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { getLocaleDirection, loadTranslations } from '../src/runtime/config';
import Direction from './fixtures/Direction.svelte';
import Harness from './fixtures/Harness.svelte';
import { setupGT, withoutComments } from './helpers';

/** The `dir` and text of an element in the server render. */
function shown(body: string, className: string) {
  const match = new RegExp(
    `<p class="${className}"[^>]*dir="(\\w+)"[^>]*>([^<]*)</p>`
  ).exec(withoutComments(body));
  return match && { dir: match[1], text: match[2] };
}

describe('getLocaleDirection', () => {
  beforeEach(() => setupGT());

  it.each(['ar', 'he', 'fa', 'ur', 'ar-EG', 'he-IL', 'fa-IR'])(
    '%s is right-to-left',
    (locale) => {
      expect(getLocaleDirection(locale)).toBe('rtl');
    }
  );

  it.each(['en', 'en-US', 'fr', 'fr-CA', 'de'])(
    '%s is left-to-right',
    (locale) => {
      expect(getLocaleDirection(locale)).toBe('ltr');
    }
  );

  it('sets <html lang dir> in a hooks.server.ts page transform', () => {
    // The README's transformPageChunk, for a request whose cookie is "he".
    const locale = 'he';
    const html = '<html lang="%lang%" dir="%dir%">'
      .replace('%lang%', locale)
      .replace('%dir%', getLocaleDirection(locale));
    expect(html).toBe('<html lang="he" dir="rtl">');
  });
});

describe('useLocaleDirection server rendering', () => {
  beforeEach(() => setupGT());

  it.each([
    ['ar', 'rtl'],
    ['he', 'rtl'],
    ['fa', 'rtl'],
    ['fr', 'ltr'],
  ])('renders %s as %s', async (locale, dir) => {
    const gt = await loadTranslations(locale);
    const { body } = render(Harness, {
      props: { component: Direction, ...gt } as never,
    });
    expect(shown(body, 'active')).toEqual({ dir, text: dir });
  });

  it('renders the default locale as ltr', () => {
    const { body } = render(Harness, {
      props: { component: Direction, locale: 'en' } as never,
    });
    expect(shown(body, 'active')).toEqual({ dir: 'ltr', text: 'ltr' });
  });

  it('renders the direction of an explicit locale', async () => {
    const gt = await loadTranslations('fr');
    const { body } = render(Harness, {
      props: { component: Direction, ...gt } as never,
    });
    expect(shown(body, 'fixed')).toEqual({ dir: 'rtl', text: 'rtl' });
  });

  it('renders the default locale direction without a provider', () => {
    const { body } = render(Direction);
    expect(shown(body, 'active')).toEqual({ dir: 'ltr', text: 'ltr' });
  });
});
