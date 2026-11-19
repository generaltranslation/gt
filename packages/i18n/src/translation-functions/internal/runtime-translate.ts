import type { JsxChildren } from '@generaltranslation/format';
import { getLocale } from '../../helpers/locale';
import type { JsxTranslationOptions } from '../types/options';
import { resolveJsxWithRuntimeFallback } from './helpers';

type RuntimeJsxTranslationOptions = JsxTranslationOptions & {
  $locale?: string;
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
