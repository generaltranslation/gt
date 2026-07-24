import type { GetServerSidePropsContext, PreviewData } from 'next';
import type { ParsedUrlQuery } from 'querystring';
import { getI18nConfig } from '@generaltranslation/react-core/pure';
import { parseAcceptLanguage } from 'gt-i18n/internal';
import { noLocalesCouldBeDeterminedWarning } from '../errors/ssg';
import { defaultLocaleHeaderName } from '../utils/headers';

type HeaderValue = string | string[] | undefined;

/**
 * Resolve the user's locale from a Next Pages Router server-side request.
 */
export function parseLocale<
  Params extends ParsedUrlQuery = ParsedUrlQuery,
  Preview extends PreviewData = PreviewData,
>(context: GetServerSidePropsContext<Params, Preview>): string {
  const i18nConfig = getI18nConfig();
  const { headerName, ignorePreferredLanguages } = getParseLocaleParams();
  const preferredLocales: string[] = [];

  addHeaderCandidates(preferredLocales, context.req.headers[headerName]);

  const cookieLocale = context.req.cookies?.[i18nConfig.getLocaleCookieName()];
  if (cookieLocale) {
    preferredLocales.push(cookieLocale);
  }

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
