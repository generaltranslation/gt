import { RenderMethod } from '../types/types';
import React from 'react';
/**
 * Provides General Translation context to its children, which can then access `useGT`, `useLocale`, and `useDefaultLocale`.
 *
 * @param {React.ReactNode} children - The children components that will use the translation context.
 * @param {string} [projectId] - The project ID required for General Translation cloud services.
 * @param {Dictionary} [dictionary=defaultDictionary] - The translation dictionary for the project.
 * @param {string[]} [locales] - The list of approved locales for the project.
 * @param {string} [defaultLocale=libraryDefaultLocale] - The default locale to use if no other locale is found.
 * @param {string} [locale] - The current locale, if already set.
 * @param {string} [cacheUrl='https://cache.gtx.dev'] - The URL of the cache service for fetching translations.
 *
 * @returns {JSX.Element} The provider component for General Translation context.
 */
export default function GTProvider({ children, projectId, dictionary, locales, defaultLocale, locale, cacheUrl, runtimeUrl, renderSettings, devApiKey, ...metadata }: {
    children?: React.ReactNode;
    projectId: string;
    dictionary?: any;
    locales?: string[];
    defaultLocale?: string;
    locale?: string;
    cacheUrl?: string;
    runtimeUrl?: string;
    devApiKey?: string;
    renderSettings?: {
        method: RenderMethod;
        timeout?: number;
    };
    [key: string]: any;
}): React.JSX.Element;
//# sourceMappingURL=GTProvider.d.ts.map