import { getTranslationsInternal } from 'gt-i18n/internal';
import type { TFunctionType } from 'gt-i18n';
import { use } from '../utils/use';
import { getRequestConditions } from '../request/getRequestConditions';
import { ensureNextDictionaryManager } from './dictionaries';

export async function getTranslations(rootId?: string): Promise<TFunctionType> {
  ensureNextDictionaryManager();
  const conditions = await getRequestConditions();
  return getTranslationsInternal({
    locale: conditions._locale,
    enableI18n: conditions._enableI18n,
    rootId,
  });
}

export function useTranslations(rootId?: string): TFunctionType {
  return use(getTranslations(rootId));
}
