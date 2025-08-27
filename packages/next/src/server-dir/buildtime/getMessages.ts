import getI18NConfig from '../../config-dir/getI18NConfig';
import { getLocale } from '../../server';
import { hashSource } from 'generaltranslation/id';
import {
  createStringRenderError,
  createStringTranslationError,
  createTranslationLoadingWarning,
} from '../../errors/createErrors';
import {
  InlineTranslationOptions,
  _Message,
  _Messages,
  decodeMsg,
  decodeOptions,
  reactHasUse,
} from 'gt-react/internal';
import use from '../../utils/use';

/**
 * Gets the message decoding and translation function `m` provided by `<GTProvider>`.
 *
 * @returns {Function} A translation function that accepts an encoded message, decodes it, and returns the translated value.
 *
 * @example
 * const encodedMessage = msg("Hello, world")
 * const m = await getMessages();
 * m(encodedMessage) // returns "Hello, world" translated
 *
 * @example
 * const encodedMessage = msg("My name is {name}", { name: "Brian" });
 * const m = await getMessages();
 * m(encodedMessage) // returns "My name is Brian" translated
 */
export async function getMessages(
  _messages?: _Messages
): Promise<(message: string, options?: InlineTranslationOptions) => string> {
  // ---------- SET UP ---------- //

  const I18NConfig = getI18NConfig();
  const locale = await getLocale();
  const defaultLocale = I18NConfig.getDefaultLocale();
  const [translationRequired] = I18NConfig.requiresTranslation(locale);
  const gt = I18NConfig.getGTClass();
  const translations = translationRequired
    ? await I18NConfig.getCachedTranslations(locale)
    : undefined;

  // --------- HELPER FUNCTIONS ------- //

  function initializeT(
    message: string,
    options: Record<string, any> & {
      $context?: string;
      $id?: string;
      $_hash?: string;
    } = {}
  ) {
    if (!message || typeof message !== 'string') return null;

    const { $id: id, $context: context, $_hash: _hash, ...variables } = options;

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
        ...(context && { context }),
        ...(id && { id }),
        dataFormat: 'ICU',
      });

    return {
      id,
      context,
      _hash,
      variables,
      calculateHash,
      renderMessage,
    };
  }

  function getTranslationData(
    calculateHash: () => string,
    id?: string,
    _hash?: string
  ) {
    let translationEntry;
    let hash = ''; // empty string because 1) it has to be a string but 2) we don't always need to calculate it
    if (id) {
      translationEntry = translations?.[id];
    }
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
    _messages &&
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
      const { id, context, _hash, calculateHash } = init;
      const { translationEntry, hash } = getTranslationData(
        calculateHash,
        id,
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
              ...(context && { context }),
              ...(id && { id }),
              hash,
            },
          })) as string;
      } catch (error) {
        console.warn(error);
      }
    };
    await Promise.all(_messages.map(preload));
  }

  // ---------- THE m() FUNCTION ---------- //

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
  const m = (encodedMsg: string, options: Record<string, any> = {}) => {
    // Decode message and return if it's invalid
    const decodedOptions = decodeOptions(encodedMsg);
    if (!decodedOptions || !decodedOptions.$_hash || !decodedOptions.$_source) {
      return encodedMsg;
    }

    const { $_hash, $_source, $context, $hash, $id, ...decodedVariables } =
      decodedOptions;

    const renderMessage = (msg: string, locales: string[]) => {
      return gt.formatMessage(msg, {
        locales,
        variables: { ...decodedVariables, ...options },
      });
    };

    // Return if default locale

    if (!translationRequired) return renderMessage($_source, [defaultLocale]);

    // Check translation entry

    const translationEntry = translations?.[decodedOptions.$_hash];

    // Check translations
    if (translationEntry === null) {
      return renderMessage($_source, [defaultLocale]);
    }

    // If a translation already exists
    if (translationEntry) {
      try {
        return renderMessage(translationEntry as string, [
          locale,
          defaultLocale,
        ]);
      } catch (error) {
        console.error(
          createStringRenderError($_source, decodeMsg(encodedMsg)),
          'Error: ',
          error
        );
        return renderMessage($_source, [defaultLocale]);
      }
    }

    if (!I18NConfig.isDevelopmentApiEnabled()) {
      console.warn(
        createStringTranslationError($_source, decodeMsg(encodedMsg), 't')
      );
      return renderMessage($_source, [defaultLocale]);
    }

    if (typeof preloadedTranslations?.[$_hash] !== 'undefined') {
      if (preloadedTranslations?.[$_hash]) {
        try {
          return renderMessage(preloadedTranslations?.[$_hash] as string, [
            locale,
            defaultLocale,
          ]);
        } catch (error) {
          console.error(
            createStringRenderError($_source, decodeMsg(encodedMsg)),
            'Error: ',
            error
          );
        }
      }
      return renderMessage($_source, [defaultLocale]);
    }

    // Translate on demand
    try {
      I18NConfig.translateIcu({
        source: $_source,
        targetLocale: locale,
        options: {
          ...($context && { context: $context }),
          hash: $_hash,
        },
      }).then((result) => {
        // Log the translation result for debugging purposes
        // eslint-disable-next-line no-console
        console.warn(
          createTranslationLoadingWarning({
            source: renderMessage($_source, [defaultLocale]),
            translation: renderMessage(result as string, [
              locale,
              defaultLocale,
            ]),
          })
        );
      });
    } catch (error) {
      console.warn(error);
    }

    // Default is returning source, rather than returning a loading state
    return renderMessage($_source, [defaultLocale]);
  };

  return m;
}

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
export function useMessages(_messages?: _Messages) {
  return use(getMessages(_messages));
}
