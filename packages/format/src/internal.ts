import { intlCache } from './cache/IntlCache';

export function getCachedPluralRules(
  locales: string | readonly string[]
): Intl.PluralRules {
  return intlCache.get('PluralRules', locales);
}
