import { getPathnameForLocale } from 'gt-i18n/internal';
import {
  GTProvider as ReactGTProvider,
  type SharedGTProviderProps,
} from 'gt-react';
import { isLocaleRoutingEnabled } from '../setup/initializeGT';

/** Opens the current page at the URL for the new locale. */
function navigateToLocale({ locale }: { locale: string }): void {
  const url = new URL(window.location.href);
  url.pathname = getPathnameForLocale(url.pathname, locale);
  window.location.assign(url.href);
}

/**
 * gt-react's GTProvider. With locale routing, changing the locale navigates
 * to the page's URL for that locale instead of reloading the current one.
 */
export function GTProvider(props: SharedGTProviderProps) {
  const reload =
    props._reload ?? (isLocaleRoutingEnabled() ? navigateToLocale : undefined);
  return <ReactGTProvider {...props} _reload={reload} />;
}
