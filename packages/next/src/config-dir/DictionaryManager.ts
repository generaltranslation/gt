import { standardizeLocale } from 'generaltranslation';
import { Dictionary } from 'gt-react/internal';
import resolveDictionaryLoader from '../resolvers/resolveDictionaryLoader';
import { customLoadDictionaryWarning } from '../errors/createErrors';

/**
 * Manages Dictionary
 */
export class DictionaryManager {
  private dictionaryMap: Map<string, Dictionary>;

  /**
   * Creates an instance of TranslationManager.
   * @constructor
   */
  constructor() {
    this.dictionaryMap = new Map();
  }

  /**
   * Retrieves dictionary for a given locale from bundle.
   * @param {string} locale - The locale code.
   * @returns {Promise<Dictionary | undefined>} The dictionary data or undefined if not found.
   */
  async getDictionary(locale: string): Promise<Dictionary | undefined> {
    const reference =
      process.env._GENERALTRANSLATION_GT_SERVICES_ENABLED === 'true'
        ? standardizeLocale(locale)
        : locale;

    // Check internal cache
    let result = this.dictionaryMap.get(reference);
    if (result) return result;

    // Load dictionary
    const customLoadDictionary = resolveDictionaryLoader();
    if (customLoadDictionary) {
      try {
        result = await customLoadDictionary(reference);
        if (!result) return undefined;
        this.dictionaryMap.set(reference, result);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(customLoadDictionaryWarning(reference), error);
        }
        return undefined;
      }
    }

    return result;
  }
}

const dictionaryManager = new DictionaryManager();
export default dictionaryManager;
