import { EventType, IncrementalSource } from '@rrweb/types';
import type { eventWithTime } from '@rrweb/types';

import type {
  HarvestOptions,
  LocaleTextOverlay,
  TranslationsLoader,
} from './types';

// Per-locale HARVEST (the "Process" step, run in-browser right after a recording stops).
// We do NOT translate — we read the app's OWN published translations per locale from the
// supplied `loadTranslations` (e.g. GT's loader / the CDN) and map them onto the recorded
// stream by MESSAGE HASH. No re-rendering: it needs neither reconstructable per-locale
// URLs nor a stable DOM shape across locales, and it covers interaction-only states. Two
// complementary lookups:
//
//   • `<T>` content: every `<T>` (with tag-ids enabled) is wrapped in a node carrying its
//     message HASH (see hashOf); its text nodes align to the flattened translation for
//     that hash. Handles JSX structure + variables. (overlayFromDict)
//   • `gt()` / `useGT()` strings: these render as bare text with NO hash marker, so we
//     hash each recorded SOURCE string (via the caller's `hashMessage`) and look that up
//     in the same dict. (stringOverlay)

// ===================================================================================
// GTJSON: GT's minified translation format. A locale's dictionary maps each message HASH
// to its translated content — a `JsxChildren` tree (string leaves, element nodes
// `{ t, c }`, variable placeholders `{ k, v }`) or, for string messages, a bare string.
// We only read it, so the shapes are declared locally (gt-rrweb stays framework-agnostic
// — gt-react is an OPTIONAL peer).
// ===================================================================================

/** A variable placeholder: `k` = name, `v` = minified type. Renders one text node. */
type GtVariable = { k: string; i?: number; v?: string };
/** GT metadata on an element; `b` present ⇒ plural/branch (no single rendered form). */
type GtProp = { b?: Record<string, GtJsxChildren>; t?: 'p' | 'b' };
/** An element: `t` = tag, `c` = children. */
type GtElement = { t?: string; i?: number; d?: GtProp; c?: GtJsxChildren };
export type GtJsxChild = string | GtElement | GtVariable;
export type GtJsxChildren = GtJsxChild | GtJsxChild[];

/** A locale's translations: hash → translated content (null when untranslated). */
export type TranslationDict = Record<string, GtJsxChildren | null>;

/**
 * A flattened leaf, one per rendered text node in document order: translatable `text`,
 * or a `variable` placeholder whose recorded (source) value must be kept.
 */
export type GtLeaf = { text: string } | { variable: true };

// GT field separators (U+001C-U+001F) delimit internal metadata inside string leaves;
// they never render, so strip them from emitted text. (Matching these control chars is
// the whole point.)
// oxlint-disable-next-line no-control-regex
const FIELD_SEP = /[\u001c-\u001f]/g;

function isElement(node: GtElement | GtVariable): node is GtElement {
  // A variable carries a `k` (name); an element never does.
  return !('k' in node);
}

// HTML void elements render neither children nor text. A CHILDLESS element that isn't one
// of these is a value-rendering component — a GT `<DateTime>`/`<Num>`/`<Currency>`
// (serialized as `{ t: 'LocalizedDateTime', … }`, no `c`) or a custom component — which
// renders one dynamic text node we must keep on source, NOT drop. Treating it as a
// placeholder keeps the leaf count aligned with the rendered text nodes.
const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

/**
 * Flatten a GTJSON entry to its leaves in document order — one per text node the app
 * renders for this message. Strings become text leaves; variables (`{ k }`) and
 * value-rendering components (a childless non-void element, e.g. a localized date/number)
 * become placeholder leaves (the caller keeps the recorded source value); elements with
 * children (`{ t, c }`) recurse. A plural/branch (`d.b`) has no single rendered form, so
 * the whole entry is unresolvable and this returns `null` — the caller then skips that
 * message and leaves it on source. Pure.
 */
export function flattenEntry(
  entry: GtJsxChildren | null | undefined
): GtLeaf[] | null {
  if (entry == null) return null;
  const out: GtLeaf[] = [];
  let unresolvable = false;

  const walk = (node: GtJsxChild): void => {
    if (unresolvable) return;
    if (typeof node === 'string') {
      out.push({ text: node.replace(FIELD_SEP, '') });
      return;
    }
    if (!node || typeof node !== 'object') return;
    if (!isElement(node)) {
      out.push({ variable: true });
      return;
    }
    if (node.d?.b) {
      unresolvable = true; // plural/branch: which branch rendered is unknown
      return;
    }
    if (node.c != null) {
      walkChildren(node.c);
      return;
    }
    // Childless: a void element renders nothing; anything else renders one dynamic text
    // node (localized date/number, custom component) we keep on source.
    if (!(typeof node.t === 'string' && VOID_TAGS.has(node.t.toLowerCase()))) {
      out.push({ variable: true });
    }
  };

  const walkChildren = (children: GtJsxChildren): void => {
    if (Array.isArray(children)) children.forEach(walk);
    else walk(children);
  };

  walkChildren(entry);
  return unresolvable ? null : out;
}

// ===================================================================================
// rrweb serialized DOM: the subset the harvest reads, plus recorded-text collection.
// ===================================================================================

type SerializedNode = {
  type: number;
  id: number;
  tagName?: string;
  textContent?: string;
  attributes?: Record<string, unknown>;
  childNodes?: SerializedNode[];
};

const TEXT_NODE = 3;

/**
 * The message hash a node carries, or null. Two tag-ids mechanisms exist: the runtime
 * wrapper renders `data-_gt` (a `hashMessage` string on a `display:contents` span), and
 * the SWC transform renders `data-_gt-hash`; we accept either. GT's INTERNAL `data-_gt`
 * is an object prop that never reaches the DOM, so it never appears here — but we still
 * reject a non-string / `[object …]` value defensively.
 */
function hashOf(n: SerializedNode): string | null {
  const a = n.attributes;
  if (!a) return null;
  const raw = a['data-_gt-hash'] ?? a['data-_gt'];
  if (typeof raw !== 'string') return null;
  const h = raw.trim();
  if (!h || h.startsWith('[object')) return null;
  return h;
}

/** Every recorded text node (rrweb id → text) across the FullSnapshot + mutations. */
export function collectRecordedText(
  events: eventWithTime[]
): Map<number, string> {
  const map = new Map<number, string>();
  const walk = (n: SerializedNode | undefined) => {
    if (!n) return;
    if (
      n.type === TEXT_NODE &&
      typeof n.textContent === 'string' &&
      n.textContent.trim()
    ) {
      map.set(n.id, n.textContent);
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
      for (const t of e.data.texts) {
        if (typeof t.value === 'string' && t.value.trim())
          map.set(t.id, t.value);
      }
    }
  }
  return map;
}

/** True if the recording carries GT message hashes (i.e. tag-ids was enabled). */
export function recordingHasHashes(events: eventWithTime[]): boolean {
  let found = false;
  const walk = (n: SerializedNode | undefined) => {
    if (!n || found) return;
    if (hashOf(n)) {
      found = true;
      return;
    }
    n.childNodes?.forEach(walk);
  };
  for (const e of events) {
    if (found) break;
    if (e.type === EventType.FullSnapshot) walk(e.data.node as SerializedNode);
    else if (
      e.type === EventType.IncrementalSnapshot &&
      e.data.source === IncrementalSource.Mutation
    ) {
      for (const add of e.data.adds) walk(add.node as SerializedNode);
    }
  }
  return found;
}

// ===================================================================================
// Hash harvest.
// ===================================================================================

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
    loadTranslations: TranslationsLoader;
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
      dict = (await opts.loadTranslations(target)) as TranslationDict;
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

// ===================================================================================
// Public entry.
// ===================================================================================

/** Read a cookie value in the browser (undefined if absent / non-browser). */
function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined' || !document.cookie) return undefined;
  for (const c of document.cookie.split('; ')) {
    const i = c.indexOf('=');
    if (i > 0 && decodeURIComponent(c.slice(0, i)) === name)
      return decodeURIComponent(c.slice(i + 1));
  }
  return undefined;
}

/**
 * Harvest the per-locale overlay for a recording using ONLY the app's `loadTranslations`
 * (the hash strategy). Without a loader there is nothing to read, so the overlay is empty
 * and the replay renders source. `<T>` content is mapped by the DOM message hash; passing
 * `hashMessage` additionally covers `gt()`/`useGT()` strings.
 */
export async function harvestLocales(
  events: eventWithTime[],
  locales: string[],
  options: HarvestOptions = {}
): Promise<LocaleTextOverlay> {
  if (typeof options.loadTranslations !== 'function') return {};
  // Source locale = the locale actually rendered while recording. Prefer an explicit
  // `sourceLocale`, then the GT locale cookie IF the consumer names it via
  // `localeCookieName` (we don't hardcode GT's cookie name — gt-rrweb stays
  // framework-agnostic; a GT app passes react-core's `defaultLocaleCookieName`), then
  // `locales[0]` (the caller-provided, SOURCE-FIRST locale — not an assumed default).
  const source =
    options.sourceLocale ??
    (options.localeCookieName
      ? readCookie(options.localeCookieName)
      : undefined) ??
    locales[0];

  return harvestHash(events, locales, {
    source,
    loadTranslations: options.loadTranslations,
    hashMessage: options.hashMessage,
  });
}

export type { HarvestOptions, LocaleTextOverlay, TranslationsLoader };
