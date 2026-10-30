import { getI18nConfig } from 'gt-i18n/internal';
import { getLocale } from '../request/getLocale';
import { use } from '../utils/use';
import { localizeHref, type LinkLocale } from './localize-utils';

/**
 * Returns a function that localizes hrefs the same way `gt-next/link` does,
 * for server code such as Server Components, route handlers, and Server
 * Actions.
 *
 * Internal paths are prefixed with the target locale, except default-locale
 * paths when `prefixDefaultLocale` is `false` (an explicit default `locale`
 * keeps its prefix while `enableSmartRouting` is on). Localized path aliases
 * and locale availability are still resolved by the middleware. External URLs
 * and paths that don't match `pathRegex` are never prefixed.
 *
 * @example
 * ```tsx
 * import { getLocalizeHref } from 'gt-next/server';
 *
 * export async function CheckoutButton() {
 *   const localizeHref = await getLocalizeHref();
 *   return <Button href={localizeHref('/checkout')}>Checkout</Button>;
 * }
 * ```
 *
 * @returns A promise of a function taking an href and an optional locale (a
 * locale string, or `false` to leave the href unchanged) that returns the
 * localized href.
 */
export async function getLocalizeHref(): Promise<
  (href: string, locale?: LinkLocale) => string
> {
  const currentLocale = await getLocale();
  const defaultLocale = getI18nConfig().getDefaultLocale();
  return (href, locale) =>
    localizeHref(href, locale, currentLocale, defaultLocale);
}

/**
 * Server Component version of `useLocalizeHref()`: localizes hrefs the same
 * way `gt-next/link` does, using the request locale.
 *
 * @example
 * ```tsx
 * import { useLocalizeHref } from 'gt-next';
 *
 * export function CheckoutButton() {
 *   const localizeHref = useLocalizeHref();
 *   return <Button href={localizeHref('/checkout')}>Checkout</Button>;
 * }
 * ```
 */
export function useLocalizeHref() {
  return use(getLocalizeHref());
}
