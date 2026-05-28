import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeI18nConfig } from 'gt-i18n/internal';
import { InternalT, ServerT } from '../T';
import { setReactI18nCache } from '../../../i18n-cache/singleton-operations';
import type { ReactI18nCache } from '../../../i18n-cache/ReactI18nCache';
import type { JsxChildren } from 'generaltranslation/types';
import type { LookupOptions } from 'gt-i18n/internal/types';

describe('<T>', () => {
  beforeEach(() => {
    initializeI18nConfig({
      defaultLocale: 'en',
      locales: ['fr', 'es'],
    });
  });

  it('loads and renders server translations with the same explicit locale', async () => {
    const loadTranslations = vi.fn(async () => ({}));
    const lookupTranslation = vi.fn(
      (locale: string, _message: JsxChildren, _options: LookupOptions) =>
        locale === 'fr' ? 'Bonjour' : 'Wrong locale'
    );
    setReactI18nCache(
      createCache({
        loadTranslations,
        lookupTranslation,
      })
    );

    await expect(
      ServerT({
        locale: 'fr',
        children: 'Hello',
      })
    ).resolves.toBe('Bonjour');
    expect(loadTranslations).toHaveBeenCalledWith('fr');
    expect(lookupTranslation).toHaveBeenCalledWith(
      'fr',
      expect.anything(),
      expect.objectContaining({ $locale: 'fr' })
    );
  });

  it('normalizes sugar and dollar-prefixed translation props', () => {
    const lookupTranslation = vi.fn(() => 'Bonjour');
    setReactI18nCache(createCache({ lookupTranslation }));

    expect(
      InternalT({
        locale: 'fr',
        children: 'Hello',
        id: 'welcome',
        context: 'homepage',
        _hash: 'hash-a',
        maxChars: 12,
      })
    ).toBe('Bonjour');

    expect(lookupTranslation).toHaveBeenCalledWith(
      'fr',
      expect.anything(),
      expect.objectContaining({
        $format: 'JSX',
        $locale: 'fr',
        $id: 'welcome',
        $context: 'homepage',
        $_hash: 'hash-a',
        $maxChars: 12,
      })
    );

    lookupTranslation.mockClear();

    expect(
      InternalT({
        locale: 'es',
        children: 'Hello',
        $id: 'welcome-dollar',
        $context: 'homepage-dollar',
        $_hash: 'hash-b',
        $maxChars: 24,
      })
    ).toBe('Bonjour');

    expect(lookupTranslation).toHaveBeenCalledWith(
      'es',
      expect.anything(),
      expect.objectContaining({
        $format: 'JSX',
        $locale: 'es',
        $id: 'welcome-dollar',
        $context: 'homepage-dollar',
        $_hash: 'hash-b',
        $maxChars: 24,
      })
    );
  });
});

function createCache({
  loadTranslations = vi.fn(async () => ({})),
  lookupTranslation = vi.fn(() => undefined),
}: {
  loadTranslations?: ReactI18nCache['loadTranslations'];
  lookupTranslation?: ReactI18nCache['lookupTranslation'];
}): ReactI18nCache {
  return {
    isTranslationEnabled: () => true,
    loadTranslations,
    lookupTranslation,
  } as unknown as ReactI18nCache;
}
