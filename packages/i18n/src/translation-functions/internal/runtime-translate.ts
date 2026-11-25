import type { JsxChildren } from '@generaltranslation/format';
import { getLocale } from '../../helpers/locale';
import type { JsxLookupOptions } from '../types/options';
import { resolveJsxWithRuntimeFallback } from './helpers';

type RuntimeJsxLookupOptions = JsxLookupOptions & {
  $locale?: string;
};

export const GtInternalRuntimeTranslateJsx = (
  content: JsxChildren,
  options: RuntimeJsxLookupOptions = {}
) => {
  const locale = options.$locale ?? getLocale();
  return resolveJsxWithRuntimeFallback(locale, content, {
    $format: 'JSX',
    ...options,
  });
};
