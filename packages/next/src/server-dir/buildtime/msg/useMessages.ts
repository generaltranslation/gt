import {
  _Message,
  _Messages,
  messageRegistry,
  reactHasUse,
} from 'gt-react/internal';
import use from '../../../utils/use';
import { getLocale } from '../../../server';
import getI18NConfig from '../../../config-dir/getI18NConfig';
import { hashSource } from 'generaltranslation/id';
import {
  createStringRenderError,
  createStringTranslationError,
} from '../../../errors/createErrors';

/**
 * Asynchronous function to obtain the `m()` translation function for registered ICU messages.
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
 * const m = await getMessages();
 * const welcome = m(message, { name: 'Alice' });
 *
 * @remarks
 * - You must register all messages you wish to translate using {@link msg} before calling `m()`.
 * - The returned `m()` function will only translate messages that have been registered.
 */
export async function getMessages(_messages?: _Messages): Promise<
  (
    message: string,
    options?: {
      [k: string]: string | undefined;
      $_hash?: string;
    }
  ) => string
> {

  // ---------- SET UP ---------- //

  const I18NConfig = getI18NConfig();
  const locale = await getLocale();
  const defaultLocale = I18NConfig.getDefaultLocale();
  const [translationRequired] = I18NConfig.requiresTranslation(locale);

  const gt = I18NConfig.getGTClass();

  const translations = translationRequired
    ? await I18NConfig.getCachedTranslations(locale)
    : undefined;

  // Pull the latest snapshot of registered messages from the server-side registry
  // (safe singleton; HMR-friendly).
  const snap = messageRegistry.getSnapshot();
  const registryMessages = snap?.registryMessages ?? [];

  // --------- HELPER FUNCTIONS ------- //

  function initializeT(
    message: string,
    options: Record<string, any> & {
      $_hash?: string;
    } = {}
  ) {
    if (!message || typeof message !== 'string') return null;

    const { $_hash: _hash, ...variables } = options;

    // Update renderContent to use actual variables
    const renderMessage = (msg: string, locales: string[]) => {
      return gt.formatMessage(msg, {
        locales,
        variables,
      });
    };

    // Calculate hash
    const calculateHash = () =>
      hashSource({
        source: message,
        dataFormat: 'ICU',
      });

    return {
      _hash,
      variables,
      calculateHash,
      renderMessage,
    };
  }

  function getTranslationData(
    calculateHash: () => string,
    _hash?: string
  ) {
    let translationEntry;
    let hash = ''; // empty string because 1) it has to be a string but 2) we don't always need to calculate it
    if (_hash && translations?.[_hash]) {
      hash = _hash;
      translationEntry = translations?.[_hash];
    }
    // Use calculated hash to index
    if (!translationEntry) {
      hash = calculateHash();
      translationEntry = translations?.[hash];
    }
    return {
      translationEntry,
      hash,
    };
  }

  // ---------- PRELOAD TRANSLATIONS IF _MESSAGES SUPPLIED --------- //

  let preloadedTranslations: Record<string, string> | undefined;
  if (
    reactHasUse &&
    (_messages || registryMessages.length) &&
    I18NConfig.isDevelopmentApiEnabled() &&
    translationRequired
  ) {
    preloadedTranslations = {};
    const preload = async ({
      message,
      ...options
    }: _Message): Promise<void> => {
      // Early return if possible
      if (!message) return;
      // Setup
      const init = initializeT(message, options);
      if (!init) return;
      const { _hash, calculateHash } = init;
      const { translationEntry, hash } = getTranslationData(
        calculateHash,
        _hash
      );
      // Return if no translation needed
      if (translationEntry) return;
      // Await the creation of the translation
      try {
        (preloadedTranslations as Record<string, string>)[hash] =
          (await I18NConfig.translateIcu({
            source: message,
            targetLocale: locale,
            options: {
              hash,
            },
          })) as string;
      } catch (error) {
        console.warn(error);
      }
    };
    await Promise.all([
      ..._messages || [],
      ...registryMessages
    ].map(preload));
  }

  // ---------- THE m() FUNCTION ---------- //

  /**
   * Translates a registered message using the current locale and provided variables.
   *
   * @param {string} msg - The message string to translate. This must be registered via {@link msg}.
   * @param {Object} [options] - An object containing variables to interpolate into the message, as well as optional metadata.
   * @param {string} [options.$_hash] - Optional hash to identify the message variant.
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
    message: string,
    options: Record<string, any> & {
      $_hash?: string;
    } = {}
  ) => {
    // ----- SET UP ----- //

    const init = initializeT(message, options);

    if (!init) return '';

    const { _hash, calculateHash, renderMessage } = init;

    // ----- EARLY RETURN IF TRANSLATION NOT REQUIRED ----- //

    // Check: translation required
    if (!translationRequired) return renderMessage(message, [defaultLocale]);

    // ----- GET TRANSLATION ----- //

    const { translationEntry, hash } = getTranslationData(
      calculateHash,
      _hash
    );

    // ----- RENDER TRANSLATION ----- //

    // If a translation already exists
    if (translationEntry) {
      try {
        return renderMessage(translationEntry as string, [
          locale,
          defaultLocale,
        ]);
      } catch (error) {
        console.error(error);
        return renderMessage(message, [defaultLocale]);
      }
    }

    // If it is not possible to create a translation
    if (!I18NConfig.isDevelopmentApiEnabled()) {
      console.warn(createStringTranslationError(message, undefined, 'm'));
      return renderMessage(message, [defaultLocale]);
    }

    // If the translation has been preloaded
    if (!translationEntry && preloadedTranslations?.[hash]) {
      try {
        return renderMessage(preloadedTranslations[hash], [
          locale,
          defaultLocale,
        ]);
      } catch (error) {
        console.error(createStringRenderError(message, undefined), 'Error: ', error);
        return renderMessage(message, [defaultLocale]);
      }
    }

    // Default is returning source, rather than returning a loading state
    return renderMessage(message, [defaultLocale]);
  };

  return m;
}

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
export function useMessages(_messages: _Message[]) {
  return use(getMessages(_messages));
}
