import React from 'react';
/**
 * `useElement()` hook which gets the translation function `t()` provided by `<GTProvider>`.
 *
 * **`t()` returns only JSX elements.** For returning strings as well, see `useGT()`.
 *
 * @param {string} [id] - Optional prefix to prepend to the translation keys.
 * @returns {Function} A translation function that accepts a key string and returns the translated value.
 *
 * @example
 * const t = useElement('user');
 * console.log(t('name')); // Translates item 'user.name', returns it as a JSX element
 *
 * const t = useElement();
 * console.log(t('hello')); // Translates item 'hello', returns it as a JSX element
 */
export default function useElement(id?: string): (id: string, options?: Record<string, any>) => React.JSX.Element;
//# sourceMappingURL=useElement.d.ts.map