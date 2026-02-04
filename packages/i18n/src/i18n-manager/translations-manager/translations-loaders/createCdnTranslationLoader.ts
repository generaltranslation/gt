import { resolveCanonicalLocale } from 'generaltranslation';
import { TranslationsLoader } from './types';
import { defaultCacheUrl } from 'generaltranslation/internal';
import { Translations } from '../utils/types/translation-data';
import { CustomMapping } from 'generaltranslation/src/types';

/**
 * Parameters for the createCdnTranslationLoader function
 * @param cacheUrl - The cache url
 * @param projectId - The project id
 * @param _versionId - The version id
 * @param _branchId - The branch id
 */
type CreateCdnTranslationLoaderParams = {
  cacheUrl: string;
  projectId: string;
  _versionId?: string;
  _branchId?: string;
  customMapping?: CustomMapping;
};

/**
 * Creates a translations loader function that loads translations from a CDN
 * @param params - The parameters for the createCdnTranslationLoader function
 * @returns A translations loader function
 *
 * TODO: validate projectId, cacheUrl, _versionId, _branchId
 */
export function createCdnTranslationLoader(
  params: CreateCdnTranslationLoaderParams
): TranslationsLoader {
  // Get url
  const urlWithoutLocale = generateCdnUrl(params);

  // define loader function
  const loader: TranslationsLoader = async (locale: string) => {
    // Standardize locale
    locale = resolveCanonicalLocale(locale, params.customMapping);
    const url = urlWithoutLocale.replace('[locale]', locale);
    const response = await fetch(url);
    return (await response.json()) as Translations;
  };

  return loader;
}

// ===== HELPER FUNCTIONS ===== //

/**
 * Generate a URL for a translations file
 */
function generateCdnUrl(params: CreateCdnTranslationLoaderParams): string {
  const {
    cacheUrl = defaultCacheUrl,
    projectId,
    _versionId,
    _branchId,
  } = params;

  // Generate version id segment and branch id query
  const versionIdSegment = _versionId ? `/${_versionId}` : '';
  const branchIdQuery = _branchId ? `?branchId=${_branchId}` : '';

  // Generate URL
  const url =
    `${cacheUrl}/${projectId}/[locale]` + versionIdSegment + branchIdQuery;

  return url;
}
