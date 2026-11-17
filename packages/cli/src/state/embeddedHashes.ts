import type { Updates } from 'generaltranslation';
import type { MessageEmbedding } from '../react/jsx/utils/stringParsing/extractMessageTrees/isEmbeddedMessage.js';

type Update = Updates[number];

/**
 * Entries the compiler embeds at their call sites for the locales in
 * `files.gt.inlineTranslations.locales`: `<T>`, and the tagged-template
 * messages from the unstable `t`, `useGT()` and `getGT()` that the compiler
 * of their entry point embeds (see extractMessageTrees/isEmbeddedMessage.ts).
 * Messages that use helpers are embedded only with
 * `files.gt.inlineTranslations.helpers`. Derive content is never embedded.
 *
 * Every other entry, including `msg()`, `m()` and stable `gt()`/`t()`, still
 * has to be loaded, so `files.gt.inlineTranslations.msgOutput` writes every
 * entry except these for each embedded locale.
 */
const embeddedUpdates = new WeakMap<Update, MessageEmbedding>();
let embeddedHashes: Record<MessageEmbedding, Set<string>> | undefined;
// Hashes also used by an entry that is not embedded, which must stay loaded
let loadedHashes: Set<string> | undefined;

/** Marks an extracted entry whose translations the compiler embeds. */
export function markEmbeddedUpdate(
  update: Update,
  embedding: MessageEmbedding
): void {
  embeddedUpdates.set(update, embedding);
}

/** Records the hashes of a scan's updates; call once their hashes are set. */
export function recordEmbeddedHashes(updates: Iterable<Update>): void {
  embeddedHashes ??= { always: new Set(), 'with-helpers': new Set() };
  loadedHashes ??= new Set();
  for (const update of updates) {
    const { hash } = update.metadata;
    if (!hash) continue;
    const embedding = embeddedUpdates.get(update);
    if (embedding && !update.metadata.staticId) {
      embeddedHashes[embedding].add(hash);
    } else {
      loadedHashes.add(hash);
    }
  }
}

/**
 * Records the hashes of every other entry of the run, such as gt-vue's or a
 * dictionary's, as loaded. Does nothing when no scan recorded hashes.
 */
export function recordLoadedHashes(updates: Iterable<Update>): void {
  if (!loadedHashes) return;
  for (const update of updates) {
    const { hash } = update.metadata;
    if (hash && !embeddedUpdates.has(update)) loadedHashes.add(hash);
  }
}

/**
 * Hashes only embedded entries use. `helpers` is
 * `files.gt.inlineTranslations.helpers`: without it, messages that use
 * helpers are not embedded, and neither is a hash one of them shares.
 * Undefined when nothing was extracted this run (for example when
 * translations are only downloaded), so callers don't overwrite msgOutput
 * files with every entry.
 */
export function getEmbeddedHashes(
  helpers: boolean
): ReadonlySet<string> | undefined {
  if (!embeddedHashes) return undefined;
  const withHelpers = embeddedHashes['with-helpers'];
  return new Set(
    [...embeddedHashes.always, ...(helpers ? withHelpers : [])].filter(
      (hash) => !loadedHashes?.has(hash) && (helpers || !withHelpers.has(hash))
    )
  );
}

export function clearEmbeddedHashes(): void {
  embeddedHashes = undefined;
  loadedHashes = undefined;
}
