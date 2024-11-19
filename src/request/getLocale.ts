import getI18NConfig from "../utils/getI18NConfig";
import { getNextLocale } from "../next/getNextLocale";

let getLocaleFunction: () => Promise<string>;

/**
 * Gets the user's current locale. 
 * 
 * @returns {Promise<string>} The user's locale, e.g., 'en-US'.
 *
 * @example
 * const locale = await getLocale();
 * console.log(locale); // 'en-US'
*/
export default async function getLocale(): Promise<string> {
    if (getLocaleFunction) return await getLocaleFunction();
    try {
        const customRequestConfig = require('gt-next/_request');
        const customGetLocale: () => Promise<string> = customRequestConfig?.default?.getLocale || customRequestConfig.getLocale;
        const locale = await customGetLocale();
        getLocaleFunction = customGetLocale;
        return locale;
    } catch {
        const I18NConfig = getI18NConfig();
        getLocaleFunction = async () => await getNextLocale(
            I18NConfig.getDefaultLocale(), I18NConfig.getLocales()
        );
        return await getLocaleFunction();
    };
        
}
