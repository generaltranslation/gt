import React from 'react';
import { GTProvider as GTReactProvider } from 'gt-react';
import { GTProviderProps } from './types';
import { isSSREnabled } from './utils/isSSREnabled';
import { determineProviderLocale } from './utils/determineProviderLocale';

/**
 * Provides General Translation context to its children, which can then access `useGT`, `useLocale`, and `useDefaultLocale`.
 *
 * @param {React.ReactNode} children - The children components that will use the translation context.
 * @param {string} [projectId] - The project ID required for General Translation cloud services.
 * @param {Dictionary} [dictionary=defaultDictionary] - The translation dictionary for the project.
 * @param {string[]} [locales] - The list of approved locales for the project.
 * @param {string} [defaultLocale=libraryDefaultLocale] - The default locale to use if no other locale is found.
 * @param {string} [cacheUrl='https://cdn.gtx.dev'] - The URL of the cache service for fetching translations.
 * @param {string} [runtimeUrl='https://runtime.gtx.dev'] - The URL of the runtime service for fetching translations.
 * @param {RenderSettings} [renderSettings=defaultRenderSettings] - The settings for rendering translations.
 * @param {string} [_versionId] - The version ID for fetching translations.
 * @param {string} [devApiKey] - The API key for development environments.
 * @param {object} [metadata] - Additional metadata to pass to the context.
 * @param {string} [localeCookieName=defaultLocaleCookieName] - The name of the cookie to store the locale.
 * @param {boolean} [enableI18n=true] - Whether to enable i18n.
 * @param {boolean|undefined} [enableI18nLoaded=undefined] - Flag to indicate if the enableI18n flag is finished loading asynchronously. Undefined means flag is loaded synchronously.
 * @param {Translations | null} [translations=null] - The translations to use for the context.
 * @param {React.ReactNode} [fallback = undefined] - Custom fallback to display while loading
 *
 * @returns {JSX.Element} The provider component for General Translation context.
 */
export function GTProvider(props: GTProviderProps): React.ReactNode {
  return (
    <GTReactProvider
      ssr={isSSREnabled()}
      {...props}
      reloadOnLocaleUpdate={true}
      locale={determineProviderLocale(props)}
    />
  );
}
