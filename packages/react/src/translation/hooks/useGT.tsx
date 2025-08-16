import { Suspense, use, useEffect, useMemo, useRef, useState } from 'react';
import useGTContext from '../../provider/GTContext';
import { _Messages, Translations } from '../../types/types';
import { peek, useable } from './dangerouslyUsable';

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

  let preloadedTranslations: Translations | undefined;
  if (_messages && translationRequired && runtimeTranslationEnabled) {
    // console.log(_messages && translationRequired)
    preloadedTranslations = use(
      useable(['_preloadMessages', locale], () => _preloadMessages(_messages), {
        ttl: 60_000,
      })
    );
  }
  console.log(preloadedTranslations);

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
    return _tFunction(string, options, preloadedTranslations);
  }

  return t;
}
