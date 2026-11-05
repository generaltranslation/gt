import { intlCache } from './cache/IntlCache';

export function getCachedPluralRules(
  locales?: Intl.LocalesArgument
): Intl.PluralRules {
  return intlCache.get('PluralRules', locales);
}

export { LocaleConfigBase } from './LocaleConfigBase';
