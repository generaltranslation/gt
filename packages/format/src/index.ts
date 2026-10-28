export { GTIntl } from './intl/GTIntl';
export type {
  LocaleConfig,
  LocaleMatcher,
  ResolvedLocaleConfig,
} from './intl/localeConfig';

export {
  determineLocale,
  formatCurrency,
  formatCutoff,
  formatDateTime,
  formatList,
  formatListToParts,
  formatMessage,
  formatNum,
  formatRelativeTime,
  formatRelativeTimeFromDate,
  getLocaleDirection,
  getLocaleEmoji,
  getLocaleName,
  getLocaleProperties,
  isSameDialect,
  isSameLanguage,
  isSupersetLocale,
  isValidLocale,
  requiresTranslation,
  resolveAliasLocale,
  resolveCanonicalLocale,
  standardizeLocale,
} from './core';

export { getRegionProperties } from './locales/getRegionProperties';

export { HTML_CONTENT_PROPS } from './types-dir/jsx/content';

export type { LocaleProperties } from './locales/getLocaleProperties';
export type { CustomRegionMapping } from './locales/getRegionProperties';
export type { CustomMapping } from './locales/customLocaleMapping';
export type { CutoffFormatOptions } from './formatting/custom-formats/CutoffFormat/types';
export type { Variable, VariableType } from './types-dir/jsx/variables';
export type {
  Content,
  ContentByFormat,
  ContentFor,
  DataFormat,
  GTProp,
  HtmlContentPropKeysRecord,
  HtmlContentPropValuesRecord,
  JsxChild,
  JsxChildren,
  JsxElement,
  StringContent,
  StringFormat,
} from './types-dir/jsx/content';
export type { FormatVariables } from './types';
