import { createMissingPagesRouterLocaleWarning } from '../errors/ssg';
import {
  isLocaleSupported,
  resolveLocaleOrDefault,
} from '../request/localeValidation';

type PagesRouterLocaleContext = {
  locale?: string;
  defaultLocale?: string;
};

/**
 * Read the active locale resolved by Next.js internationalized routing.
 */
export function parseLocale(context: PagesRouterLocaleContext): string {
  const requestedLocale = context.locale ?? context.defaultLocale;
  const locale = isLocaleSupported(requestedLocale)
    ? requestedLocale
    : resolveLocaleOrDefault(requestedLocale);

  if (context.locale === undefined) {
    console.warn(createMissingPagesRouterLocaleWarning(locale));
  }

  return locale;
}
