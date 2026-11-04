import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  afterEach(() => vi.unstubAllEnvs());
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
      isDevHotReloadEnabled: vi.fn().mockReturnValue(false),
    });
  });

  it('passes locale-scoped snapshots to gt-react GTProvider', async () => {
    const { GTProvider } = await import('../GTProvider');

    const element = await GTProvider({ children: 'content' });

    expect(mockGetLocale).toHaveBeenCalled();
    expect(mockGetRegion).toHaveBeenCalled();
    expect(mockLoadDictionaries).toHaveBeenCalledWith('fr');
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

  it.each([
    ['true', true],
    ['false', false],
    [undefined, false],
  ])(
    'passes build-time locale refresh support %s as boolean %s',
    async (value, expected) => {
      vi.stubEnv(
        '_GENERALTRANSLATION_LOCALE_REFRESH_SUPPORTED',
        value as string | undefined
      );
      const { GTProvider } = await import('../GTProvider');
      const element = await GTProvider({ children: 'content' });
      expect(element.props.supportsLocaleRefresh).toBe(expected);
    }
  );

  it('uses the request locale and skips cached translations when translation is not required', async () => {
    const config = {
      requiresTranslation: vi.fn().mockReturnValue(false),
      isDevHotReloadEnabled: vi.fn().mockReturnValue(false),
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
    });

    expect(mockGetLocale).toHaveBeenCalled();
    expect(mockGetRegion).toHaveBeenCalled();
    expect(mockLoadDictionaries).toHaveBeenCalledWith('en');
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

  it('passes GT_PROJECT_ID and GT_API_KEY to the client when hot reload is on', async () => {
    vi.stubEnv('GT_PROJECT_ID', 'project-id');
    vi.stubEnv('GT_API_KEY', 'gtx-dev-key');
    vi.stubEnv('NODE_ENV', 'development');
    mockGetI18nConfig.mockReturnValue({
      requiresTranslation: vi.fn().mockReturnValue(true),
      isDevHotReloadEnabled: vi.fn().mockReturnValue(true),
    });
    const { GTProvider } = await import('../GTProvider');

    const element = await GTProvider({ children: 'content' });

    expect(element.props.devCredentials).toEqual({
      projectId: 'project-id',
      devApiKey: 'gtx-dev-key',
    });
  });

  it('never passes a development key when hot reload is off, as in production', async () => {
    vi.stubEnv('GT_PROJECT_ID', 'project-id');
    vi.stubEnv('GT_API_KEY', 'gtx-dev-key');
    vi.stubEnv('NODE_ENV', 'production');
    const { GTProvider } = await import('../GTProvider');

    const element = await GTProvider({ children: 'content' });

    expect(element.props.devCredentials).toBeUndefined();
  });
});
