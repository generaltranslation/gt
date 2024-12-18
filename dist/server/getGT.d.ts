/**
 * Returns the translation function `t()`, which is used to translate an item from the dictionary.
 *
 * @param {string} [id] - Optional prefix to prepend to the translation keys.
 * @returns {Function} A translation function that accepts a key string and returns the translated value.
 *
 * @example
 * const t = await getGT('user');
 * console.log(t('name')); // Translates item 'user.name'
 *
 * const t = await getGT();
 * console.log(t('hello')); // Translates item 'hello'
 */
export declare function getGT(id?: string): Promise<(id: string, options?: Record<string, any>) => any>;
/**
 * Returns the translation function `t()`, which is used to translate an item from the dictionary.
 *
 * **`t()` returns only JSX elements.** For returning strings as well, see `await getGT()` or `useGT()`.
 *
 * @param {string} [id] - Optional prefix to prepend to the translation keys.
 * @returns {Function} A translation function that accepts a key string and returns the translated value.
 *
 * @example
 * const t = useElement('user');
 * console.log(t('name')); // Translates item 'user.name', returns as JSX
 *
 * const t = useElement();
 * console.log(t('hello')); // Translates item 'hello', returns as JSX
 */
export declare function useElement(id?: string): (id: string, options?: Record<string, any>) => JSX.Element;
//# sourceMappingURL=getGT.d.ts.map