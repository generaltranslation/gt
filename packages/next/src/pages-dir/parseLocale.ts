import type { GetServerSidePropsContext, PreviewData } from 'next';
import type { ParsedUrlQuery } from 'querystring';
import { createMissingPagesRouterLocaleWarning } from '../errors/ssg';
import {
  isLocaleSupported,
  resolveLocaleOrDefault,
} from '../request/localeValidation';

export type PagesRouterLocaleContext = {
  locale?: string;
  defaultLocale?: string;
};

/**
 * Read the active locale resolved by Next.js internationalized routing.
 */
export function parseLocale<
  Params extends ParsedUrlQuery = ParsedUrlQuery,
  Preview extends PreviewData = PreviewData,
>(context: GetServerSidePropsContext<Params, Preview>): string {
  return resolvePagesRouterLocale(context);
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
