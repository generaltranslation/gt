import { getTranslationsInternal } from 'gt-i18n/internal';
import type {
  DictionaryTranslationOptions,
  TFunctionType,
} from 'gt-i18n/types';
import { getDictionary } from '../../dictionary/getDictionary';
import { getI18NConfig } from '../../config-dir/getI18NConfig';
import { getRequestConditions } from '../../request/getRequestConditions';
import { use } from '../../utils/use';

/**
 * Returns the dictionary access function t(), which is used to translate an item from the dictionary.
 *
 * @param {string} [id] - Optional prefix to prepend to the translation keys.
 * @returns {Function} A translation function that accepts a key string and returns the translated value.
 *
 * @example
 * const t = await getTranslations('user');
 * console.log(t('name')); // Translates item 'user.name'
 *
 * const t = await getTranslations();
 * console.log(t('hello')); // Translates item 'hello'
 */
export async function getTranslations(id?: string): Promise<TFunctionType> {
  const I18NConfig = getI18NConfig();

  // Seed the source dictionary into the i18n cache
  I18NConfig.setSourceDictionary((await getDictionary()) || {});

  const { _locale: locale, _enableI18n: enableI18n } =
    await getRequestConditions();
  const t = await getTranslationsInternal({ locale, enableI18n });
  if (!id) return t;

  // Prepend the id prefix to translation keys
  const prefixedT = ((suffix: string, options?: DictionaryTranslationOptions) =>
    t(`${id}.${suffix}`, options)) as TFunctionType;
  prefixedT.obj = (suffix: string) => t.obj(`${id}.${suffix}`);
  return prefixedT;
}

/**
 * Returns the dictionary access function t(), which is used to translate an item from the dictionary.
 *
 * @param {string} [id] - Optional prefix to prepend to the translation keys.
 * @returns {Function} A translation function that accepts a key string and returns the translated value.
 *
 * @example
 * const t = useTranslations('user');
 * console.log(t('name')); // Translates item 'user.name'
 *
 * const t = useTranslations();
 * console.log(t('hello')); // Translates item 'hello'
 */
export function useTranslations(id?: string): TFunctionType {
  return use(getTranslations(id));
}
