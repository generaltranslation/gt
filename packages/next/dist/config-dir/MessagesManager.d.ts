import { MessagesObject } from "gt-react/internal";
/**
 * Manages messages
 */
export declare class MessagesManager {
    private messagesMap;
    /**
     * Creates an instance of TranslationManager.
     * @constructor
     */
    constructor();
    _flattenObject(obj: Record<string, any>, parentKey?: string, result?: Record<string, any>): Record<string, any>;
    /**
     * Retrieves messages for a given locale from bundle.
     * @param {string} locale - The locale code.
     * @returns {Promise<MessagesObject | undefined>} The messages data or undefined if not found.
     */
    getMessages(locale: string): Promise<MessagesObject | undefined>;
}
declare const messagesManager: MessagesManager;
export default messagesManager;
//# sourceMappingURL=MessagesManager.d.ts.map