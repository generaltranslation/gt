import { routeCreateTranslationLoader } from './translations-manager/translations-loaders/routeCreateTranslationLoader';
import type { SafeTranslationsLoader } from './translations-manager/translations-loaders/types';
import type { Translation } from './translations-manager/utils/types/translation-data';
import type { I18nCacheConstructorParams } from './types';
import { getLoadTranslationsType } from './utils/getLoadTranslationsType';

/** Creates the configured loader without constructing a full I18nCache. */
export function createTranslationLoader(
  params: I18nCacheConstructorParams
): SafeTranslationsLoader<Translation> {
  return routeCreateTranslationLoader({
    loadTranslations: params.loadTranslations,
    type: getLoadTranslationsType(params),
    remoteTranslationLoaderParams: {
      cacheUrl: params.cacheUrl,
      projectId: params.projectId,
      _versionId: params._versionId,
      _branchId: params._branchId,
    },
  }) as SafeTranslationsLoader<Translation>;
}
