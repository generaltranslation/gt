// @vitest-environment edge-runtime
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GT } from 'generaltranslation';
import { getLocaleFromRequest } from '../utils';

// Mock gt-react/internal — only provides a constant, avoids deep react-core build chain
vi.mock('gt-react/internal', () => ({
  defaultLocaleCookieName: 'generaltranslation.locale',
}));

// ---- Cookie Constants ----
const LOCALE_COOKIE = 'generaltranslation.locale';
const RESET_COOKIE = 'generaltranslation.locale-reset';
const REFERRER_COOKIE = 'generaltranslation.referrer-locale';

// ---- Helpers ----

function createRequest(
  pathname: string,
  opts: {
    cookies?: Record<string, string>;
    acceptLanguage?: string;
  } = {}
): NextRequest {
  const url = new URL(pathname, 'http://localhost:3000');
  const headers = new Headers();
  if (opts.acceptLanguage) {
    headers.set('accept-language', opts.acceptLanguage);
  }

  const req = new NextRequest(url, { headers });
  if (opts.cookies) {
    for (const [name, value] of Object.entries(opts.cookies)) {
      req.cookies.set(name, value);
    }
  }
  return req;
}

// Standard params for getLocaleFromRequest
const DEFAULT_LOCALE = 'en';
const APPROVED_LOCALES = ['en', 'fr', 'es', 'de'];

function callGetLocaleFromRequest(
  req: NextRequest,
  overrides: {
    defaultLocale?: string;
    approvedLocales?: string[];
    localeRouting?: boolean;
    gtServicesEnabled?: boolean;
    prefixDefaultLocale?: boolean;
    defaultLocalePaths?: string[];
  } = {}
) {
  const gt = new GT();
  return getLocaleFromRequest(
    req,
    overrides.defaultLocale ?? DEFAULT_LOCALE,
    overrides.approvedLocales ?? APPROVED_LOCALES,
    overrides.localeRouting ?? true,
    overrides.gtServicesEnabled ?? false,
    overrides.prefixDefaultLocale ?? false,
    overrides.defaultLocalePaths ?? [],
    REFERRER_COOKIE,
    LOCALE_COOKIE,
    RESET_COOKIE,
    gt
  );
}

// ---- Tests ----

describe('Locale Resolution (Category 1)', () => {
  let savedBrowserLocalesEnv: string | undefined;

  beforeEach(() => {
    savedBrowserLocalesEnv =
      process.env._GENERALTRANSLATION_IGNORE_BROWSER_LOCALES;
    // By default, browser locales are ignored (env var not set or not 'false')
    delete process.env._GENERALTRANSLATION_IGNORE_BROWSER_LOCALES;
  });

  afterEach(() => {
    if (savedBrowserLocalesEnv === undefined) {
      delete process.env._GENERALTRANSLATION_IGNORE_BROWSER_LOCALES;
    } else {
      process.env._GENERALTRANSLATION_IGNORE_BROWSER_LOCALES =
        savedBrowserLocalesEnv;
    }
  });

  it('1.1: pathname locale /fr/about → userLocale=fr, pathnameLocale=fr', () => {
    const req = createRequest('/fr/about');
    const result = callGetLocaleFromRequest(req);

    expect(result.userLocale).toBe('fr');
    expect(result.pathnameLocale).toBe('fr');
    expect(result.clearResetCookie).toBe(false);
  });

  it('1.2: reset cookie fr on /en/about → userLocale=fr, clearResetCookie=true', () => {
    const req = createRequest('/en/about', {
      cookies: {
        [LOCALE_COOKIE]: 'fr',
        [RESET_COOKIE]: 'true',
      },
    });
    const result = callGetLocaleFromRequest(req);

    expect(result.userLocale).toBe('fr');
    expect(result.clearResetCookie).toBe(true);
  });

  it('1.3: cookie locale de (no reset) → userLocale=de', () => {
    const req = createRequest('/about', {
      cookies: {
        [LOCALE_COOKIE]: 'de',
      },
    });
    const result = callGetLocaleFromRequest(req);

    expect(result.userLocale).toBe('de');
    expect(result.clearResetCookie).toBe(false);
  });

  it('1.4: referrer cookie fr → userLocale=fr', () => {
    const req = createRequest('/about', {
      cookies: {
        [REFERRER_COOKIE]: 'fr',
      },
    });
    const result = callGetLocaleFromRequest(req);

    expect(result.userLocale).toBe('fr');
  });

  it('1.5: reset cookie en + referrer cookie fr → referrer ignored, userLocale=en', () => {
    const req = createRequest('/about', {
      cookies: {
        [LOCALE_COOKIE]: 'en',
        [RESET_COOKIE]: 'true',
        [REFERRER_COOKIE]: 'fr',
      },
    });
    const result = callGetLocaleFromRequest(req);

    expect(result.userLocale).toBe('en');
    expect(result.clearResetCookie).toBe(true);
  });

  it('1.6: Accept-Language: es → userLocale=es', () => {
    // Enable browser locale detection
    process.env._GENERALTRANSLATION_IGNORE_BROWSER_LOCALES = 'false';

    const req = createRequest('/about', {
      acceptLanguage: 'es-ES,es;q=0.9,en;q=0.8',
    });
    const result = callGetLocaleFromRequest(req);

    expect(result.userLocale).toBe('es');
  });

  it('1.7: no signals → userLocale=en (default fallback)', () => {
    const req = createRequest('/about');
    const result = callGetLocaleFromRequest(req);

    expect(result.userLocale).toBe('en');
    expect(result.pathnameLocale).toBeUndefined();
    expect(result.clearResetCookie).toBe(false);
  });

  it('pathname locale takes priority over cookie locale', () => {
    const req = createRequest('/fr/about', {
      cookies: {
        [LOCALE_COOKIE]: 'de',
      },
    });
    const result = callGetLocaleFromRequest(req);

    expect(result.userLocale).toBe('fr');
    expect(result.pathnameLocale).toBe('fr');
  });

  it('reset cookie overrides pathname locale', () => {
    const req = createRequest('/fr/about', {
      cookies: {
        [LOCALE_COOKIE]: 'es',
        [RESET_COOKIE]: 'true',
      },
    });
    const result = callGetLocaleFromRequest(req);

    expect(result.userLocale).toBe('es');
    expect(result.clearResetCookie).toBe(true);
  });

  it('invalid pathname locale is ignored', () => {
    const req = createRequest('/notavalidlocale/page');
    const result = callGetLocaleFromRequest(req);

    expect(result.pathnameLocale).toBeUndefined();
    expect(result.userLocale).toBe('en');
  });

  it('default locale paths are recognized when !prefixDefaultLocale', () => {
    const req = createRequest('/about-us');
    const result = callGetLocaleFromRequest(req, {
      prefixDefaultLocale: false,
      defaultLocalePaths: ['/about-us'],
    });

    expect(result.userLocale).toBe('en');
  });
});
