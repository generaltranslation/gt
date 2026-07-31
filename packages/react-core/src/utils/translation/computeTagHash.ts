import { getI18nConfig, hashMessage } from 'gt-i18n/internal';

// Single source of truth for the <T> id-tagging hash. Returns the translation
// hash ONLY when id-tagging is enabled (otherwise `undefined` → the output is
// rendered untouched, so apps not using the feature pay nothing). Collapsing the
// enable-check and the hash into one call keeps the T/Tx variants in lockstep and
// makes the "hash computed but not gated" bug (an earlier revision of this feature
// hashed on one RSC path regardless of the flag) inexpressible.
export function computeTagHash(
  ...args: Parameters<typeof hashMessage>
): string | undefined {
  return getI18nConfig().isIdTaggingEnabled()
    ? hashMessage(...args)
    : undefined;
}
