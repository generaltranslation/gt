// A translations file of a build with hash minification holds each of its
// translations once, and for the list of each chunk that reads some of
// them, runs of three numbers: a place in the list, the place of its
// translation in the file, and how many places follow on from both. A call
// site passes the name of its chunk's list, a dot and its place in the list.

/** Whether a string is what a call site of such a build passes. */
export const isMinifiedId = (id) => /^[A-Za-z0-9_-]{8}\.\d+$/.test(id);

/**
 * What a file's translations are to a page: an entry for each id, as
 * gt-react's `register()` makes them. A file keyed by hashes is that
 * already.
 */
export function entriesOf(translations) {
  if (!Array.isArray(translations)) return translations;
  const [held, lists] = translations;
  const entries = {};
  for (const [name, runs] of Object.entries(lists)) {
    for (let run = 0; run < runs.length; run += 3) {
      for (let next = 0; next < runs[run + 2]; next++) {
        entries[`${name}.${runs[run] + next}`] = held[runs[run + 1] + next];
      }
    }
  }
  return entries;
}

/** The translations a file of such a build writes out, each of which it holds once. */
export const heldBy = (translations) =>
  Array.isArray(translations) ? translations[0] : Object.values(translations);
