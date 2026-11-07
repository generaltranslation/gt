/**
 * Hashes of entries extracted from msg() and from the m() function returned
 * by useMessages()/getMessages() during this run.
 *
 * The compiler can embed translations for gt() and <T> at their call sites,
 * but msg() strings are resolved later by m(), away from the call site, so
 * they still have to be loaded. `files.gt.inlineTranslations.msgOutput`
 * writes these entries to a separate file per embedded locale.
 */
let messageHashes: Set<string> | undefined;

export function recordMessageHashes(hashes: Iterable<string>): void {
  messageHashes ??= new Set();
  for (const hash of hashes) messageHashes.add(hash);
}

/**
 * Undefined when nothing was extracted this run (for example when
 * translations are only downloaded), so callers don't overwrite message
 * files with an empty set.
 */
export function getMessageHashes(): ReadonlySet<string> | undefined {
  return messageHashes;
}

export function clearMessageHashes(): void {
  messageHashes = undefined;
}
