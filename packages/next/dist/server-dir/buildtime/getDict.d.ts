import { TranslationOptions } from 'gt-react/internal';
import React from 'react';
/**
 * Returns the dictionary access function `d()`, which is used to translate an item from the dictionary.
 *
 * @param {string} [id] - Optional prefix to prepend to the translation keys.
 * @returns {Function} A translation function that accepts a key string and returns the translated value.
 *
 * @example
 * const d = await getDict('user');
 * console.log(d('name')); // Translates item 'user.name'
 *
 * const d = await getDict();
 * console.log(d('hello')); // Translates item 'hello'
 */
export default function getDict(id?: string): Promise<(id: string, options?: {
    locale?: string;
} & TranslationOptions) => React.ReactNode>;
//# sourceMappingURL=getDict.d.ts.map