/**
 * Gets the translation function `t`, which is used to translate an item from the dictionary.
 *
 * @param {string} [id] - Optional prefix to prepend to the translation keys.
 * @returns {Function} A translation function that accepts a key string and returns the translated value.
 *
 * @example
 * const t = getGT('user');
 * console.log(t('name')); // Translates item 'user.name'
 *
 * const t = getGT();
 * console.log(t('hello')); // Translates item 'hello'
 */
export declare function getGT(id?: string): (id: string, options?: Record<string, any>, f?: Function) => JSX.Element | Promise<string> | undefined;
/**
 * Gets the translation function `t`, which is used to translate a JSX element from the dictionary.
 * For translating strings directly, see `getGT()` or `useGT()`.
 *
 * @param {string} [id] - Optional prefix to prepend to the translation keys.
 * @returns {Function} A translation function that accepts a key string and returns the translated value.
 *
 * @example
 * const t = gt('user');
 * console.log(t('name')); // Translates item 'user.name'
 *
 * const t = gt();
 * console.log(t('hello')); // Translates item 'hello'
 */
export declare function gt(id?: string): (id: string, options?: Record<string, any>, f?: Function) => JSX.Element;
//# sourceMappingURL=getGT.d.ts.map