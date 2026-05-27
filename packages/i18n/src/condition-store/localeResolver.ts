import {
  I18nConfig,
  type I18nConfigParams,
  type LocaleCandidates,
} from '../i18n-config/I18nConfig';
import { getI18nConfig } from '../i18n-config/singleton-operations';

export type { LocaleCandidates } from '../i18n-config/I18nConfig';

/**
 * Return the best supported locale for the candidates, or undefined when none match.
 */
export function determineSupportedLocale(
  candidates: LocaleCandidates,
  config: I18nConfigParams = {}
): string | undefined {
  return getLocaleResolverConfig(config).determineSupportedLocale(candidates);
}

/**
 * Return the best supported locale for the candidates, falling back to the default locale.
 */
export function resolveSupportedLocale(
  candidates: LocaleCandidates,
  config: I18nConfigParams = {}
): string {
  return getLocaleResolverConfig(config).resolveSupportedLocale(candidates);
}

export function createLocaleResolver(config: I18nConfigParams = {}) {
  const i18nConfig = getLocaleResolverConfig(config);
  return (candidates?: LocaleCandidates): string =>
    i18nConfig.resolveSupportedLocale(candidates);
}

function getLocaleResolverConfig(config: I18nConfigParams): I18nConfig {
  if (hasLocaleResolverConfigParams(config)) {
    return new I18nConfig(config);
  }
  return getI18nConfig();
}

function hasLocaleResolverConfigParams(config: I18nConfigParams): boolean {
  return (
    'defaultLocale' in config ||
    'locales' in config ||
    'customMapping' in config
  );
}
