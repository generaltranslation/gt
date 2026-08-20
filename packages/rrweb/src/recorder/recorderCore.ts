import { record } from '@rrweb/record';
import { EventType } from '@rrweb/types';
import type { eventWithTime } from '@rrweb/types';

import { harvestLocales } from '../harvest/harvestLocales';
import {
  fetchInlinedFontCss,
  injectFontStyle,
  removeInlinedFonts,
} from './inlineFonts';
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
// A recording is "owned" once `activeStop` is set — but start() must await font
// inlining BEFORE it can call record(), so ownership is reserved SYNCHRONOUSLY with
// `preparing` (a concurrent start() bails on the guard) plus a monotonic `sessionId`:
// stop()/abort() during the prep window bump `sessionId` to cancel the pending start
// (so recording can't begin after the caller stopped it), and it also guards the
// post-harvest status reset so a slow harvest can't clobber a newer recording.
let preparing = false;
let sessionId = 0;
// Snapshot of coreConfig taken when a recording claims the session, so stop()/harvest
// use THIS session's settings + onComplete even if configure() runs (another mount)
// during recording or the async harvest.
let activeConfig: CoreConfig | undefined;
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
  // `overflow:hidden` clips content to the frame: a descendant sized to the VIEWPORT
  // (e.g. `height:100vh`) is laid out against the window, not this box, so it would
  // otherwise spill past the 16:9 edges. Clipping keeps the capture inside the frame
  // (inner scroll containers still scroll; rrweb records their scroll either way).
  const box =
    `inset:auto !important;left:50% !important;top:50% !important;` +
    `transform:translate(-50%,-50%) !important;width:${w} !important;height:${h} !important;` +
    `overflow:hidden !important;`;
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

// Self-contained fonts: fetchInlinedFontCss / injectFontStyle / removeInlinedFonts live
// in ./inlineFonts alongside the CSS collection they wrap.

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
  // Reserve ownership SYNCHRONOUSLY (before any await) so a second start() during the
  // font-inlining window can't create a competing recorder.
  if (activeStop || preparing) return;
  preparing = true;
  const mySession = ++sessionId;
  setStatus('preparing');
  // Do the ONLY await (font fetch) BEFORE mutating the DOM. If stop()/abort()
  // supersedes this prep during the fetch, we bail having touched nothing — so we
  // can't remove a newer session's frame/fonts (they share element ids).
  const fontCss = await fetchInlinedFontCss();
  if (sessionId !== mySession) return; // superseded during the fetch; nothing to undo
  // Freeze this session's config now — a later configure() must not change how it's
  // framed, harvested, or which onComplete receives its bundle.
  activeConfig = { ...coreConfig };
  applyFrame();
  injectFontStyle(fontCss); // embed fonts before the snapshot (self-contained)
  // Set up this session's event storage: drop any prior events, record its locales.
  activeEvents = [];
  activeLocales = [...runConfig.locales];
  // Start rrweb capture — record() streams events to emit() and returns the stop fn.
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
    // data: URIs ourselves (injectFontStyle, above) — `collectFonts` only
    // captures the @font-face RULES, not the binaries.
    inlineStylesheet: false,
    collectFonts: true,
  });
  // `record()` returns undefined if it can't start (e.g. no document).
  if (!stop) {
    removeFrame();
    removeInlinedFonts();
    preparing = false;
    setStatus('idle');
    return;
  }
  activeStop = stop;
  preparing = false;
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
  // stop() during the prep window (recorder not yet owned): cancel the pending start
  // so recording doesn't begin after this call.
  if (preparing && !activeStop) {
    preparing = false;
    sessionId += 1;
    removeFrame();
    removeInlinedFonts();
    setStatus('idle');
    return null;
  }
  if (!activeStop) return null;
  const stoppedSession = sessionId;
  // Use the config SNAPSHOT taken when this session started (see activeConfig) — not
  // live coreConfig, which a later configure() (another mount) may have changed during
  // recording or the harvest. This session's bundle must use its own selector/URL
  // mapping/harvest options and reach its own onComplete.
  const cfg = activeConfig ?? coreConfig;
  const onComplete = cfg.onComplete;
  const harvestOptions: HarvestOptions = {
    contentSelector: cfg.contentSelector,
    ...cfg.harvest,
  };
  activeStop(); // stop rrweb recording
  activeStop = undefined;
  navCleanup?.();
  removeFrame();
  removeInlinedFonts();
  const events = activeEvents;
  const locales = activeLocales;
  activeEvents = [];
  activeLocales = [];
  if (events.length === 0) {
    if (sessionId === stoppedSession) setStatus('idle');
    return null;
  }

  let overlay: LocaleTextOverlay = {};
  let output = events;
  if (locales.length > 1) {
    setStatus('preparing');
    try {
      // Harvest the SAME region we record/frame (e.g. the app shell incl. its
      // sidebar) — not just <main> — so sidebar-only text is translated too. An
      // explicit harvest.contentSelector still overrides.
      overlay = await harvestLocales(events, locales, harvestOptions);
      output = injectOverlay(events, overlay);
    } catch {
      // Non-fatal: the bundle falls back to source-only (empty overlay).
    }
  }

  const bundle: RecorderBundle = { events: output, locales, overlay };
  // Only reset status if no new recording started while we were harvesting —
  // otherwise we'd clear the in-progress recording's status/overlay.
  if (sessionId === stoppedSession) setStatus('idle');
  onComplete?.(bundle);
  return bundle;
}

/** Stop rrweb's observers without harvesting (e.g. on page unload). */
export function abort(): void {
  // Cancel a pending prep (see stop()).
  if (preparing && !activeStop) {
    preparing = false;
    sessionId += 1;
    removeFrame();
    removeInlinedFonts();
    setStatus('idle');
    return;
  }
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
