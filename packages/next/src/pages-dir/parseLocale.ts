import type { GetServerSidePropsContext, PreviewData } from 'next';
import type { ParsedUrlQuery } from 'querystring';
import { getI18nConfig } from 'gt-i18n/internal';
import { noLocalesCouldBeDeterminedWarning } from '../errors/ssg';
import { defaultLocaleHeaderName } from '../utils/headers';
import { defaultLocaleCookieName } from '@generaltranslation/react-core/pure';

type HeaderValue = string | string[] | undefined;

/**
 * Resolve the user's locale from a Next Pages Router server-side request.
 */
export function parseLocale<
  Params extends ParsedUrlQuery = ParsedUrlQuery,
  Preview extends PreviewData = PreviewData,
>(context: GetServerSidePropsContext<Params, Preview>): string {
  const { headerName, cookieName, ignorePreferredLanguages } =
    getParseLocaleParams();
  const preferredLocales: string[] = [];

  addHeaderCandidates(preferredLocales, context.req.headers[headerName]);

  const cookieLocale = context.req.cookies?.[cookieName];
  if (cookieLocale) {
    preferredLocales.push(cookieLocale);
  }

  if (!ignorePreferredLanguages) {
    preferredLocales.push(
      ...getAcceptLanguageCandidates(context.req.headers['accept-language'])
    );
  }

  if (preferredLocales.length === 0 && !ignorePreferredLanguages) {
    console.warn(noLocalesCouldBeDeterminedWarning);
  }

  const i18nConfig = getI18nConfig();
  return (
    i18nConfig
      .getGTClass()
      .determineLocale(preferredLocales, i18nConfig.getLocales()) ||
    i18nConfig.getDefaultLocale()
  );
}

function getParseLocaleParams(): {
  headerName: string;
  cookieName: string;
  ignorePreferredLanguages: boolean;
} {
  const privateConfig = JSON.parse(
    process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS || '{}'
  );

  return {
    headerName:
      privateConfig.headersAndCookies?.localeHeaderName ||
      defaultLocaleHeaderName,
    cookieName:
      privateConfig.headersAndCookies?.localeCookieName ||
      defaultLocaleCookieName,
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

function getAcceptLanguageCandidates(headerValue: HeaderValue): string[] {
  const headerValues = Array.isArray(headerValue) ? headerValue : [headerValue];
  return headerValues.flatMap(
    (value) =>
      value
        ?.split(',')
        .map((item) => item.split(';')?.[0].trim())
        .filter(Boolean) || []
  );
}
