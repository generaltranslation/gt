import useGTContext from '../../provider/GTContext';
import { useRegistryMessages } from '../../msg/useRegistryMessages';
import { _Messages, reactHasUse } from '../../internal';
import React from 'react';
import { useable } from '../../promises/dangerouslyUsable';

/* ----- USE MESSAGES HOOK ----- */

/**
 * React hook to obtain the `m()` translation function for registered ICU messages.
 *
 * This hook provides a translation function for messages that have been registered
 * using the {@link msg} function. It must be used in conjunction with `msg()` to ensure
 * messages are available for translation and extraction workflows.
 *
 * @returns {(msg: string, options?: { [variable: string]: string | undefined; $id?: string; $_hash?: string }) => string}
 *   The `m()` function for translating registered messages.
 *
 * @example
 * // Register your messages at the top level of your file or component
 * const message = msg('Welcome, {name}!');
 *
 * // Use the m() function inside your component
 * const m = useMessages();
 * const welcome = m(message, { name: 'Alice' });
 *
 * @remarks
 * - You must register all messages you wish to translate using {@link msg} before calling `m()`.
 * - This hook must be used within a `<GTProvider>`.
 * - The returned `m()` function will only translate messages that have been registered.
 */
export function useMessages(_messages?: _Messages) {
  const {
    developmentApiEnabled,
    translationRequired,
    locale,
    _preloadMessages,
    _filterMessagesForPreload,
    _mFunction,
  } = useGTContext(
    `useMessages(): No context provided. You're trying to get the m() function from the useMessages() hook, which can be called within a <GTProvider>.`
  );

  // relocate to provider
  const messageSet = useRegistryMessages();

  let preloadedTranslations = {};
  if (
    developmentApiEnabled &&
    translationRequired &&
    reactHasUse &&
    (messageSet || _messages)
  ) {
    const untranslatedMessages = _filterMessagesForPreload([
      ...(_messages || []),
      ...(messageSet
        ? Array.from(messageSet, (message: string) => ({ message }))
        : []),
    ]);
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
   * Translates a registered message using the current locale and provided variables.
   *
   * @param {string} msg - The message string to translate. This must be registered via {@link msg}.
   * @param {Object} [options] - An object containing variables to interpolate into the message, as well as optional metadata.
   * @returns {string} The translated and interpolated message string.
   *
   * @example
   * const m = useMessages();
   * m('Hello, {name}!', { name: 'Alice' }); // "Hello, Alice!" (translated if available)
   *
   * @remarks
   * - Only messages registered with {@link msg} will be translated.
   * - If a translation is not available, the source message will be returned.
   * - This function is locale-aware and will use the current locale from context.
   */
  const m = (
    msg: string,
    options: {
      [variable: string]: string | undefined;
      $_hash?: string;
    } = {}
  ) => {
    return _mFunction(msg, options, preloadedTranslations, messageSet);
  };

  return m;
}
