import { Suspense, use, useEffect, useMemo, useRef } from 'react';
import useGTContext from '../../provider/GTContext';
import { _Messages } from '../../types/types';

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
export default function useGT(_messages?: _Messages) {
  const {
    runtimeTranslationEnabled,
    translationRequired,
    _preloadMessages,
    _tFunction,
    locale,
  } = useGTContext(
    `useGT(): No context provided. You're trying to get the t() function from the useGT() hook, which can be called within a <GTProvider>.`
  );

  const promiseRef = useRef<Promise<void> | null>(null);

  if (_messages && runtimeTranslationEnabled && translationRequired && !promiseRef.current) {
    // Create the Promise only once and store it in the ref
    promiseRef.current = _preloadMessages(_messages);
  }

  /**
   * @param {string} message
   * @param {InlineTranslationOptions} options For translating strings, the locale to translate to.
   * @returns The translated version of content
   *
   * @example
   * t('Hello, world!'); // Translates 'Hello, world!'
   *
   * @example
   * // With a context and a custom identifier:
   * t('My name is {name}', { name: "John", $context: 'name is a proper noun' } )); // Translates 'My name is {name}' and replaces {name} with 'John'
   */
  function t(
    string: string,
    options: Record<string, any> & {
      $id?: string;
      $context?: string;
      $_hash?: string;
    } = {}
  ): string {
    return _tFunction(string, options);
  }

  return t;
}
