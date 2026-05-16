import T from "./deprecated/translation/T";
import useGT from "./deprecated/translation/hooks/useGT";
import useTranslations from "./deprecated/translation/hooks/useTranslations";
import useDefaultLocale from "./deprecated/hooks/useDefaultLocale";
import useLocale from "./deprecated/hooks/useLocale";
import useVersionId from "./deprecated/hooks/useVersionId";
import useRegion from "./deprecated/hooks/useRegion";
import GTProvider from "./deprecated/provider/GTProvider";
import Var from "./deprecated/variables/Var";
import Num from "./deprecated/variables/Num";
import Currency from "./deprecated/variables/Currency";
import DateTime from "./deprecated/variables/DateTime";
import RelativeTime from "./deprecated/variables/RelativeTime";
import { Static, Derive } from "./deprecated/variables/Derive";
import Plural from "./deprecated/branches/plurals/Plural";
import Branch from "./deprecated/branches/Branch";
import useLocales from "./deprecated/hooks/useLocales";
import useSetLocale from "./deprecated/hooks/useSetLocale";
import LocaleSelector from "./deprecated/ui/LocaleSelector";
import useLocaleSelector from "./deprecated/hooks/useLocaleSelector";
import RegionSelector from "./deprecated/ui/RegionSelector";
import type {
  DictionaryTranslationOptions,
  InlineTranslationOptions,
  RuntimeTranslationOptions,
} from "./deprecated/types-dir/types";
import { useGTClass, useLocaleProperties } from "./deprecated/hooks/useGTClass";
import { useRegionSelector } from "./deprecated/hooks/useRegionSelector";
import { useLocaleDirection } from "./deprecated/hooks/useLocaleDirection";
import { msg, decodeMsg, decodeOptions } from "./deprecated/messages/messages";
import useMessages from "./deprecated/translation/hooks/useMessages";
import { GTContext } from "./deprecated/provider/GTContext";
import useRuntimeTranslation from "./deprecated/provider/hooks/useRuntimeTranslation";
import useCreateInternalUseGTFunction from "./deprecated/provider/hooks/translation/useCreateInternalUseGTFunction";
import useCreateInternalUseTranslationsFunction from "./deprecated/provider/hooks/translation/useCreateInternalUseTranslationsFunction";
import { useCreateInternalUseTranslationsObjFunction } from "./deprecated/provider/hooks/translation/useCreateInternalUseTranslationsObjFunction";

export * from "gt-i18n/fallbacks";

export { declareStatic, derive, declareVar, decodeVars } from "gt-i18n";

export {
  Var,
  Num,
  Currency,
  DateTime,
  RelativeTime,
  Static,
  Derive,
  T,
  GTProvider,
  Plural,
  Branch,
  useGT,
  useTranslations,
  useDefaultLocale,
  useLocale,
  useLocales,
  useSetLocale,
  useLocaleSelector,
  useRegion,
  useRegionSelector,
  useGTClass,
  useLocaleProperties,
  useLocaleDirection,
  useVersionId,
  LocaleSelector,
  RegionSelector,
  DictionaryTranslationOptions,
  InlineTranslationOptions,
  RuntimeTranslationOptions,
  msg,
  decodeMsg,
  decodeOptions,
  useMessages,
  GTContext,
  useRuntimeTranslation,
  useCreateInternalUseGTFunction,
  useCreateInternalUseTranslationsFunction,
  useCreateInternalUseTranslationsObjFunction,
};
