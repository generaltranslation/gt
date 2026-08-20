import { EventType, IncrementalSource } from '@rrweb/types';
import type { eventWithTime } from '@rrweb/types';

import { flattenEntry, type TranslationDict } from './gtjson';
import {
  collectRecordedText,
  hashOf,
  TEXT_NODE,
  type SerializedNode,
} from './serialized';
import type { LocaleTextOverlay, TranslationsLoader } from '../types';

// The "hash" strategy. We map recorded text onto each target locale's translation read
// from the app's OWN translations (getTranslations, e.g. the GT CDN) with NO re-rendering
// — so it needs neither reconstructable per-locale URLs nor a stable DOM shape across
// locales, and it covers interaction-only states (it works purely from the recorded
// stream + the dict). Two complementary lookups:
//
//   • `<T>` content: every `<T>` (with tag-ids enabled) is wrapped in a node carrying the
//     message HASH (see serialized.hashOf); its text nodes align to the flattened
//     translation for that hash. Handles JSX structure + variables. (overlayFromDict)
//   • `gt()` / `useGT()` strings: these render as bare text with NO hash marker, so we
//     hash each recorded SOURCE string (via the caller's `hashMessage`) and look that up
//     in the same dict. (stringOverlay)

/** One recorded `<T>` occurrence: its hash + its descendant text nodes, in order. */
type HashNode = { hash: string; textNodes: { id: number; text: string }[] };

// Collect every hash node's descendant text nodes in document order. Text is kept
// UNTRIMMED so its position lines up with the flattened entry's leaves (which include
// whitespace-only string leaves). Only the OUTERMOST hash node of a nested pair is
// emitted: its entry already recurses into the inner `<T>` (a child element), so the
// inner text nodes are covered by the outer alignment.
export function collectHashNodes(events: eventWithTime[]): HashNode[] {
  const found: HashNode[] = [];

  const collectText = (
    n: SerializedNode,
    acc: { id: number; text: string }[]
  ): void => {
    if (n.type === TEXT_NODE) {
      if (typeof n.textContent === 'string')
        acc.push({ id: n.id, text: n.textContent });
      return;
    }
    n.childNodes?.forEach((c) => collectText(c, acc));
  };

  const walk = (n: SerializedNode | undefined): void => {
    if (!n) return;
    if (hashOf(n)) {
      const textNodes: { id: number; text: string }[] = [];
      n.childNodes?.forEach((c) => collectText(c, textNodes));
      found.push({ hash: hashOf(n) as string, textNodes });
      return; // outermost only
    }
    n.childNodes?.forEach(walk);
  };

  for (const e of events) {
    if (e.type === EventType.FullSnapshot) {
      walk(e.data.node as SerializedNode);
    } else if (
      e.type === EventType.IncrementalSnapshot &&
      e.data.source === IncrementalSource.Mutation
    ) {
      for (const add of e.data.adds) walk(add.node as SerializedNode);
    }
  }
  return found;
}

/**
 * Build one locale's overlay from a translations dict by aligning each hash node's text
 * nodes to the flattened translation. A node is skipped (left on source) when its hash
 * is untranslated, is a plural/branch (no single rendered form), or the leaf count
 * doesn't match the recorded text-node count (structure drift) — so a mismatch never
 * mis-assigns text. Variable leaves keep the recorded (source) value. Pure.
 */
export function overlayFromDict(
  hashNodes: HashNode[],
  dict: TranslationDict
): Record<number, string> {
  const bag: Record<number, string> = {};
  for (const node of hashNodes) {
    const leaves = flattenEntry(dict[node.hash]);
    if (!leaves || leaves.length !== node.textNodes.length) continue;
    for (let i = 0; i < leaves.length; i++) {
      const leaf = leaves[i];
      if ('variable' in leaf) continue; // keep the recorded variable value
      const target = node.textNodes[i];
      if (leaf.text && leaf.text !== target.text && leaf.text.trim())
        bag[target.id] = leaf.text;
    }
  }
  return bag;
}

/**
 * Cover text NOT wrapped in a `<T>` — `gt()`/`useGT()` strings and other bare recorded
 * text — by hashing each recorded SOURCE string to its GT message hash and looking that
 * up in the dict. Nodes already translated by the `<T>` path (`covered`) are skipped so
 * it wins. Only STRING dict entries apply (a JSX entry belongs to a `<T>`, not bare
 * text); a translation equal to source, blank, or absent is left on source. An
 * interpolated string (e.g. `gt('Hello {name}')` rendered as "Hello Ann") won't match its
 * template's hash, so it simply stays on source. Pure.
 */
export function stringOverlay(
  recorded: Map<number, string>,
  covered: Set<number>,
  dict: TranslationDict,
  hashMessage: (message: string) => string | undefined
): Record<number, string> {
  const bag: Record<number, string> = {};
  const hashByText = new Map<string, string | null>(); // memoize per distinct string
  for (const [id, text] of recorded) {
    if (covered.has(id)) continue;
    let hash = hashByText.get(text);
    if (hash === undefined) {
      try {
        hash = hashMessage(text) ?? null;
      } catch {
        hash = null;
      }
      hashByText.set(text, hash);
    }
    if (!hash) continue;
    const entry = dict[hash];
    if (typeof entry === 'string' && entry.trim() && entry !== text)
      bag[id] = entry;
  }
  return bag;
}

export async function harvestHash(
  events: eventWithTime[],
  locales: string[],
  opts: {
    source: string;
    getTranslations: TranslationsLoader;
    hashMessage?: (message: string) => string | undefined;
  }
): Promise<LocaleTextOverlay> {
  const targets = locales.filter((l) => l && l !== opts.source);
  const hashNodes = collectHashNodes(events);
  // Recorded text is only needed for the `gt()`-string lookup (hashMessage path).
  const recorded = opts.hashMessage ? collectRecordedText(events) : null;
  const overlay: LocaleTextOverlay = {};
  for (const target of targets) {
    let dict: TranslationDict | null = null;
    try {
      dict = (await opts.getTranslations(target)) as TranslationDict;
    } catch {
      dict = null; // best effort: this locale falls back to source
    }
    if (!dict) {
      overlay[target] = {};
      continue;
    }
    // `<T>` content first (precise, wins), then fill bare `gt()` text.
    const bag = overlayFromDict(hashNodes, dict);
    if (recorded && opts.hashMessage) {
      const covered = new Set(Object.keys(bag).map(Number));
      Object.assign(
        bag,
        stringOverlay(recorded, covered, dict, opts.hashMessage)
      );
    }
    overlay[target] = bag;
  }
  return overlay;
}
