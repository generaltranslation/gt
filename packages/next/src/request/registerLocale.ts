import { getI18nConfig } from 'gt-i18n/internal';
import { localeStore } from './localeStore';
import { ensureGTServerInitialized } from '../setup/ensureGTServerInitialized';

/**
 * Set the locale for the current request context.
 * Use this in Route Handlers and OG image handlers where next/root-params is unavailable.
 * Must be called at the top of the request handler before any other gt-next functions.
 *
 * @param locale - A BCP-47 locale tag (e.g., 'en-US', 'de', 'fr')
 */
export function registerLocale(locale: string): void {
  ensureGTServerInitialized();
  const gt = getI18nConfig().getGTClass();
  localeStore.enterWith(gt.resolveAliasLocale(locale));
}
