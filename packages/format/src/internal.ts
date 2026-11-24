import { intlCache } from './cache/IntlCache';

export function getCachedPluralRules(
  locales: NonNullable<Intl.LocalesArgument>,
  options?: Intl.PluralRulesOptions
): Intl.PluralRules {
  return intlCache.get('PluralRules', locales, options);
}

export {
  BRANCH_TRANSFORMATIONS,
  type BranchElementName,
} from './types-dir/jsx/content';
export { localeMatchers, snapshotLocaleConfig } from './intl/localeConfig';
export {
  defaultDefaultLocale,
  defaultLocaleMatcher,
} from './settings/settings';
export { LocaleIntl } from './intl/LocaleIntl';
export { formatIntlMessage } from './intl/formatIntlMessage';
