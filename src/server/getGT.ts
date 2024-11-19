import createServerTFunction from "./createServerTFunction"

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
export default function getGT(id?: string): (
    id: string, 
    options?: Record<string, any>, 
    f?: Function
) => string | JSX.Element | Promise<string | JSX.Element> | undefined {

    const serverTFunction = createServerTFunction(id);

    /**
    * Translates a dictionary item based on its `id` and options.
    * 
    * @param {string} [id] - The ID of the item in the dictionary to translate.
    * @param {Record<string, any>} [options={}] - Variables or parameters (e.g., `n`) passed into the translation for dynamic content.
    * @param {Function} [f] - Advanced feature. `f` is executed with `options` as parameters, and its result is translated based on the dictionary value of `id`. You likely don't need this parameter unless you using `getGT` on the client-side.
    * 
    * @returns {string | JSX.Element | Promise<string | JSX.Element>}
    */
    function t(
        id: string, 
        options: Record<string, any> = {}, 
        f?: Function
    ): string | JSX.Element | Promise<string | JSX.Element> | undefined {
        return serverTFunction(id, options, f);
    }
    
    return t;
}