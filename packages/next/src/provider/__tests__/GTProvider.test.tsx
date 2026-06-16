import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetDictionary,
  mockGetDictionaryEntry,
  mockGetI18nConfig,
  mockGetEnableI18n,
  mockGetLocale,
  mockGetRegion,
  mockLoadTranslations,
  mockGetLocaleDictionary,
  mockMergeDictionaries,
  mockClientGTProvider,
} = vi.hoisted(() => ({
  mockGetDictionary: vi.fn(),
  mockGetDictionaryEntry: vi.fn(),
  mockGetI18nConfig: vi.fn(),
  mockGetEnableI18n: vi.fn(),
  mockGetLocale: vi.fn(),
  mockGetRegion: vi.fn(),
  mockLoadTranslations: vi.fn(),
  mockGetLocaleDictionary: vi.fn(),
  mockMergeDictionaries: vi.fn(),
  mockClientGTProvider: vi.fn(),
}));

vi.mock('gt-i18n/internal', () => ({
  getI18nConfig: mockGetI18nConfig,
}));

vi.mock('../../config-dir/DictionaryManager', () => ({
  dictionaryManager: {
    getDictionary: mockGetLocaleDictionary,
  },
}));

vi.mock('../../dictionary/getDictionary', () => ({
  getDictionary: mockGetDictionary,
  getDictionaryEntry: mockGetDictionaryEntry,
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
    loadTranslations: mockLoadTranslations,
  }),
}));

vi.mock('../../utils/client-boundary', () => ({
  Client_GTProvider: mockClientGTProvider,
}));

vi.mock('gt-react/internal', () => ({
  mergeDictionaries: mockMergeDictionaries,
}));

describe('GTProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLocale.mockResolvedValue('fr');
    mockGetEnableI18n.mockResolvedValue(true);
    mockGetRegion.mockResolvedValue(undefined);
    mockGetDictionary.mockResolvedValue({
      greeting: 'Hello',
    });
    mockGetDictionaryEntry.mockReturnValue({
      title: 'Title',
    });
    mockMergeDictionaries.mockReturnValue({
      greeting: 'Bonjour',
    });
    mockLoadTranslations.mockResolvedValue({
      hash: 'Salut',
    });
    mockGetLocaleDictionary.mockResolvedValue({
      greeting: 'Bonjour',
    });
    mockGetI18nConfig.mockReturnValue({
      requiresTranslation: vi.fn().mockReturnValue(true),
    });
  });

  it('passes locale-scoped snapshots to gt-react/context GTProvider', async () => {
    const { GTProvider } = await import('../GTProvider');

    const element = await GTProvider({ children: 'content' });

    expect(mockGetLocale).toHaveBeenCalled();
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
    mockGetLocaleDictionary.mockResolvedValue({});
    mockGetI18nConfig.mockReturnValue(config);
    mockGetLocale.mockResolvedValue('en');
    mockGetEnableI18n.mockResolvedValue(false);

    const { GTProvider } = await import('../GTProvider');

    const element = await GTProvider({
      children: 'content',
      id: 'marketing.hero',
    });

    expect(mockGetLocale).toHaveBeenCalled();
    expect(mockGetDictionaryEntry).toHaveBeenCalledWith('marketing.hero');
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
        translations: {
          en: {},
        },
      },
    });
  });
});
