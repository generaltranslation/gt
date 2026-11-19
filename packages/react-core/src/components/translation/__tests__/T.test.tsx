import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { derive } from 'gt-i18n';
import { hashContent, initializeI18nConfig } from 'gt-i18n/internal';
import { setReactI18nCache } from '../../../i18n-cache/singleton-operations';
import { RscT } from '../T.rsc';
import { RscTx } from '../Tx.rsc';
import type { ReactI18nCache } from '../../../i18n-cache/ReactI18nCache';

type TestGlobal = typeof globalThis & {
  __generaltranslation?: unknown;
};

function resetGTGlobals() {
  Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
}

const getLookupTranslation = vi.fn();

const deriveContext = JSON.parse(
  readFileSync(
    new URL(
      '../../../../../../test-fixtures/derive-context.json',
      import.meta.url
    ),
    'utf8'
  )
) as {
  source: string;
  variants: { context: 'formal' | 'casual'; hash: string }[];
};

function setup() {
  initializeI18nConfig({
    defaultLocale: 'en',
    locales: ['en', 'fr'],
  });
  setReactI18nCache({
    getLookupTranslation,
    lookupTranslationWithFallback: async (
      _locale: string,
      ...lookup: Parameters<typeof hashContent>
    ) => hashContent(...lookup),
  } as unknown as ReactI18nCache);
}

describe('RscT', () => {
  beforeEach(() => {
    resetGTGlobals();
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

  // The lookups return the catalog key in place of a translation.
  it.each(deriveContext.variants)(
    'looks up context={derive($context)} by the hash the CLI extracts',
    async ({ context, hash }) => {
      getLookupTranslation.mockResolvedValue(hashContent);
      const props = {
        children: deriveContext.source,
        context: derive(context),
        _locale: 'fr',
        _enableI18n: true,
      };

      await expect(RscT(props)).resolves.toBe(hash);
      await expect(RscTx(props)).resolves.toBe(hash);
    }
  );

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
