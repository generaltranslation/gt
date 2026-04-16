import { tx } from 'gt-i18n/internal';

/**
 * Internal runtime translate string function for dev only
 */
const GtInternalRuntimeTranslateString: typeof tx = (content, options) => {
  // Mark as ICU because that is the default format used for compiler collected translations (gt, t, msg)
  return tx(content, { $format: 'ICU', ...options });
};

export { GtInternalRuntimeTranslateString };
