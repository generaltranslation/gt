import type { TranslationPreferences } from '../adapter/types';

/**
 * These are user preferences, not run state, so they persist across sessions
 * rather than resetting with the tab. Plugin config sets the starting point;
 * once the user touches a switch, their choice wins. Keyed by project + dataset
 * so Studios sharing an origin don't collide.
 */
export const getPreferencesStorageKey = (
  projectId: string | undefined,
  dataset: string | undefined
) => `gt-sanity:preferences:${projectId ?? ''}:${dataset ?? ''}`;

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Read the stored preferences, falling back to `defaults` for anything the
 * stored object doesn't specify.
 */
export function readPreferences(
  storageKey: string,
  defaults: TranslationPreferences
): TranslationPreferences {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return defaults;
    const parsed: unknown = JSON.parse(raw);
    if (!isPlainRecord(parsed)) return defaults;
    // Merge per key: a preference added in a later release falls back to its
    // default instead of being dropped by a stale stored object.
    const merged = { ...defaults };
    const keys = Object.keys(defaults) as (keyof TranslationPreferences)[];
    for (const key of keys) {
      const value = parsed[key];
      if (typeof value === 'boolean') merged[key] = value;
    }
    return merged;
  } catch {
    return defaults;
  }
}

export function writePreferences(
  storageKey: string,
  value: TranslationPreferences
): void {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    // localStorage unavailable (SSR, private mode, quota) — the choice still
    // applies, it just won't survive a reload.
  }
}
