import { localeStore } from './localeStore';

/**
 * Set the locale for the current request context.
 * Use this in Route Handlers and OG image handlers where next/root-params is unavailable.
 *
 * @param locale - A BCP-47 locale tag (e.g., 'en-US', 'de', 'fr')
 */
export function registerLocale(locale: string): void {
  localeStore.enterWith(locale);
}
