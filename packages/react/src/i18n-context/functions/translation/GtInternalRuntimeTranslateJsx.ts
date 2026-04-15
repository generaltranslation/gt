import { resolveJsxWithRuntimeFallback } from 'gt-i18n/internal';

/**
 * Internal runtime translate JSX function for dev only
 */
const GtInternalRuntimeTranslateJsx: typeof resolveJsxWithRuntimeFallback = (
  content,
  options
) => {
  // Mark as ICU because that is the default format used for compiler collected translations (gt, t, msg)
  return resolveJsxWithRuntimeFallback(content, { $format: 'JSX', ...options });
};

export { GtInternalRuntimeTranslateJsx };
