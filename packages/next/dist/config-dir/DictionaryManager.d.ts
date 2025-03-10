import { DictionaryObject } from 'gt-react/internal';
/**
 * Manages Dictionary
 */
export declare class DictionaryManager {
    private dictionaryMap;
    /**
     * Creates an instance of TranslationManager.
     * @constructor
     */
    constructor();
    _flattenObject(obj: Record<string, any>, parentKey?: string, result?: Record<string, any>): Record<string, any>;
    /**
     * Retrieves dictionary for a given locale from bundle.
     * @param {string} locale - The locale code.
     * @returns {Promise<DictionaryObject | undefined>} The dictionary data or undefined if not found.
     */
    getDictionary(locale: string): Promise<DictionaryObject | undefined>;
}
declare const dictionaryManager: DictionaryManager;
export default dictionaryManager;
//# sourceMappingURL=DictionaryManager.d.ts.map