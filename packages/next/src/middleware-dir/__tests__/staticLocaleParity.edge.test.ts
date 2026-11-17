// @vitest-environment edge-runtime
/**
 * gt-react/static-locale's negotiateLocale must pick the same locale as this
 * middleware without locale path routing, so per-locale builds and gt-next
 * apps agree on a visitor's locale.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { GTIntl } from 'generaltranslation/internal';
import type { CustomMapping } from '@generaltranslation/format';
import {
  defaultLocaleCookieName,
  defaultResetLocaleCookieName,
} from 'gt-i18n/internal/cookies';
import { negotiateLocale } from 'gt-react/static-locale';
import { createPathMatcher } from '../createPathMatcher';
import { getLocaleFromRequest } from '../utils';
import { defaultReferrerLocaleCookieName } from '../../utils/cookies';

type Scenario = {
  name: string;
  cookie?: string;
  /** A raw Cookie header, used instead of `cookie` */
  cookieHeader?: string;
  acceptLanguage?: string;
};

const scenarios: Scenario[] = [
  { name: 'no cookie or header' },
  { name: 'supported cookie', cookie: 'de', acceptLanguage: 'fr' },
  { name: 'regional cookie', cookie: 'fr-CA', acceptLanguage: 'de' },
  { name: 'unsupported cookie', cookie: 'ja', acceptLanguage: 'de' },
  { name: 'invalid cookie', cookie: 'not a locale', acceptLanguage: 'es' },
  { name: 'q-values', acceptLanguage: 'de;q=0.5, es;q=0.9, ja' },
  { name: 'regional header', acceptLanguage: 'de-AT, fr;q=0.8' },
  { name: 'unsupported header', acceptLanguage: 'ja, ko;q=0.5' },
  { name: 'alias by canonical code', acceptLanguage: 'zh-CN' },
  { name: 'alias cookie', cookie: 'cn', acceptLanguage: 'fr' },
  {
    name: 'repeated cookie',
    cookieHeader: `${defaultLocaleCookieName}=de; other=1; ${defaultLocaleCookieName}=es`,
    acceptLanguage: 'fr',
  },
];

function requestHeaders({
  cookie,
  cookieHeader,
  acceptLanguage,
}: Scenario): Headers {
  const headers = new Headers();
  const rawCookie =
    cookieHeader ??
    (cookie && `${defaultLocaleCookieName}=${encodeURIComponent(cookie)}`);
  if (rawCookie) headers.set('cookie', rawCookie);
  if (acceptLanguage) headers.set('accept-language', acceptLanguage);
  return headers;
}

const configs: {
  name: string;
  defaultLocale: string;
  locales: string[];
  customMapping?: CustomMapping;
}[] = [
  { name: 'plain', defaultLocale: 'en', locales: ['fr', 'de', 'es'] },
  {
    name: 'aliases',
    defaultLocale: 'en-US',
    locales: ['fr-FR', 'de', 'cn'],
    customMapping: { cn: { code: 'zh-CN' } },
  },
];

function middlewareLocale(
  scenario: Scenario,
  { defaultLocale, locales, customMapping }: (typeof configs)[number]
): string {
  const req = new NextRequest(new URL('/about', 'http://localhost'), {
    headers: requestHeaders(scenario),
  });
  return getLocaleFromRequest(
    req,
    defaultLocale,
    false,
    false,
    createPathMatcher([]),
    defaultReferrerLocaleCookieName,
    defaultLocaleCookieName,
    defaultResetLocaleCookieName,
    // As createMiddlewareRouting builds it
    new GTIntl({
      locales: Array.from(new Set([defaultLocale, ...locales])),
      customMapping,
    })
  ).userLocale;
}

describe('gt-react/static-locale parity with the middleware', () => {
  let savedEnv: string | undefined;
  beforeEach(() => {
    savedEnv = process.env._GENERALTRANSLATION_IGNORE_BROWSER_LOCALES;
    // withGTConfig's default: browser locales are used
    process.env._GENERALTRANSLATION_IGNORE_BROWSER_LOCALES = 'false';
  });
  afterEach(() => {
    if (savedEnv === undefined) {
      delete process.env._GENERALTRANSLATION_IGNORE_BROWSER_LOCALES;
    } else {
      process.env._GENERALTRANSLATION_IGNORE_BROWSER_LOCALES = savedEnv;
    }
  });

  for (const config of configs) {
    it.each(scenarios)(`$name (${config.name} config)`, (scenario) => {
      const headers = requestHeaders(scenario);
      const expected = middlewareLocale(scenario, config);
      expect(negotiateLocale({ headers }, config)).toBe(expected);
      // Node's req.headers
      expect(
        negotiateLocale(Object.fromEntries(headers.entries()), config)
      ).toBe(expected);
    });
  }

  it('matches ignoreBrowserLocales', () => {
    process.env._GENERALTRANSLATION_IGNORE_BROWSER_LOCALES = 'true';
    const scenario = { name: 'header only', acceptLanguage: 'fr' };
    expect(
      negotiateLocale(
        { headers: requestHeaders(scenario) },
        { ...configs[0], ignoreBrowserLocales: true }
      )
    ).toBe(middlewareLocale(scenario, configs[0]));
  });
});
