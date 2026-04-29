import type { CustomMapping } from 'generaltranslation/types';
import { TranslationsLoader } from './types';
import { LoadTranslationsType } from '../../utils/getLoadTranslationsType';
import logger from '../../../logs/logger';
import { createRemoteTranslationLoader } from './createRemoteTranslationLoader';
import { createFallbackTranslationLoader } from './createFallbackTranslationLoader';

/**
 * Creates a translation loader function that loads translations from a remote store (CDN or other)
 * @param params - The parameters for the createTranslationLoader function
 * @param params.type - The type of translation loader to create
 * @param params.remoteTranslationLoaderParams - The parameters for the remote translation loader
 * @param params.loadTranslations - The custom translations loader function
 * @returns A translation loader function
 */
export function routeCreateTranslationLoader({
  type,
  remoteTranslationLoaderParams,
  loadTranslations,
}: {
  type: LoadTranslationsType;
  remoteTranslationLoaderParams: {
    cacheUrl?: string | null;
    projectId?: string;
    _versionId?: string;
    _branchId?: string;
    customMapping?: CustomMapping;
  };
  loadTranslations?: TranslationsLoader;
}): TranslationsLoader {
  if (type === LoadTranslationsType.DISABLED) {
    // TODO: move this warning to validation layer
    logger.warn(
      'I18nManager: No translation loader found. No translations will be loaded.'
    );
  }

  const { cacheUrl, projectId, _versionId, _branchId, customMapping } =
    remoteTranslationLoaderParams;

  switch (type) {
    case LoadTranslationsType.REMOTE:
    case LoadTranslationsType.GT_REMOTE:
      return createRemoteTranslationLoader({
        cacheUrl: cacheUrl || '',
        projectId: projectId || '',
        _versionId,
        _branchId,
        customMapping,
      });
    case LoadTranslationsType.CUSTOM:
      return loadTranslations!;
    case LoadTranslationsType.DISABLED:
      return createFallbackTranslationLoader();
  }
}
