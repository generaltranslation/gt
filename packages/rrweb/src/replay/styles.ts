/**
 * Player chrome (stage, scrubber, HUD, synthesized cursor) for the GT replayer.
 *
 * The CSS is scoped under the root `.gt-replayer` class so the player can be
 * embedded anywhere without leaking page-level rules — every selector is a
 * descendant of the mounted container, and the container itself (not the page
 * `<body>`) is the flex column that letterboxes the replay. Injected ONCE per
 * document (guarded by an id) so multiple instances share one sheet.
 *
 * The theme-dependent chrome tones (dark default, `.chrome-light` override) mirror
 * the dashboard's own shadcn tokens, inlined as hsl() because the HUD lives OUTSIDE
 * the replay iframe and can't read its CSS vars.
 */
export const GT_REPLAYER_CLASS = 'gt-replayer';

export const REPLAYER_CSS = `
.gt-replayer {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  margin: 0;
  overflow: hidden;
  background: #0f0f10;
  color: #e7e7e7;
  font-family: system-ui, -apple-system, sans-serif;
}
/* Debug drag-and-drop: highlight while a file hovers; transient swap notices. */
.gt-replayer.gt-debug-drop::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 2147483646;
  border: 2px dashed rgba(37, 120, 255, 0.9);
  background: rgba(37, 120, 255, 0.08);
  pointer-events: none;
}
.gt-replayer .gt-debug-notice {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2147483646;
  background: rgba(20, 20, 20, 0.92);
  color: #fff;
  font: 12px system-ui, sans-serif;
  padding: 6px 12px;
  border-radius: 6px;
  pointer-events: none;
}
/* rrweb positions its replay wrapper relative; the mouse it renders is hidden
   below (we draw our own director cursor). */
.gt-replayer .replayer-wrapper { position: relative; }
.gt-replayer #scrubrow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.gt-replayer #hud {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border-radius: 8px; /* --radius */
  background: hsl(240 10% 3.9%); /* --popover */
  border: 1px solid hsl(240 3.7% 15.9%); /* --border */
}
.gt-replayer #flags {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.gt-replayer #hud button {
  border: 0;
  background: transparent;
  color: hsl(240 5% 64.9%); /* --muted-foreground */
  cursor: pointer;
  line-height: 1;
  padding: 4px 6px;
  border-radius: 6px;
  transition:
    background 0.12s ease,
    color 0.12s ease;
}
.gt-replayer #hud button:hover {
  background: hsl(240 3.7% 15.9%); /* --accent (ghost hover) */
  color: hsl(0 0% 98%); /* --foreground */
}
.gt-replayer #flags button {
  font-size: 16px;
}
.gt-replayer #flags button.active {
  background: hsl(240 3.7% 15.9%); /* --accent = selected */
}
.gt-replayer #hudsep {
  width: 1px;
  align-self: stretch;
  margin: 3px 1px;
  background: hsl(240 3.7% 15.9%); /* --border */
}
.gt-replayer #darkToggle,
.gt-replayer #fsToggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.gt-replayer #darkToggle svg,
.gt-replayer #fsToggle svg {
  width: 15px;
  height: 15px;
}
/* ----- full-screen mode ----- */
/* Native fullscreen (:fullscreen, desktop/Android) and a CSS fallback (.gt-fs, used
   where the Fullscreen API cannot fullscreen a div — e.g. iOS Safari). Both fill the
   viewport; the stage drops its mini-player aspect so the replay contain-fits +
   letterboxes into the whole screen. 100dvh keeps it natural on mobile (accounts for
   the dynamic browser chrome). */
.gt-replayer.gt-fs {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
}
.gt-replayer.gt-fs,
.gt-replayer:fullscreen {
  width: 100vw !important;
  height: 100vh !important;
  height: 100dvh !important;
  max-width: none !important;
  margin: 0 !important;
  border-radius: 0 !important;
  aspect-ratio: auto !important;
  background: #000;
}
.gt-replayer.gt-fs #stage,
.gt-replayer:fullscreen #stage {
  flex: 1 1 auto !important;
  width: auto !important;
  aspect-ratio: auto !important;
}
/* ----- scrubber: YouTube-style seek bar, auto-hides on inactivity ----- */
.gt-replayer #scrubber {
  position: absolute;
  z-index: 8;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 22px; /* larger hover target above the thin bar */
  opacity: 0;
  transform: translateY(4px);
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
  pointer-events: none;
}
.gt-replayer #scrubber.show {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}
.gt-replayer #time {
  font-size: 11px;
  color: #fff;
  font-variant-numeric: tabular-nums;
}
.gt-replayer #trackrow {
  display: flex;
  align-items: center;
  gap: 8px;
}
/* Fixed size so toggling play<->pause never shifts the layout. */
.gt-replayer #playBtn {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #fff;
  cursor: pointer;
  transition: background 0.12s ease;
}
.gt-replayer #playBtn:hover {
  background: rgba(255, 255, 255, 0.14);
}
.gt-replayer #playBtn svg {
  width: 15px;
  height: 15px;
  display: block;
}
.gt-replayer #track {
  position: relative;
  flex: 1 1 auto;
  height: 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.28);
  cursor: pointer;
}
.gt-replayer #played {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 0;
  border-radius: 4px;
  background: #000;
}
.gt-replayer #thumb {
  position: absolute;
  top: 50%;
  left: 0;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: #000;
  transform: translate(-50%, -50%);
  opacity: 0;
  transition: opacity 0.12s ease;
}
.gt-replayer #scrubber.show:hover #thumb {
  opacity: 1;
}
/* Progress bar follows the replay theme: black in light, white in dark. */
.gt-replayer #scrubber.dark #played,
.gt-replayer #scrubber.dark #thumb {
  background: #fff;
}
/* Light mode: applyThemeMode sets the stage to the recording's OWN (light)
   background, so the dark-tuned chrome reads wrong on it. Re-tone the chrome to the
   dashboard's LIGHT shadcn tokens, toggled by applyThemeMode via .chrome-light on
   the root. Played/thumb are already black (the non-.dark default). */
.gt-replayer.chrome-light #hud {
  background: hsl(0 0% 100%);
  border-color: hsl(240 5.9% 90%);
}
.gt-replayer.chrome-light #hudsep {
  background: hsl(240 5.9% 90%);
}
.gt-replayer.chrome-light #hud button {
  color: hsl(240 3.8% 46.1%);
}
.gt-replayer.chrome-light #hud button:hover,
.gt-replayer.chrome-light #flags button.active {
  background: hsl(240 4.8% 95.9%);
  color: hsl(240 5.9% 10%);
}
.gt-replayer.chrome-light #time {
  color: hsl(240 4% 34%);
}
.gt-replayer.chrome-light #playBtn {
  color: hsl(240 10% 3.9%);
}
.gt-replayer.chrome-light #playBtn:hover {
  background: rgba(0, 0, 0, 0.08);
}
.gt-replayer.chrome-light #track {
  background: rgba(0, 0, 0, 0.16);
}
.gt-replayer.chrome-light .pp-btn {
  background: hsl(0 0% 100%);
  border-color: hsl(240 5.9% 90%);
  color: hsl(240 10% 3.9%);
}
.gt-replayer #stage {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  background: #0f0f10;
}
.gt-replayer #scaler {
  position: absolute;
  transform-origin: top left;
}
/* Passive playback: the recorded page inside must not be scrollable or clickable
   by the viewer — it just plays. rrweb still drives the replay's own
   scroll/mutations programmatically. */
.gt-replayer #player,
.gt-replayer #player iframe {
  pointer-events: none;
}
/* Kill the replay iframe's default UA border so the recording is edge-to-edge. */
.gt-replayer #stage iframe {
  border: 0 !important;
}
/* Transparent shield OVER the replay that swallows every viewer pointer/wheel/touch
   event so it behaves like a video. Player chrome sits above it; a mousemove still
   bubbles to #stage to reveal the controls. */
.gt-replayer #shield {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 4;
  cursor: pointer;
}
/* Center play badge, shown while paused (click the replay to resume). */
.gt-replayer #playpause {
  position: absolute;
  inset: 0;
  z-index: 6;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s ease;
}
.gt-replayer #playpause.show {
  opacity: 1;
}
.gt-replayer #playpause .pp-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 66px;
  height: 66px;
  border-radius: 50%;
  background: hsl(240 10% 3.9%); /* --popover */
  border: 1px solid hsl(240 3.7% 15.9%); /* --border */
  color: #fff;
}
.gt-replayer #playpause svg {
  width: 30px;
  height: 30px;
  margin-left: 3px; /* optically center the play triangle */
}
/* Capture-frame chrome. HIDDEN by default (the embedding card/iframe is the frame);
   still positioned in JS so the scrubber/HUD geometry that references it keeps
   working. Flip display:none -> block to bring back the "captured demo" affordance. */
.gt-replayer #recframe {
  display: none;
  position: absolute;
  z-index: 5;
  border-radius: 6px;
  outline: 2px solid #fff;
  box-shadow: 0 0 0 100vmax rgba(0, 0, 0, 0.5);
  pointer-events: none;
}
/* Our recordings drop mousemove, so hide rrweb's (static) replay cursor — we draw
   our own synthesized one. */
.gt-replayer .replayer-mouse,
.gt-replayer .replayer-mouse-tail {
  display: none !important;
}
/* ----- synthesized director cursor ----- */
.gt-replayer #fx {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 6;
  overflow: hidden;
}
.gt-replayer #cursor {
  position: absolute;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
  opacity: 0;
  will-change: transform;
  /* Scale the cursor by the replay's fit scale (applied via transform) around its
     tip, so it matches the size a real cursor would be at this zoom. */
  transform-origin: top left;
  transition: opacity 0.25s ease;
}
.gt-replayer #cursor.on {
  opacity: 1;
}
.gt-replayer #cursor svg {
  position: absolute;
  top: -1px;
  left: -1px;
  filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.45));
  transition: transform 0.07s ease;
}
.gt-replayer #cursor.clicking svg {
  transform: scale(0.8);
}
.gt-replayer .gt-ring {
  position: absolute;
  border: 2px solid rgba(37, 120, 255, 0.9);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  /* Keep this FAST — a slow ripple makes the whole replay feel sluggish (mutations
     are held for its duration, see CLICK_ANIM_MS). */
  animation: gt-replayer-ring 0.22s ease-out forwards;
}
@keyframes gt-replayer-ring {
  from {
    width: 10px;
    height: 10px;
    opacity: 0.85;
  }
  to {
    width: 64px;
    height: 64px;
    opacity: 0;
  }
}
`;

/**
 * The player chrome DOM, mounted into the container root. rrweb's Replayer builds
 * the recorded page inside `#player`; every other node is player chrome (the
 * letterbox stage, the click shield, the scrubber/HUD, and the synthesized cursor).
 */
export const REPLAYER_HTML = `
<div id="stage">
  <div id="scaler"><div id="player"></div></div>
  <div id="shield"></div>
  <div id="playpause">
    <span class="pp-btn">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
    </span>
  </div>
  <div id="recframe"></div>
  <div id="scrubber">
    <div id="scrubrow">
      <span id="time">0:00 / 0:00</span>
      <div id="hud">
        <span id="flags"></span>
        <span id="hudsep"></span>
        <button id="darkToggle" type="button" aria-label="Toggle theme"></button>
        <button id="fsToggle" type="button" aria-label="Toggle full screen"></button>
      </div>
    </div>
    <div id="trackrow">
      <button id="playBtn" type="button" aria-label="Play/pause"></button>
      <div id="track"><div id="played"></div><div id="thumb"></div></div>
    </div>
  </div>
  <div id="fx">
    <div id="cursor">
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
        <path
          d="M1 1 L1 16.5 L5.2 12.3 L8.3 19 L10.8 17.9 L7.7 11.2 L13.5 11.2 Z"
          fill="#ffffff"
          stroke="#141414"
          stroke-width="1.3"
          stroke-linejoin="round"
        />
      </svg>
    </div>
  </div>
</div>
`;
