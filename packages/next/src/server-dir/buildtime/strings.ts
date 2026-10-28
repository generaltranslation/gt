import { use } from '../../utils/use';
import {
  getGTInternal,
  getMessagesInternal,
  getTranslationsInternal,
} from 'gt-i18n/internal';
import type { Message, SyncResolutionFunctionWithFallback } from 'gt-i18n';
import { getRequestConditions } from '../../request/getRequestConditions';

export async function getGT(
  _messages?: Message[]
): Promise<SyncResolutionFunctionWithFallback> {
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
  return getTranslationsInternal({
    locale: conditions._locale,
    enableI18n: conditions._enableI18n,
    rootId,
  });
}

export function useGT(
  _messages?: Message[]
): SyncResolutionFunctionWithFallback {
  return use(getGT(_messages));
}

export function useMessages() {
  return use(getMessages());
}

export function useTranslations(rootId?: string) {
  return use(getTranslations(rootId));
}
