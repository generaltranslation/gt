import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetRequest, mockSetCookie } = vi.hoisted(() => ({
  mockGetRequest: vi.fn(),
  mockSetCookie: vi.fn(),
}));

vi.mock('@tanstack/react-start/server', () => ({
  getRequest: () => mockGetRequest(),
  setCookie: (...args: unknown[]) => mockSetCookie(...args),
}));

import { initializeI18nConfig } from '@generaltranslation/react-core/pure';
import {
  getRequestConditions,
  initializeRequestConditions,
} from '../requestConditions';

const config = {
  defaultLocale: 'en',
  locales: ['en', 'fr', 'es'],
};

function createRequest({
  locale,
  enableI18n = true,
  pathname = '/',
  acceptLanguage,
}: {
  locale?: string;
  enableI18n?: boolean;
  pathname?: string;
  acceptLanguage?: string;
}) {
  const cookies = [];
  if (locale) cookies.push(`generaltranslation.locale=${locale}`);
  cookies.push(`generaltranslation.enable-i18n=${String(enableI18n)}`);
  const headers = new Headers({ cookie: cookies.join('; ') });
  if (acceptLanguage) headers.set('accept-language', acceptLanguage);
  return new Request(`https://example.com${pathname}`, { headers });
}

describe.sequential('request conditions', () => {
  beforeEach(() => {
    initializeI18nConfig(config);
    initializeRequestConditions();
    mockGetRequest.mockReset();
    mockSetCookie.mockReset();
  });

  it('reads the current request from TanStack', () => {
    const request = createRequest({ locale: 'fr', enableI18n: false });
    mockGetRequest.mockReturnValue(request);

    expect(getRequestConditions()).toEqual({
      locale: 'fr',
      enableI18n: false,
    });
  });

  it('prefers the locale cookie over Accept-Language', () => {
    const request = createRequest({
      locale: 'fr',
      acceptLanguage: 'es,en;q=0.8',
    });

    expect(getRequestConditions(request).locale).toBe('fr');
  });

  it('falls back to Accept-Language', () => {
    const request = createRequest({ acceptLanguage: 'es,en;q=0.8' });

    expect(getRequestConditions(request).locale).toBe('es');
  });

  it('isolates conditions by request', () => {
    const firstRequest = createRequest({ locale: 'fr' });
    const secondRequest = createRequest({
      locale: 'es',
      enableI18n: false,
    });

    expect(getRequestConditions(firstRequest)).toEqual({
      locale: 'fr',
      enableI18n: true,
    });
    expect(getRequestConditions(secondRequest)).toEqual({
      locale: 'es',
      enableI18n: false,
    });
    expect(getRequestConditions(firstRequest).locale).toBe('fr');
  });

  it('resolves and writes conditions once per request', () => {
    const request = createRequest({ locale: 'fr' });

    expect(getRequestConditions(request)).toBe(getRequestConditions(request));
    expect(mockSetCookie).toHaveBeenCalledOnce();
  });

  it('prioritizes a path locale when locale routing is enabled', () => {
    initializeRequestConditions(true);
    const request = createRequest({ locale: 'es', pathname: '/fr/about' });

    expect(getRequestConditions(request).locale).toBe('fr');
  });

  it('ignores path locales when locale routing is disabled', () => {
    const request = createRequest({ locale: 'es', pathname: '/fr/about' });

    expect(getRequestConditions(request).locale).toBe('es');
  });

  it('shares memoized conditions across package bundle instances', async () => {
    const request = createRequest({ locale: 'fr' });
    const conditions = getRequestConditions(request);

    vi.resetModules();
    const freshModule = await import('../requestConditions');

    expect(freshModule.getRequestConditions(request)).toBe(conditions);
    expect(mockSetCookie).toHaveBeenCalledOnce();
  });
});
