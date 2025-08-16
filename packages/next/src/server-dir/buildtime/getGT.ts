import getI18NConfig from '../../config-dir/getI18NConfig';
import { getLocale } from '../../server';
import { hashSource } from 'generaltranslation/id';
import {
  createStringTranslationError,
  missingVariablesError,
  createTranslationLoadingWarning,
} from '../../errors/createErrors';
import {
  InlineTranslationOptions,
  _Message,
  _Messages,
} from 'gt-react/internal';
import use from '../../utils/use';

/**
 * getGT() returns a function that translates a string, being marked as translated at build time.
 *
 * @returns A promise of the t() function used for translating strings
 *
 * @example
 * const t = await getGT();
 * console.log(t('Hello, world!')); // Translates 'Hello, world!'
 */
export async function getGT(
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
      if (_hash && _hash !== hash) {
        console.error(
          `Hash mismatch: Buildtime: "${_hash}". Runtime: "${hash}"`
        );
      }
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

  // ---------- THE t() FUNCTION ---------- //

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
  const t = (
    message: string,
    options: Record<string, any> & {
      $context?: string;
      $id?: string;
      $_hash?: string;
    } = {}
  ) => {
    // ----- SET UP ----- //

    const init = initializeT(message, options);

    if (!init) return '';

    const { id, context, _hash, calculateHash, renderMessage } = init;

    // ----- EARLY RETURN IF TRANSLATION NOT REQUIRED ----- //

    // Check: translation required
    if (!translationRequired) return renderMessage(message, [defaultLocale]);

    // ----- GET TRANSLATION ----- //

    const { translationEntry, hash } = getTranslationData(
      calculateHash,
      id,
      _hash
    );

    // ----- RENDER TRANSLATION ----- //

    // If a translation already exists
    if (translationEntry) {
      return renderMessage(translationEntry as string, [locale, defaultLocale]);
    }

    // If it is not possible to create a translation
    if (!I18NConfig.isDevelopmentApiEnabled()) {
      console.warn(createStringTranslationError(message, id, 't'));
      return renderMessage(message, [defaultLocale]);
    }

    // If the translation has been preloaded
    if (!translationEntry && preloadedTranslations?.[hash]) {
      return renderMessage(preloadedTranslations[hash], [
        locale,
        defaultLocale,
      ]);
    }

    // ----

    // Translate on demand
    try {
      I18NConfig.translateIcu({
        source: message,
        targetLocale: locale,
        options: {
          ...(context && { context }),
          ...(id && { id }),
          hash,
        },
      }).then((result) => {
        // Log the translation result for debugging purposes
        // eslint-disable-next-line no-console
        console.warn(
          createTranslationLoadingWarning({
            ...(id && { id }),
            source: renderMessage(message, [defaultLocale]),
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
    return renderMessage(message, [defaultLocale]);
  };

  return t;
}

/**
 * useGT() returns a function that translates a string, being marked as translated at build time.
 *
 * @returns A promise of the t() function used for translating strings
 *
 * @example
 * const t = useGT();
 * console.log(t('Hello, world!')); // Translates 'Hello, world!'
 */
export function useGT(_messages?: _Messages) {
  return use(getGT(_messages));
}
