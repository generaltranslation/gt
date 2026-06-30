import type { GetServerSidePropsContext, PreviewData } from 'next';
import type { ParsedUrlQuery } from 'querystring';
import {
  getAcceptLanguageCandidates,
  getLocaleResolutionParams,
  resolveLocaleFromCandidates,
} from '../request/localeResolution';

type HeaderValue = string | string[] | undefined;

/**
 * Resolve the user's locale from a Next Pages Router server-side request.
 */
export function parseLocale<
  Params extends ParsedUrlQuery = ParsedUrlQuery,
  Preview extends PreviewData = PreviewData,
>(context: GetServerSidePropsContext<Params, Preview>): string {
  const { headerName, cookieName, ignorePreferredLanguages } =
    getLocaleResolutionParams();
  const cookieLocale = context.req.cookies?.[cookieName];
  const preferredLocales = [
    ...getHeaderCandidates(context.req.headers[headerName]),
    ...(cookieLocale ? [cookieLocale] : []),
    ...(!ignorePreferredLanguages
      ? getAcceptLanguageCandidates(context.req.headers['accept-language'])
      : []),
  ];

  return resolveLocaleFromCandidates(
    preferredLocales,
    ignorePreferredLanguages
  );
}

function getHeaderCandidates(headerValue: HeaderValue): string[] {
  if (Array.isArray(headerValue)) {
    return headerValue.filter(Boolean);
  }
  return headerValue ? [headerValue] : [];
}
