import type { Updates } from 'generaltranslation';

type Update = Updates[number];

/**
 * Entries the compiler embeds at their call sites for the locales in
 * `files.gt.inlineTranslations.locales`: `<T>`, and tagged-template messages
 * from the unstable `t`, `useGT()` and `getGT()` that both compilers resolve
 * (see extractMessageTrees/isEmbeddedMessage.ts). Derive content is never
 * embedded.
 *
 * Every other entry, including `msg()`, `m()` and stable `gt()`/`t()`, still
 * has to be loaded, so `files.gt.inlineTranslations.msgOutput` writes every
 * entry except these for each embedded locale.
 */
const embeddedUpdates = new WeakSet<Update>();
let embeddedHashes: Set<string> | undefined;
// Hashes also used by an entry that is not embedded, which must stay loaded
let loadedHashes: Set<string> | undefined;

/** Marks an extracted entry whose translations the compiler embeds. */
export function markEmbeddedUpdate(update: Update): void {
  embeddedUpdates.add(update);
}

/** Records the hashes of a scan's updates; call once their hashes are set. */
export function recordEmbeddedHashes(updates: Iterable<Update>): void {
  embeddedHashes ??= new Set();
  loadedHashes ??= new Set();
  for (const update of updates) {
    const { hash } = update.metadata;
    if (!hash) continue;
    if (embeddedUpdates.has(update) && !update.metadata.staticId) {
      embeddedHashes.add(hash);
    } else {
      loadedHashes.add(hash);
    }
  }
}

/**
 * Hashes only embedded entries use. Undefined when nothing was extracted this
 * run (for example when translations are only downloaded), so callers don't
 * overwrite msgOutput files with every entry.
 */
export function getEmbeddedHashes(): ReadonlySet<string> | undefined {
  if (!embeddedHashes) return undefined;
  return new Set(
    [...embeddedHashes].filter((hash) => !loadedHashes?.has(hash))
  );
}

export function clearEmbeddedHashes(): void {
  embeddedHashes = undefined;
  loadedHashes = undefined;
}
