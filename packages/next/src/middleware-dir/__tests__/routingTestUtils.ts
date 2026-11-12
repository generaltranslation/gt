import { afterEach, beforeEach, expect, vi } from 'vitest';
import type { NextResponse } from 'next/server';
import type { CustomMapping } from '@generaltranslation/format/types';
import { defaultLocaleRoutingEnabledCookieName } from '../../utils/cookies';
import { defaultLocaleHeaderName } from '../../utils/headers';

export type RoutingEnv = {
  defaultLocale?: string;
  locales?: readonly string[];
  customMapping?: CustomMapping;
  localeMatcher?: string;
  headersAndCookies?: Record<string, string>;
  /** Mirrors `_GENERALTRANSLATION_GT_SERVICES_ENABLED`. */
  services?: boolean;
  /** Negotiate from Accept-Language (`ignoreBrowserLocales: false`). */
  browserLocales?: boolean;
};

/** Stubs the env vars `withGTConfig()` writes for the middleware. */
export function stubRoutingEnv({
  services = false,
  browserLocales = false,
  ...i18nConfig
}: RoutingEnv = {}) {
  vi.stubEnv(
    '_GENERALTRANSLATION_I18N_CONFIG_PARAMS',
    JSON.stringify({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      ...i18nConfig,
    })
  );
  vi.stubEnv('_GENERALTRANSLATION_GT_SERVICES_ENABLED', String(services));
  vi.stubEnv(
    '_GENERALTRANSLATION_IGNORE_BROWSER_LOCALES',
    String(!browserLocales)
  );
  vi.stubEnv('_GENERALTRANSLATION_PATH_REGEX', '');
}

/**
 * Stubs the routing env before each test of the enclosing suite and restores
 * it afterwards. Tests may call `stubRoutingEnv()` again to override it.
 */
export function useRoutingEnv(env?: RoutingEnv) {
  beforeEach(() => stubRoutingEnv(env));
  afterEach(() => vi.unstubAllEnvs());
}

export type RouteKind = 'next' | 'rewrite' | 'redirect';

/**
 * Asserts the full shape of a routed middleware response: its kind, the
 * resolved locale header, the routing cookie, and the absolute target URL.
 */
export function expectRoutedResponse(
  response: NextResponse,
  kind: RouteKind,
  locale: string,
  url?: string,
  localeRouting = true
) {
  expect(response.status).toBe(kind === 'redirect' ? 307 : 200);
  expect(response.headers.get(defaultLocaleHeaderName)).toBe(locale);
  expect(
    response.cookies.get(defaultLocaleRoutingEnabledCookieName)?.value
  ).toBe(String(localeRouting));
  expect(response.headers.get('location')).toBe(
    kind === 'redirect' ? url : null
  );
  expect(response.headers.get('x-middleware-rewrite')).toBe(
    kind === 'rewrite' ? url : null
  );
  expect(response.headers.get('x-middleware-next')).toBe(
    kind === 'next' ? '1' : null
  );
}
