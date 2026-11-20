import chalk from 'chalk';
import { stripVTControlCharacters } from 'node:util';
import type { SpinnerResult } from '@clack/prompts';
import { getGlobeFrames } from './frames.js';
import type { GlobeFrame, GlobeFrameSet } from './frames.js';
import { paintFrame } from './paint.js';

const FRAME_MS = 1000 / 30;
const REST_FRAMES = 18;
const INTRO_FAST_FORWARD = 3;
const LOOP_FAST_FORWARD = 2.5;
// The globe lands by now even if the command only reports progress.
const MAX_ANIMATION_MS = 10_000;
const STATUS_FRAMES = ['◒', '◐', '◓', '◑'];
const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';

type Write = NodeJS.WriteStream['write'];
type Held =
  | { stream: NodeJS.WriteStream; args: Parameters<Write> }
  | { run: () => void };

export type GlobeBannerOptions = {
  /** Where the globe draws. */
  stream: NodeJS.WriteStream;
  /** Streams whose writes are held while the globe animates. */
  hold?: NodeJS.WriteStream[];
};

/**
 * The animated banner. It owns the terminal while it animates: the intro
 * plays, then the globe loops while the command works, showing its spinner
 * and progress messages on a status line under it. Other output (warnings,
 * errors, prompts, anything written directly) makes the globe fast-forward to
 * rest, as does the command finishing or 10 seconds passing. Everything held
 * meanwhile prints, in order, as soon as it lands. The command never waits.
 */
export class GlobeBanner {
  private animating = false;
  private started = false;
  private options?: Required<GlobeBannerOptions>;
  private frames?: GlobeFrameSet;
  private readonly writes = new Map<NodeJS.WriteStream, Write>();
  private held: Held[] = [];
  private deferring = 0;
  private status = '';
  private phase: 'intro' | 'rest' | 'loop' = 'intro';
  private position = 0;
  private settling = false;
  private drawn = false;
  private tick = 0;
  private timer?: NodeJS.Timeout;
  private cap?: NodeJS.Timeout;
  private landed: Promise<void> = Promise.resolve();
  private resolveLanded = () => {};
  private readonly painted = new Map<GlobeFrame, string[]>();
  private afterLanding: Array<() => void> = [];

  isAnimating(): boolean {
    return this.animating;
  }

  /** Plays the banner once per process; returns false if it already ran. */
  start(options: GlobeBannerOptions): boolean {
    if (this.started) return false;
    this.started = true;
    this.animating = true;
    this.options = {
      stream: options.stream,
      hold: options.hold ?? [process.stdout, process.stderr],
    };
    this.frames = getGlobeFrames();
    this.landed = new Promise((resolve) => (this.resolveLanded = resolve));
    for (const stream of new Set(this.options.hold)) {
      const write = stream.write;
      this.writes.set(stream, write);
      stream.write = ((...args: Parameters<Write>) => {
        this.held.push({ stream, args });
        if (this.deferring === 0) void this.settle();
        return true;
      }) as Write;
    }
    process.on('exit', this.onExit);
    process.on('SIGINT', this.onInterrupt);
    this.options.stream.on('resize', this.onResize);
    // A blank line above the globe, as the static banner has.
    this.raw(`\n${HIDE_CURSOR}`);
    this.drawFrame(this.frames.intro[0]);
    this.position = 1;
    this.timer = setInterval(() => this.advance(), FRAME_MS);
    this.cap = setTimeout(() => void this.settle(), MAX_ANIMATION_MS);
    // The banner never keeps a finished command alive; exit lands it.
    this.timer.unref();
    this.cap.unref();
    return true;
  }

  /**
   * Holds a progress line for after landing, showing it on the status line
   * meanwhile, without landing the globe.
   */
  note(text: string, print: () => void): void {
    this.held.push({ run: print });
    this.status = text;
  }

  /** Runs `fn` with its output held for after landing, without landing. */
  defer(fn: () => void): void {
    this.deferring++;
    try {
      fn();
    } finally {
      this.deferring--;
    }
  }

  /** Fast-forwards the globe to rest; resolves once held output has printed. */
  settle(): Promise<void> {
    if (!this.animating) return Promise.resolve();
    this.settling = true;
    return this.landed;
  }

  /**
   * A spinner whose messages show on the banner's status line while the
   * globe animates, and that becomes a real spinner once it lands.
   */
  spinner(create: () => SpinnerResult): SpinnerResult {
    let real: SpinnerResult | undefined;
    let running = false;
    let message = '';
    // The real spinner, started with the current message if one is running.
    const becomeReal = () => {
      if (!real) {
        real = create();
        if (running) real.start(message);
      }
      return real;
    };
    return {
      start: (msg = '') => {
        message = msg;
        if (!this.animating) {
          running = true;
          (real ??= create()).start(msg);
          return;
        }
        running = true;
        this.status = msg;
        this.afterLanding.push(() => {
          if (running) becomeReal();
        });
      },
      message: (msg = '') => {
        message = msg;
        if (this.animating) this.status = msg;
        else if (real) real.message(msg);
        else if (running) becomeReal();
      },
      stop: (msg = '', code?: number) => {
        if (!this.animating) {
          if (real || running) becomeReal().stop(msg, code);
          running = false;
          return;
        }
        running = false;
        this.status = '';
        // Prints the spinner's final line, in order, once the globe lands.
        const started = message;
        this.held.push({
          run: () => {
            const done = create();
            done.start(started);
            done.stop(msg, code);
          },
        });
      },
      get isCancelled() {
        return real?.isCancelled ?? false;
      },
    };
  }

  private advance(): void {
    const { intro, loop } = this.frames!;
    this.tick++;
    if (this.phase === 'rest') {
      if (this.settling) return this.land();
      this.drawFrame(intro[intro.length - 1]);
      if (++this.position >= REST_FRAMES) {
        this.phase = 'loop';
        this.position = 0;
      }
      return;
    }
    const frames = this.phase === 'intro' ? intro : loop;
    const last = frames.length - 1;
    this.drawFrame(frames[Math.min(Math.floor(this.position), last)]);
    if (this.position >= last) {
      if (this.settling) return this.land();
      this.phase = 'rest';
      this.position = 0;
      return;
    }
    const step = !this.settling
      ? 1
      : this.phase === 'intro'
        ? INTRO_FAST_FORWARD
        : LOOP_FAST_FORWARD;
    this.position = Math.min(this.position + step, last);
  }

  private paint(frame: GlobeFrame): string[] {
    let lines = this.painted.get(frame);
    if (!lines) {
      lines = paintFrame(frame, this.frames!.columns, true);
      this.painted.set(frame, lines);
    }
    return lines;
  }

  private statusLine(): string {
    const text = stripVTControlCharacters(this.status).split('\n')[0].trim();
    if (!text) return '';
    const spin =
      STATUS_FRAMES[Math.floor(this.tick / 4) % STATUS_FRAMES.length];
    // One line only: a wrapped status line would break the in-place redraw.
    const room = Math.max(10, (this.options!.stream.columns ?? 80) - 4);
    const shown = text.length > room ? `${text.slice(0, room - 1)}…` : text;
    return `${chalk.magenta(spin)}  ${shown}`;
  }

  // Redraws the globe and the status line in place.
  private drawFrame(frame: GlobeFrame): void {
    const lines = [...this.paint(frame), this.statusLine()];
    const up = this.drawn ? `\x1b[${lines.length}A` : '';
    this.raw(`${up}${lines.map((line) => `\r${line}\x1b[K`).join('\n')}\n`);
    this.drawn = true;
  }

  private land(): void {
    this.status = '';
    this.drawFrame(this.frames!.rest);
    // Step back onto the now-empty status line so output continues there.
    this.raw(`\x1b[1A${SHOW_CURSOR}`);
    this.release();
  }

  // Stops animating, restores the streams, and prints the held output.
  private release(): void {
    if (!this.animating) return;
    this.animating = false;
    clearInterval(this.timer);
    clearTimeout(this.cap);
    process.off('exit', this.onExit);
    process.off('SIGINT', this.onInterrupt);
    this.options!.stream.off('resize', this.onResize);
    for (const [stream, write] of this.writes) stream.write = write;
    this.writes.clear();
    const held = this.held;
    this.held = [];
    for (const item of held) {
      if ('run' in item) item.run();
      else item.stream.write(...item.args);
    }
    const afterLanding = this.afterLanding;
    this.afterLanding = [];
    for (const fn of afterLanding) fn();
    this.resolveLanded();
  }

  private raw(text: string): void {
    const stream = this.options!.stream;
    (this.writes.get(stream) ?? stream.write).call(stream, text);
  }

  // A command that exits mid-animation lands at once, so nothing is lost.
  private readonly onExit = () => {
    if (this.animating) this.land();
  };

  private readonly onInterrupt = () => {
    if (!this.animating) return;
    this.land();
    // Ours was the only handler, so keep Ctrl+C's default: exit.
    if (process.listenerCount('SIGINT') === 0)
      process.kill(process.pid, 'SIGINT');
  };

  // A resize can rewrap the block, so redrawing in place is no longer safe.
  private readonly onResize = () => {
    if (!this.animating) return;
    this.raw(`\n${SHOW_CURSOR}`);
    this.release();
  };
}

export const globeBanner = new GlobeBanner();
