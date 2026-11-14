import { intlCache } from './cache/IntlCache';

export function getCachedPluralRules(
  locales: NonNullable<Intl.LocalesArgument>
): Intl.PluralRules {
  return intlCache.get('PluralRules', locales);
}

export { localeMatchers, snapshotLocaleConfig } from './intl/localeConfig';
export { defaultLocaleMatcher } from './settings/settings';
