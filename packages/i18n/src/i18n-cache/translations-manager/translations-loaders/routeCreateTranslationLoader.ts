import { TranslationsLoader } from './types';
import { LoadTranslationsType } from '../../utils/getLoadTranslationsType';
import { createRemoteTranslationLoader } from './createRemoteTranslationLoader';
import { createFallbackTranslationLoader } from './createFallbackTranslationLoader';
import { getI18nConfig } from '../../../i18n-config/singleton-operations';
import { createDiagnosticMessage } from 'generaltranslation/internal';

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
  };
  loadTranslations?: TranslationsLoader;
}): TranslationsLoader {
  const { cacheUrl, projectId, _versionId, _branchId } =
    remoteTranslationLoaderParams;

  // Warnings are deferred to loader invocation: translations may be provided
  // externally via updateTranslations() (eg streamed from a server), in which
  // case the loader is never invoked and the warnings do not apply
  switch (type) {
    case LoadTranslationsType.REMOTE:
    case LoadTranslationsType.GT_REMOTE:
      if (!projectId) {
        return createFallbackTranslationLoader(
          'I18nCache: ' +
            createDiagnosticMessage({
              whatHappened:
                'Loading translations from a remote store needs a projectId. No translations will be loaded.',
              fix: 'Add projectId to the I18nCache config or disable remote translation loading',
            })
        );
      }
      return createRemoteTranslationLoader({
        cacheUrl: cacheUrl as string | undefined,
        projectId,
        _versionId,
        _branchId,
        customMapping: getI18nConfig().getCustomMapping(),
      });
    case LoadTranslationsType.CUSTOM:
      return loadTranslations!;
    case LoadTranslationsType.DISABLED:
      return createFallbackTranslationLoader(
        'I18nCache: No translation loader found. No translations will be loaded.'
      );
  }
}
