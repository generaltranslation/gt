import { standardizeLocale } from 'generaltranslation';
import { MessagesContent, MessagesObject } from 'gt-react/internal';
import resolveMessageLoader from '../loaders/resolveMessagesLoader';
import { customLoadMessagesWarning } from '../errors/createErrors';

/**
 * Manages messages
 */
export class MessagesManager {
  private messagesMap: Map<string, MessagesObject>;

  /**
   * Creates an instance of TranslationManager.
   * @constructor
   */
  constructor() {
    this.messagesMap = new Map();
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
   * Retrieves messages for a given locale from bundle.
   * @param {string} locale - The locale code.
   * @returns {Promise<MessagesObject | undefined>} The messages data or undefined if not found.
   */
  async getMessages(locale: string): Promise<MessagesObject | undefined> {
    const reference = standardizeLocale(locale);

    // Check internal cache
    let result = this.messagesMap.get(reference);
    if (result) return result;

    // Load messages
    const customLoadMessages = resolveMessageLoader();
    if (customLoadMessages) {
      try {
        result = this._flattenObject(await customLoadMessages(reference));
        this.messagesMap.set(reference, result);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(customLoadMessagesWarning(reference), error);
        }
        return undefined;
      }
    }

    return result;
  }
}

const messagesManager = new MessagesManager();
export default messagesManager;
