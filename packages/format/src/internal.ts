import { intlCache } from './cache/IntlCache';
export {
  getDefaultStringFormat,
  isStringFormat,
} from './formatting/defaultStringFormat';

export function getCachedPluralRules(
  locales?: Intl.LocalesArgument
): Intl.PluralRules {
  return intlCache.get('PluralRules', locales);
}
