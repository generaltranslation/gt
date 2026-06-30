import { defaultLocaleCookieName } from '@generaltranslation/react-core/cookies';
import { getI18nConfig } from 'gt-i18n/internal';
import { noLocalesCouldBeDeterminedWarning } from '../errors/ssg';
import { defaultLocaleHeaderName } from '../utils/headers';

export type LocaleHeaderValue = string | string[] | null | undefined;

export type LocaleResolutionParams = {
  headerName: string;
  cookieName: string;
  ignorePreferredLanguages: boolean;
};

export function getLocaleResolutionParams(): LocaleResolutionParams {
  const privateConfig = JSON.parse(
    process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS || '{}'
  );

  return {
    headerName:
      privateConfig.headersAndCookies?.localeHeaderName ||
      defaultLocaleHeaderName,
    cookieName:
      privateConfig.headersAndCookies?.localeCookieName ||
      defaultLocaleCookieName,
    ignorePreferredLanguages: privateConfig.ignoreBrowserLocales || false,
  };
}

export function getAcceptLanguageCandidates(
  headerValue: LocaleHeaderValue
): string[] {
  const headerValues = Array.isArray(headerValue) ? headerValue : [headerValue];
  return headerValues.flatMap(
    (value) =>
      value
        ?.split(',')
        .map((item) => item.split(';')?.[0].trim())
        .filter(Boolean) || []
  );
}

export function resolveLocaleFromCandidates(
  preferredLocales: string[],
  ignorePreferredLanguages: boolean
): string {
  if (preferredLocales.length === 0 && !ignorePreferredLanguages) {
    console.warn(noLocalesCouldBeDeterminedWarning);
  }

  const i18nConfig = getI18nConfig();
  return (
    i18nConfig
      .getGTClass()
      .determineLocale(preferredLocales, i18nConfig.getLocales()) ||
    i18nConfig.getDefaultLocale()
  );
}
