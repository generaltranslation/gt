import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';
import { getLocale } from 'gt-i18n';

vi.mock('virtual:gt-astro/config-server', () => ({
  config: {
    defaultLocale: 'en',
    locales: ['en', 'fr', 'zh'],
  },
  settings: { localeRouting: true },
  loadTranslations: undefined,
}));

const { onRequest } = await import('../middleware');

const COOKIE_NAME = 'generaltranslation.locale';

type ContextParams = {
  path?: string;
  cookie?: string;
  acceptLanguage?: string;
  prerendered?: boolean;
};

function createContext({
  path = '/',
  cookie,
  acceptLanguage,
  prerendered = false,
}: ContextParams = {}) {
  const cookieJar = new Map<string, string>(
    cookie ? [[COOKIE_NAME, cookie]] : []
  );
  const setCookieCalls: Array<[string, string]> = [];
  const url = new URL(`http://localhost${path}`);
  const context = {
    url,
    request: new Request(url, {
      headers: acceptLanguage ? { 'accept-language': acceptLanguage } : {},
    }),
    isPrerendered: prerendered,
    locals: {} as Record<string, unknown>,
    cookies: {
      get: (name: string) =>
        cookieJar.has(name) ? { value: cookieJar.get(name) } : undefined,
      set: (name: string, value: string) => {
        cookieJar.set(name, value);
        setCookieCalls.push([name, value]);
      },
    },
    redirect: (location: string, status?: number) =>
      new Response(null, {
        status: status ?? 302,
        headers: { Location: location },
      }),
  } as unknown as APIContext;
  return { context, cookieJar, setCookieCalls };
}

function createNext() {
  const seen: { locale?: string } = {};
  const next = vi.fn(async () => {
    seen.locale = getLocale();
    return new Response('ok');
  });
  return { next, seen };
}

describe('onRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects bare paths using Accept-Language', async () => {
    const { context } = createContext({
      path: '/about',
      acceptLanguage: 'fr-FR,fr;q=0.9,en;q=0.2',
    });
    const { next } = createNext();
    const response = (await onRequest(context, next)) as Response;
    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/fr/about');
    expect(next).not.toHaveBeenCalled();
  });

  it('prefers the locale cookie over Accept-Language', async () => {
    const { context } = createContext({
      path: '/',
      cookie: 'zh',
      acceptLanguage: 'fr',
    });
    const { next } = createNext();
    const response = (await onRequest(context, next)) as Response;
    expect(response.headers.get('Location')).toBe('/zh');
  });

  it('falls back to the default locale', async () => {
    const { context } = createContext({ path: '/' });
    const { next } = createNext();
    const response = (await onRequest(context, next)) as Response;
    expect(response.headers.get('Location')).toBe('/en');
  });

  it('preserves the query string on redirect', async () => {
    const { context } = createContext({ path: '/posts?tag=ai' });
    const { next } = createNext();
    const response = (await onRequest(context, next)) as Response;
    expect(response.headers.get('Location')).toBe('/en/posts?tag=ai');
  });

  it('serves locale-prefixed paths and scopes the locale', async () => {
    const { context, setCookieCalls } = createContext({ path: '/fr/about' });
    const { next, seen } = createNext();
    const response = (await onRequest(context, next)) as Response;
    expect(response.status).toBe(200);
    expect((context.locals as { gt: { locale: string } }).gt.locale).toBe('fr');
    expect(seen.locale).toBe('fr');
    expect(setCookieCalls).toContainEqual([COOKIE_NAME, 'fr']);
  });

  it('redirects locale aliases to the canonical prefix', async () => {
    const { context } = createContext({ path: '/fr-FR/about' });
    const { next } = createNext();
    const response = (await onRequest(context, next)) as Response;
    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/fr/about');
  });

  it('does not redirect file requests', async () => {
    const { context } = createContext({ path: '/favicon.ico' });
    const { next } = createNext();
    const response = (await onRequest(context, next)) as Response;
    expect(response.status).toBe(200);
  });

  it('does not redirect internal paths', async () => {
    const { context } = createContext({ path: '/_actions/something' });
    const { next } = createNext();
    const response = (await onRequest(context, next)) as Response;
    expect(response.status).toBe(200);
  });

  it('does not touch cookies or headers for prerendered pages', async () => {
    const { context, setCookieCalls } = createContext({
      path: '/fr/about',
      prerendered: true,
    });
    const { next, seen } = createNext();
    const response = (await onRequest(context, next)) as Response;
    expect(response.status).toBe(200);
    expect(seen.locale).toBe('fr');
    expect(setCookieCalls).toEqual([]);
  });

  it('renders prerendered pages without a locale prefix in the default locale', async () => {
    const { context } = createContext({ path: '/', prerendered: true });
    const { next, seen } = createNext();
    const response = (await onRequest(context, next)) as Response;
    expect(response.status).toBe(200);
    expect(seen.locale).toBe('en');
  });

  it('skips the cookie write when the value is unchanged', async () => {
    const { context, setCookieCalls } = createContext({
      path: '/fr/about',
      cookie: 'fr',
    });
    const { next } = createNext();
    await onRequest(context, next);
    expect(setCookieCalls).toEqual([]);
  });
});
