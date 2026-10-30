import { getI18nConfig, type LocaleCandidates } from 'gt-i18n/internal';

export function resolveLocale(candidates?: LocaleCandidates | null): string {
  return getI18nConfig().resolveSupportedLocale(candidates ?? undefined);
}
