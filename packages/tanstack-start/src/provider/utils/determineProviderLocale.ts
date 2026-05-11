import { GTProviderProps } from '../types';
import { isSSREnabled } from './isSSREnabled';
import { getLocale } from 'gt-i18n';

/**
 * Determines the locale for the provider, must follow specific logic
 */
export function determineProviderLocale(
  props: Partial<Pick<GTProviderProps, 'locale'>>
): string | undefined {
  if (typeof props.locale === 'string') {
    return props.locale;
  } else if (isSSREnabled()) {
    return getLocale();
  } else {
    // Locale needs to be undefined for client because locale change:
    // After refresh, there is enough time for a render cycle to execute updating the cookie back
    // to _locale (ie locale being supplied here)
    // TODO: address this issue, we should have better logic handling for post refresh
    return undefined;
  }
}
