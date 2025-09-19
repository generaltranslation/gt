import {
  collectUntranslatedEntries,
  Dictionary,
  DictionaryEntry,
  DictionaryTranslationOptions,
  getDictionaryEntry,
  getEntryAndMetadata,
  getSubtreeWithCreation,
  injectAndMerge,
  injectEntry,
  injectFallbacks,
  injectHashes,
  injectTranslations,
  isDictionaryEntry,
  isValidDictionaryEntry,
  mergeDictionaries,
  stripMetadataFromEntries,
} from 'gt-react/internal';

import getDictionary from '../../dictionary/getDictionary';
import {
  createDictionaryTranslationError,
  createInvalidDictionaryEntryWarning,
  createInvalidDictionaryTranslationEntryWarning,
  createNoEntryFoundWarning,
  createTranslationLoadingWarning,
} from '../../errors/createErrors';
import getI18NConfig from '../../config-dir/getI18NConfig';
import { getLocale } from '../../request/getLocale';
import { formatMessage } from 'generaltranslation';
import { hashSource } from 'generaltranslation/id';
import use from '../../utils/use';
import { getSubtree } from 'gt-react/internal';
import setDictionary from '../../dictionary/setDictionary';

/**
 * Returns the dictionary access function t(), which is used to translate an item from the dictionary.
 *
 * @param {string} [id] - Optional prefix to prepend to the translation keys.
 * @returns {Function} A translation function that accepts a key string and returns the translated value.
 *
 * @example
 * const t = await getTranslations('user');
 * console.log(t('name')); // Translates item 'user.name'
 *
 * const t = await getTranslations();
 * console.log(t('hello')); // Translates item 'hello'
 */
export async function getTranslations(id?: string): Promise<
  ((id: string, options?: DictionaryTranslationOptions) => string) & {
    obj: (id: string, options?: Record<string, any>) => any | undefined;
  }
> {
  // ---------- SET UP ---------- //

  const getId = (suffix: string) => {
    return id ? `${id}.${suffix}` : suffix;
  };

  const dictionary = (await getDictionary()) || {};

  const I18NConfig = getI18NConfig();
  const locale = await getLocale();
  const defaultLocale = I18NConfig.getDefaultLocale();
  const [translationRequired] = I18NConfig.requiresTranslation(locale);

  let dictionaryTranslations = translationRequired
    ? await I18NConfig.getDictionaryTranslations(locale)
    : undefined;
  const translations = translationRequired
    ? await I18NConfig.getCachedTranslations(locale)
    : undefined;

  // ---------- THE t() METHOD ---------- //

  /**
   * @description A function that translates a dictionary entry based on its id and options.
   * @param {string} id The identifier of the dictionary entry to translate.
   * @param {DictionaryTranslationOptions} options
   * @returns The translated version of the dictionary entry.
   *
   * @example
   * t('greetings.greeting1'); // Translates item in dictionary under greetings.greeting1
   *
   * @example
   * // dictionary entry
   * {
   *  greetings: {
   *    greeting2: "Hello, {name}!"
   *  }
   * }
   *
   * // Translates item in dictionary under greetings.greeting2 and replaces {name} with 'John'
   * t('greetings.greeting2', { variables: { name: 'John' } });
   */
  const t = (id: string, options: Record<string, any> = {}): string => {
    // Get entry
    id = getId(id);
    const value = getDictionaryEntry(dictionary, id);

    // Check: no entry found
    if (!value) {
      console.warn(createNoEntryFoundWarning(id));
      return '';
    }

    // Check: invalid entry
    if (!isValidDictionaryEntry(value)) {
      console.warn(createInvalidDictionaryEntryWarning(id));
      return '';
    }

    // Get entry and metadata
    // eslint-disable-next-line prefer-const
    let { entry, metadata } = getEntryAndMetadata(value);

    // Validate entry
    if (!entry || typeof entry !== 'string') return '';

    // Render Method
    const renderContent = (message: string, locales: string[]) => {
      return formatMessage(message, {
        locales,
        variables: options,
      });
    };

    // Check: translation required
    if (!translationRequired) return renderContent(entry, [defaultLocale]);

    // ---------- DICTIONARY TRANSLATIONS ---------- //

    // Get dictionaryTranslation
    const dictionaryTranslation = getDictionaryEntry(
      dictionaryTranslations || {},
      id
    );
    // Check: invalid entry
    if (
      dictionaryTranslation !== undefined &&
      (!isValidDictionaryEntry(dictionaryTranslation) ||
        typeof dictionaryTranslation !== 'string')
    ) {
      console.warn(createInvalidDictionaryTranslationEntryWarning(id));
      return renderContent(entry, [defaultLocale]);
    }

    // Render dictionaryTranslation
    if (dictionaryTranslation) {
      return formatMessage(dictionaryTranslation, {
        locales: [locale, defaultLocale],
        variables: options,
      });
    }

    // ---------- TRANSLATION ---------- //

    let translationEntry = translations?.[id];
    let hash = '';
    const getHash = () => {
      if (metadata?.$_hash) return metadata.$_hash;
      const hash = hashSource({
        source: entry,
        ...(metadata?.$context && { context: metadata.$context }),
        id,
        dataFormat: 'ICU',
      });
      // Inject hash if not there yet
      metadata = { ...metadata, $_hash: hash };
      injectEntry([entry, metadata], dictionary, id, dictionary);
      return hash;
    };
    if (!translationEntry) {
      hash = getHash();
      translationEntry = translations?.[hash];
    }

    // ----- RENDER TRANSLATION ----- //

    // If a translation already exists
    if (translationEntry)
      return renderContent(translationEntry as string, [locale, defaultLocale]);

    // If a translation errored
    if (translationEntry === null) return renderContent(entry, [defaultLocale]);

    // ----- CREATE TRANSLATION ----- //
    // Since this is buildtime string translation, it's dev only

    if (!I18NConfig.isDevelopmentApiEnabled()) {
      console.warn(createDictionaryTranslationError(id));
      return renderContent(entry, [defaultLocale]);
    }

    // Don't translate non-string entries
    if (typeof entry !== 'string') {
      injectEntry(entry, dictionaryTranslations!, id, dictionary);
      return renderContent(entry, [defaultLocale]);
    }

    try {
      // Translate on demand
      I18NConfig.translateIcu({
        source: entry,
        targetLocale: locale,
        options: {
          ...(metadata?.$context && { context: metadata.$context }),
          id,
          hash: getHash(),
        },
      }).then((result) => {
        // Log the translation result for debugging purposes
        // eslint-disable-next-line no-console
        console.warn(
          createTranslationLoadingWarning({
            ...(id && { id }),
            source: renderContent(entry, [defaultLocale]),
            translation: renderContent(result as string, [
              locale,
              defaultLocale,
            ]),
          })
        );

        // inject
        injectEntry(result as string, dictionaryTranslations!, id, dictionary);
      });
    } catch (error) {
      console.warn(error);
    }

    // Default is returning source, rather than returning a loading state
    return renderContent(entry, [defaultLocale]);
  };

  /**
   * @description A function that translates a dictionary object and returns it
   * @param id The identifier of the dictionary entry to translate.
   * @param options The options for the dictionary entry (if applicable)
   */
  t.obj = (
    id: string,
    options: Record<string, any> = {}
  ): Dictionary | DictionaryEntry | string | undefined => {
    // (1) Get subtree
    const idWithParent = getId(id);
    const subtree = getSubtree({ dictionary, id: idWithParent });
    // Check: no subtree found
    if (!subtree) {
      console.warn(createNoEntryFoundWarning(idWithParent));
      return {};
    }
    // Check: if subTreeTranslation is a dictionaryEntry
    if (isDictionaryEntry(subtree)) {
      return t(id, options);
    }
    // Check: if is default locale
    if (!translationRequired) {
      // remove metadata from entries
      const strippedSubtree = stripMetadataFromEntries(subtree);
      return strippedSubtree;
    }

    // Set up the dictionaryTranslations object if it doesn't exist
    if (!dictionaryTranslations) {
      dictionaryTranslations = {};
      I18NConfig.setDictionaryTranslations(locale, dictionaryTranslations);
    }
    const translatedSubtree = getSubtreeWithCreation({
      dictionary: dictionaryTranslations,
      id: idWithParent,
      sourceDictionary: dictionaryTranslations,
    });

    // (2) Calculate subtreeWithHashes, dictionaryTranslationsWithTranslations, translatedSubtreeWithFallbacks, and untranslatedEntries
    // Note: the following four operations can technically be combined into one traversal, but this
    // strategy is much more readable and much easier to test/debug
    // Inject hashes into subtree
    const { dictionary: subtreeWithHashes, updateDictionary } = injectHashes(
      // eslint-disable-next-line no-undef
      structuredClone(subtree) as Dictionary,
      idWithParent
    );
    // Collect untranslated entries
    const untranslatedEntries = collectUntranslatedEntries(
      subtreeWithHashes as Dictionary,
      translatedSubtree as Dictionary,
      idWithParent
    );
    // Inject translations into translation subtree
    const {
      dictionary: dictionaryTranslationsWithTranslations,
      updateDictionary: updateDictionaryTranslations,
    } = injectTranslations(
      subtreeWithHashes as Dictionary,
      // eslint-disable-next-line no-undef
      structuredClone(translatedSubtree) as Dictionary,
      translations || {},
      untranslatedEntries,
      idWithParent
    );
    // Inject fallbacks into translation subtree
    const translatedSubtreeWithFallbacks = injectFallbacks(
      subtreeWithHashes as Dictionary,
      // eslint-disable-next-line no-undef
      structuredClone(dictionaryTranslationsWithTranslations) as Dictionary,
      untranslatedEntries,
      idWithParent
    );

    // (3) For each untranslated entry, translate it
    for (const untranslatedEntry of untranslatedEntries) {
      const { source, metadata } = untranslatedEntry;
      const id = metadata?.$id;
      if (typeof source !== 'string') {
        injectEntry(source, dictionaryTranslations!, id, dictionary);
        continue;
      }

      // (3.a) Translate
      I18NConfig.translateIcu({
        source,
        targetLocale: locale,
        options: {
          ...(metadata?.$context && { context: metadata.$context }),
          id,
          hash: metadata?.$_hash,
        },
      })
        // (3.b) Inject the translation into the translations object
        .then((result) => {
          injectEntry(
            result as string,
            dictionaryTranslations!,
            id,
            dictionary
          );
        });
    }

    // (5) Update the dictionaryTranslations object and dictionary
    // inject translatedSubtreeWithFallbacks and new subtree objects
    if (updateDictionary) {
      const newDictionary = injectAndMerge(
        dictionary,
        subtreeWithHashes,
        idWithParent
      );
      setDictionary(newDictionary);
    }
    if (updateDictionaryTranslations) {
      const newDictionaryTranslations = mergeDictionaries(
        dictionaryTranslations,
        dictionaryTranslationsWithTranslations
      );
      I18NConfig.setDictionaryTranslations(locale, newDictionaryTranslations);
    }

    // (4) Copy the dictionaryTranslations object
    // eslint-disable-next-line no-undef
    return structuredClone(translatedSubtreeWithFallbacks);
  };

  return t;
}

/**
 * Returns the dictionary access function t(), which is used to translate an item from the dictionary.
 *
 * @param {string} [id] - Optional prefix to prepend to the translation keys.
 * @returns {Function} A translation function that accepts a key string and returns the translated value.
 *
 * @example
 * const t = useTranslations('user');
 * console.log(t('name')); // Translates item 'user.name'
 *
 * const t = useTranslations();
 * console.log(t('hello')); // Translates item 'hello'
 */
export function useTranslations(id?: string) {
  return use(getTranslations(id));
}
