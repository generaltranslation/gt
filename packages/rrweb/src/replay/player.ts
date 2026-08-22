import { Replayer as RRWebReplayer } from '@rrweb/replay';
import type { eventWithTime } from '@rrweb/types';
import morphdomDefault from 'morphdom';

import type { LocaleTextOverlay } from '../types';
import { GT_REPLAYER_CLASS, REPLAYER_CSS, REPLAYER_HTML } from './styles';

/**
 * The recording a replayer plays. Structurally a {@link RecorderBundle}: the rrweb
 * event stream plus the harvested per-locale text overlay. `locales` is SOURCE
 * FIRST (locales[0] is the recorded/source render); `overlay` maps locale → (rrweb
 * node id → translated text). Both are optional — with neither, the replay just
 * renders the recorded source with no flag switcher.
 */
export type GTReplayerBundle = {
  events: eventWithTime[];
  locales?: readonly string[];
  overlay?: LocaleTextOverlay;
};

export type GTReplayerOptions = {
  /**
   * Locale to render on mount. Defaults to the source locale (locales[0]) — i.e.
   * the recording as captured. Must be one of `bundle.locales` to take effect.
   */
  initialLocale?: string;
  /**
   * Show the in-player locale switcher (the flag buttons) and allow switching
   * locales mid-replay. Default true. Set false for locale-specific embeds (e.g.
   * a docs page that should only ever show one locale).
   */
  switchLocalesAllowed?: boolean;
  /**
   * Debug: drag-and-drop a recording JSON file onto the player to hot-swap the
   * replay with it (a bundle `{events, locales?, overlay?}` or a raw rrweb events
   * array). A non-JSON / non-recording file fails gracefully with a notice.
   * Default false.
   */
  debug?: boolean;
};

/** Handle returned by {@link createGTReplayer}; call `destroy()` to tear it down. */
export type GTReplayerHandle = {
  destroy(): void;
};

// ---- local structural types ---------------------------------------------- //
// The rrweb event/serialized-node payloads are loosely shaped for our walks; we
// read them through these minimal types (cast at the boundary) rather than fighting
// rrweb's discriminated unions per access.

type SNode = {
  type?: number;
  id?: number;
  tagName?: string;
  textContent?: string;
  attributes?: Record<string, unknown>;
  childNodes?: SNode[];
};
type IncrementalData = {
  source?: number;
  adds?: Array<{ node?: SNode }>;
  removes?: Array<{ id?: number }>;
  texts?: Array<{ id?: number; value?: string }>;
  attributes?: unknown[];
  x?: number;
  y?: number;
  id?: number;
};
type FullSnapshotData = { node?: SNode };
type MetaData = { width?: number; height?: number };

/** rrweb serialized-DOM mirror (id <-> live node), as much of it as we use. */
type ReplayMirror = {
  getId(node: Node): number;
  getNode(id: number): Node | null;
};

/**
 * The rrweb Replayer surface we drive. Declared locally (and the instance is cast to
 * it) so this module doesn't couple to @rrweb/replay's exact published types — we
 * only rely on the runtime class existing.
 */
type ReplayerInstance = {
  iframe: HTMLIFrameElement;
  play(timeOffset?: number): void;
  pause(timeOffset?: number): void;
  getCurrentTime(): number;
  getMetaData(): { totalTime: number };
  getMirror(): ReplayMirror;
  on(event: string, handler: (...args: unknown[]) => void): void;
  hoverElements: (...args: unknown[]) => void;
};
type ReplayerCtor = new (
  events: eventWithTime[],
  config: Record<string, unknown>
) => ReplayerInstance;
type MorphdomFn = (
  from: Node,
  to: Node,
  opts?: { onBeforeElUpdated?: (fromEl: Element, toEl: Element) => boolean }
) => void;

const RR = RRWebReplayer as unknown as ReplayerCtor;
const morphdom = morphdomDefault as unknown as MorphdomFn;

// rrweb EventType / IncrementalSource values we branch on (kept local so we don't
// depend on @rrweb/types shipping them as runtime enums).
const EVT = { FullSnapshot: 2, IncrementalSnapshot: 3, Meta: 4 } as const;
const SRC = { Mutation: 0, MouseInteraction: 2 } as const;

const STYLE_ID = 'gt-replayer-styles';

function injectStyles(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = REPLAYER_CSS;
  doc.head.appendChild(style);
}

/** One mounted player. createGTReplayer wraps this to add debug hot-swap. */
function createPlayerInstance(
  container: HTMLElement,
  bundle: GTReplayerBundle,
  options: GTReplayerOptions
): GTReplayerHandle {
  const ownerDoc = container.ownerDocument ?? document;
  container.classList.add(GT_REPLAYER_CLASS);
  container.innerHTML = REPLAYER_HTML;
  injectStyles(ownerDoc);

  function must<T extends HTMLElement>(sel: string): T {
    const el = container.querySelector(sel);
    if (!el) throw new Error(`gt-replayer: missing element ${sel}`);
    return el as unknown as T;
  }

  const showError = (msg: string): void => {
    console.error('[gt-replayer]', msg);
    const s = container.querySelector('#stage');
    if (s)
      s.insertAdjacentHTML(
        'beforeend',
        '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#e88;font:14px system-ui">' +
          msg +
          '</div>'
      );
  };

  let events = bundle.events;
  if (!Array.isArray(events) || events.length < 2) {
    showError('recording has too few events');
    return { destroy() {} };
  }

  // Teardown state, declared up front: setup code below (the ResizeObserver, the
  // reveal-gate poll) reads/writes these synchronously, so they must be initialized
  // before that runs — not at the bottom next to destroy() (that's a TDZ crash).
  let destroyed = false;
  let resizeObs: ResizeObserver | null = null;
  let warmTimer: ReturnType<typeof setTimeout> | null = null;

  // ---- timeline reader helpers ------------------------------------------- //
  const incr = (e: eventWithTime): IncrementalData | null =>
    e.type === EVT.IncrementalSnapshot
      ? (e.data as unknown as IncrementalData)
      : null;
  const srcOf = (e: eventWithTime): number => {
    const d = incr(e);
    return d && typeof d.source === 'number' ? d.source : -1;
  };

  // Timeline pacing for a crisp demo. Two goals:
  //  • Page transitions are INSTANT — the load/render wait between a click and the
  //    DOM it produces collapses to ~nothing, so the destination page appears the
  //    moment the cursor clicks (the recorded ~1–2s SPA latency is dead weight).
  //  • The cursor still glides — a dwell is kept BEFORE each click cluster (the
  //    recorded idle before the user moved to the next target) so there's time to
  //    animate the pointer to it and for the viewer to read the page.
  // A "click" is really a mousedown/up/click burst, so the dwell is applied before
  // the START of that burst, never inside it. Fine timing WITHIN an action (e.g.
  // typing) is preserved. Clicks are recomputed from this timeline, so the cursor
  // stays in sync.
  function compressTimeline(
    evs: eventWithTime[],
    hidden: Set<number>
  ): eventWithTime[] {
    const isMouse = (e: eventWithTime) => srcOf(e) === SRC.MouseInteraction;
    const isMut = (e: eventWithTime) => srcOf(e) === SRC.Mutation;
    const WAIT = 200; // gaps longer than this are load/idle waits, not fine timing
    const COLLAPSED = 30; // what a load/render wait shrinks to → ~instant
    const MIN_DWELL = 550; // guaranteed glide + read time before a press
    const MAX_DWELL = 900; // but don't sit on long recorded idles
    const NEW_PRESS = 250; // a mouse event >this since the LAST mouse event is a
    // NEW press. Measuring from the last MOUSE event (not the last event) is
    // essential: a click's result often keeps mutating for ~1s (a chart bar
    // animating), so the gap from the previous EVENT to the next click's mousedown
    // can be tiny — a "gap since previous event" test would drop that click.
    // The ripple (`.gt-ring`) animates for CLICK_ANIM_MS — keep in sync with the CSS.
    // It's intentionally SHORT: a click's resulting mutations are held for its
    // duration, so a slow ripple makes the replay drag. A UI commonly flips its
    // state on pointerDOWN — BEFORE the Click event — so fire the ripple at the
    // press and BLOCK every mutation the press causes until the ripple finishes.
    const CLICK_ANIM_MS = 220; // == `.gt-ring` animation duration
    const CLICK_HOLD = CLICK_ANIM_MS + 60;
    const out: eventWithTime[] = [{ ...evs[0] }];
    let prevOrig = evs[0].timestamp;
    let acc = evs[0].timestamp;
    let lastMouseOrig = isMouse(evs[0]) ? evs[0].timestamp : -Infinity;
    let animEndUntil = -Infinity; // no press-caused paint may land before this
    for (let i = 1; i < evs.length; i++) {
      const origTs = evs[i].timestamp;
      const origGap = Math.max(0, origTs - prevOrig);
      prevOrig = origTs;
      const idleSincePress = origTs - lastMouseOrig;
      // A hidden press (dead first click of a double-click — see detectDoubleClicks)
      // is NOT treated as a press: it gets no glide dwell, so its gap collapses like
      // any load/idle wait and its time is removed from the timeline.
      const press =
        isMouse(evs[i]) && idleSincePress > NEW_PRESS && !hidden.has(origTs);
      if (isMouse(evs[i])) lastMouseOrig = origTs;
      if (press) {
        // dwell so the cursor visibly glides in; the ripple fires at this beat
        acc += Math.min(MAX_DWELL, Math.max(MIN_DWELL, idleSincePress));
        animEndUntil = acc + CLICK_HOLD;
      } else {
        acc += origGap > WAIT ? COLLAPSED : origGap;
      }
      // hold any press-caused paint until its ripple animation is over
      if (isMut(evs[i]) && acc < animEndUntil) acc = animEndUntil;
      out.push({ ...evs[i], timestamp: acc });
    }
    return out;
  }

  // Find redundant double-clicks on the RAW timeline: presses (detected the same way
  // compressTimeline does) where the FIRST caused NO DOM change before the NEXT press
  // within DOUBLE_CLICK_MS. That's a dead click / retry — most often clicking a link
  // while its route is still compiling, so the navigation only lands on the second
  // press. Their raw timestamps are handed to compressTimeline, which drops their
  // dwell so the surviving press plays like any other click.
  function detectDoubleClicks(evs: eventWithTime[]): Set<number> {
    const NEW_PRESS = 250; // must match compressTimeline
    const DOUBLE_CLICK_MS = 5000; // raw-time repeat window
    const presses: number[] = [];
    let lastMouse = -Infinity;
    for (const e of evs) {
      const d = incr(e);
      if (!d || d.source !== SRC.MouseInteraction) continue;
      // Focus/Blur are also source=2 but coordless; only coord-bearing presses can be
      // "clicks" to collapse. lastMouse still advances on every mouse event to mirror
      // compressTimeline's gaps.
      if (
        e.timestamp - lastMouse > NEW_PRESS &&
        typeof d.x === 'number' &&
        typeof d.y === 'number'
      )
        presses.push(e.timestamp);
      lastMouse = e.timestamp;
    }
    const changedBetween = (a: number, b: number) =>
      evs.some((e) => {
        if (e.timestamp <= a || e.timestamp > b) return false;
        const d = incr(e);
        if (!d || d.source !== SRC.Mutation) return false;
        return (
          (d.adds && d.adds.length) ||
          (d.removes && d.removes.length) ||
          (d.texts && d.texts.length) ||
          (d.attributes && d.attributes.length)
        );
      });
    const hidden = new Set<number>();
    for (let k = 0; k < presses.length - 1; k++) {
      const t = presses[k];
      const next = presses[k + 1];
      if (next - t <= DOUBLE_CLICK_MS && !changedBetween(t, next))
        hidden.add(t);
    }
    return hidden;
  }

  events = compressTimeline(events, detectDoubleClicks(events));

  const t0 = events[0].timestamp;
  const metaEvt = events.find((e) => e.type === EVT.Meta);
  const metaData = metaEvt ? (metaEvt.data as unknown as MetaData) : null;
  const recW = (metaData && metaData.width) || window.innerWidth;
  const recH = (metaData && metaData.height) || window.innerHeight;

  // Click waypoints (IncrementalSource.MouseInteraction, type Click). We dropped
  // mousemove at record time, so these clicks ARE the path. One ripple per PRESS,
  // fired at the cluster's FIRST mouse event; the trailing blur/focus/mouseup/click
  // of the same press follow with tiny gaps and must NOT each fire a ripple.
  type Click = { t: number; x: number; y: number; id: number };
  const clicks: Click[] = [];
  for (let i = 1; i < events.length; i++) {
    const e = events[i];
    const d = incr(e);
    if (!d || d.source !== SRC.MouseInteraction) continue;
    // Only POINTER interactions carry coords. Focus/Blur (also source=2) have x/y
    // undefined — an isolated trailing blur would otherwise become a (0,0) waypoint
    // the cursor glides to, snapping to the top-left. Require real coords.
    if (typeof d.x !== 'number' || typeof d.y !== 'number') continue;
    if (e.timestamp - events[i - 1].timestamp <= 300) continue;
    clicks.push({
      t: e.timestamp - t0,
      x: d.x,
      y: d.y,
      id: typeof d.id === 'number' ? d.id : -1,
    });
  }

  const replayer = new RR(events, {
    root: must('#player'),
    speed: 1,
    skipInactive: false,
    mouseTail: false,
    showWarning: false,
    // rrweb renders blocked elements (operator chrome, class `rr-block`) as
    // placeholder boxes filled with `background: currentColor`; under dark mode that
    // inherited color is near-white, painting the content area white. Force those
    // placeholders transparent inside the replay iframe.
    insertStyleRules: [
      '.rr-block { background: transparent !important; border: 0 !important; }',
      // rrweb replays recorded Focus events by programmatically .focus()-ing the
      // target; inside the iframe that counts as keyboard focus, so the app's
      // :focus-visible ring paints on every clicked control. Passive demo → strip it.
      ':focus, :focus-visible { outline: none !important; box-shadow: none !important; }',
      // Replayed CSS animations/transitions don't track the (compressed) mutation
      // timeline, so fading overlays flash half-opacity frames. Force everything to
      // 0s so overlays snap straight to their end state.
      '*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition-duration: 0s !important; transition-delay: 0s !important; }',
      // Radix keeps a dismissed overlay in the DOM for its exit animation
      // (data-state="closed"); with the fade gone that would linger as a solid dim.
      // Hide closed-state elements outright so a dismiss is instant.
      '[data-state="closed"] { display: none !important; }',
      // Replaced elements (img/svg) sized ONLY by a Tailwind `size-*` class blow up
      // during a backward-seek/scrub: the rebuild paints a frame BEFORE the external
      // stylesheet re-applies, so each falls back to its intrinsic size. Pin every
      // size-* token in the recording so nothing can blow up mid-scrub.
      'img.size-3, svg.size-3 { width: 0.75rem !important; height: 0.75rem !important; }',
      'img.size-3\\.5, svg.size-3\\.5 { width: 0.875rem !important; height: 0.875rem !important; }',
      'img.size-4, svg.size-4 { width: 1rem !important; height: 1rem !important; }',
      'img.size-5, svg.size-5 { width: 1.25rem !important; height: 1.25rem !important; }',
      'img.size-8, svg.size-8 { width: 2rem !important; height: 2rem !important; }',
      'img.size-10, svg.size-10 { width: 2.5rem !important; height: 2.5rem !important; }',
    ],
  });

  // Disable rrweb's :hover reproduction. On each recorded interaction rrweb adds a
  // `:hover` class up the hovered element's ancestor chain, which activates the app's
  // rewritten `.\:hover` styles (e.g. a nav item's white outline ring) — so a hover
  // highlight trails the recorded pointer. We synthesize our own cursor and want no
  // hover state applied, so make it a no-op.
  replayer.hoverElements = () => {};

  // ---- no first-paint flash ---------------------------------------------- //
  // The Replayer builds+paints its first snapshot on construction, but the app's
  // stylesheet loads async. Elements sized ONLY by CSS briefly render at their
  // intrinsic (large) size, then snap smaller once the CSS applies. So keep the
  // replay hidden until its stylesheets (then fonts) have loaded, then fade in.
  // Hiding runs synchronously here, before the browser's first paint. Re-armed on
  // every full-snapshot rebuild (initial + restart/seek) so restarts don't flash.
  const scalerEl = must('#scaler');
  // Whether the stage is currently shown. The director cursor is an overlay OUTSIDE
  // the scaler, so hiding the scaler alone leaves it visible; the frame loop reads
  // this to hide the cursor while the stage is gated (see below).
  let stageRevealed = false;
  function hideReplay(): void {
    scalerEl.style.transition = 'none';
    scalerEl.style.opacity = '0';
    stageRevealed = false;
  }
  function revealReplay(): void {
    scalerEl.style.transition = 'opacity 160ms ease';
    scalerEl.style.opacity = '1';
    stageRevealed = true;
  }
  function whenReplayStyled(cb: () => void): void {
    // POLL (rather than listen for load events) until the rebuilt snapshot is in the
    // iframe AND every stylesheet <link> has applied (`l.sheet`). A load-event
    // listener races: the sheet can finish before we attach, or the Replayer
    // re-creates the <link> mid-build, so the event is missed. Capped so a
    // stuck/missing sheet can't blank the stage forever.
    const started = performance.now();
    const attempt = (): void => {
      if (destroyed) return;
      const doc = replayer.iframe && replayer.iframe.contentDocument;
      const bodyReady = doc && doc.body && doc.body.childNodes.length;
      const links = doc
        ? [...doc.querySelectorAll('link[rel="stylesheet"]')]
        : [];
      const stylesReady =
        bodyReady &&
        links.length &&
        links.every((l) => (l as HTMLLinkElement).sheet);
      if (!stylesReady && performance.now() - started < 1500) {
        requestAnimationFrame(attempt);
        return;
      }
      // then let fonts settle so text doesn't reflow right after reveal
      const fonts = doc && doc.fonts;
      if (fonts && fonts.ready) fonts.ready.then(cb, cb);
      else cb();
    };
    attempt();
  }
  // One-shot: gate ONLY the initial build (the first-paint flash). Later rebuilds — a
  // backward seek/scrub rebuilds from the single full snapshot — happen with the
  // stylesheet already applied, so hiding again would just flicker while scrubbing.
  // The timeline + director cursor start only once the stage is actually revealed.
  let autoStarted = false;
  function beginPlaybackOnce(): void {
    if (autoStarted || destroyed) return;
    autoStarted = true;
    // Resolve the capture frame + crop to it. The framed element's box can take a few
    // frames to settle after the snapshot is in, so poll fit() until it's valid.
    const frameT0 = performance.now();
    const tryFrame = (): void => {
      if (destroyed || frameBox) return;
      fit();
      if (!frameBox && performance.now() - frameT0 < 3000)
        requestAnimationFrame(tryFrame);
    };
    tryFrame();
    startLoop(); // director cursor + scrubber loop (cursor was hidden until now)
    replayer.play(0); // start the timeline from 0, in sync with the reveal
    // Warm the hidden scrub engine while idle so the first drag is instant.
    warmTimer = setTimeout(() => {
      if (destroyed) return;
      try {
        ensureEngine();
        if (engine) engine.pause(0);
      } catch {}
    }, 1200);
  }
  let revealGateArmed = true;
  function gateReveal(): void {
    if (!revealGateArmed || destroyed) return;
    revealGateArmed = false;
    hideReplay();
    let shown = false;
    const show = (): void => {
      if (shown || destroyed) return;
      shown = true;
      revealReplay();
      captureAppCss(); // CSS is loaded now → snapshot it for the rebuild bridge
      applyThemeMode(); // now CSS is loaded → stage bg can match the recording
      beginPlaybackOnce(); // start playback + cursor together with the reveal
    };
    whenReplayStyled(show);
    setTimeout(show, 2000); // safety net — never leave the stage blank
  }
  gateReveal();
  replayer.on('fullsnapshot-rebuilded', gateReveal);

  // ---- theme OPTION (dark toggle) ---------------------------------------- //
  // Dark mode is an in-player OPTION, re-asserted on the replay <html> across rrweb
  // rebuilds. The toggle drives whatever theme mechanism the RECORDING itself uses —
  // a `.dark` class (Tailwind/shadcn) or a `data-theme` / `data-mode` attribute —
  // detected from the captured <html>, so it works for any GT site, not just one.
  const THEME_ATTRS = ['data-theme', 'data-mode', 'data-color-mode'] as const;
  type ThemeSwitch = {
    recordedDark: boolean;
    setDark: (html: HTMLElement, dark: boolean) => void;
  };
  function detectThemeSwitch(evs: eventWithTime[]): ThemeSwitch {
    const fs = evs.find((e) => e.type === EVT.FullSnapshot);
    const findHtml = (n?: SNode): SNode | null => {
      if (!n) return null;
      if (n.type === 2 && n.tagName === 'html') return n;
      for (const c of n.childNodes || []) {
        const found = findHtml(c);
        if (found) return found;
      }
      return null;
    };
    const attrs: Record<string, unknown> =
      (fs &&
        findHtml((fs.data as unknown as FullSnapshotData).node)?.attributes) ||
      {};
    // Attribute-based theming (data-theme="dark"|"light", …). The recorded value is
    // the "light" value unless it's already "dark".
    const themeAttr = THEME_ATTRS.find((a) => typeof attrs[a] === 'string');
    if (themeAttr) {
      const recorded = String(attrs[themeAttr]);
      const lightVal = recorded === 'dark' ? 'light' : recorded;
      return {
        recordedDark: recorded === 'dark',
        setDark: (html, dark) =>
          html.setAttribute(themeAttr, dark ? 'dark' : lightVal),
      };
    }
    // Class-based theming (`.dark` on <html>) — the default/Tailwind convention.
    const cls = typeof attrs.class === 'string' ? attrs.class : '';
    return {
      recordedDark: /(^|\s)dark(\s|$)/.test(cls),
      setDark: (html, dark) => html.classList.toggle('dark', dark),
    };
  }
  const themeSwitch = detectThemeSwitch(events);
  let darkMode = themeSwitch.recordedDark;
  // Last successfully-detected recording background, per theme. A backward scrub
  // fires 'fullsnapshot-rebuilded' → applyThemeMode() while the DOM is mid-rebuild,
  // when the body momentarily reads a transparent bg. Without a cache we'd fall back
  // to the dark stage color and flash the stage black for that frame. Remember the
  // good value and keep it when detection fails.
  const lastRecBg: { light: string; dark: string } = { light: '', dark: '' };
  function applyThemeMode(): void {
    const rdoc = replayer.iframe && replayer.iframe.contentDocument;
    const html = rdoc && rdoc.documentElement;
    if (!rdoc || !html) return;
    const dark = darkMode;
    // Re-tone the PLAYER chrome (HUD/scrubber/buttons) for the active theme — the
    // stage below takes the recording's own bg, so dark-tuned chrome looks wrong on a
    // light recording.
    container.classList.toggle('chrome-light', !dark);
    themeSwitch.setDark(html, dark);
    const scheme = dark ? 'dark' : 'light';
    if (html.style.colorScheme !== scheme) html.style.colorScheme = scheme;
    // Match the stage (letterbox) AND the replay box (scaler) background to the
    // recording's OWN background so (a) the centered replay has no visible seam, and
    // (b) a torn/empty rebuild frame during a scrub shows the page color, not black.
    let recBg = '';
    for (const el of [rdoc.body, html]) {
      if (!el) continue;
      const c = getComputedStyle(el).backgroundColor;
      if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') {
        recBg = c;
        break;
      }
    }
    const key = dark ? 'dark' : 'light';
    if (recBg) lastRecBg[key] = recBg; // cache good detections per theme
    // Prefer a fresh read, else the last good one for this theme, else the default
    // stage bg. Never fall straight to the dark default once we've seen a real bg.
    const bg = recBg || lastRecBg[key] || '#0f0f10';
    stageEl.style.background = bg;
    scalerEl.style.background = bg;
  }

  // ---- FOUC bridge across rebuilds (the real "jumpy scrub" fix) ---------- //
  // A backward seek makes rrweb rebuild the snapshot, re-creating the replay iframe's
  // <link rel=stylesheet>. A <link> re-applies ASYNC, so the FIRST frame after every
  // rebuild is UNSTYLED. During a scrub a seek fires every frame, so that unstyled
  // frame is ALL you ever see → torn content = "jumpy". Bridge it: once the app CSS
  // has loaded, snapshot every readable rule into a string and re-inject it as an
  // INLINE <style> (parses synchronously) at the top of <head> on EVERY rebuild.
  let appCssText = '';
  function captureAppCss(): void {
    if (appCssText) return;
    const doc = replayer.iframe && replayer.iframe.contentDocument;
    if (!doc) return;
    const rules: string[] = [];
    for (const ss of [...doc.styleSheets]) {
      if (ss.ownerNode && (ss.ownerNode as Element).id === '__gt-css-bridge')
        continue;
      let cr: CSSRuleList;
      try {
        cr = ss.cssRules;
      } catch {
        continue; // cross-origin sheet — not readable, skip
      }
      for (const rule of cr) rules.push(rule.cssText);
    }
    if (rules.length < 80) return; // not fully loaded yet — retry next rebuild
    appCssText = rules.join('\n');
  }
  function bridgeStyles(): void {
    const doc = replayer.iframe && replayer.iframe.contentDocument;
    if (!doc || !doc.head) return;
    if (!appCssText) captureAppCss();
    if (!appCssText) return;
    if (doc.getElementById('__gt-css-bridge')) return; // already bridged this doc
    const bridge = doc.createElement('style');
    bridge.id = '__gt-css-bridge';
    bridge.textContent = appCssText;
    doc.head.insertBefore(bridge, doc.head.firstChild);
  }

  // Theme toggle in the HUD (sun when dark → go light, moon when light → go dark).
  const darkToggle = must<HTMLButtonElement>('#darkToggle');
  const SUN_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>';
  const MOON_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>';
  function syncDarkIcon(): void {
    // Show the icon for the mode you'll switch TO (dark now → Sun → light).
    darkToggle.innerHTML = darkMode ? SUN_SVG : MOON_SVG;
    darkToggle.title = darkMode
      ? 'Switch to light mode'
      : 'Switch to dark mode';
  }
  syncDarkIcon();
  darkToggle.onclick = () => {
    darkMode = !darkMode;
    syncDarkIcon();
    applyThemeMode();
    scrubber.classList.toggle('dark', darkMode); // bar: white↔black
  };

  // ---- full-screen mode -------------------------------------------------- //
  // Fill the viewport via a CSS class (works everywhere, incl. iOS Safari where the
  // Fullscreen API can't fullscreen a <div>), and additionally request native
  // fullscreen where supported for an immersive, chrome-hidden view.
  const fsToggle = must<HTMLButtonElement>('#fsToggle');
  const FS_ENTER_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>';
  const FS_EXIT_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>';
  const inFullscreen = (): boolean => container.classList.contains('gt-fs');
  function syncFsIcon(): void {
    const on = inFullscreen();
    fsToggle.innerHTML = on ? FS_EXIT_SVG : FS_ENTER_SVG;
    fsToggle.title = on ? 'Exit full screen' : 'Full screen';
  }
  function setFullscreen(on: boolean): void {
    container.classList.toggle('gt-fs', on);
    syncFsIcon();
    fit(); // the stage size changed drastically → re-fit the crop into it
    if (on) {
      if (container.requestFullscreen)
        container.requestFullscreen().catch(() => {});
    } else if (ownerDoc.fullscreenElement && ownerDoc.exitFullscreen) {
      ownerDoc.exitFullscreen().catch(() => {});
    }
  }
  syncFsIcon();
  fsToggle.onclick = () => setFullscreen(!inFullscreen());
  // Collapse back when native fullscreen is exited via Esc / a system gesture.
  const onFsChange = (): void => {
    if (!ownerDoc.fullscreenElement && inFullscreen()) {
      container.classList.remove('gt-fs');
      syncFsIcon();
      fit();
    }
  };
  ownerDoc.addEventListener('fullscreenchange', onFsChange);

  // ---- per-locale text overlay ------------------------------------------- //
  // The bundle carries `locales` (source first) and a node-id-keyed overlay
  // (locale → { rrwebId: text }). Switching locale swaps text in place on the live
  // replay DOM with no rebuild — only translated text changes.
  //
  // When the structured `locales`/`overlay` fields are absent — e.g. a raw
  // events-only export, or a debug drag-drop of one — fall back to the copies the
  // recorder embeds in the stream itself as custom events (`gt-locales`,
  // `gt-i18n`), so such files still replay localized rather than source-only.
  const embedded = readEmbedded(bundle.events);
  const OVERLAYS: LocaleTextOverlay = bundle.overlay || embedded.overlay || {};
  const localeList = bundle.locales
    ? [...bundle.locales]
    : embedded.locales
      ? [...embedded.locales]
      : [];
  const demoLocales =
    localeList.length > 0
      ? { locales: localeList, sourceLocale: localeList[0] }
      : null;
  const SOURCE_LOCALE = demoLocales ? demoLocales.sourceLocale : null;
  function overlayFor(loc: string): Record<number, string> | null {
    return OVERLAYS[loc] || null;
  }
  let ACTIVE_LOCALE = options.initialLocale || SOURCE_LOCALE;
  let overlay: Record<number, string> | null = null;
  if (
    ACTIVE_LOCALE &&
    ACTIVE_LOCALE !== SOURCE_LOCALE &&
    demoLocales &&
    demoLocales.locales.indexOf(ACTIVE_LOCALE) !== -1
  ) {
    overlay = overlayFor(ACTIVE_LOCALE);
  }
  const mirror = replayer.getMirror();

  // id -> last SOURCE text recorded for that node. The harvest keyed each target off
  // this text, so we substitute ONLY while the live node still shows it — a dynamic
  // node whose value has since changed stays source (never a stale localization).
  function collectRecordedSource(evs: eventWithTime[]): Map<number, string> {
    const map = new Map<number, string>();
    const walk = (n?: SNode): void => {
      if (!n) return;
      if (
        n.type === 3 &&
        typeof n.id === 'number' &&
        typeof n.textContent === 'string' &&
        n.textContent.trim()
      )
        map.set(n.id, n.textContent);
      (n.childNodes || []).forEach(walk);
    };
    for (const e of evs) {
      if (e.type === EVT.FullSnapshot)
        walk((e.data as unknown as FullSnapshotData).node);
      const d = incr(e);
      if (d && d.source === SRC.Mutation) {
        (d.adds || []).forEach((a) => walk(a.node));
        (d.texts || []).forEach((tx) => {
          if (
            typeof tx.id === 'number' &&
            typeof tx.value === 'string' &&
            tx.value.trim()
          )
            map.set(tx.id, tx.value);
        });
      }
    }
    return map;
  }
  // Always available (even when the initial locale is source) so in-place locale
  // switching can revert swapped nodes back to their recorded source.
  const RECORDED_SRC = collectRecordedSource(events);
  const swapped = new Set<number>(); // rrweb node ids we've text-swapped (for revert)

  // Apply translations by rewriting text nodes as rrweb renders them, via a
  // MutationObserver — ONCE per change, not every frame — so we never fight rrweb's
  // own updates. Re-translating a node's target text is a no-op (targets aren't
  // source keys), so no loop.
  function translateTextNode(node: Node, m?: ReplayMirror | null): void {
    const mir = m || mirror;
    if (!mir || !overlay) return;
    const id = mir.getId(node);
    if (id == null || id < 0) return;
    const tgt = overlay[id];
    if (tgt === undefined) return;
    const src = RECORDED_SRC.get(id);
    // Only substitute while the node still shows its recorded source text; otherwise
    // (dynamic value changed) leave it as source.
    if (src !== undefined && (node.textContent || '').trim() !== src.trim())
      return;
    if (node.textContent !== tgt) node.textContent = tgt;
    swapped.add(id); // track for in-place locale switch revert
  }
  function translateTree(rootNode: Node, m?: ReplayMirror | null): void {
    if (!rootNode) return;
    const doc = rootNode.ownerDocument || (rootNode as unknown as Document);
    const walker = doc.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT);
    const nodes: Node[] = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n);
    nodes.forEach((n) => translateTextNode(n, m));
  }
  let translateObserver: MutationObserver | null = null;
  function attachTranslator(): void {
    if (!overlay) return;
    const doc = replayer.iframe && replayer.iframe.contentDocument;
    if (!doc || !doc.body) return;
    translateTree(doc.body);
    if (translateObserver) translateObserver.disconnect();
    translateObserver = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === 'characterData') {
          if (r.target.nodeType === 3) translateTextNode(r.target);
        } else {
          r.addedNodes.forEach((nn) => {
            if (nn.nodeType === 3) translateTextNode(nn);
            else if (nn.nodeType === 1) translateTree(nn);
          });
        }
      }
    });
    translateObserver.observe(doc.body, {
      subtree: true,
      childList: true,
      characterData: true,
    });
  }
  // rrweb replaces the document on each FullSnapshot rebuild (incl. restart), so
  // (re)attach then; plus an initial attach once the iframe is ready. Re-inject the
  // app CSS synchronously on every rebuild BEFORE the theme/paint so the first
  // post-rebuild frame is styled (kills the scrub FOUC), then re-assert the theme.
  replayer.on('fullsnapshot-rebuilded', attachTranslator);
  replayer.on('fullsnapshot-rebuilded', bridgeStyles);
  replayer.on('fullsnapshot-rebuilded', applyThemeMode);
  (function initAttach(): void {
    if (!overlay || destroyed) return;
    const doc = replayer.iframe && replayer.iframe.contentDocument;
    if (doc && doc.body && doc.body.childNodes.length) attachTranslator();
    else requestAnimationFrame(initAttach);
  })();

  // ---- no-rebuild scrub via a hidden "engine" replayer + morphdom -------- //
  // rrweb must REBUILD the whole document on a backward seek (it can't reverse
  // mutations); that repaints everything and re-loads the web fonts (FOUT). Fix: once
  // the user starts scrubbing, FREEZE the visible replayer and drive the display from
  // a SEPARATE hidden "engine" replayer — computing each target frame there, then
  // MORPHDOM only the differences into the (never-rebuilt) visible iframe. Unchanged
  // components keep their exact DOM node → no repaint; the visible document is never
  // rebuilt → fonts stay loaded → no FOUT.
  let engine: ReplayerInstance | null = null;
  let engineMirror: ReplayMirror | null = null;
  let engineMode = false; // true once the scrubber is touched; visible replayer dormant
  const engineHost = ownerDoc.createElement('div');
  engineHost.setAttribute('aria-hidden', 'true');
  engineHost.style.cssText =
    'position:fixed;left:-100000px;top:0;width:' +
    recW +
    'px;height:' +
    recH +
    'px;opacity:0;pointer-events:none;overflow:hidden;';
  container.appendChild(engineHost);
  function ensureEngine(): ReplayerInstance {
    if (engine) return engine;
    engine = new RR(events, {
      root: engineHost,
      speed: 1,
      skipInactive: false,
      mouseTail: false,
      showWarning: false,
      insertStyleRules: [
        '.rr-block { background: transparent !important; border: 0 !important; }',
      ],
    });
    engine.hoverElements = () => {}; // no rrweb hover reproduction (see above)
    engineMirror = engine.getMirror();
    return engine;
  }
  function morphVisibleFromEngine(): void {
    const ed = engine && engine.iframe && engine.iframe.contentDocument;
    const vd = replayer.iframe && replayer.iframe.contentDocument;
    if (!ed || !ed.body || !vd || !vd.body) return;
    if (overlay) translateTree(ed.body, engineMirror); // localize engine frame
    // Copy the engine body into the visible document first, then morph the visible
    // body to match it — reusing every unchanged node in place. onBeforeElUpdated
    // returns false for equal subtrees so morphdom skips them entirely.
    const copy = vd.importNode(ed.body, true);
    morphdom(vd.body, copy, {
      onBeforeElUpdated: (fromEl, toEl) => !fromEl.isEqualNode(toEl),
    });
    const eh = ed.documentElement;
    const vh = vd.documentElement;
    if (eh && vh && vh.getAttribute('class') !== eh.getAttribute('class'))
      vh.setAttribute('class', eh.getAttribute('class') || ''); // carry dark class
    applyThemeMode();
  }
  // Enter engine mode: freeze the visible replayer (no-arg pause = stop the timer
  // WITHOUT a rebuild) and stop its translate observer (morphdom supplies
  // already-localized content), then hand rendering to engine+morphdom.
  function enterEngineMode(atT: number): void {
    if (engineMode) return;
    engineMode = true;
    ensureEngine();
    try {
      replayer.pause();
    } catch {}
    if (translateObserver) translateObserver.disconnect();
    if (engine) engine.pause(atT);
    morphVisibleFromEngine();
  }
  function engineScrubTo(t: number): void {
    ensureEngine();
    if (engine) engine.pause(t);
    morphVisibleFromEngine();
  }
  // Current time from whichever clock is live: the engine while scrubbing (or paused
  // after a scrub), else the visible replayer (normal forward playback).
  function curTime(): number {
    return engineMode && engine
      ? engine.getCurrentTime()
      : replayer.getCurrentTime();
  }

  const stageEl = must('#stage');
  const scaler = scalerEl;
  const fx = must('#fx');
  const cursor = must('#cursor');
  const recframe = must('#recframe');
  const scrubber = must('#scrubber');
  // Swallow wheel/touch on the replay shield so nothing scrolls — the recorded page
  // behaves like a video. (Controls sit above the shield.)
  const shield = must('#shield');
  shield.addEventListener('wheel', (e) => e.preventDefault(), {
    passive: false,
  });
  shield.addEventListener('touchmove', (e) => e.preventDefault(), {
    passive: false,
  });

  // ---- crop to the recorder's capture frame (mini-player) ---------------- //
  // The recorder reflows the content into a centered box of a fixed aspect,
  // marked by html.gt-recording + a <style id="gt-rrweb-frame"> whose rule targets
  // the framed element. Measure that element's box (recorded-viewport coords, which
  // are constant) and crop the replay to it, so the player shows just the framed
  // content at the capture aspect — a mini-player — not the whole viewport + walls.
  function resolveFrameBox(): {
    x: number;
    y: number;
    w: number;
    h: number;
  } | null {
    try {
      const doc = replayer.iframe && replayer.iframe.contentDocument;
      const st =
        doc &&
        (doc.getElementById('gt-rrweb-frame') as HTMLStyleElement | null);
      if (!doc || !st) return null;
      let selectorText = '';
      if (st.sheet && st.sheet.cssRules.length)
        selectorText =
          (st.sheet.cssRules[0] as CSSStyleRule).selectorText || '';
      else selectorText = (st.textContent || '').split('{')[0];
      const sel = selectorText
        .split(',')
        .map((s) => s.replace(/html\.gt-recording/g, '').trim())
        .filter(Boolean)
        .join(',');
      const el = sel ? doc.querySelector(sel) : null;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return null;
      // Reject a not-yet-settled measurement: a real capture frame is SMALLER than
      // the recorded viewport in at least one dimension and never larger than it.
      if (r.width > recW + 1 || r.height > recH + 1) return null;
      if (r.width >= recW - 1 && r.height >= recH - 1) return null;
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    } catch {
      return null;
    }
  }
  let frameBox: { x: number; y: number; w: number; h: number } | null = null;

  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  function fit(): void {
    // Resolve the capture frame once (its box is constant in recorded coords). Retry
    // each fit until the iframe's snapshot is in — then size the player to that aspect.
    if (!frameBox) {
      frameBox = resolveFrameBox();
      if (frameBox) {
        // Size the player to the capture aspect via the STAGE (a flex child) with a
        // definite width — not the flex-column root, whose height would then be
        // content-driven and collapse. Root height follows the stage.
        stageEl.style.flex = 'none';
        stageEl.style.width = '100%';
        stageEl.style.aspectRatio = `${frameBox.w} / ${frameBox.h}`;
        container.style.height = 'auto';
      }
    }
    const cropX = frameBox ? frameBox.x : 0;
    const cropY = frameBox ? frameBox.y : 0;
    const cropW = frameBox ? frameBox.w : recW;
    const cropH = frameBox ? frameBox.h : recH;

    const stageW = stageEl.clientWidth || window.innerWidth;
    const stageH = stageEl.clientHeight || window.innerHeight;
    // Contain-fit the CROP box (capture frame, or the whole viewport when unframed)
    // into the stage, then center it; the viewport outside the crop is clipped by
    // #stage (overflow:hidden). Unframed never upscales past 1:1.
    scale = Math.min(stageW / cropW, stageH / cropH);
    if (!frameBox) scale = Math.min(scale, 1);
    const boxW = cropW * scale;
    const boxH = cropH * scale;
    const centerX = Math.max(0, (stageW - boxW) / 2);
    const centerY = Math.max(0, (stageH - boxH) / 2);
    // Offset the (full-viewport) scaler so the crop box lands in the centered box.
    offsetX = centerX - cropX * scale;
    offsetY = centerY - cropY * scale;
    scaler.style.left = offsetX + 'px';
    scaler.style.top = offsetY + 'px';
    scaler.style.transform = 'scale(' + scale + ')';
    // Shield + controls hug the visible crop box.
    shield.style.left = centerX + 'px';
    shield.style.top = centerY + 'px';
    shield.style.width = boxW + 'px';
    shield.style.height = boxH + 'px';
    recframe.style.left = centerX + 'px';
    recframe.style.top = centerY + 'px';
    recframe.style.width = boxW + 'px';
    recframe.style.height = boxH + 'px';
    scrubber.style.left = centerX + 14 + 'px';
    scrubber.style.width = boxW - 28 + 'px';
    scrubber.style.bottom = stageH - (centerY + boxH) + 12 + 'px';
  }
  fit();
  window.addEventListener('resize', fit);
  // Re-fit whenever the stage actually changes size. The first fit() runs before the
  // controls bar reaches its final height, which shrinks the stage by a few px.
  if (window.ResizeObserver) {
    resizeObs = new ResizeObserver(() => fit());
    resizeObs.observe(stageEl);
  }

  // ----- director: eased glide between clicks, ripple on click ----- //
  // The cursor eases across the glide interval (see positionAt) — no speed constant,
  // duration clamp, or per-frame cap — so it can never freeze-then-dart (a teleport);
  // the ease itself supplies the read-time pauses near each click.
  //
  // LOGISTIC (sigmoid) easing → the SPEED profile is a slow → fast → slow bell (the
  // derivative of an S-curve): the cursor accelerates out of the previous click,
  // cruises through the middle, and decelerates onto the next. The half-range sets the
  // steepness; ±4 keeps the fast middle gentler than an ease-in-out cubic, so even the
  // longest move stays a visible glide rather than a dart.
  const logistic = (x: number): number => 1 / (1 + Math.exp(-x));
  const LOGISTIC_RANGE = 4; // sigmoid half-range — steepness of the slow-fast-slow S
  const L_LO = logistic(-LOGISTIC_RANGE);
  const L_HI = logistic(LOGISTIC_RANGE);
  const easeLogistic = (p: number): number =>
    (logistic((p - 0.5) * 2 * LOGISTIC_RANGE) - L_LO) / (L_HI - L_LO);
  let lastPulse = -1;
  let prevT = 0;
  const cursorEnabled = true; // always on in the chromeless UI (no toggle)

  // Resolve a click's position LIVE from its target node in the replay (not the
  // recorded pixel coords). An element can render at a DIFFERENT position than at
  // record time, so anchoring the cursor + ripple to the node keeps them ON target.
  // Falls back to the recorded point when the node is gone.
  function liveXY(c: Click): { x: number; y: number } {
    try {
      const mir = replayer.getMirror();
      const node = mir && c.id != null ? mir.getNode(c.id) : null;
      const el: Element | null = node
        ? node.nodeType === 3
          ? node.parentElement
          : (node as Element)
        : null;
      if (el && el.getBoundingClientRect) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          // Prefer the EXACT recorded click point when it still falls within the live
          // element — so the cursor sits where the click actually landed, not the
          // center of a large target. Fall back to the element center only when the
          // point is outside it (the element reflowed away from the recorded point).
          if (
            c.x >= r.left &&
            c.x <= r.right &&
            c.y >= r.top &&
            c.y <= r.bottom
          )
            return { x: c.x, y: c.y };
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        }
      }
    } catch {
      /* node not resolvable — fall through to recorded coords */
    }
    return { x: c.x, y: c.y };
  }

  function pulse(c: Click): void {
    cursor.classList.add('clicking');
    setTimeout(() => {
      if (!destroyed) cursor.classList.remove('clicking');
    }, 90);
    const pos = liveXY(c);
    const ring = ownerDoc.createElement('div');
    ring.className = 'gt-ring';
    ring.style.left = offsetX + pos.x * scale + 'px';
    ring.style.top = offsetY + pos.y * scale + 'px';
    // Scale the ripple with the replay too, so it stays proportional to the cursor.
    ring.style.transform = 'translate(-50%, -50%) scale(' + scale + ')';
    fx.appendChild(ring);
    ring.addEventListener('animationend', () => ring.remove());
  }

  // Each click's LAYOUT TRANSITION is the burst of DOM mutations it causes; the
  // cursor must stay ON the clicked element for the whole transition, then glide to
  // the next click during the idle gap after. glideStart[j] = when the PREVIOUS
  // click's transition ends = the last meaningful mutation between click j-1 and
  // click j (or click j-1's own time if it caused none).
  const mutTimes: number[] = [];
  for (const e of events) {
    const d = incr(e);
    if (d && d.source === SRC.Mutation) {
      if (
        (d.adds && d.adds.length) ||
        (d.removes && d.removes.length) ||
        (d.texts && d.texts.length)
      )
        mutTimes.push(e.timestamp - t0);
    }
  }
  const glideStart = clicks.map((c, j) => {
    if (j === 0) return c.t;
    const from = clicks[j - 1].t;
    let end = from;
    for (const m of mutTimes) if (m > from && m <= c.t && m > end) end = m;
    return end;
  });

  // The on-screen point where the cursor ARRIVED at each click, captured ONCE then
  // frozen. During a click's layout transition the clicked element reflows or is
  // removed, so re-resolving its live position every frame would drag the cursor with
  // it (a teleport). Holding this fixed arrival point instead means 0 velocity through
  // the transition. Cleared on seek/restart (the DOM rebuilds) so it re-captures.
  const arrivedXY: Array<{ x: number; y: number }> = [];
  function arrival(k: number): { x: number; y: number } {
    if (!arrivedXY[k]) arrivedXY[k] = liveXY(clicks[k]);
    return arrivedXY[k];
  }

  function positionAt(T: number): { x: number; y: number } | null {
    if (!clicks.length) return null;
    const j = clicks.findIndex((c) => c.t >= T);
    if (j === -1) return arrival(clicks.length - 1); // frozen past the last click
    // Frozen on the FIRST click until it fires: use its recorded coordinate, not a
    // live lookup. At frame 0 the target element hasn't reached its clicked position
    // yet, so resolving it live would seed a stale point (the element's frame-0
    // center) — the "weird" starting spot. The recorded point IS the first click.
    if (j === 0) return { x: clicks[0].x, y: clicks[0].y };
    const nextC = clicks[j];
    const from = arrival(j - 1); // the previous click's frozen arrival point
    const start = glideStart[j];
    // HOLD through the previous click's layout transition → return the frozen arrival
    // point unchanged: 0 instantaneous velocity while the page changes "under" the
    // pointer (no live re-resolve that could jump it).
    if (T <= start) return from;
    // GLIDE over the (now-stable) idle gap, easing onto the next click's LIVE position
    // so the ripple still lands on target even if it reflowed.
    const to = liveXY(nextC);
    const span = nextC.t - start;
    const p = span > 0 ? (T - start) / span : 1;
    const e = easeLogistic(Math.min(1, Math.max(0, p)));
    return { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e };
  }

  // ----- scrubber: seek + YouTube-style auto-hide ----- //
  const track = must('#track');
  const played = must('#played');
  const thumb = must('#thumb');
  const timeEl = must('#time');
  const totalTime =
    (replayer.getMetaData && replayer.getMetaData().totalTime) ||
    events[events.length - 1].timestamp - events[0].timestamp;
  const fmtTime = (ms: number): string => {
    const s = Math.max(0, Math.round(ms / 1000));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  };
  const totalStr = fmtTime(totalTime);
  let lastPct = -1;
  let lastSec = -1;
  function updateScrub(t: number): void {
    const frac = totalTime ? Math.max(0, Math.min(1, t / totalTime)) : 0;
    const pct = Math.round(frac * 1000) / 10;
    if (pct !== lastPct) {
      lastPct = pct;
      played.style.width = pct + '%';
      thumb.style.left = pct + '%';
    }
    const sec = Math.round(t / 1000);
    if (sec !== lastSec) {
      lastSec = sec;
      timeEl.textContent = fmtTime(t) + ' / ' + totalStr;
    }
  }
  updateScrub(0);
  scrubber.classList.toggle('dark', darkMode); // bar color follows theme

  // Auto-hide after a beat of stillness; reveal on any pointer activity over the
  // stage (and stay while hovering the bar or mid-drag).
  let dragging = false;
  // Scrubbing coalescer: a pointermove fires ~120x/s, but each backward
  // engine.pause(t) rebuilds. A pointermove only records the target time
  // (pendingSeek) + moves the bar instantly; the actual rebuild is applied at most
  // ONCE per animation frame in frame(), always to the latest target.
  let pendingSeek: number | null = null;
  let lastAppliedSeek: number | null = null;
  let overScrubber = false;
  let hideTimer: ReturnType<typeof setTimeout> | null = null;
  let paused = false;
  const playpause = must('#playpause');
  const playBtn = must<HTMLButtonElement>('#playBtn');
  const PLAY_SVG =
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
  const PAUSE_SVG =
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h3.4v14H7zM13.6 5H17v14h-3.4z"/></svg>';
  function setPaused(p: boolean): void {
    paused = p;
    playpause.classList.toggle('show', p);
    playBtn.innerHTML = p ? PLAY_SVG : PAUSE_SVG; // button shows the action
  }
  setPaused(false); // init: playing → show the pause icon
  function showControls(): void {
    scrubber.classList.add('show');
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      // keep the controls up while paused / hovering / dragging
      if (!dragging && !overScrubber && !paused)
        scrubber.classList.remove('show');
    }, 2200);
  }
  stageEl.addEventListener('mousemove', showControls);
  stageEl.addEventListener('mouseleave', () => {
    if (!dragging) scrubber.classList.remove('show');
  });
  scrubber.addEventListener('mouseenter', () => {
    overScrubber = true;
    showControls();
  });
  scrubber.addEventListener('mouseleave', () => {
    overScrubber = false;
    showControls();
  });
  showControls(); // flash it once on load so it's discoverable

  // Seeking. Keep the director's ripple index in sync so a jump doesn't fire a burst
  // of click ripples.
  function syncPulseTo(t: number): void {
    let idx = -1;
    for (let i = 0; i < clicks.length; i++) {
      if (clicks[i].t <= t) idx = i;
      else break;
    }
    lastPulse = idx;
    prevT = t;
  }
  function timeFromClientX(x: number): number {
    const r = track.getBoundingClientRect();
    const frac = r.width ? Math.max(0, Math.min(1, (x - r.left) / r.width)) : 0;
    return frac * totalTime;
  }
  track.addEventListener('pointerdown', (e) => {
    dragging = true;
    startLoop(); // in case we were paused — the cursor should follow the scrub
    try {
      track.setPointerCapture(e.pointerId);
    } catch {}
    const t = timeFromClientX(e.clientX);
    // Enter engine mode (freeze the visible replayer, drive via morphdom) on the first
    // touch; thereafter just seek the engine. Either way NO visible-doc rebuild.
    if (!engineMode) enterEngineMode(t);
    else engineScrubTo(t);
    lastAppliedSeek = t;
    pendingSeek = null;
    updateScrub(t);
    syncPulseTo(t);
  });
  track.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const t = timeFromClientX(e.clientX);
    pendingSeek = t; // defer the expensive rebuild to frame() (coalesced)
    updateScrub(t); // but move the bar/thumb instantly for responsiveness
  });
  const endDrag = (e: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    pendingSeek = null;
    const t = timeFromClientX(e.clientX);
    engineScrubTo(t); // land the final position (morphed, no rebuild flash)
    // Pause on release: keep the morphed frame displayed, stay in engine mode.
    setPaused(true);
    syncPulseTo(t);
    showControls();
  };
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);

  // Click anywhere on the replay (the shield) to pause/resume — like a video.
  function togglePlay(): void {
    if (paused) {
      const t = curTime();
      // if it had finished, a click replays from the beginning
      const restart = t >= totalTime - 50;
      // Hand rendering back to the visible replayer for forward playback. If we were
      // in engine mode (after a scrub), this is the single point where the visible doc
      // rebuilds — folded into the resume. A restart is a full rebuild too; re-arm the
      // reveal gate to hide it, and hide the stage SYNCHRONOUSLY now — the rebuild
      // event lags a frame and play(0) resets the clock immediately, so without this
      // the cursor would flash a teleport from the last click to the first.
      if (restart || engineMode) {
        revealGateArmed = true;
        hideReplay();
      }
      engineMode = false;
      replayer.play(restart ? 0 : t);
      setPaused(false);
      startLoop();
    } else {
      replayer.pause();
      setPaused(true);
    }
    showControls();
  }
  shield.addEventListener('click', togglePlay);
  playBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePlay();
  });
  // At the end, surface the play badge so a click replays from the start.
  replayer.on('finish', () => setPaused(true));

  let lastCurX: number | null = null;
  let lastCurY: number | null = null;
  let lastCurScale = -1;
  let rafId: number | null = null;
  function startLoop(): void {
    if (rafId == null && !destroyed) rafId = requestAnimationFrame(frame);
  }
  function frame(): void {
    if (destroyed) {
      rafId = null;
      return;
    }
    // Reschedule only while actually playing (or scrubbing) — don't spin the rAF loop
    // while paused/finished, to save CPU.
    rafId = !paused || dragging ? requestAnimationFrame(frame) : null;
    // Coalesced scrub: apply at most the LATEST pending seek this frame. Routed
    // through the engine+morphdom (no visible rebuild).
    if (dragging && pendingSeek != null && pendingSeek !== lastAppliedSeek) {
      engineScrubTo(pendingSeek);
      lastAppliedSeek = pendingSeek;
      syncPulseTo(pendingSeek);
      pendingSeek = null;
    }
    const T = curTime();
    if (!dragging) updateScrub(T); // keep the bar in sync during playback
    // Hide the director cursor whenever the stage is gated — the initial build AND
    // every restart/seek rebuild. On a restart the timeline jumps back to 0 under the
    // hidden (rebuilding) stage; if the cursor stayed visible it would teleport from
    // the last click to the first. It reappears at the correct spot on reveal.
    if (!cursorEnabled || !stageRevealed) {
      cursor.classList.remove('on');
      return;
    }
    // A seek/scrub makes T jump (either direction). Resync the ripple index to the new
    // position WITHOUT firing the skipped clicks; otherwise every click between the old
    // and new time replays its ripple at once. Normal 1× playback advances only
    // ~16ms/frame, well under this threshold.
    const seeked = T < prevT || T - prevT > 250;
    if (seeked) {
      // The DOM rebuilds on a seek/restart, so the captured arrival points are stale —
      // drop them and re-capture against the seeked-to frame.
      arrivedXY.length = 0;
      let idx = -1;
      for (let i = 0; i < clicks.length; i++) {
        if (clicks[i].t <= T) idx = i;
        else break;
      }
      lastPulse = idx;
    }
    prevT = T;
    const pos = positionAt(T);
    if (!pos) return;
    cursor.classList.add('on');
    const cx = offsetX + pos.x * scale;
    const cy = offsetY + pos.y * scale;
    if (cx !== lastCurX || cy !== lastCurY || scale !== lastCurScale) {
      lastCurX = cx;
      lastCurY = cy;
      lastCurScale = scale;
      // Scale the cursor with the replay so it's the size a real cursor would be at
      // this zoom (origin = its tip, so the point stays on target).
      cursor.style.transform =
        'translate(' + cx + 'px,' + cy + 'px) scale(' + scale + ')';
    }
    for (let i = 0; i < clicks.length; i++) {
      if (i > lastPulse && T >= clicks[i].t) {
        lastPulse = i;
        pulse(clicks[i]);
      }
    }
  }
  applyThemeMode(); // initial theme assert (the frame loop no longer does it)
  // NB: startLoop() is deliberately NOT called here — it starts in beginPlaybackOnce()
  // at reveal, so the cursor never shows over a blank stage.

  // Locale flag switcher: one clickable flag per traced locale. Switch locale WITHOUT
  // reloading: read the target overlay, revert the nodes we swapped back to source,
  // apply the new overlay over the LIVE DOM. Structure/images are untouched, so
  // there's zero rebuild flash — only translated text changes.
  let switching = false;
  function switchLocale(loc: string): void {
    if (switching || loc === ACTIVE_LOCALE) return;
    switching = true;
    // Locale switching operates on the visible replayer's live DOM via its mirror. If
    // we're mid/post-scrub (engine mode, visible doc morphed), hand rendering back
    // first so the mirror + DOM are authoritative again.
    if (engineMode) {
      engineMode = false;
      revealGateArmed = true;
      replayer.pause(curTime());
    }
    try {
      const isSource = !loc || loc === SOURCE_LOCALE;
      let newOverlay: Record<number, string> | null = null;
      if (!isSource && demoLocales && demoLocales.locales.indexOf(loc) !== -1) {
        newOverlay = overlayFor(loc);
      }
      // revert previously-swapped nodes to their recorded source text
      const oldOverlay = overlay;
      if (oldOverlay && mirror) {
        for (const nid of swapped) {
          const n = mirror.getNode(nid);
          if (n && n.nodeType === 3) {
            const src = RECORDED_SRC.get(nid);
            if (src !== undefined && n.textContent === oldOverlay[nid])
              n.textContent = src;
          }
        }
      }
      swapped.clear();
      overlay = newOverlay;
      if (overlay) attachTranslator();
      else if (translateObserver) {
        translateObserver.disconnect();
        translateObserver = null;
      }
      ACTIVE_LOCALE = loc;
      const fEl = container.querySelector('#flags');
      if (fEl)
        [...fEl.children].forEach((b) =>
          (b as HTMLElement).classList.toggle(
            'active',
            (b as HTMLElement).dataset.loc === loc
          )
        );
    } finally {
      switching = false;
    }
  }

  // Source → "/" (renders as recorded), targets → the locale. Active one highlighted.
  (function setupFlags(): void {
    const flagsEl = container.querySelector('#flags');
    const sep = container.querySelector('#hudsep');
    if (
      !flagsEl ||
      !demoLocales ||
      !demoLocales.locales.length ||
      options.switchLocalesAllowed === false
    ) {
      if (sep) (sep as HTMLElement).style.display = 'none';
      return;
    }
    const source = demoLocales.sourceLocale;
    // Language → canonical country, so variants stay visually distinct; fall back to
    // region.
    const LANG_COUNTRY: Record<string, string> = {
      en: 'US',
      fr: 'FR',
      es: 'ES',
      de: 'DE',
      it: 'IT',
      pt: 'BR',
      nl: 'NL',
      ja: 'JP',
      zh: 'CN',
      ko: 'KR',
      ru: 'RU',
      ar: 'SA',
      hi: 'IN',
      pl: 'PL',
      tr: 'TR',
      sv: 'SE',
      da: 'DK',
      fi: 'FI',
      nb: 'NO',
      no: 'NO',
      cs: 'CZ',
      el: 'GR',
      he: 'IL',
      th: 'TH',
      vi: 'VN',
      id: 'ID',
      uk: 'UA',
      ro: 'RO',
      hu: 'HU',
    };
    const toFlag = (loc: string): string => {
      const lang = (loc.split('-')[0] || '').toLowerCase();
      const region = (loc.split('-')[1] || '').toUpperCase();
      const cc =
        LANG_COUNTRY[lang] || (/^[A-Z]{2}$/.test(region) ? region : '');
      if (/^[A-Z]{2}$/.test(cc))
        return String.fromCodePoint(
          ...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
        );
      return '🌐';
    };
    for (const loc of demoLocales.locales) {
      const btn = ownerDoc.createElement('button');
      btn.type = 'button';
      btn.textContent = toFlag(loc);
      btn.title = loc + (loc === source ? ' (source)' : '');
      btn.dataset.loc = loc;
      if (loc === ACTIVE_LOCALE) btn.classList.add('active');
      btn.onclick = () => switchLocale(loc); // in-place, no reload → no flash
      flagsEl.appendChild(btn);
    }
  })();

  // Build the frame-0 snapshot now (so the reveal gate can detect that styles have
  // applied) WITHOUT advancing the timeline. Actual playback starts in
  // beginPlaybackOnce() the moment the stage is revealed.
  replayer.pause(0);

  // ---- teardown ---------------------------------------------------------- //
  function destroy(): void {
    if (destroyed) return;
    destroyed = true;
    if (rafId != null) cancelAnimationFrame(rafId);
    rafId = null;
    window.removeEventListener('resize', fit);
    ownerDoc.removeEventListener('fullscreenchange', onFsChange);
    if (ownerDoc.fullscreenElement === container)
      ownerDoc.exitFullscreen?.().catch(() => {});
    if (resizeObs) resizeObs.disconnect();
    if (translateObserver) translateObserver.disconnect();
    if (hideTimer) clearTimeout(hideTimer);
    if (warmTimer) clearTimeout(warmTimer);
    try {
      replayer.pause();
    } catch {}
    try {
      if (engine) engine.pause();
    } catch {}
    engineHost.remove();
    container.innerHTML = '';
    container.classList.remove(GT_REPLAYER_CLASS, 'chrome-light');
  }

  return { destroy };
}

// ---- debug hot-swap helpers ------------------------------------------------ //

/** Coerce dropped JSON into a bundle: a raw events array or {events,...}. */
function toBundle(parsed: unknown): GTReplayerBundle | null {
  if (Array.isArray(parsed))
    return parsed.length >= 2 ? { events: parsed as eventWithTime[] } : null;
  if (parsed && typeof parsed === 'object') {
    const o = parsed as { events?: unknown };
    if (Array.isArray(o.events) && o.events.length >= 2)
      return parsed as GTReplayerBundle;
  }
  return null;
}

/**
 * Recover the recorder's self-describing metadata from the event stream: the
 * `gt-locales` ({locales, sourceLocale}) and `gt-i18n` (overlay) custom events it
 * splices in. Used as a fallback when a bundle omits the structured
 * `locales`/`overlay` fields (e.g. a raw events-only export or debug drop).
 */
function readEmbedded(events: eventWithTime[] | undefined): {
  locales?: readonly string[];
  overlay?: LocaleTextOverlay;
} {
  // Wire-format tags the recorder writes (GT_EVENT.locales / GT_EVENT.i18n in
  // ../types). Inlined here so `./replay` stays a single self-contained bundle
  // rather than sharing a runtime chunk with the recorder entry.
  const LOCALES_TAG = 'gt-locales';
  const I18N_TAG = 'gt-i18n';
  const out: { locales?: readonly string[]; overlay?: LocaleTextOverlay } = {};
  if (!Array.isArray(events)) return out;
  for (const e of events) {
    // rrweb custom events are EventType.Custom (5) with { tag, payload } data.
    const ev = e as {
      type?: number;
      data?: { tag?: string; payload?: unknown };
    };
    if (ev.type !== 5 || !ev.data) continue;
    const { tag, payload } = ev.data;
    if (tag === LOCALES_TAG && payload && typeof payload === 'object') {
      const p = payload as { locales?: unknown };
      if (
        Array.isArray(p.locales) &&
        p.locales.every((l) => typeof l === 'string')
      )
        out.locales = p.locales as string[];
    } else if (tag === I18N_TAG && payload && typeof payload === 'object') {
      out.overlay = payload as LocaleTextOverlay;
    }
  }
  return out;
}

/** Transient in-player notice (debug drop feedback); auto-removes. */
function showNotice(container: HTMLElement, msg: string): void {
  const doc = container.ownerDocument ?? document;
  const note = doc.createElement('div');
  note.className = 'gt-debug-notice';
  note.textContent = msg;
  container.appendChild(note);
  setTimeout(() => note.remove(), 2200);
}

/**
 * Mount the GT replayer into `container` and start playing `bundle`.
 *
 * Renders a self-contained player: a letterboxed rrweb stage cropped to the
 * recorder's capture frame, a synthesized "director" cursor that eases between the
 * recorded clicks, a YouTube-style scrubber (with a hidden engine-replayer +
 * morphdom for flicker-free backward scrubbing), light/dark + full-screen toggles,
 * and — when the bundle carries locales and `switchLocalesAllowed` isn't false — a
 * flag switcher that swaps the per-locale text overlay in place with no rebuild.
 *
 * With `debug: true`, dropping a recording JSON file onto the player hot-swaps the
 * replay; non-JSON / non-recording files fail gracefully with a notice.
 *
 * `container` should be sized by its parent (the player fills the width and sets
 * its own aspect). Returns a handle; call `destroy()` to tear everything down.
 */
export function createGTReplayer(
  container: HTMLElement,
  bundle: GTReplayerBundle,
  options: GTReplayerOptions = {}
): GTReplayerHandle {
  let inner = createPlayerInstance(container, bundle, options);
  if (!options.debug) return { destroy: () => inner.destroy() };

  // Debug: drag a recording JSON onto the player to replace the replay in place.
  // Listeners live on the container (outside the instance), so they survive swaps.
  const onDragOver = (e: DragEvent): void => {
    e.preventDefault();
    container.classList.add('gt-debug-drop');
  };
  const onDragLeave = (): void => container.classList.remove('gt-debug-drop');
  const onDrop = (e: DragEvent): void => {
    e.preventDefault();
    container.classList.remove('gt-debug-drop');
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    file.text().then(
      (text) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          showNotice(container, `Not a JSON file: ${file.name}`);
          return;
        }
        const next = toBundle(parsed);
        if (!next) {
          showNotice(container, `Not a recording: ${file.name}`);
          return;
        }
        inner.destroy();
        inner = createPlayerInstance(container, next, options);
      },
      () => showNotice(container, `Could not read ${file.name}`)
    );
  };
  container.addEventListener('dragover', onDragOver);
  container.addEventListener('dragleave', onDragLeave);
  container.addEventListener('drop', onDrop);

  return {
    destroy() {
      container.removeEventListener('dragover', onDragOver);
      container.removeEventListener('dragleave', onDragLeave);
      container.removeEventListener('drop', onDrop);
      container.classList.remove('gt-debug-drop');
      inner.destroy();
    },
  };
}
