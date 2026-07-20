import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSetCookie = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-start', () => ({
  createMiddleware: () => ({
    server: (serverFn: unknown) => serverFn,
  }),
}));

vi.mock('@tanstack/react-start/server', () => ({
  setCookie: (...args: unknown[]) => mockSetCookie(...args),
}));

import { initializeI18nConfig } from '@generaltranslation/react-core/pure';
import { getEnableI18n, getLocale } from '../../functions/server';
import { gtMiddleware } from '../gtMiddleware';

type GlobalWithRegistry = {
  __generaltranslation?: {
    i18n?: Record<string, unknown>;
  };
};

function resetI18nConfigSingleton() {
  const globalObj = globalThis as GlobalWithRegistry;
  if (globalObj.__generaltranslation?.i18n) {
    Reflect.deleteProperty(globalObj.__generaltranslation.i18n, 'i18nConfig');
  }
}

describe('gtMiddleware', () => {
  beforeEach(() => {
    resetI18nConfigSingleton();
    initializeI18nConfig({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
    });
    mockSetCookie.mockReset();
  });

  it('makes request conditions available to downstream server code', async () => {
    const request = new Request('https://example.com', {
      headers: {
        cookie:
          'generaltranslation.locale=fr; generaltranslation.enable-i18n=false',
      },
    });

    const result = await (
      gtMiddleware as unknown as (args: {
        request: Request;
        next: () => Promise<unknown>;
      }) => Promise<unknown>
    )({
      request,
      next: async () => ({
        locale: getLocale(),
        enableI18n: getEnableI18n(),
      }),
    });

    expect(result).toEqual({ locale: 'fr', enableI18n: false });
    expect(mockSetCookie).toHaveBeenCalledWith(
      'generaltranslation.locale',
      'fr',
      {
        path: '/',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365,
      }
    );

    expect(() => getLocale()).toThrow(
      'Cannot read GT request state outside a request scope'
    );
  });
});
