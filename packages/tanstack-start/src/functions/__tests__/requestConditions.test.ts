import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeI18nConfig } from '@generaltranslation/react-core/pure';
import { setCookie } from '@tanstack/react-start/server';
import {
  localeCookieOptions,
  resolveRequestConditions,
} from '../requestConditions';

vi.mock('@tanstack/react-start/server', () => ({
  setCookie: vi.fn(),
}));

const config = {
  defaultLocale: 'en',
  locales: ['en', 'es', 'fr'],
  localeRouting: true,
};

function resolve(path: string, headers: Record<string, string>) {
  return resolveRequestConditions(
    new Request(`https://example.com${path}`, { headers }),
    config
  ).locale;
}

describe.sequential('resolveRequestConditions locale cookie', () => {
  beforeEach(() => {
    Reflect.deleteProperty(globalThis, '__generaltranslation');
    initializeI18nConfig(config);
    vi.clearAllMocks();
  });

  it.each([
    { cookie: 'es', acceptLanguage: 'es' },
    { cookie: 'fr', acceptLanguage: 'es' },
  ])(
    'does not set a $cookie cookie that matches the resolved locale',
    ({ cookie, acceptLanguage }) => {
      expect(
        resolve('/', {
          cookie: `generaltranslation.locale=${cookie}`,
          'accept-language': acceptLanguage,
        })
      ).toBe(cookie);
      expect(setCookie).not.toHaveBeenCalled();
    }
  );

  it.each([
    {
      name: 'missing',
      path: '/',
      headers: { 'accept-language': 'es' },
      locale: 'es',
    },
    {
      name: 'different from the path locale',
      path: '/es/docs',
      headers: { cookie: 'generaltranslation.locale=fr' },
      locale: 'es',
    },
    {
      name: 'unsupported',
      path: '/',
      headers: {
        cookie: 'generaltranslation.locale=ja',
        'accept-language': 'es',
      },
      locale: 'es',
    },
  ])('sets the cookie when it is $name', ({ path, headers, locale }) => {
    expect(resolve(path, headers)).toBe(locale);
    expect(setCookie).toHaveBeenCalledExactlyOnceWith(
      'generaltranslation.locale',
      locale,
      localeCookieOptions
    );
  });
});
