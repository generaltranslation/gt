import { useCallback, useMemo } from 'react';
import useGTContext from '../provider/GTContext';
import { writeChildrenAsObjects } from '../internal';
import { hashJsxChildren } from 'generaltranslation/id';

/**
 * Gets the translation function `t` provided by `<GTProvider>`.
 *
 * @returns {Function} A translation function that accepts a key string and returns the translated value.
 *
 * @example
 * const t = useTranslation('user');
 * console.log(t('To be or not to be...'));
 *
 * const t = useTranslation();
 * return (<> {t('...that is the question')} </>);
 */
export default function useTranslation() {
  const { getContentTranslation } = useGTContext(
    `useTranslation(): No context provided. You're trying to get the t() function from the useTranslation() hook, which can be invoked within a <GTProvider>.`
  );

  /**
   * @param content String to translate
   * @param id Optional custom identifier for translation
   * @param options Optional options for the translation and variable insertion
   * @returns {string} A promise of a translated string.
   */
  function t(
    content: string = '',
    id: string = '',
    options: Record<string, any> = {}
  ): string {
    if (getContentTranslation) {
      return getContentTranslation(content, id, options);
    }
    return '';
  }

  return t;
}
