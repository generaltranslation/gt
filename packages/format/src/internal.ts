import { intlCache } from './cache/IntlCache';

export {
  LocaleResolver,
  type LocaleResolverConstructorParams,
} from './LocaleResolver';

export function getCachedPluralRules(
  locales?: Intl.LocalesArgument
): Intl.PluralRules {
  return intlCache.get('PluralRules', locales);
}
