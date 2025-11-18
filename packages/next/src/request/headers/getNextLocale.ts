import { cookies, headers } from 'next/headers';
import getI18NConfig from '../../config-dir/getI18NConfig';
import { noLocalesCouldBeDeterminedWarning } from '../../errors';
import { RequestFunctionReturnType } from '../types';

/**
 * Retrieves the 'accept-language' header from the headers list.
 * If the 'next/headers' module is not available, it attempts to load it. If the
 * headers function is available, it returns the primary language from the 'accept-language'
 * header.
 *
 * @returns {Promise<string>} A promise that resolves to the primary language from the
 * 'accept-language' header.
 */
export async function getNextLocale(): Promise<RequestFunctionReturnType> {
  const [headersList, cookieStore] = await Promise.all([headers(), cookies()]);

  const I18NConfig = getI18NConfig();
  const defaultLocale = I18NConfig.getDefaultLocale();
  const locales = I18NConfig.getLocales();

  const preferredLocales: string[] = [];

  // Language routed to by middleware
  const headerLocale = headersList.get(I18NConfig.getLocaleHeaderName());
  if (headerLocale) {
    preferredLocales.push(headerLocale);
  }
  const cookieLocale = cookieStore.get(I18NConfig.getLocaleCookieName());
  if (cookieLocale?.value) {
    preferredLocales.push(cookieLocale.value);
  }

  // Browser languages, in preference order
  if (process.env._GENERALTRANSLATION_IGNORE_BROWSER_LOCALES === 'false') {
    const acceptedLocales = headersList
      .get('accept-language')
      ?.split(',')
      .map((item: string) => item.split(';')?.[0].trim());

    if (acceptedLocales) preferredLocales.push(...acceptedLocales);
  }

  // Give an error here
  if (
    preferredLocales.length === 0 &&
    process.env._GENERALTRANSLATION_IGNORE_BROWSER_LOCALES === 'false'
  ) {
    console.warn(noLocalesCouldBeDeterminedWarning);
  }

  // add defaultLocale just in case there are no matches
  preferredLocales.push(defaultLocale);

  const gt = getI18NConfig().getGTClass();
  return gt.determineLocale(preferredLocales, locales);
}
