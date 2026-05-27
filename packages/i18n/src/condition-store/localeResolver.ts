import {
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
  return getI18nConfig().determineSupportedLocale(candidates, config);
}

/**
 * Return the best supported locale for the candidates, falling back to the default locale.
 */
export function resolveSupportedLocale(
  candidates: LocaleCandidates,
  config: I18nConfigParams = {}
): string {
  return getI18nConfig().resolveSupportedLocale(candidates, config);
}

export function createLocaleResolver(config: I18nConfigParams = {}) {
  return (candidates?: LocaleCandidates): string =>
    getI18nConfig().resolveSupportedLocale(candidates, config);
}
