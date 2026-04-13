import { getI18nManager } from '../../i18n-manager/singleton-operations';
import { ResolveJsxTranslationFunction } from '../types/functions';

/**
 * Given a JsxChildren and any associated metadata needed for a hash calculation, resolve the associated translation.
 */
export const resolveJsxTranslation: ResolveJsxTranslationFunction = (
  children,
  options = {}
) => {
  const i18nManager = getI18nManager();
  const translation = i18nManager.lookupTranslation(children, {
    $format: 'JSX',
    ...options,
  });
  return translation;
};
