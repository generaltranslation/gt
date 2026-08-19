import { record } from '@rrweb/record';
import { EventType } from '@rrweb/types';
import type { eventWithTime } from '@rrweb/types';

import { harvestLocales } from '../harvest/harvestLocales';
import {
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
const CHROME_V = 144; // vertical reserve so the overlay's Stop button stays on-screen

function aspectOf(frame: FrameOption): number | null {
  if (frame === '16:9') return 16 / 9;
  if (typeof frame === 'object' && frame.aspect > 0) return frame.aspect;
  return null;
}

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

// ----- SPA navigation capture ----- //

// rrweb only captures the initial href; record SPA navigations as custom events so
// the harvest knows which URLs were visited. Patches the History API for the
// recording and restores it on stop.
function startNavCapture(): void {
  const origPush = history.pushState;
  const origReplace = history.replaceState;
  const emit = () => {
    try {
      record.addCustomEvent(GT_EVENT.nav, { href: location.href });
    } catch {
      /* recorder not active */
    }
  };
  history.pushState = function (
    this: History,
    ...args: Parameters<History['pushState']>
  ) {
    const result = origPush.apply(this, args);
    emit();
    return result;
  };
  history.replaceState = function (
    this: History,
    ...args: Parameters<History['replaceState']>
  ) {
    const result = origReplace.apply(this, args);
    emit();
    return result;
  };
  window.addEventListener('popstate', emit);
  navCleanup = () => {
    history.pushState = origPush;
    history.replaceState = origReplace;
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

export function start(runConfig: RecorderConfig): void {
  if (activeStop) return;
  applyFrame();
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
    // <link href>s makes the replay load the real CSS. Inline the fonts so they
    // don't need a cross-origin fetch.
    inlineStylesheet: false,
    collectFonts: true,
  });
  // `record()` returns undefined if it can't start (e.g. no document).
  if (!stop) {
    removeFrame();
    return;
  }
  activeStop = stop;
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
  activeStop();
  activeStop = undefined;
  navCleanup?.();
  removeFrame();
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
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[gt-rrweb] locale harvest failed; source only', err);
    }
  }

  const bundle: RecorderBundle = { events: output, locales, overlay };
  setStatus('idle');
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
  activeEvents = [];
  activeLocales = [];
  setStatus('idle');
}
