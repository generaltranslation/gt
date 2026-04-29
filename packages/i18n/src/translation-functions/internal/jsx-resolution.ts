import { JsxChildren } from 'generaltranslation/types';
import { JsxTranslationOptions } from '../types/options';
import { resolveJsx } from './helpers';

/**
 * Given a JsxChildren and any associated metadata needed for a hash calculation, resolve the associated translation.
 * @deprecated use resolveJsx instead
 */
export function resolveJsxTranslation(
  children: JsxChildren,
  options: JsxTranslationOptions = {}
) {
  return resolveJsx(children, options);
}
