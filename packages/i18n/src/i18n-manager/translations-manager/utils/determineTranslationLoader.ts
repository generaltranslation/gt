import { CustomMapping } from 'generaltranslation/types';
import { TranslationsLoader } from '../translations-loaders/types';
import {
  getLoadTranslationsType,
  LoadTranslationsType,
} from '../../utils/getLoadTranslationsType';
import logger from '../../../logs/logger';
import { createRemoteTranslationLoader } from '../translations-loaders/createRemoteTranslationLoader';
import { createFallbackTranslationLoader } from '../translations-loaders/createFallbackTranslationLoader';

/**
 * determine the correct translation loader to use
 */
export function determineTranslationLoader(config: {
  projectId?: string;
  cacheUrl?: string | null;
  _versionId?: string;
  _branchId?: string;
  loadTranslations?: TranslationsLoader;
  customMapping?: CustomMapping;
}): TranslationsLoader {
  const loadTranslationsType = getLoadTranslationsType(config);
  if (loadTranslationsType === LoadTranslationsType.DISABLED) {
    // TODO: move this warning to validation layer
    logger.warn(
      'I18nManager: No translation loader found. No translations will be loaded.'
    );
  }

  switch (loadTranslationsType) {
    case LoadTranslationsType.REMOTE:
    case LoadTranslationsType.GT_REMOTE:
      return createRemoteTranslationLoader({
        cacheUrl: config.cacheUrl!,
        projectId: config.projectId!,
        _versionId: config._versionId,
        _branchId: config._branchId,
        customMapping: config.customMapping,
      });
    case LoadTranslationsType.CUSTOM:
      return config.loadTranslations!;
    case LoadTranslationsType.DISABLED:
      return createFallbackTranslationLoader();
  }
}
