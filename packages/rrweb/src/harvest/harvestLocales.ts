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
      paths.push(new URL(href, location.origin).pathname);
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

// Default: swap the leading locale segment (…/en-US/x → …/fr/x). If the source
// locale isn't the first segment (unprefixed default), prepend the target.
function defaultLocaleToUrl(
  path: string,
  source: string,
  target: string
): string {
  const segs = path.split('/');
  if (segs[1] === source) segs[1] = target;
  else segs.splice(1, 0, target);
  return segs.join('/') || '/';
}

function countText(doc: Document, root: Node): number {
  let n = 0;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
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

// Index each element's own text by a STRUCTURAL KEY = its path of `tagName[nth-of-
// type]` from the content root. GT preserves element structure across locales (it
// only swaps text), so the SAME element carries the SAME key in every locale. Keys
// are computed per element from ELEMENTS only, so whitespace/comment nodes and
// active-item markup elsewhere can't shift alignment; elements present in only one
// render (dynamic/async) simply don't match — safe, never mis-paired.
function textByKey(root: Element): Map<string, string> {
  const map = new Map<string, string>();
  const visit = (el: Element, prefix: string) => {
    const own: string[] = [];
    const tagCounts: Record<string, number> = {};
    el.childNodes.forEach((c) => {
      if (c.nodeType === Node.TEXT_NODE) {
        if ((c.textContent ?? '').trim()) own.push(c.textContent ?? '');
      } else if (c.nodeType === Node.ELEMENT_NODE) {
        const child = c as Element;
        const nth = (tagCounts[child.tagName] =
          (tagCounts[child.tagName] ?? 0) + 1);
        visit(child, `${prefix}/${child.tagName}[${nth}]`);
      }
    });
    if (own.length > 0) map.set(prefix, own.join(''));
  };
  visit(root, '');
  return map;
}

async function harvestStructural(
  events: eventWithTime[],
  locales: string[],
  opts: Required<
    Pick<HarvestOptions, 'localeToUrl' | 'contentSelector' | 'maxPaths'>
  >
): Promise<LocaleTextOverlay> {
  const source = locales[0];
  if (!source) return {};
  const targets = locales.slice(1);
  const paths = visitedPaths(events, opts.maxPaths);
  const dict: Record<string, Map<string, string>> = {};
  for (const t of targets) dict[t] = new Map();

  for (const path of paths) {
    const src = await renderShell(
      opts.localeToUrl(path, source, source),
      opts.contentSelector
    );
    const srcMap = src.shell ? textByKey(src.shell) : null;
    for (const target of targets) {
      const bag = dict[target];
      const tgt = await renderShell(
        opts.localeToUrl(path, source, target),
        opts.contentSelector
      );
      if (bag && srcMap && tgt.shell) {
        const tgtMap = textByKey(tgt.shell);
        for (const [key, s] of srcMap) {
          const g = tgtMap.get(key);
          if (g !== undefined && s.trim() && g.trim() && s !== g) bag.set(s, g);
        }
      }
      tgt.dispose();
    }
    src.dispose();
  }

  // Map the dictionary onto the recording's nodes by source text.
  const recorded = collectRecordedText(events);
  const overlay: LocaleTextOverlay = {};
  for (const target of targets) {
    const d = dict[target];
    const bag: Record<number, string> = {};
    overlay[target] = bag;
    for (const [id, text] of recorded) {
      const tr = d?.get(text);
      if (tr !== undefined) bag[id] = tr;
    }
  }
  return overlay;
}

// ----- public entry ----- //

export async function harvestLocales(
  events: eventWithTime[],
  locales: string[],
  options: HarvestOptions = {}
): Promise<LocaleTextOverlay> {
  const resolved = {
    localeToUrl: options.localeToUrl ?? defaultLocaleToUrl,
    contentSelector: options.contentSelector ?? DEFAULT_CONTENT_SELECTOR,
    maxPaths: options.maxPaths ?? DEFAULT_MAX_PATHS,
  };

  const requested = options.key ?? 'auto';
  const useHash =
    requested === 'hash' ||
    (requested === 'auto' && recordingHasHashes(events));

  if (useHash) {
    // The `data-_gt-hash` id-tagging is SHIPPED (@generaltranslation/react-core
    // >=11.1.9, opt-in via `_tagIds`), so hashes are available. What's not done yet
    // is gt-rrweb's hash MAPPING (flatten a <T>'s translation dict onto individual
    // nodes via `getTranslations`) — so fall back to structural for now; 'auto'
    // stays safe. TODO(gt-rrweb): implement hash mapping.
    // eslint-disable-next-line no-console
    console.warn(
      '[gt-rrweb] hash harvest not implemented yet; using structural harvest.'
    );
  }

  return harvestStructural(events, locales, resolved);
}
