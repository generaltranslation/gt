import useGTContext from '../../provider/GTContext';
import { InlineTranslationOptions } from '../../types/types';

/**
 * Gets the translation function `t` provided by `<GTProvider>`.
 *
 * @returns {Function} A translation function that accepts a key string and returns the translated value.
 *
 * @example
 * const t = useGT();
 * console.log(t('To be or not to be...'));
 *
 * const t = useGT();
 * return (<>
 *  {
 *     t('My name is {customName}', { variables: { customName: "Brian" } } )
 *  }
 * </>);
 *
 */
export default function useGT() {
  const { _internalUseGTFunction } = useGTContext(
    `useGT(): No context provided. You're trying to get the t() function from the useGT() hook, which can be invoked within a <GTProvider>.`
  );

  /**
   * @param {string} string String to translate
   * @param {InlineTranslationOptions} options Options for the translation and variable insertion
   * @returns {string} A translated string.
   */
  function t(
    string: string, 
    options: InlineTranslationOptions = {}
  ): string {
    return (_internalUseGTFunction as any)(string, options);
  }

  return t;
}
