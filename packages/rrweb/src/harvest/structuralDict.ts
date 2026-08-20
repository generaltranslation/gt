// The per-target dictionary the STRUCTURAL harvest builds by observing the same message
// across per-locale renders. Kept in its own module (not the public harvest entry) so
// these helpers stay internal to the strategy while remaining unit-testable.

// `bag` holds the SINGLE observation that every occurrence of a source text agreed on
// (a real translation, or the source text itself = "untranslated"); `ambiguous` holds
// source texts whose occurrences DISAGREED and are therefore dropped.
export type TargetDict = { bag: Map<string, string>; ambiguous: Set<string> };

export function newTargetDict(): TargetDict {
  return { bag: new Map(), ambiguous: new Set() };
}

// Fold one render's structural alignment (source key→text vs target key→text) into a
// target's dictionary. Every source-text occurrence is recorded as an observation —
// a real translation, or the source itself when the target is missing/blank/identical
// ("untranslated"). If a source text is observed with MORE THAN ONE distinct value
// (different translations, or translated in one place and untranslated in another) it
// is context-dependent → marked ambiguous and dropped, so every matching node renders
// SOURCE rather than one occurrence's value applied everywhere. Pure (mutates entry).
export function foldObservations(
  entry: TargetDict,
  srcMap: Map<string, string>,
  tgtMap: Map<string, string>
): void {
  for (const [key, s] of srcMap) {
    if (!s.trim() || entry.ambiguous.has(s)) continue;
    const g = tgtMap.get(key);
    const observed = g !== undefined && g.trim() && g !== s ? g : s;
    const prev = entry.bag.get(s);
    if (prev === undefined) {
      entry.bag.set(s, observed);
    } else if (prev !== observed) {
      entry.ambiguous.add(s);
      entry.bag.delete(s);
    }
  }
}

// Map a finished target dictionary onto the recording's nodes by source text. Emits
// only REAL translations (a bag value equal to the source means every occurrence was
// untranslated → that node renders source). Pure.
export function overlayFromDict(
  entry: TargetDict,
  recorded: Map<number, string>
): Record<number, string> {
  const bag: Record<number, string> = {};
  for (const [id, text] of recorded) {
    if (entry.ambiguous.has(text)) continue;
    const tr = entry.bag.get(text);
    if (tr !== undefined && tr !== text) bag[id] = tr;
  }
  return bag;
}
