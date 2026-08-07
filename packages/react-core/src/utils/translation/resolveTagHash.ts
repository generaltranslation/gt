import { getI18nConfig, hashMessage } from 'gt-i18n/internal';

// Capability-safe id-tagging gate. isIdTaggingEnabled lives on react-core's
// ReactI18nConfig, but the config is a first-writer-wins singleton shared across
// bundled package copies, so an OLDER copy — which has no isIdTaggingEnabled
// method — can win initialization. Calling it unconditionally would throw a
// TypeError on EVERY <T>/<Tx> render; treat a missing method as disabled.
export function idTaggingEnabled(): boolean {
  const config = getI18nConfig() as { isIdTaggingEnabled?: () => boolean };
  return (
    typeof config.isIdTaggingEnabled === 'function' &&
    config.isIdTaggingEnabled()
  );
}

// Single source of truth for the <T> id-tagging hash. Returns the translation
// hash ONLY when id-tagging is enabled (otherwise `undefined` → the output is
// rendered untouched, so apps not using the feature pay nothing).
//
// It also CACHES the result on `options.$_hash`. hashMessage short-circuits to
// `options.$_hash` when present, so every downstream hash of these same options
// — the translation lookup (client store + RSC cache key both go through
// hashMessage) — reuses this value instead of hashing again. Net effect when
// id-tagging is on: a single hash shared by tag + lookup, or ZERO extra hashing
// when the compiler already injected `$_hash`. Called from prepareT (once,
// BEFORE the lookup) so the lookup benefits from the cached value.
export function resolveTagHash(
  ...args: Parameters<typeof hashMessage>
): string | undefined {
  if (!idTaggingEnabled()) {
    return undefined;
  }
  const hash = hashMessage(...args); // reuses args[1].$_hash when already set
  (args[1] as { $_hash?: string }).$_hash = hash; // cache for the lookup
  return hash;
}
