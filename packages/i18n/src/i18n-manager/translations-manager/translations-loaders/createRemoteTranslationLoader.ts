import { resolveCanonicalLocale } from 'generaltranslation';
import { TranslationsLoader } from './types';
import { defaultCacheUrl } from 'generaltranslation/internal';
import { Translations } from '../utils/types/translation-data';
import { CustomMapping } from 'generaltranslation/types';

/**
 * Parameters for the createRemoteTranslationLoader function
 * @param cacheUrl - The cache url
 * @param projectId - The project id
 * @param _versionId - The version id
 * @param _branchId - The branch id
 */
type CreateRemoteTranslationLoaderParams = {
  cacheUrl: string;
  projectId: string;
  _versionId?: string;
  _branchId?: string;
  customMapping?: CustomMapping;
};

/**
 * Creates a translations loader function that loads translations from a remote store (CDN or other)
 * @param params - The parameters for the createRemoteTranslationLoader function
 * @returns A translations loader function
 *
 * TODO: validate projectId, cacheUrl, _versionId, _branchId
 */
export function createRemoteTranslationLoader(
  params: CreateRemoteTranslationLoaderParams
): TranslationsLoader {
  // Get url
  const unlocalizedUrl = generateUrl(params);

  // define loader function
  const loader: TranslationsLoader = async (locale: string) => {
    // Standardize locale
    locale = resolveCanonicalLocale(locale, params.customMapping);
    const url = unlocalizedUrl.replace('[locale]', locale);
    const response = await fetch(url);
    return (await response.json()) as Translations;
  };

  return loader;
}

// ===== HELPER FUNCTIONS ===== //

/**
 * Generate a URL for a translations file
 */
function generateUrl(params: CreateRemoteTranslationLoaderParams): string {
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
