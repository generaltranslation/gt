import { use } from '../../utils/use';
import { getGTInternal, getMessagesInternal } from 'gt-i18n/internal';
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

export function useGT(
  _messages?: Message[]
): SyncResolutionFunctionWithFallback {
  return use(getGT(_messages));
}

export function useMessages() {
  return use(getMessages());
}
