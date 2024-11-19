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
export default function getGT(id?: string): (id: string, options?: Record<string, any>, f?: Function) => string | JSX.Element | Promise<string | JSX.Element> | undefined;
//# sourceMappingURL=getGT.d.ts.map