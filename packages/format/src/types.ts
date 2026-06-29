export type { LocaleProperties } from './locales/getLocaleProperties';
export type { CustomRegionMapping } from './locales/getRegionProperties';
export type { CustomMapping } from './locales/customLocaleMapping';
export type { CutoffFormatOptions } from './formatting/custom-formats/CutoffFormat/types';
export type { Variable, VariableType } from './types-dir/jsx/variables';
export { HTML_CONTENT_PROPS } from './types-dir/jsx/content';
export type {
  Content,
  DataFormat,
  GTProp,
  HtmlContentPropKeysRecord,
  HtmlContentPropValuesRecord,
  I18nextMessage,
  IcuMessage,
  JsxChild,
  JsxChildren,
  JsxElement,
  StringContent,
  StringFormat,
  StringMessage,
} from './types-dir/jsx/content';

export type FormatVariables = Record<
  string,
  string | number | boolean | null | undefined | Date
>;
