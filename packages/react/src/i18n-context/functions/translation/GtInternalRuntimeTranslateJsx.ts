import { resolveJsxWithRuntimeFallback } from 'gt-i18n/internal';

/**
 * Internal runtime translate JSX function for dev only
 */
const GtInternalRuntimeTranslateJsx: typeof resolveJsxWithRuntimeFallback = (
  content,
  options
) => {
  // Mark as JSX because that is the default format used for compiler collected T-component translations
  return resolveJsxWithRuntimeFallback(content, { $format: 'JSX', ...options });
};

export { GtInternalRuntimeTranslateJsx };
