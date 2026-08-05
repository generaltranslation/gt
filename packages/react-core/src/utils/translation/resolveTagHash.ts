import { getI18nConfig, hashMessage } from 'gt-i18n/internal';

// Single source of truth for the <T> id-tagging hash. Returns the translation
// hash ONLY when id-tagging is enabled (otherwise `undefined` → the output is
// rendered untouched, so apps not using the feature pay nothing).
//
// It also CACHES the result on `options.$_hash`. hashMessage short-circuits to
// `options.$_hash` when present, so every downstream hash of these same options
// — the translation lookup (client store + RSC cache key both go through
// hashMessage) — reuses this value instead of hashing again. Net effect when
// id-tagging is on: a single hash shared by tag + lookup, or ZERO extra hashing
// when the compiler already injected `$_hash`. Call this BEFORE the lookup so the
// lookup benefits from the cached value.
export function resolveTagHash(
  ...args: Parameters<typeof hashMessage>
): string | undefined {
  if (!getI18nConfig().isIdTaggingEnabled()) {
    return undefined;
  }
  const hash = hashMessage(...args); // reuses args[1].$_hash when already set
  (args[1] as { $_hash?: string }).$_hash = hash; // cache for the lookup
  return hash;
}
