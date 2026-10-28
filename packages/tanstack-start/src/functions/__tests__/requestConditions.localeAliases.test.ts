import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeI18nConfig } from '@generaltranslation/react-core/pure';
import { getRequest, setCookie } from '@tanstack/react-start/server';
import { AsyncLocalConditionStore } from '../../condition-store/AsyncLocalConditionStore';

vi.mock('@tanstack/react-start/server', () => ({
  getRequest: vi.fn(),
  setCookie: vi.fn(),
}));

const config = {
  defaultLocale: 'en-us',
  locales: ['en-us', 'en-gb'],
  customMapping: {
    'en-us': { code: 'en-US' },
    'en-gb': { code: 'en-GB' },
  },
  localeRouting: true,
};

function readLocale(store: AsyncLocalConditionStore, request: Request) {
  vi.mocked(getRequest).mockReturnValueOnce(request);
  return store.getLocale();
}

describe('request locale aliases', () => {
  beforeEach(() => {
    Reflect.deleteProperty(globalThis, '__generaltranslation');
    initializeI18nConfig(config);
    vi.clearAllMocks();
  });
  afterEach(() => {
    Reflect.deleteProperty(globalThis, '__generaltranslation');
  });

  it.each([
    { path: '/', headers: { cookie: 'generaltranslation.locale=en-GB' } },
    { path: '/', headers: { cookie: 'generaltranslation.locale=en-gb' } },
    { path: '/', headers: { 'accept-language': 'en-GB' } },
    {
      path: '/en-gb/docs',
      headers: { cookie: 'generaltranslation.locale=en-US' },
    },
  ])(
    'exposes and writes the alias for $path with $headers',
    ({ path, headers }) => {
      const store = new AsyncLocalConditionStore(config);
      const request = new Request(`https://example.com${path}`, {
        headers: headers as Record<string, string>,
      });

      expect(readLocale(store, request)).toBe('en-gb');
      expect(setCookie).toHaveBeenCalledWith(
        'generaltranslation.locale',
        'en-gb',
        expect.any(Object)
      );
    }
  );

  it('aliases the default locale when no candidate is supported', () => {
    const store = new AsyncLocalConditionStore(config);
    const request = new Request('https://example.com', {
      headers: { 'accept-language': 'ja' },
    });

    expect(readLocale(store, request)).toBe('en-us');
  });

  it('resolves against the initialized config, which includes the default locale', () => {
    Reflect.deleteProperty(globalThis, '__generaltranslation');
    const defaultOutsideLocales = { defaultLocale: 'en', locales: ['fr'] };
    initializeI18nConfig(defaultOutsideLocales);
    const store = new AsyncLocalConditionStore(defaultOutsideLocales);
    const request = new Request('https://example.com', {
      headers: { 'accept-language': 'en, fr' },
    });

    expect(readLocale(store, request)).toBe('en');
  });

  it('preserves canonical codes without a mapping', () => {
    Reflect.deleteProperty(globalThis, '__generaltranslation');
    const unmappedConfig = {
      defaultLocale: 'en-US',
      locales: ['en-US', 'en-GB'],
    };
    initializeI18nConfig(unmappedConfig);
    const store = new AsyncLocalConditionStore(unmappedConfig);
    const request = new Request('https://example.com', {
      headers: { 'accept-language': 'en-GB' },
    });

    expect(readLocale(store, request)).toBe('en-GB');
  });
});
