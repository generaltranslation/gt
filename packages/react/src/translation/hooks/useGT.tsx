import useGTContext from '../../provider/GTContext';

/**
 * Gets the translation function `t` provided by `<GTProvider>`.
 *
 * @returns {Function} A translation function that accepts a key string and returns the translated value.
 *
 * @example
 * const t = useGT();
 * console.log(t('To be or not to be...'));
 *
 * @example
 * const t = useGT();
 * return (<>
 *  {
 *     t('My name is {customName}', { customName: "Brian", id: 'my-name', context: 'a proper noun' } )
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
   * @param {string} [options.context] Additional context for the translation to help resolve ambiguous phrases (e.g., 'a formal greeting', 'as in a pop-up notification')
   * @param {string} [options.id] An optional identifier for use with the translation editor to ensure consistent translation across your app
   * @returns {string} A translated string.
   */
  function t(
    string: string,
    options: Record<string, any> & {
      $id?: string;
      $context?: string;
    } = {}
  ): string {
    return (_internalUseGTFunction as any)(string, options);
  }

  return t;
}
