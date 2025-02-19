import React from 'react';
import { TranslationOptions } from '../../types/types';
/**
 * Gets the dictionary access function `d` provided by `<GTProvider>`.
 *
 * @param {string} [id] - Optional prefix to prepend to the translation keys.
 * @returns {Function} A translation function that accepts a key string and returns the translated value.
 *
 * @example
 * const d = useDict('user');
 * console.log(d('name')); // Translates item 'user.name'
 *
 * const d = useDict();
 * console.log(d('hello')); // Translates item 'hello'
 */
export default function useDict(id?: string): (id: string, options?: TranslationOptions) => React.ReactNode;
//# sourceMappingURL=useDict.d.ts.map