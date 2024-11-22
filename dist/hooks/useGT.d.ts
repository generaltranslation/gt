/**
 * Gets the translation function `t` provided by `<GTProvider>`.
 *
 * @param {string} [id] - Optional prefix to prepend to the translation keys.
 * @returns {Function} A translation function that accepts a key string and returns the translated value.
 *
 * @example
 * const t = useGT('user');
 * console.log(t('name')); // Translates item 'user.name'
 *
 * const t = useGT();
 * console.log(t('hello')); // Translates item 'hello'
 */
export declare function useGT(id?: string): (id: string, options?: Record<string, any>, f?: Function) => JSX.Element | string | undefined;
/**
 * Flagship `gt()` hook which gets the translation function `t()` provided by `<GTProvider>`.
 * `t()` returns only JSX elements. For returning strings as well, see `useGT()`.
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
//# sourceMappingURL=useGT.d.ts.map