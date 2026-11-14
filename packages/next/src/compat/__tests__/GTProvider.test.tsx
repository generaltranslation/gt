import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetLocale,
  mockGetGTProviderProps,
  mockLoadDictionaries,
  mockClientGTProvider,
} = vi.hoisted(() => ({
  mockGetLocale: vi.fn(),
  mockGetGTProviderProps: vi.fn(),
  mockLoadDictionaries: vi.fn(),
  mockClientGTProvider: vi.fn(),
}));

vi.mock('../../request/getLocale', () => ({
  getLocale: mockGetLocale,
}));

vi.mock('../../provider/GTProvider', () => ({
  getGTProviderProps: mockGetGTProviderProps,
}));

vi.mock('../dictionaries', () => ({
  loadDictionaries: mockLoadDictionaries,
}));

vi.mock('../client-boundary', () => ({
  Client_GTProvider: mockClientGTProvider,
}));

describe('compat GTProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLocale.mockResolvedValue('fr');
  });

  it("streams the request locale's translations and dictionaries to the client boundary", async () => {
    const providerProps = {
      supportsLocaleRefresh: true,
      locale: 'fr',
      region: undefined,
      enableI18n: true,
      translations: { fr: {} },
    };
    const dictionaries = {
      fr: { greeting: 'Bonjour' },
      en: { greeting: 'Hello' },
    };
    mockGetGTProviderProps.mockResolvedValue(providerProps);
    mockLoadDictionaries.mockResolvedValue(dictionaries);
    const { GTProvider } = await import('../GTProvider');

    const element = await GTProvider({ children: 'content' });

    expect(mockGetGTProviderProps).toHaveBeenCalledWith('fr');
    expect(mockLoadDictionaries).toHaveBeenCalledWith('fr');
    expect(React.isValidElement(element)).toBe(true);
    expect(element).toMatchObject({
      type: mockClientGTProvider,
      props: { ...providerProps, dictionaries, children: 'content' },
    });
  });

  it('starts loading dictionaries before translations resolve', async () => {
    let resolveProps!: (props: unknown) => void;
    mockGetGTProviderProps.mockReturnValue(
      new Promise((resolve) => {
        resolveProps = resolve;
      })
    );
    mockLoadDictionaries.mockResolvedValue({});
    const { GTProvider } = await import('../GTProvider');

    const element = GTProvider({ children: 'content' });
    await vi.waitFor(() => expect(mockLoadDictionaries).toHaveBeenCalled());
    resolveProps({ locale: 'fr', translations: { fr: {} } });

    await expect(element).resolves.toMatchObject({
      props: { locale: 'fr', dictionaries: {} },
    });
  });
});
