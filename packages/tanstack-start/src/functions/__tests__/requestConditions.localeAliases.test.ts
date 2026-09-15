import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeI18nConfig } from '@generaltranslation/react-core/pure';
import { setCookie } from '@tanstack/react-start/server';
import { AsyncLocalConditionStore } from '../../condition-store/AsyncLocalConditionStore';

vi.mock('@tanstack/react-start/server', () => ({
  setCookie: vi.fn(),
}));

const config = {
  defaultLocale: 'en-US',
  locales: ['en-US', 'en-GB'],
  customMapping: {
    'en-us': { code: 'en-US' },
    'en-gb': { code: 'en-GB' },
  },
  localeRouting: true,
};

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

      expect(store.run(request, () => store.getLocale())).toBe('en-gb');
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

    expect(store.run(request, () => store.getLocale())).toBe('en-us');
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

    expect(store.run(request, () => store.getLocale())).toBe('en-GB');
  });
});
