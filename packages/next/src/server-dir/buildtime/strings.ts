import { use } from '../../utils/use';
import {
  getGTInternal,
  getMessagesInternal,
  getTranslationsInternal,
} from 'gt-i18n/internal';
import type { Message } from 'gt-i18n/types';
import { getRequestConditions } from '../../request/getRequestConditions';
import { memoizeForRequest } from '../../utils/requestMemo';

export function getGT(_messages?: Message[]) {
  const load = async () => {
    const conditions = await getRequestConditions();
    return getGTInternal(
      {
        locale: conditions._locale,
        enableI18n: conditions._enableI18n,
      },
      _messages
    );
  };
  // Development prefetches each call's compiler-injected messages for hot reload.
  return process.env.NODE_ENV !== 'production' && _messages?.length
    ? load()
    : memoizeForRequest('gt', load);
}

export function getMessages() {
  return memoizeForRequest('messages', async () => {
    const conditions = await getRequestConditions();
    return getMessagesInternal({
      locale: conditions._locale,
      enableI18n: conditions._enableI18n,
    });
  });
}

export function getTranslations(rootId?: string) {
  return memoizeForRequest(
    rootId === undefined ? 'translations' : `translations:${rootId}`,
    async () => {
      const conditions = await getRequestConditions();
      return getTranslationsInternal({
        locale: conditions._locale,
        enableI18n: conditions._enableI18n,
        rootId,
      });
    }
  );
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
