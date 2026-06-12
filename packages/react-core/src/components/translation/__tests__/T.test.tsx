import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeI18nConfig } from 'gt-i18n/internal';
import { setReactI18nCache } from '../../../i18n-cache/singleton-operations';
import { RscT } from '../T';
import type { ReactI18nCache } from '../../../i18n-cache/ReactI18nCache';

const getLookupTranslation = vi.fn();

function setup() {
  initializeI18nConfig({
    defaultLocale: 'en',
    locales: ['en', 'fr'],
  });
  setReactI18nCache({
    getLookupTranslation,
  } as unknown as ReactI18nCache);
}

describe('RscT', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setup();
  });

  it('loads translations and looks up with the explicit locale', async () => {
    const lookupTranslation = vi.fn(() => 'Bonjour');
    getLookupTranslation.mockResolvedValue(lookupTranslation);

    await expect(
      RscT({ children: 'Hello', _locale: 'fr', _enableI18n: true })
    ).resolves.toBe('Bonjour');

    expect(getLookupTranslation).toHaveBeenCalledWith('fr');
    expect(lookupTranslation).toHaveBeenCalledWith(
      'Hello',
      expect.objectContaining({
        $format: 'JSX',
        $locale: 'fr',
      })
    );
  });

  it('renders source without loading translations for the default locale', async () => {
    await expect(
      RscT({ children: 'Hello', _locale: 'en', _enableI18n: true })
    ).resolves.toBe('Hello');

    expect(getLookupTranslation).not.toHaveBeenCalled();
  });

  it('renders source without loading translations when i18n is disabled', async () => {
    await expect(
      RscT({ children: 'Hello', _locale: 'fr', _enableI18n: false })
    ).resolves.toBe('Hello');

    expect(getLookupTranslation).not.toHaveBeenCalled();
  });
});
