import { record } from '@rrweb/record';
import { EventType } from '@rrweb/types';
import type { eventWithTime } from '@rrweb/types';

import { harvestLocales } from '../harvest/harvestLocales';
import { collectInlinedFontFaceCss } from './inlineFonts';
import {
  aspectOf,
  DEFAULT_CONTENT_SELECTOR,
  GT_EVENT,
  type FrameOption,
  type HarvestOptions,
  type LocaleTextOverlay,
  type RecorderBundle,
  type RecorderConfig,
  type RecorderStatus,
} from '../types';

// The live recorder lives in MODULE state, not React state. rrweb's `record()` is a
// global side effect on `document`; its lifecycle must survive component remounts
// (route changes remount the subtree that mounts <GTRecorder>). Keeping it here means
// a recording keeps running across navigation; React just mirrors this state.

type CoreConfig = {
  contentSelector: string;
  frame: FrameOption;
  onComplete?: (bundle: RecorderBundle) => void;
  harvest?: HarvestOptions;
};

const coreConfig: CoreConfig = {
  contentSelector: DEFAULT_CONTENT_SELECTOR,
  frame: 'none',
};

let status: RecorderStatus = 'idle';
let activeStop: (() => void) | undefined;
let activeEvents: eventWithTime[] = [];
let activeLocales: string[] = [];
let navCleanup: (() => void) | undefined;
// Bumped on every start(). stop() captures it before its async harvest so a stop
// whose harvest resolves AFTER a new recording began won't reset the shared status
// (which would tear down the new recording's overlay + Stop control).
let generation = 0;
const listeners = new Set<(status: RecorderStatus) => void>();

function setStatus(next: RecorderStatus): void {
  if (status === next) return;
  status = next;
  for (const listener of listeners) listener(status);
}

export function getStatus(): RecorderStatus {
  return status;
}

export function subscribe(
  listener: (status: RecorderStatus) => void
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** <GTRecorder> pushes its props here so any stop source produces the same bundle. */
export function configure(config: Partial<CoreConfig>): void {
  Object.assign(coreConfig, config);
}

// ----- capture framing ----- //

const FRAME_STYLE_ID = 'gt-rrweb-frame';
// Vertical space (px) reserved above+below the framed content so the overlay's Stop
// button stays on-screen; must match RecordingOverlay's CHROME_V.
const CHROME_V = 144;

// Reflow the content region into a centered box of the given aspect. Injected as a
// stylesheet + an <html> class so it's captured by rrweb (applied BEFORE the
// snapshot) — the replay reproduces the same framing.
function applyFrame(): void {
  const ar = aspectOf(coreConfig.frame);
  if (ar == null) return;
  if (document.getElementById(FRAME_STYLE_ID)) return;
  const w = `min(94vw, calc((100vh - ${CHROME_V}px) * ${ar}))`;
  const h = `min(calc(100vh - ${CHROME_V}px), calc(94vw / ${ar}))`;
  const box =
    `inset:auto !important;left:50% !important;top:50% !important;` +
    `transform:translate(-50%,-50%) !important;width:${w} !important;height:${h} !important;`;
  // Prefix each comma-separated selector with the recording class.
  const rule = coreConfig.contentSelector
    .split(',')
    .map((s) => `html.gt-recording ${s.trim()}`)
    .join(',');
  const style = document.createElement('style');
  style.id = FRAME_STYLE_ID;
  style.textContent = `${rule}{${box}}`;
  document.head.appendChild(style);
  document.documentElement.classList.add('gt-recording');
}

function removeFrame(): void {
  document.getElementById(FRAME_STYLE_ID)?.remove();
  document.documentElement.classList.remove('gt-recording');
}

// ----- self-contained fonts ----- //

const FONT_STYLE_ID = 'gt-rrweb-fonts';

// Embed same-origin web fonts as data: URIs in a <style> appended to <head> BEFORE
// the snapshot, so the recording carries its own fonts (see inlineFonts). Best
// effort: a fetch/CORS failure just leaves the replay on fallback fonts.
async function injectInlinedFonts(): Promise<void> {
  if (document.getElementById(FONT_STYLE_ID)) return;
  try {
    const css = await collectInlinedFontFaceCss();
    if (!css) return;
    const style = document.createElement('style');
    style.id = FONT_STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  } catch {
    // Best effort: on failure the replay falls back to system fonts.
  }
}

function removeInlinedFonts(): void {
  document.getElementById(FONT_STYLE_ID)?.remove();
}

// ----- SPA navigation capture ----- //

// rrweb only captures the initial href; record SPA navigations as custom events so
// the harvest knows which URLs were visited. Patches the History API for the
// recording and restores it on stop.
function startNavCapture(): void {
  const origPush = window.history.pushState;
  const origReplace = window.history.replaceState;
  const emit = () => {
    try {
      record.addCustomEvent(GT_EVENT.nav, { href: window.location.href });
    } catch {
      /* recorder not active */
    }
  };
  window.history.pushState = function (
    this: History,
    ...args: Parameters<History['pushState']>
  ) {
    const result = origPush.apply(this, args);
    emit();
    return result;
  };
  window.history.replaceState = function (
    this: History,
    ...args: Parameters<History['replaceState']>
  ) {
    const result = origReplace.apply(this, args);
    emit();
    return result;
  };
  window.addEventListener('popstate', emit);
  navCleanup = () => {
    window.history.pushState = origPush;
    window.history.replaceState = origReplace;
    window.removeEventListener('popstate', emit);
    navCleanup = undefined;
  };
}

// Splice the harvested overlay into the stream as a custom event, right after the
// FullSnapshot. The replayer reads it to render each locale.
function injectOverlay(
  events: eventWithTime[],
  overlay: LocaleTextOverlay
): eventWithTime[] {
  const at = Math.max(
    0,
    events.findIndex((e) => e.type === EventType.FullSnapshot)
  );
  const evt = {
    type: EventType.Custom,
    data: { tag: GT_EVENT.i18n, payload: overlay },
    timestamp: events[at]?.timestamp ?? 0,
  } as eventWithTime;
  const out = events.slice();
  out.splice(at + 1, 0, evt);
  return out;
}

// ----- lifecycle ----- //

export async function start(runConfig: RecorderConfig): Promise<void> {
  if (activeStop) return;
  setStatus('preparing');
  applyFrame();
  // Embed fonts BEFORE the snapshot so they're captured self-contained.
  await injectInlinedFonts();
  activeEvents = [];
  activeLocales = runConfig.locales;
  const stop = record({
    emit(event) {
      activeEvents.push(event);
    },
    // Drop high-volume cursor telemetry — the replay synthesizes the cursor from
    // click waypoints. (Scroll can't be disabled via `sampling` — it takes a
    // throttle number, not a boolean — so it stays recorded but unused.)
    sampling: { mousemove: false },
    // Never capture typed values (passwords / PII).
    maskAllInputs: true,
    // Do NOT re-serialize the app's stylesheets — rrweb's CSSOM inlining is lossy
    // for modern CSS (nesting, @layer, color-mix). Keeping the (absolutized)
    // <link href>s makes the replay load the real CSS. Fonts referenced by those
    // sheets can't be fetched cross-origin at replay time, so we embed them as
    // data: URIs ourselves (injectInlinedFonts, above) — `collectFonts` only
    // captures the @font-face RULES, not the binaries.
    inlineStylesheet: false,
    collectFonts: true,
  });
  // `record()` returns undefined if it can't start (e.g. no document).
  if (!stop) {
    removeFrame();
    removeInlinedFonts();
    setStatus('idle');
    return;
  }
  activeStop = stop;
  generation += 1;
  startNavCapture();
  // Stamp the traced locales (source first) so the recording is self-describing.
  if (runConfig.locales.length) {
    record.addCustomEvent(GT_EVENT.locales, {
      locales: runConfig.locales,
      sourceLocale: runConfig.locales[0],
    });
  }
  setStatus('recording');
}

// Stop capture, HARVEST the traced locales, and return the assembled bundle. Harvest
// failure is non-fatal — the bundle falls back to source-only (empty overlay).
export async function stop(): Promise<RecorderBundle | null> {
  if (!activeStop) return null;
  const stoppedGeneration = generation;
  activeStop();
  activeStop = undefined;
  navCleanup?.();
  removeFrame();
  removeInlinedFonts();
  const events = activeEvents;
  const locales = activeLocales;
  activeEvents = [];
  activeLocales = [];
  if (events.length === 0) {
    setStatus('idle');
    return null;
  }

  let overlay: LocaleTextOverlay = {};
  let output = events;
  if (locales.length > 1) {
    setStatus('preparing');
    try {
      overlay = await harvestLocales(events, locales, coreConfig.harvest);
      output = injectOverlay(events, overlay);
    } catch {
      // Non-fatal: the bundle falls back to source-only (empty overlay).
    }
  }

  const bundle: RecorderBundle = { events: output, locales, overlay };
  // Only reset status if no new recording started while we were harvesting —
  // otherwise we'd clear the in-progress recording's status/overlay.
  if (generation === stoppedGeneration) setStatus('idle');
  coreConfig.onComplete?.(bundle);
  return bundle;
}

/** Stop rrweb's observers without harvesting (e.g. on page unload). */
export function abort(): void {
  if (!activeStop) return;
  activeStop();
  activeStop = undefined;
  navCleanup?.();
  removeFrame();
  removeInlinedFonts();
  activeEvents = [];
  activeLocales = [];
  setStatus('idle');
}
