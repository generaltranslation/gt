import { getI18nConfig } from '@generaltranslation/react-core/pure';
import type { GetServerSidePropsContext, PreviewData } from 'next';
import type { ParsedUrlQuery } from 'querystring';

/**
 * Resolve the user's enableI18n state from a Next Pages Router server-side request.
 */
export function parseEnableI18n<
  Params extends ParsedUrlQuery = ParsedUrlQuery,
  Preview extends PreviewData = PreviewData,
>(context: GetServerSidePropsContext<Params, Preview>): boolean {
  const cookieEnableI18n =
    context.req.cookies?.[getI18nConfig().getEnableI18nCookieName()];
  if (cookieEnableI18n === undefined) return true;
  return cookieEnableI18n === 'true';
}
