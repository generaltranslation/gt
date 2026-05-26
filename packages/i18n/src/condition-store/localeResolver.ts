import type { LocaleResolverConfig } from '../i18n-cache/types';
import { I18nConfig } from '../i18n-config/I18nConfig';
import { getI18nConfig } from '../i18n-config/singleton-operations';

export type LocaleCandidates = string | string[] | undefined;

/**
 * Return the best supported locale for the candidates, or undefined when none match.
 */
export function determineSupportedLocale(
  candidates: LocaleCandidates,
  config: LocaleResolverConfig = {}
): string | undefined {
  return getLocaleResolverConfig(config).determineSupportedLocale(candidates);
}

/**
 * Return the best supported locale for the candidates, falling back to the default locale.
 */
export function resolveSupportedLocale(
  candidates: LocaleCandidates,
  config: LocaleResolverConfig = {}
): string {
  return getLocaleResolverConfig(config).resolveSupportedLocale(candidates);
}

export function createLocaleResolver(config: LocaleResolverConfig = {}) {
  const i18nConfig = getLocaleResolverConfig(config);
  return (candidates?: LocaleCandidates): string =>
    i18nConfig.resolveSupportedLocale(candidates);
}

function getLocaleResolverConfig(config: LocaleResolverConfig): I18nConfig {
  if (hasLocaleResolverConfigParams(config)) {
    return new I18nConfig(config);
  }
  return getI18nConfig();
}

function hasLocaleResolverConfigParams(config: LocaleResolverConfig): boolean {
  return (
    'defaultLocale' in config ||
    'locales' in config ||
    'customMapping' in config
  );
}
