export { GTIntl } from './intl/GTIntl';
export type { LocaleConfig, ResolvedLocaleConfig } from './intl/localeConfig';

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
  getRegionProperties,
  isSameDialect,
  isSameLanguage,
  isSupersetLocale,
  isValidLocale,
  requiresTranslation,
  resolveAliasLocale,
  resolveCanonicalLocale,
  standardizeLocale,
} from './core';

export { HTML_CONTENT_PROPS } from './types';

export type {
  Content,
  ContentByFormat,
  ContentFor,
  CustomMapping,
  CustomRegionMapping,
  DataFormat,
  CutoffFormatOptions,
  FormatVariables,
  GTProp,
  HtmlContentPropKeysRecord,
  HtmlContentPropValuesRecord,
  JsxChild,
  JsxChildren,
  JsxElement,
  LocaleProperties,
  StringContent,
  StringFormat,
  Variable,
  VariableType,
} from './types';
