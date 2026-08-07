import type { GetServerSidePropsContext, PreviewData } from 'next';
import type { ParsedUrlQuery } from 'querystring';
import { getI18nConfig } from '@generaltranslation/react-core/pure';
import { parseAcceptLanguage } from 'gt-i18n/internal';
import {
  createMissingPagesRouterLocaleWarning,
  noLocalesCouldBeDeterminedWarning,
} from '../errors/ssg';
import { defaultLocaleHeaderName } from '../utils/headers';
import {
  isLocaleSupported,
  resolveLocaleOrDefault,
} from '../request/localeValidation';

type HeaderValue = string | string[] | undefined;

export type PagesRouterLocaleContext = {
  locale?: string;
  defaultLocale?: string;
};

/**
 * Read the active locale resolved by Next.js internationalized routing,
 * retaining the previous request detector as a compatibility fallback.
 */
export function parseLocale<
  Params extends ParsedUrlQuery = ParsedUrlQuery,
  Preview extends PreviewData = PreviewData,
>(context: GetServerSidePropsContext<Params, Preview>): string {
  if (context.locale !== undefined) {
    if (isLocaleSupported(context.locale)) return context.locale;
    return resolveLocaleOrDefault(context.locale);
  }

  return detectLocale(context);
}

export function resolvePagesRouterLocale(
  context: PagesRouterLocaleContext
): string {
  const requestedLocale = context.locale ?? context.defaultLocale;
  const locale = isLocaleSupported(requestedLocale)
    ? requestedLocale
    : resolveLocaleOrDefault(requestedLocale);

  if (context.locale === undefined) {
    console.warn(createMissingPagesRouterLocaleWarning(locale));
  }

  return locale;
}

/**
 * @deprecated Retained for backwards compatibility until the next major version.
 */
function detectLocale<
  Params extends ParsedUrlQuery = ParsedUrlQuery,
  Preview extends PreviewData = PreviewData,
>(context: GetServerSidePropsContext<Params, Preview>): string {
  const i18nConfig = getI18nConfig();
  const { headerName, ignorePreferredLanguages } = getParseLocaleParams();
  const preferredLocales: string[] = [];

  addHeaderCandidates(preferredLocales, context.req.headers[headerName]);

  const cookieLocale = context.req.cookies?.[i18nConfig.getLocaleCookieName()];
  if (cookieLocale) preferredLocales.push(cookieLocale);

  if (!ignorePreferredLanguages) {
    preferredLocales.push(
      ...parseAcceptLanguage(context.req.headers['accept-language'])
    );
  }

  if (preferredLocales.length === 0 && !ignorePreferredLanguages) {
    console.warn(noLocalesCouldBeDeterminedWarning);
  }

  return (
    i18nConfig.determineLocale(preferredLocales, i18nConfig.getLocales()) ||
    i18nConfig.getDefaultLocale()
  );
}

function getParseLocaleParams(): {
  headerName: string;
  ignorePreferredLanguages: boolean;
} {
  const privateConfig = JSON.parse(
    process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS || '{}'
  );

  return {
    headerName:
      privateConfig.headersAndCookies?.localeHeaderName ||
      defaultLocaleHeaderName,
    ignorePreferredLanguages: privateConfig.ignoreBrowserLocales || false,
  };
}

function addHeaderCandidates(candidates: string[], headerValue: HeaderValue) {
  if (Array.isArray(headerValue)) {
    candidates.push(...headerValue.filter(Boolean));
  } else if (headerValue) {
    candidates.push(headerValue);
  }
}
