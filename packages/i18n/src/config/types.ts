import { CustomMapping } from 'generaltranslation/types';

/**
 * TODO: this is a react-only type, we need to move this
 */
export type RenderMethod = 'skeleton' | 'replace' | 'default';

/**
 * TODO: this disagrees with the type in react-core/src/types-dir/config.ts, we need to move this
 * General Config:
 * @param defaultLocale - The default locale to use
 * @param locales - The locales to support
 * @param customMapping - The custom mapping to use (for aliasing locale codes and other properties)
 * @param enableI18n - Whether to enable i18n
 *
 * Remote Store/Cache Config:
 * @param projectId - The project id
 * @param devApiKey - The dev api key
 * @param _versionId - The version id
 * @param _branchId - The branch id
 * @param cacheUrl - The cache url
 * @param runtimeUrl - The runtime url
 * @param timeout - The timeout
 * @param modelProvider - The model provider
 */
export type GTConfig = {
  // general config
  defaultLocale?: string;
  locales?: string[];
  customMapping?: CustomMapping;
  enableI18n?: boolean;

  // remote config
  projectId?: string;
  devApiKey?: string;
  apiKey?: string;
  _versionId?: string;
  _branchId?: string;

  // remote store config
  cacheUrl?: string | null;
  cacheExpiryTime?: number;

  // remote translate config
  runtimeUrl?: string | null;
  modelProvider?: string;

  // other
  localeCookieName?: string;
};
