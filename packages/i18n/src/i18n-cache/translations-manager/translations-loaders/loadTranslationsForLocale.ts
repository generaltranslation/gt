import type { I18nCacheConstructorParams } from '../../types';
import { getLoadTranslationsType } from '../../utils/getLoadTranslationsType';
import { resolveCacheLocale } from '../../utils/resolveCacheLocale';
import type { Translation } from '../utils/types/translation-data';
import type { Hash } from '../TranslationsCache';
import { routeCreateTranslationLoader } from './routeCreateTranslationLoader';

export async function loadTranslationsForLocale<
  TranslationValue extends Translation = Translation,
>(
  params: I18nCacheConstructorParams,
  locale: string
): Promise<Record<Hash, TranslationValue>> {
  const translationLocale = resolveCacheLocale(locale);
  if (!translationLocale) return {};

  const loadTranslations = routeCreateTranslationLoader({
    loadTranslations: params.loadTranslations,
    type: getLoadTranslationsType(params),
    remoteTranslationLoaderParams: {
      cacheUrl: params.cacheUrl,
      projectId: params.projectId,
      _versionId: params._versionId,
      _branchId: params._branchId,
    },
  });
  return (await loadTranslations(translationLocale)) as Record<
    Hash,
    TranslationValue
  >;
}
