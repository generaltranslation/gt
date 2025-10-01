import * as React from 'react';
import useGTContext from '../../provider/GTContext';
import { _Messages, Translations } from '../../types/types';
import { useable } from '../../promises/dangerouslyUsable';
import { reactHasUse } from '../../promises/reactHasUse';
import { useCallback } from 'react';

/**
 * Gets the translation function `gt` provided by `<GTProvider>`.
 *
 * @returns {Function} A translation function that accepts an ICU message format string and returns the translation of that string.
 *
 * @example
 * const gt = useGT();
 * console.log(gt('To be or not to be...'));
 *
 * @example
 * const gt = useGT();
 * gt('My name is {customName}', { customName: "Brian", id: 'my-name', context: 'a proper noun' } )
 */
export default function useGT(_messages?: _Messages) {
  const {
    developmentApiEnabled,
    translationRequired,
    _preloadMessages,
    _filterMessagesForPreload,
    _tFunction,
    locale,
  } = useGTContext(
    `useGT(): No context provided. You're trying to get the gt() function from the useGT() hook, which can be called within a <GTProvider>.`
  );

  let preloadedTranslations: Translations | undefined;
  if (
    _messages &&
    reactHasUse &&
    developmentApiEnabled &&
    translationRequired
  ) {
    const untranslatedMessages = _filterMessagesForPreload(_messages);
    if (untranslatedMessages.length > 0) {
      preloadedTranslations = React.use(
        useable(
          [
            '_preloadMessages', // prefix key
            locale, // should change on locale
            JSON.stringify(untranslatedMessages), // should change when messages change
          ],
          () => _preloadMessages(untranslatedMessages)
        )
      );
    }
  }

  /**
   * @param {string} message
   * @param {InlineTranslationOptions} options Interpolated variables and translation context.
   * @returns The translated version of content
   *
   * @example
   * gt('Hello, world!'); // Translates 'Hello, world!'
   *
   * @example
   * // With a context and a custom identifier:
   * gt('My name is {name}', { name: "John", $context: 'name is a proper noun' } )); // Translates 'My name is {name}' and replaces {name} with 'John'
   */
  function _gt(
    string: string,
    options: Record<string, any> & {
      $id?: string;
      $context?: string;
      $_hash?: string;
    } = {}
  ): string {
    return _tFunction(string, options, preloadedTranslations);
  }
  const gt = useCallback(_gt, [preloadedTranslations, _tFunction]);

  return gt;
}
