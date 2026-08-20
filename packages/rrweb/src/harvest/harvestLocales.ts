import { EventType, IncrementalSource } from '@rrweb/types';
import type { eventWithTime } from '@rrweb/types';

import {
  DEFAULT_CONTENT_SELECTOR,
  type HarvestOptions,
  type LocaleTextOverlay,
} from '../types';

// Per-locale HARVEST (the "Process" step, run in-browser right after a recording
// stops). We do NOT translate — we read the site's OWN rendered translations, using
// only what every GT site guarantees (it can render each locale + preserves DOM
// structure across locales):
//
//   1. Collect the visited paths (initial URL + captured SPA navigations).
//   2. For each path, render the SOURCE locale and each TARGET locale in a hidden,
//      same-origin (authenticated) iframe and read the content-region text in
//      document order. Same clean structure across locales ⇒ pair by structural key
//      → a { sourceText → targetText } dictionary per locale.
//   3. Map that onto the recording: every recorded text node (by rrweb id) whose
//      source text is in the dictionary gets its target text.
//
// This is the "structural" strategy. The "hash" strategy (keyed by data-_gt-hash)
// is more robust and also covers interaction-only states, but requires the id-tagging
// feature (`_tagIds`) to be enabled so the recorded DOM carries hashes.

const RENDER_TIMEOUT_MS = 20000;
const SETTLE_TICKS = 3; // consecutive stable polls before we read
const DEFAULT_MAX_PATHS = 12; // bound total renders

type SerializedNode = {
  type: number;
  id: number;
  tagName?: string;
  textContent?: string;
  attributes?: Record<string, unknown>;
  childNodes?: SerializedNode[];
};

// ----- shared: recorded text + hash presence ----- //

/** Every recorded text node (rrweb id → text) across the FullSnapshot + mutations. */
export function collectRecordedText(
  events: eventWithTime[]
): Map<number, string> {
  const map = new Map<number, string>();
  const walk = (n: SerializedNode | undefined) => {
    if (!n) return;
    if (
      n.type === 3 &&
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

/** True if the recording carries `data-_gt-hash` (i.e. `_tagIds` was enabled). */
export function recordingHasHashes(events: eventWithTime[]): boolean {
  let found = false;
  const walk = (n: SerializedNode | undefined) => {
    if (!n || found) return;
    if (n.attributes && n.attributes['data-_gt-hash'] != null) {
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

// ----- structural strategy ----- //

function visitedPaths(events: eventWithTime[], maxPaths: number): string[] {
  const paths: string[] = [];
  const push = (href: string) => {
    try {
      paths.push(new URL(href, window.location.origin).pathname);
    } catch {
      /* ignore malformed */
    }
  };
  for (const e of events) {
    if (e.type === EventType.Meta && e.data.href) push(e.data.href);
    if (
      e.type === EventType.Custom &&
      e.data.tag === 'gt-nav' &&
      typeof (e.data.payload as { href?: string })?.href === 'string'
    ) {
      push((e.data.payload as { href: string }).href);
    }
  }
  return [...new Set(paths)].slice(0, maxPaths);
}

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

// Default URL builder for LOCALE-PREFIXED routing: swap the source-locale path
// segment — WHEREVER it sits, not just the first — for the target, or prepend one if
// the path has no source-locale segment. An app that encodes the locale outside the
// path (cookie/domain/query) has no segment to swap and must pass its own
// `localeToUrl`.
function prefixLocaleToUrl(
  path: string,
  source: string,
  target: string
): string {
  const segs = path.split('/');
  const i = segs.findIndex((s) => s === source);
  if (i > 0) segs[i] = target;
  else segs.splice(1, 0, target);
  return segs.join('/') || '/';
}

function countText(doc: Document, root: Node): number {
  let n = 0;
  const walker = doc.createTreeWalker(root, window.NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) n++;
  return n;
}

type Rendered = { shell: Element | null; dispose: () => void };

// Render a same-origin URL in a hidden iframe; resolve with its content-region
// element once its text-node count settles (SPA data loaded). Resolves { shell: null }
// on timeout/failure. Caller MUST dispose().
function renderShell(url: string, selector: string): Promise<Rendered> {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText =
      'position:fixed;left:-99999px;top:0;width:1440px;height:900px;border:0;visibility:hidden;';
    const dispose = () => iframe.remove();
    let done = false;
    const finish = (shell: Element | null) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      resolve({ shell, dispose });
    };
    const timer = window.setTimeout(() => finish(null), RENDER_TIMEOUT_MS);
    iframe.onload = () => {
      const doc = iframe.contentDocument;
      if (!doc) return finish(null);
      let last = -1;
      let stable = 0;
      let ticks = 0;
      const poll = () => {
        if (done) return;
        const shell = doc.querySelector(selector) ?? doc.body;
        const count = shell ? countText(doc, shell) : 0;
        stable = count > 0 && count === last ? stable + 1 : 0;
        last = count;
        if (stable >= SETTLE_TICKS) return finish(shell);
        if (++ticks > 80) return finish(shell); // ~12s of polling
        window.setTimeout(poll, 150);
      };
      poll();
    };
    document.body.appendChild(iframe);
    iframe.src = url;
  });
}

// Index EACH TEXT NODE by a STRUCTURAL KEY = its element path (`tagName[nth-of-type]`
// from the content root) plus its position among that element's children. GT preserves
// DOM structure across locales (it only swaps text), so the same text node carries the
// same key in every locale. Per-TEXT-NODE granularity (not per-element joined text)
// matters: it matches collectRecordedText, so every occurrence — including text nodes
// inside multi-text-node elements — contributes an observation to foldObservations (an
// untranslated one can flag ambiguity), and there's no joined-text artifact that could
// collide with an unrelated recorded node.
function textByKey(root: Element): Map<string, string> {
  const map = new Map<string, string>();
  const visit = (el: Element, prefix: string) => {
    const tagCounts: Record<string, number> = {};
    el.childNodes.forEach((c, i) => {
      if (c.nodeType === window.Node.TEXT_NODE) {
        const t = c.textContent ?? '';
        if (t.trim()) map.set(`${prefix}#${i}`, t);
      } else if (c.nodeType === window.Node.ELEMENT_NODE) {
        const child = c as Element;
        const nth = (tagCounts[child.tagName] =
          (tagCounts[child.tagName] ?? 0) + 1);
        visit(child, `${prefix}/${child.tagName}[${nth}]`);
      }
    });
  };
  visit(root, '');
  return map;
}

// Per-target dictionary. `bag` holds the SINGLE observation that every occurrence of
// a source text agreed on (a real translation, or the source text itself =
// "untranslated"); `ambiguous` holds source texts whose occurrences DISAGREED and are
// therefore dropped.
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

async function harvestStructural(
  events: eventWithTime[],
  locales: string[],
  opts: Required<
    Pick<HarvestOptions, 'localeToUrl' | 'contentSelector' | 'maxPaths'>
  > & { source: string }
): Promise<LocaleTextOverlay> {
  const source = opts.source;
  if (!source) return {};
  const targets = locales.filter((l) => l && l !== source);
  const paths = visitedPaths(events, opts.maxPaths);
  const dict: Record<string, TargetDict> = {};
  for (const t of targets) dict[t] = newTargetDict();

  for (const path of paths) {
    const src = await renderShell(
      opts.localeToUrl(path, source, source),
      opts.contentSelector
    );
    const srcMap = src.shell ? textByKey(src.shell) : null;
    for (const target of targets) {
      const tgt = await renderShell(
        opts.localeToUrl(path, source, target),
        opts.contentSelector
      );
      if (srcMap && tgt.shell) {
        foldObservations(dict[target], srcMap, textByKey(tgt.shell));
      }
      tgt.dispose();
    }
    src.dispose();
  }

  // Map each target dictionary onto the recording's nodes by source text.
  const recorded = collectRecordedText(events);
  const overlay: LocaleTextOverlay = {};
  for (const target of targets) {
    overlay[target] = overlayFromDict(dict[target], recorded);
  }
  return overlay;
}

// ----- public entry ----- //

export async function harvestLocales(
  events: eventWithTime[],
  locales: string[],
  options: HarvestOptions = {}
): Promise<LocaleTextOverlay> {
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

  const resolved = {
    localeToUrl: options.localeToUrl ?? prefixLocaleToUrl,
    contentSelector: options.contentSelector ?? DEFAULT_CONTENT_SELECTOR,
    maxPaths: options.maxPaths ?? DEFAULT_MAX_PATHS,
    source,
  };

  // NOTE: the `key: 'hash'` harvest (map recorded `data-_gt-hash` nodes to a
  // translations dict via `getTranslations`) isn't implemented yet; 'auto'/'hash'
  // both fall back to the structural harvest below, which stays safe.
  // TODO(gt-rrweb): implement hash mapping.

  return harvestStructural(events, locales, resolved);
}
