import { getI18nConfig } from 'gt-i18n/internal';
import { use } from '../utils/use';

export async function getEnableI18n(): Promise<boolean> {
  // Resolved statically from config (default true) so consuming routes are not
  // opted out of static rendering. A per-request dynamic override can be
  // layered in front of this later if a runtime-toggle use case arises.
  return getI18nConfig().getEnableI18n();
}

export function useEnableI18n(): boolean {
  return use(getEnableI18n());
}
