import type { CustomMapping } from 'generaltranslation/types';
import type { TranslationsLoader } from '../../translations-loaders/types';

/**
 * Configuration for the TranslationsManager
 *
 * @property {string} [projectId] - The project id.
 * @property {string} [cacheUrl] - The cache url.
 * @property {string} [_versionId] - The version id.
 * @property {string} [_branchId] - The branch id.
 * @property {number | null} cacheExpiryTime - The cache expiry time in milliseconds (use null or a negative number to disable expiry).
 * @property {TranslationsLoader} [loadTranslations] - A custom translations loader function.
 */
export type TranslationsManagerConfig = {
  projectId?: string;
  cacheUrl?: string | null;
  _versionId?: string;
  _branchId?: string;
  customMapping?: CustomMapping;
  cacheExpiryTime?: number | null;
  loadTranslations?: TranslationsLoader;
};
