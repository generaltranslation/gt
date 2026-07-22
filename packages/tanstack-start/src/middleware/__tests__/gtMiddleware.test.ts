import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSetCookie = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-start', () => ({
  createMiddleware: () => ({
    server: (serverFn: unknown) => serverFn,
  }),
  createIsomorphicFn: () => ({
    server: (serverFn: (...args: never[]) => unknown) => ({
      client: (clientFn: (...args: never[]) => unknown) =>
        Object.assign(serverFn, { client: clientFn, server: serverFn }),
    }),
  }),
}));

vi.mock('@tanstack/react-start/server', () => ({
  setCookie: (...args: unknown[]) => mockSetCookie(...args),
}));

import { initializeI18nConfig } from '@generaltranslation/react-core/pure';
import { AsyncLocalConditionStore } from '../../condition-store/AsyncLocalConditionStore';
import { setConditionStore } from '../../condition-store/singleton';
import { getEnableI18n, getLocale } from '../../functions/runtime';
import { gtMiddleware } from '../gtMiddleware';

type GlobalWithRegistry = {
  __generaltranslation?: {
    i18n?: Record<string, unknown>;
    tanstackStart?: Record<string, unknown>;
  };
};

function resetSingletons() {
  const globalObj = globalThis as GlobalWithRegistry;
  if (globalObj.__generaltranslation?.i18n) {
    Reflect.deleteProperty(globalObj.__generaltranslation.i18n, 'i18nConfig');
  }
  if (globalObj.__generaltranslation?.tanstackStart) {
    Reflect.deleteProperty(
      globalObj.__generaltranslation.tanstackStart,
      'conditionStore'
    );
  }
}

describe.sequential('gtMiddleware', () => {
  beforeEach(() => {
    resetSingletons();
    const config = {
      defaultLocale: 'en',
      locales: ['en', 'fr'],
    };
    initializeI18nConfig(config);
    setConditionStore(new AsyncLocalConditionStore(config));
    mockSetCookie.mockReset();
  });

  it('requires initializeGT to create the server condition store', () => {
    resetSingletons();

    expect(() =>
      (
        gtMiddleware as unknown as (args: {
          request: Request;
          next: () => Promise<unknown>;
        }) => Promise<unknown>
      )({
        request: new Request('https://example.com'),
        next: async () => undefined,
      })
    ).toThrow("Call initializeGT() from 'gt-tanstack-start'");
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
