import { libraryDefaultLocale } from 'generaltranslation/internal';
import { GTProviderProps } from '../types';
import { determineLocale } from '../../functions/determineLocale';
import { isSSREnabled } from './isSSREnabled';
import { getLocale } from '../../functions/getLocale';

/**
 * Determines the locale for the provider, must follow specific logic
 */
export function determineProviderLocale(
  props: Pick<
    GTProviderProps,
    'defaultLocale' | 'locales' | 'customMapping' | 'locale'
  >
): GTProviderProps['locale'] {
  if (props.locale) {
    return props.locale;
  } else if (isSSREnabled()) {
    // return determineLocale({
    //   defaultLocale: props.defaultLocale || libraryDefaultLocale,
    //   locales: props.locales || [libraryDefaultLocale],
    //   customMapping: props.customMapping,
    // });
    const result = getLocale();
    console.log('[determineProviderLocale](server):', result);
    return result;
  } else {
    // Locale needs to be undefined for client because locale change:
    // After refresh, there is enough time for a render cycle to execute updating the cookie back
    // to _locale (ie locale being supplied here)
    // TODO: address this issue, we should have better logic handling for post refresh
    console.log('[determineProviderLocale](client): undefined');
    return undefined;
  }
}
