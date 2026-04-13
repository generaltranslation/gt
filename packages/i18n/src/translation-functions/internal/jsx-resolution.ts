import { ResolveJsxTranslationFunction } from '../types/functions';
import { resolveJsx } from './helpers';

/**
 * Given a JsxChildren and any associated metadata needed for a hash calculation, resolve the associated translation.
 * @deprecated use resolveJsx instead
 */
export const resolveJsxTranslation: ResolveJsxTranslationFunction = (
  children,
  options = {}
) => {
  return resolveJsx(children, options);
};
