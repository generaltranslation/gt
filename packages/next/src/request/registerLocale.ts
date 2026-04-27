import getI18NConfig from '../config-dir/getI18NConfig';
import { localeStore } from './localeStore';

/**
 * Set the locale for the current request context.
 * Use this in Route Handlers and OG image handlers where next/root-params is unavailable.
 * Must be called at the top of the request handler before any other gt-next functions.
 *
 * @param locale - A BCP-47 locale tag (e.g., 'en-US', 'de', 'fr')
 */
export function registerLocale(locale: string): void {
  const gt = getI18NConfig().getGTClass();
  localeStore.enterWith(gt.resolveAliasLocale(locale));
}
