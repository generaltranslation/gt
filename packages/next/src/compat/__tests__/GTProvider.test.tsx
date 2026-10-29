import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetGTProviderProps, mockLoadDictionaries, mockClientGTProvider } =
  vi.hoisted(() => ({
    mockGetGTProviderProps: vi.fn(),
    mockLoadDictionaries: vi.fn(),
    mockClientGTProvider: vi.fn(),
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

    expect(mockLoadDictionaries).toHaveBeenCalledWith('fr');
    expect(React.isValidElement(element)).toBe(true);
    expect(element).toMatchObject({
      type: mockClientGTProvider,
      props: { ...providerProps, dictionaries, children: 'content' },
    });
  });
});
