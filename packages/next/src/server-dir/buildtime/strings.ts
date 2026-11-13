import { use } from '../../utils/use';
import {
  getGTInternal,
  getMessagesInternal,
  getTranslationsInternal,
} from 'gt-i18n/internal';
import type { Message } from 'gt-i18n/types';
import { getRequestConditions } from '../../request/getRequestConditions';
import { memoizeForRequest } from '../../utils/requestMemo';

function withRequestConditions<T>(
  resolve: (conditions: { locale: string; enableI18n: boolean }) => Promise<T>
): () => Promise<T> {
  return async () => {
    const { _locale, _enableI18n } = await getRequestConditions();
    return resolve({ locale: _locale, enableI18n: _enableI18n });
  };
}

export function getGT(_messages?: Message[]) {
  const load = withRequestConditions((conditions) =>
    getGTInternal(conditions, _messages)
  );
  // Development prefetches each call's compiler-injected messages for hot reload.
  return process.env.NODE_ENV !== 'production' && _messages?.length
    ? load()
    : memoizeForRequest('gt', load);
}

export function getMessages() {
  return memoizeForRequest(
    'messages',
    withRequestConditions(getMessagesInternal)
  );
}

export function getTranslations(rootId?: string) {
  return memoizeForRequest(
    rootId === undefined ? 'translations' : `translations:${rootId}`,
    withRequestConditions((conditions) =>
      getTranslationsInternal({ ...conditions, rootId })
    )
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
