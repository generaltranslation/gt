import { standardizeLocale } from 'generaltranslation';
import { DictionaryObject } from 'gt-react/internal';
import resolveDictionaryLoader from '../loaders/resolveDictionaryDictionary';
import { customLoadDictionaryWarning } from '../errors/createErrors';

/**
 * Manages Dictionary
 */
export class DictionaryManager {
  private dictionaryMap: Map<string, DictionaryObject>;

  /**
   * Creates an instance of TranslationManager.
   * @constructor
   */
  constructor() {
    this.dictionaryMap = new Map();
  }

  // flatten object helper function
  _flattenObject(
    obj: Record<string, any>,
    parentKey: string = '',
    result: Record<string, any> = {}
  ): Record<string, any> {
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const newKey = parentKey ? `${parentKey}.${key}` : key;
        const value = obj[key];
        if (
          value !== null &&
          typeof value === 'object' &&
          !Array.isArray(value)
        ) {
          this._flattenObject(value, newKey, result);
        } else {
          result[newKey] = value;
        }
      }
    }
    return result;
  }

  /**
   * Retrieves dictionary for a given locale from bundle.
   * @param {string} locale - The locale code.
   * @returns {Promise<DictionaryObject | undefined>} The dictionary data or undefined if not found.
   */
  async getDictionary(locale: string): Promise<DictionaryObject | undefined> {
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
        result = this._flattenObject(await customLoadDictionary(reference));
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
