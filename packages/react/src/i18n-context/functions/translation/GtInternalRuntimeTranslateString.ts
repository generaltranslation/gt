import { tx } from 'gt-i18n/internal';
import type { RuntimeTranslationOptions } from 'gt-i18n/types';
import type { StringFormat } from 'generaltranslation/types';

type RuntimeStringTranslationOptions = Omit<
  RuntimeTranslationOptions,
  '$format'
> & {
  $format?: StringFormat;
};

/**
 * Internal runtime translate string function for dev only
 */
const GtInternalRuntimeTranslateString = (
  content: string,
  options: RuntimeStringTranslationOptions = {}
) => {
  // Mark as ICU because that is the default format used for compiler collected translations (gt, t, msg)
  return tx(content, { $format: 'ICU', ...options });
};

export { GtInternalRuntimeTranslateString };
