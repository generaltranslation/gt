import type { GetServerSidePropsContext, PreviewData } from 'next';
import type { ParsedUrlQuery } from 'querystring';
import {
  getAcceptLanguageCandidates,
  getLocaleHeaderCandidates,
  getLocaleResolutionParams,
  resolveLocaleFromCandidates,
} from '../request/resolveLocale';

/**
 * Resolve the user's locale from a Next Pages Router server-side request.
 */
export function parseLocale<
  Params extends ParsedUrlQuery = ParsedUrlQuery,
  Preview extends PreviewData = PreviewData,
>(context: GetServerSidePropsContext<Params, Preview>): string {
  const { headerName, cookieName, ignorePreferredLanguages } =
    getLocaleResolutionParams();
  const preferredLocales: string[] = [];

  preferredLocales.push(
    ...getLocaleHeaderCandidates(context.req.headers[headerName])
  );

  const cookieLocale = context.req.cookies?.[cookieName];
  if (cookieLocale) {
    preferredLocales.push(cookieLocale);
  }

  if (!ignorePreferredLanguages) {
    preferredLocales.push(
      ...getAcceptLanguageCandidates(context.req.headers['accept-language'])
    );
  }

  return resolveLocaleFromCandidates(
    preferredLocales,
    ignorePreferredLanguages
  );
}
