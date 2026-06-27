/**
 * Canonical registry of reserved translation-option keys.
 *
 * Single source of truth for "which keys are reserved options vs. user
 * interpolation variables." Anything NOT listed here is treated as a user
 * variable. Consumers (e.g. extractVariables, dictionary validation, option
 * normalization) should derive from this set instead of hand-maintaining their
 * own key lists or relying on a bare `$`-prefix check.
 */

/** Public, user-facing reserved options (`$`-prefixed). */
export const PUBLIC_RESERVED_OPTION_KEYS = [
  '$id',
  '$context',
  '$maxChars',
  '$format',
  '$locale',
  // Legacy; hashing for this is handled in @generaltranslation/react-core.
  '$hash',
] as const;

/** Library-internal reserved options (`$_`-prefixed; not user-facing). */
export const INTERNAL_RESERVED_OPTION_KEYS = [
  '$_hash',
  '$_source',
  '$_fallback',
] as const;

/**
 * Every reserved option key. Any key in an options bag that is NOT in this set
 * is treated as a user interpolation variable.
 */
export const RESERVED_OPTION_KEYS = [
  ...PUBLIC_RESERVED_OPTION_KEYS,
  ...INTERNAL_RESERVED_OPTION_KEYS,
] as const;

export type ReservedOptionKey = (typeof RESERVED_OPTION_KEYS)[number];

const RESERVED_OPTION_KEY_SET: ReadonlySet<string> = new Set(
  RESERVED_OPTION_KEYS
);

/**
 * Returns true if `key` is a reserved option key (i.e. not a user
 * interpolation variable).
 */
export function isReservedOptionKey(key: string): key is ReservedOptionKey {
  return RESERVED_OPTION_KEY_SET.has(key);
}

/**
 * Keys valid inside a dictionary entry's options object (a subset of the
 * reserved keys). `satisfies` enforces that each stays a real reserved key.
 */
export const DICTIONARY_OPTION_KEYS = [
  '$context',
  '$format',
  '$maxChars',
] as const satisfies readonly ReservedOptionKey[];
