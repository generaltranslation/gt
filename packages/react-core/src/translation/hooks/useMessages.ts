import * as React from 'react';
import useGTContext from '../../provider/GTContext';
import { _Messages, Translations } from '../../types-dir/types';
import { useable } from '../../promises/dangerouslyUsable';
import { MFunctionType } from '../../types-dir/types';
import { useCallback } from 'react';
import reactUse from '../../utils/use';

/**
 * Gets the message decoding and translation function `m` provided by `<GTProvider>`.
 *
 * @returns {Function} A translation function that accepts an encoded message, decodes it, and returns the translated value.
 *
 * @example
 * const encodedMessage = msg("Hello, world")
 * const m = useMessages();
 * m(encodedMessage) // returns "Hello, world" translated
 *
 * @example
 * const encodedMessage = msg("My name is {name}", { name: "Brian" });
 * const m = useMessages();
 * m(encodedMessage) // returns "My name is Brian" translated
 */
export default function useMessages(_messages?: _Messages): MFunctionType {
  const {
    developmentApiEnabled,
    translationRequired,
    _preloadMessages,
    _filterMessagesForPreload,
    _mFunction,
    locale,
  } = useGTContext(
    `useMessages(): No context provided. You're trying to get the m() function from the useMessages() hook, which can be called within a <GTProvider>.`
  );

  let preloadedTranslations: Translations | undefined;
  if (
    _messages &&
    reactUse &&
    developmentApiEnabled &&
    translationRequired
  ) {
    const untranslatedMessages = _filterMessagesForPreload(_messages);
    if (untranslatedMessages.length > 0) {
      preloadedTranslations = reactUse(
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

  function _m<T extends string | null | undefined>(
    encodedMsg: T,
    options: Record<string, any> = {}
  ): T extends string ? string : T {
    return _mFunction(encodedMsg, options, preloadedTranslations);
  }

  /**
   * @param {string} encodedMsg - The encoded message string, typically created by the `msg()` utility.
   * @param {InlineTranslationOptions} options
   * @returns A translation
   *
   * @example
   * const example = msg("Hello, world")
   * const m = useMessages()
   * m(example); // Translates 'Hello, world!'
   *
   * @example
   * // With a context and a custom identifier:
   * const example2 = msg("My name is name", { name: "John", $context: "name is a proper noun" })
   * const m = useMessages()
   * m(example2); // Translates 'My name is John' in context
   */
  const m = useCallback(_m, [preloadedTranslations, _mFunction]);

  return m;
}
