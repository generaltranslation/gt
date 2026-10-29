import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetLocale, mockLoadDictionaries, mockClientGTDictionaryProvider } =
  vi.hoisted(() => ({
    mockGetLocale: vi.fn(),
    mockLoadDictionaries: vi.fn(),
    mockClientGTDictionaryProvider: vi.fn(),
  }));

vi.mock('../../request/getLocale', () => ({
  getLocale: mockGetLocale,
}));

vi.mock('../dictionaries', () => ({
  loadDictionaries: mockLoadDictionaries,
}));

vi.mock('../client-boundary', () => ({
  Client_GTDictionaryProvider: mockClientGTDictionaryProvider,
}));

describe('GTDictionaryProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('streams the dictionaries for the request locale to the client boundary', async () => {
    const dictionaries = {
      fr: { greeting: 'Bonjour' },
      en: { greeting: 'Hello' },
    };
    mockGetLocale.mockResolvedValue('fr');
    mockLoadDictionaries.mockResolvedValue(dictionaries);
    const { GTDictionaryProvider } = await import('../GTDictionaryProvider');

    const element = await GTDictionaryProvider({ children: 'content' });

    expect(mockLoadDictionaries).toHaveBeenCalledWith('fr');
    expect(React.isValidElement(element)).toBe(true);
    expect(element).toMatchObject({
      type: mockClientGTDictionaryProvider,
      props: { dictionaries, children: 'content' },
    });
  });

  it('throws a diagnostic outside React Server Components', async () => {
    const { GTDictionaryProvider } =
      await import('../clientGTDictionaryProvider');

    expect(() => GTDictionaryProvider({ children: 'content' })).toThrow(
      /GTDictionaryProvider can only be rendered from a server component[\s\S]*'gt-next\/compat'/
    );
  });
});
