import { getI18NConfig } from '../config-dir/getI18NConfig';
import { localeStore } from './localeStore';
import { resolveLocaleOrDefault } from './localeValidation';

/**
 * Set the locale for the current request context.
 * Use this in Route Handlers and OG image handlers where next/root-params is unavailable.
 * Must be called at the top of the request handler before any other gt-next functions.
 *
 * @param locale - A locale candidate to use for this request.
 */
export function registerLocale(locale: string): void {
  const I18NConfig = getI18NConfig();
  const gt = I18NConfig.getGTClass();
  localeStore.enterWith(resolveLocaleOrDefault(locale, I18NConfig, gt));
}
