import { getI18nConfig } from 'gt-i18n/internal';
import type { LocaleCandidates } from 'gt-i18n/internal/types';

export function resolveLocale(candidates?: LocaleCandidates | null): string {
  const i18nConfig = getI18nConfig();
  return (
    i18nConfig.determineLocale(candidates ?? undefined) ||
    i18nConfig.getDefaultLocale()
  );
}
