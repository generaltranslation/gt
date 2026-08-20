import { EventType, IncrementalSource } from '@rrweb/types';
import type { eventWithTime } from '@rrweb/types';

import { harvestHash } from './hashHarvest';
import { collectRecordedText, hashOf, type SerializedNode } from './serialized';
import {
  foldObservations,
  newTargetDict,
  overlayFromDict,
  type TargetDict,
} from './structuralDict';
import {
  DEFAULT_CONTENT_SELECTOR,
  type HarvestOptions,
  type LocaleTextOverlay,
} from '../types';

// Per-locale HARVEST (the "Process" step, run in-browser right after a recording
// stops). We do NOT translate — we read the site's OWN translations. Two strategies:
//
//   • "hash" (preferred): map recorded text onto the target locale's translation read
//     from the app's translations (getTranslations, e.g. the GT CDN) — `<T>` content by
//     the message hash each carries (tag-ids), and `gt()`/`useGT()` strings by hashing
//     their source text (hashMessage). No re-rendering; also covers interaction-only
//     states. See hashHarvest.
//   • "structural" (fallback): render the SOURCE + each TARGET locale in a hidden,
//     same-origin iframe per visited path and pair text by DOM structure. Needs
//     reconstructable per-locale URLs and a stable DOM shape across locales.
//
// `key: 'auto'` (default) uses hash when a getTranslations loader is provided AND the
// recording carries hashes (or a hashMessage is given), else structural.

const RENDER_TIMEOUT_MS = 20000;
const SETTLE_TICKS = 3; // consecutive stable polls before we read
const DEFAULT_MAX_PATHS = 12; // bound total renders

// ----- shared: recorded text + hash presence ----- //

// `collectRecordedText` (rrweb id → text) lives in ./serialized so hashHarvest can share
// it without a circular import; re-exported here for the public ./harvest entry.
export { collectRecordedText } from './serialized';

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
// from the content root) plus its position among that element's MEANINGFUL text nodes.
// GT preserves DOM structure across locales (it only swaps text), so the same text node
// carries the same key in every locale. The text index counts only non-blank text
// nodes: a whitespace-only or comment node that appears in one locale's render but not
// another must NOT shift the key, or source text would pair with an unrelated target
// string. Per-TEXT-NODE granularity (not per-element joined text) matches
// collectRecordedText, so every occurrence contributes an observation to
// foldObservations and there's no joined-text artifact that could collide.
function textByKey(root: Element): Map<string, string> {
  const map = new Map<string, string>();
  const visit = (el: Element, prefix: string) => {
    const tagCounts: Record<string, number> = {};
    let textIdx = 0;
    el.childNodes.forEach((c) => {
      if (c.nodeType === window.Node.TEXT_NODE) {
        const t = c.textContent ?? '';
        if (t.trim()) {
          map.set(`${prefix}#${textIdx}`, t);
          textIdx++;
        }
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

  // Choose the strategy. The hash strategy needs a translations loader plus SOMETHING to
  // key by: recorded `<T>` hashes (data-_gt) and/or a `hashMessage` for `gt()` strings.
  // 'auto' uses hash when possible, else structural; 'structural' is forced; 'hash' falls
  // back to structural when it can't run (still safe).
  const strategy = options.key ?? 'auto';
  const canHash =
    typeof options.getTranslations === 'function' &&
    (recordingHasHashes(events) || typeof options.hashMessage === 'function');
  if ((strategy === 'auto' || strategy === 'hash') && canHash) {
    return harvestHash(events, locales, {
      source,
      getTranslations: options.getTranslations!,
      hashMessage: options.hashMessage,
    });
  }

  return harvestStructural(events, locales, {
    localeToUrl: options.localeToUrl ?? prefixLocaleToUrl,
    contentSelector: options.contentSelector ?? DEFAULT_CONTENT_SELECTOR,
    maxPaths: options.maxPaths ?? DEFAULT_MAX_PATHS,
    source,
  });
}
