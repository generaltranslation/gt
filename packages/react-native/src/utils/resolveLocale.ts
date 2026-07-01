import { getI18nConfig } from 'gt-i18n/internal';
import type { LocaleCandidates } from 'gt-i18n/internal/types';

export function resolveLocale(candidates?: LocaleCandidates | null): string {
  return getI18nConfig().resolveSupportedLocale(candidates ?? undefined);
}
