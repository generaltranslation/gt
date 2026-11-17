import { intlCache } from './cache/IntlCache';

export function getCachedPluralRules(
  locales: NonNullable<Intl.LocalesArgument>,
  options?: Intl.PluralRulesOptions
): Intl.PluralRules {
  return intlCache.get('PluralRules', locales, options);
}

export { localeMatchers, snapshotLocaleConfig } from './intl/localeConfig';
export {
  defaultDefaultLocale,
  defaultLocaleMatcher,
} from './settings/settings';
