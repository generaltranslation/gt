import type { LanguageStatusState } from '../components/shared/LanguageStatus';
import type { TranslationStatus } from '../adapter/types';

export type ResolveLanguageStatusInput = {
  status?: TranslationStatus;
  isImported: boolean;
  isPending: boolean;
};

/**
 * Resolves what a locale row shows.
 *
 * `imported` wins over everything: once a translation is in Sanity, the status
 * query stops returning it, so a later refresh reports it as not ready.
 */
export function resolveLanguageStatusState({
  status,
  isImported,
  isPending,
}: ResolveLanguageStatusInput): LanguageStatusState {
  if (isImported) return 'imported';
  if (status?.isReady) return 'ready';
  if (isPending) return 'translating';
  return 'not-translated';
}
