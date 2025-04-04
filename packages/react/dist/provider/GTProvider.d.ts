import React from 'react';
import { CustomLoader, RenderMethod } from '../types/types';
/**
 * Provides General Translation context to its children, which can then access `useGT`, `useLocale`, and `useDefaultLocale`.
 *
 * @param {React.ReactNode} children - The children components that will use the translation context.
 * @param {string} [projectId] - The project ID required for General Translation cloud services.
 * @param {Dictionary} [dictionary=defaultDictionary] - The translation dictionary for the project.
 * @param {string[]} [locales] - The list of approved locales for the project.
 * @param {string} [defaultLocale=libraryDefaultLocale] - The default locale to use if no other locale is found.
 * @param {string} [locale] - The current locale, if already set.
 * @param {string} [cacheUrl='https://cdn.gtx.dev'] - The URL of the cache service for fetching translations.
 * @param {string} [runtimeUrl='https://runtime.gtx.dev'] - The URL of the runtime service for fetching translations.
 * @param {RenderSettings} [renderSettings=defaultRenderSettings] - The settings for rendering translations.
 * @param {string} [_versionId] - The version ID for fetching translations.
 * @param {string} [devApiKey] - The API key for development environments.
 * @param {object} [metadata] - Additional metadata to pass to the context.
 * @param {React.ReactNode} [fallback = undefined] - Custom fallback to display while loading
 *
 * @returns {JSX.Element} The provider component for General Translation context.
 */
export default function GTProvider({ children, projectId: _projectId, devApiKey: _devApiKey, dictionary: _dictionary, locales, defaultLocale, locale: _locale, cacheUrl, runtimeUrl, renderSettings, loadDictionary, loadTranslations, fallback, ssr, _versionId, ...metadata }: {
    children?: React.ReactNode;
    projectId?: string;
    devApiKey?: string;
    dictionary?: any;
    locales?: string[];
    defaultLocale?: string;
    locale?: string;
    cacheUrl?: string;
    runtimeUrl?: string;
    renderSettings?: {
        method: RenderMethod;
        timeout?: number;
    };
    loadDictionary?: CustomLoader;
    loadTranslations?: CustomLoader;
    _versionId?: string;
    ssr?: boolean;
    [key: string]: any;
}): React.JSX.Element;
//# sourceMappingURL=GTProvider.d.ts.map