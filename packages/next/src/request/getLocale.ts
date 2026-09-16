// @ts-expect-error: resolved by Next aliases or gt-next package exports.
import * as getLocaleModule from 'gt-next/internal/_getLocale';
import { cookies, headers } from 'next/headers';
import { getI18nConfig, parseAcceptLanguage } from 'gt-i18n/internal';
import { defaultLocaleCookieName } from '@generaltranslation/react-core/pure';
import type { BaseWithGTConfigProps } from '../config-dir/props/withGTConfigProps';
import { use } from '../utils/use';
import { noLocalesCouldBeDeterminedWarning } from '../errors/ssg';
import { customGetLocaleUnresolvedWarning } from '../errors/createErrors';
import { defaultLocaleHeaderName } from '../utils/headers';
import { getRegisteredLocale } from './registerLocale';
import { resolveLocaleOrDefault } from './localeValidation';
import { resolveRequestFunction } from './resolveRequestFunction';

type RequestConfig = Pick<
  BaseWithGTConfigProps,
  'headersAndCookies' | 'ignoreBrowserLocales'
>;

const requestConfig = JSON.parse(
  process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS || '{}'
) as RequestConfig;
const customGetLocale =
  process.env._GENERALTRANSLATION_CUSTOM_GET_LOCALE_ENABLED === 'true'
    ? resolveRequestFunction<string>(
        getLocaleModule,
        'getLocale',
        customGetLocaleUnresolvedWarning
      )
    : undefined;

/**
 * Gets the user's current locale.
 *
 * @returns {Promise<string>} The user's locale, e.g., 'en-US'.
 *
 * @example
 * const locale = await getLocale();
 * console.log(locale); // 'en-US'
 */
export async function getLocale(): Promise<string> {
  const registeredLocale = getRegisteredLocale();
  if (registeredLocale) return registeredLocale;

  return resolveLocaleOrDefault(await getConfiguredLocale());
}

export function useLocale() {
  return use(getLocale());
}

async function getConfiguredLocale(): Promise<string> {
  if (customGetLocale) return customGetLocale();

  const preferredLocales: string[] = [];
  const headersList = await headers();
  const headerLocale = headersList.get(
    requestConfig.headersAndCookies?.localeHeaderName ?? defaultLocaleHeaderName
  );
  if (headerLocale) preferredLocales.push(headerLocale);

  const cookieLocale = (await cookies()).get(
    requestConfig.headersAndCookies?.localeCookieName ?? defaultLocaleCookieName
  );
  if (cookieLocale?.value) preferredLocales.push(cookieLocale.value);

  if (!requestConfig.ignoreBrowserLocales) {
    preferredLocales.push(
      ...parseAcceptLanguage(headersList.get('accept-language'))
    );
    if (preferredLocales.length === 0) {
      console.warn(noLocalesCouldBeDeterminedWarning);
    }
  }

  const i18nConfig = getI18nConfig();
  return (
    i18nConfig.determineSupportedLocale(preferredLocales) ??
    i18nConfig.getDefaultLocale()
  );
}
