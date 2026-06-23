import type { LocaleProperties } from './locales/getLocaleProperties';
import type { CustomRegionMapping } from './locales/getRegionProperties';
import type { CustomMapping } from './locales/customLocaleMapping';
import type { CutoffFormatOptions } from './formatting/custom-formats/CutoffFormat/types';
import type { Variable, VariableType } from './types-dir/jsx/variables';
import {
  HTML_CONTENT_PROPS,
  type Content,
  type DataFormat,
  type GTProp,
  type HtmlContentPropKeysRecord,
  type HtmlContentPropValuesRecord,
  type I18nextMessage,
  type IcuMessage,
  type JsxChild,
  type JsxChildren,
  type JsxElement,
  type StringContent,
  type StringFormat,
  type StringMessage,
} from './types-dir/jsx/content';

export { HTML_CONTENT_PROPS };

export type {
  Content,
  CustomMapping,
  CustomRegionMapping,
  CutoffFormatOptions,
  DataFormat,
  GTProp,
  HtmlContentPropKeysRecord,
  HtmlContentPropValuesRecord,
  I18nextMessage,
  IcuMessage,
  JsxChild,
  JsxChildren,
  JsxElement,
  LocaleProperties,
  StringContent,
  StringFormat,
  StringMessage,
  Variable,
  VariableType,
};

export type FormatVariables = Record<string, unknown>;
