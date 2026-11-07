import {
  getTranslationsInternal,
  type TFunctionType,
} from 'gt-i18n/internal/compat';
import { use } from '../utils/use';
import { getRequestConditions } from '../request/getRequestConditions';
import { ensureNextDictionaryManager } from './dictionaries';

/**
 * Returns the dictionary translation function `t` for the current request.
 *
 * @param {string} [rootId] - Optional prefix to prepend to the dictionary keys.
 *
 * @example
 * const t = await getTranslations('user');
 * console.log(t('name')); // Translates the entry 'user.name'
 */
export async function getTranslations(rootId?: string): Promise<TFunctionType> {
  ensureNextDictionaryManager();
  const conditions = await getRequestConditions();
  return getTranslationsInternal({
    locale: conditions._locale,
    enableI18n: conditions._enableI18n,
    rootId,
  });
}

/**
 * Returns the dictionary translation function `t`.
 *
 * @param {string} [rootId] - Optional prefix to prepend to the dictionary keys.
 *
 * @example
 * const t = useTranslations('user');
 * console.log(t('name')); // Translates the entry 'user.name'
 */
export function useTranslations(rootId?: string): TFunctionType {
  return use(getTranslations(rootId));
}
