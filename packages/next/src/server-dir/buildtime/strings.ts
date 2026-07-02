import { use } from '../../utils/use';
import {
  getGTInternal,
  getI18nConfig,
  getMessagesInternal,
  getTranslationsInternal,
} from 'gt-i18n/internal';
import type { Message } from 'gt-i18n/types';
import { getRequestConditions } from '../../request/getRequestConditions';
import { getNextI18nCache } from '../../i18n-cache/NextI18nCache';

export async function getGT(_messages?: Message[]) {
  const conditions = await getRequestConditions();
  return getGTInternal(
    {
      locale: conditions._locale,
      enableI18n: conditions._enableI18n,
    },
    _messages
  );
}

export async function getMessages() {
  const conditions = await getRequestConditions();
  return getMessagesInternal({
    locale: conditions._locale,
    enableI18n: conditions._enableI18n,
  });
}

export async function getTranslations(rootId?: string) {
  const conditions = await getRequestConditions();
  const cache = getNextI18nCache();
  const sourceLocale = getI18nConfig().getDefaultLocale();
  const targetLocale = conditions._enableI18n
    ? conditions._locale
    : sourceLocale;
  const dictionariesToLoad = [cache.loadDictionaries(sourceLocale)];
  if (targetLocale !== sourceLocale) {
    dictionariesToLoad.push(cache.loadDictionaries(targetLocale));
  }
  const dictionaries = await Promise.all(dictionariesToLoad);
  cache.updateDictionaries(Object.assign({}, ...dictionaries));
  return getTranslationsInternal({
    locale: conditions._locale,
    enableI18n: conditions._enableI18n,
    rootId,
  });
}

export function useGT(_messages?: Message[]) {
  return use(getGT(_messages));
}

export function useMessages() {
  return use(getMessages());
}

export function useTranslations(rootId?: string) {
  return use(getTranslations(rootId));
}
