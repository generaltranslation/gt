import { useCallback } from 'react';
import { useDefaultLocale, useLocale } from 'gt-react';
import { localizeHref, type LinkLocale } from './localize-utils';

/**
 * Returns a function that localizes hrefs the same way `gt-next/link` does,
 * for navigation that does not render a `<Link>`, such as `router.push()`.
 *
 * Internal paths are prefixed with the target locale, except default-locale
 * paths when `prefixDefaultLocale` is `false` (an explicit default `locale`
 * keeps its prefix while `enableSmartRouting` is on). Localized path aliases
 * and locale availability are still resolved by the middleware. External URLs
 * are never prefixed.
 *
 * @example
 * ```tsx
 * import { useLocalizeHref } from 'gt-next/link';
 *
 * export function Checkout() {
 *   const router = useRouter();
 *   const localizeHref = useLocalizeHref();
 *   return (
 *     <button onClick={() => router.push(localizeHref('/checkout'))}>
 *       Checkout
 *     </button>
 *   );
 * }
 * ```
 *
 * @returns A function taking an href and an optional locale (a locale string,
 * or `false` to leave the href unchanged) that returns the localized href.
 */
export function useLocalizeHref(): (
  href: string,
  locale?: LinkLocale
) => string {
  const currentLocale = useLocale();
  const defaultLocale = useDefaultLocale();
  return useCallback(
    (href, locale) => localizeHref(href, locale, currentLocale, defaultLocale),
    [currentLocale, defaultLocale]
  );
}
