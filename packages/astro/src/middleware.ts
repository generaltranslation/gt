import type { APIContext, MiddlewareHandler } from 'astro';
import { defaultLocaleCookieName } from '@generaltranslation/react-core/cookies';
import { getI18nConfig } from 'gt-i18n/internal';
import {
  config,
  loadTranslations,
  settings,
} from 'virtual:gt-astro/config-server';
import { getAsyncConditionStore } from './condition-store/singleton-operations';
import { initializeGTAstro } from './setup/initialize';
import type { GTLocals } from './types';
import { parseAcceptLanguage } from './utils/parseAcceptLanguage';
import { matchPathLocale } from './utils/pathLocale';

const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

initializeGTAstro({ ...config, loadTranslations });

export const onRequest: MiddlewareHandler = (context, next) => {
  const i18nConfig = getI18nConfig();
  const cookieName = config.localeCookieName ?? defaultLocaleCookieName;
  const pathname = context.url.pathname;

  const pathLocale = matchPathLocale(pathname, i18nConfig);

  let locale: string;
  if (pathLocale) {
    locale = pathLocale.locale;
    // Redirect alias prefixes (e.g. /en-US/about) to the canonical locale
    if (
      settings.localeRouting &&
      pathLocale.segment !== locale &&
      !context.isPrerendered
    ) {
      const segments = pathname.split('/');
      segments[1] = locale;
      return context.redirect(segments.join('/') + context.url.search, 302);
    }
  } else if (context.isPrerendered) {
    // No request negotiation at build time: prerendered paths without a
    // locale prefix render in the default locale.
    locale = i18nConfig.getDefaultLocale();
  } else {
    const candidates: string[] = [];
    const cookieLocale = context.cookies.get(cookieName)?.value;
    if (cookieLocale) candidates.push(cookieLocale);
    candidates.push(
      ...parseAcceptLanguage(context.request.headers.get('accept-language'))
    );
    locale = i18nConfig.resolveSupportedLocale(candidates);

    if (settings.localeRouting && shouldLocaleRoute(pathname)) {
      persistLocaleCookie(context, cookieName, locale);
      return context.redirect(
        `/${locale}${pathname === '/' ? '' : pathname}${context.url.search}`,
        302
      );
    }
  }

  if (!context.isPrerendered) {
    persistLocaleCookie(context, cookieName, locale);
  }

  (context.locals as { gt: GTLocals }).gt = { locale };
  return getAsyncConditionStore().run(locale, () => next());
};

/**
 * Locale-prefix redirects only apply to page-like paths: internal Astro
 * paths and file requests (anything with an extension) are left alone.
 */
function shouldLocaleRoute(pathname: string): boolean {
  if (pathname.startsWith('/_')) return false;
  const lastSegment = pathname.split('/').pop() ?? '';
  return !lastSegment.includes('.');
}

function persistLocaleCookie(
  context: APIContext,
  cookieName: string,
  locale: string
): void {
  if (context.cookies.get(cookieName)?.value === locale) return;
  context.cookies.set(cookieName, locale, {
    path: '/',
    sameSite: 'lax',
    maxAge: LOCALE_COOKIE_MAX_AGE,
  });
}
