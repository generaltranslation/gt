import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetI18nConfig,
  mockGetEnableI18n,
  mockGetLocale,
  mockGetRegion,
  mockLoadDictionaries,
  mockLoadTranslations,
  mockClientGTProvider,
} = vi.hoisted(() => ({
  mockGetI18nConfig: vi.fn(),
  mockGetEnableI18n: vi.fn(),
  mockGetLocale: vi.fn(),
  mockGetRegion: vi.fn(),
  mockLoadDictionaries: vi.fn(),
  mockLoadTranslations: vi.fn(),
  mockClientGTProvider: vi.fn(),
}));

vi.mock('gt-i18n/internal', () => ({
  getI18nConfig: mockGetI18nConfig,
}));

vi.mock('../../request/getLocale', () => ({
  getLocale: mockGetLocale,
}));

vi.mock('../../request/getEnableI18n', () => ({
  getEnableI18n: mockGetEnableI18n,
}));

vi.mock('../../request/getRegion', () => ({
  getRegion: mockGetRegion,
}));

vi.mock('../../i18n-cache/NextI18nCache', () => ({
  getNextI18nCache: () => ({
    loadDictionaries: mockLoadDictionaries,
    loadTranslations: mockLoadTranslations,
  }),
}));

vi.mock('../../utils/client-boundary', () => ({
  Client_GTProvider: mockClientGTProvider,
}));

describe('GTProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLocale.mockResolvedValue('fr');
    mockGetRegion.mockResolvedValue(undefined);
    mockGetEnableI18n.mockResolvedValue(true);
    mockLoadTranslations.mockResolvedValue({
      hash: 'Salut',
    });
    mockLoadDictionaries.mockResolvedValue({
      fr: {
        greeting: 'Bonjour',
      },
    });
    mockGetI18nConfig.mockReturnValue({
      requiresTranslation: vi.fn().mockReturnValue(true),
    });
  });

  it('passes locale-scoped snapshots to gt-react GTProvider', async () => {
    const { GTProvider } = await import('../GTProvider');

    const element = await GTProvider({ children: 'content' });

    expect(mockGetLocale).toHaveBeenCalled();
    expect(mockGetRegion).toHaveBeenCalled();
    expect(mockLoadDictionaries).toHaveBeenCalledWith('fr', undefined);
    expect(React.isValidElement(element)).toBe(true);
    expect(element).toMatchObject({
      type: mockClientGTProvider,
      props: {
        children: 'content',
        dictionaries: {
          fr: {
            greeting: 'Bonjour',
          },
        },
        enableI18n: true,
        locale: 'fr',
        region: undefined,
        translations: {
          fr: {
            hash: 'Salut',
          },
        },
      },
    });
  });

  it('uses the request locale and skips cached translations when translation is not required', async () => {
    const config = {
      requiresTranslation: vi.fn().mockReturnValue(false),
    };
    mockGetI18nConfig.mockReturnValue(config);
    mockGetLocale.mockResolvedValue('en');
    mockGetRegion.mockResolvedValue('US');
    mockGetEnableI18n.mockResolvedValue(false);
    mockLoadDictionaries.mockResolvedValue({
      en: {
        greeting: 'Bonjour',
      },
    });

    const { GTProvider } = await import('../GTProvider');

    const element = await GTProvider({
      children: 'content',
      id: 'marketing.hero',
    });

    expect(mockGetLocale).toHaveBeenCalled();
    expect(mockGetRegion).toHaveBeenCalled();
    expect(mockLoadDictionaries).toHaveBeenCalledWith('en', 'marketing.hero');
    expect(mockLoadTranslations).not.toHaveBeenCalled();
    expect(React.isValidElement(element)).toBe(true);
    expect(element).toMatchObject({
      type: mockClientGTProvider,
      props: {
        dictionaries: {
          en: {
            greeting: 'Bonjour',
          },
        },
        enableI18n: false,
        locale: 'en',
        region: 'US',
        translations: {
          en: {},
        },
      },
    });
  });
});
