import { formatMessage } from 'generaltranslation';
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
  _Messages,
  validateString,
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

  if (_messages) {
    console.log('getGT(): received content', JSON.stringify(content, null, 2));
  } else {
    console.error('getGT(): no content provided');
  }

  const I18NConfig = getI18NConfig();
  const locale = await getLocale();
  const defaultLocale = I18NConfig.getDefaultLocale();
  const [translationRequired] = I18NConfig.requiresTranslation(locale);

  const translations = translationRequired
    ? await I18NConfig.getCachedTranslations(locale)
    : undefined;

  // ---------- THE t() METHOD ---------- //

  /**
   * @param {string} content
   * @param {InlineTranslationOptions} options For translating strings, the locale to translate to.
   * @returns The translated version of content
   *
   * @example
   * t('Hello, world!'); // Translates 'Hello, world!'
   *
   * @example
   * // With a context and a custom identifier:
   * t('My name is {customName}', { customName: "John", $id: 'my-name', $context: 'a proper noun' } )); // Translates 'My name is {name}' and replaces {name} with 'John'
   */
  const t = (
    message: string,
    options: Record<string, any> & {
      $context?: string;
      $id?: string;
      $hash?: string;
    } = {}
  ) => {
    // ----- SET UP ----- //
    // Validate content
    if (!message || typeof message !== 'string') return '';

    const { $id: id, $context: context, $hash: _hash, ...variables } = options;
    console.log('options', options);
    console.log('variables', variables);

    // Check: reject invalid variables
    if (!validateString(message, variables)) {
      throw new Error(missingVariablesError(Object.keys(variables), message));
    }

    // Render Method
    const renderContent = (message: string, locales: string[]) => {
      return formatMessage(message, {
        locales,
        variables,
      });
    };

    // Check: translation required
    if (!translationRequired) return renderContent(message, [defaultLocale]);

    // ----- GET TRANSLATION ----- //

    let translationEntry;

    // Use id to index
    if (id) {
      translationEntry = translations?.[id];
    }

    // Calculate hash
    let hash = '';
    const calcHash = () =>
      hashSource({
        source: message,
        ...(context && { context }),
        ...(id && { id }),
        dataFormat: 'ICU',
      });

    // Use hash to index
    if (!translationEntry) {
      hash = calcHash();
      if (_hash) {
        if (_hash !== hash) {
          console.error(`Mismatch: Buildtime: ${_hash} Runtime: ${hash}`);
        } else {
          console.log('hash matches!');
        }
      } else {
        console.error('no $hash');
      }
      translationEntry = translations?.[hash];
    }

    // ----- RENDER TRANSLATION ----- //

    // If a translation already exists
    if (translationEntry)
      return renderContent(translationEntry as string, [locale, defaultLocale]);

    // If a translation errored
    if (translationEntry === null)
      return renderContent(message, [defaultLocale]);

    // ----- CREATE TRANSLATION ----- //
    // Since this is buildtime string translation, it's dev only

    if (!I18NConfig.isDevelopmentApiEnabled()) {
      console.warn(createStringTranslationError(message, id, 't'));
      return renderContent(message, [defaultLocale]);
    }

    // Get hash
    if (!hash) hash = calcHash();

    // Translate on demand
    I18NConfig.translateIcu({
      source: message,
      targetLocale: locale,
      options: {
        ...(context && { context }),
        ...(id && { id }),
        hash,
      },
    })
      .then((result) => {
        // Log the translation result for debugging purposes
        // eslint-disable-next-line no-console
        console.warn(
          createTranslationLoadingWarning({
            ...(id && { id }),
            source: renderContent(message, [defaultLocale]),
            translation: renderContent(result as string, [
              locale,
              defaultLocale,
            ]),
          })
        );
      })
      .catch(() => {}); // No need for error logging, error logged in I18NConfig

    // Default is returning source, rather than returning a loading state
    return renderContent(message, [defaultLocale]);
  };

  if (_messages) {
    console.log('getGT(): received content', JSON.stringify(_messages, null, 2));
    for (const msgObject of _messages) {
      const { message, ...rest } = msgObject;
      t(message, { ...rest });
    }
  } else {
    console.error('getGT(): no content provided');
  }

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
