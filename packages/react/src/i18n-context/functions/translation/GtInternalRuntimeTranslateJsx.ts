import { resolveJsxWithRuntimeFallback } from 'gt-i18n/internal';
import type { JsxTranslationOptions } from 'gt-i18n/types';
import type { JsxChildren } from 'generaltranslation/types';

/**
 * Internal runtime translate JSX function for dev only
 */
const GtInternalRuntimeTranslateJsx = (
  content: JsxChildren,
  options: JsxTranslationOptions = {}
) => {
  // Mark as JSX because that is the default format used for compiler collected T-component translations
  return resolveJsxWithRuntimeFallback(content, {
    $format: 'JSX',
    ...options,
  });
};

export { GtInternalRuntimeTranslateJsx };
