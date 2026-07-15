import type {
  JsxChildren,
  StringFormat,
} from '@generaltranslation/format/types';
import { getLocale } from '../../helpers/locale';
import type {
  JsxTranslationOptions,
  RuntimeTranslationOptions,
} from '../types/options';
import { resolveJsxWithRuntimeFallback } from './helpers';
import { txPrefetch } from './tx';

type RuntimeStringTranslationOptions = Omit<
  RuntimeTranslationOptions,
  '$format'
> & {
  $format?: StringFormat;
};

type RuntimeJsxTranslationOptions = JsxTranslationOptions & {
  $locale?: string;
};

export const GtInternalRuntimeTranslateString = (
  content: string,
  options: RuntimeStringTranslationOptions = {}
) => {
  // Prefetch/registration only — the compiler-injected call discards the
  // result, and variable values are unavailable here, so the translation
  // must not be interpolated.
  return txPrefetch(content, { $format: 'ICU', ...options });
};

export const GtInternalRuntimeTranslateJsx = (
  content: JsxChildren,
  options: RuntimeJsxTranslationOptions = {}
) => {
  const locale = options.$locale ?? getLocale();
  return resolveJsxWithRuntimeFallback(locale, content, {
    $format: 'JSX',
    ...options,
  });
};
