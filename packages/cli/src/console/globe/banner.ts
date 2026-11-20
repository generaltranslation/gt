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
const CTRL_C = 0x03;
const TERMINATING_SIGNALS: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGHUP'];

type Write = NodeJS.WriteStream['write'];
type Held =
  | { stream: NodeJS.WriteStream; args: Parameters<Write> }
  | { run: () => void };
type SpinnerIndicator = 'dots' | 'timer';

export type GlobeBannerOptions = {
  /** Where the globe draws. */
  stream: NodeJS.WriteStream;
  /** Streams whose writes are held while the globe animates. */
  hold?: NodeJS.WriteStream[];
};

// Clack's spinner timer format.
function formatElapsed(startedAt: number): string {
  const seconds = (performance.now() - startedAt) / 1000;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return minutes > 0 ? `[${minutes}m ${rest}s]` : `[${rest}s]`;
}

// Terminal columns a code point takes: wide CJK and emoji take two.
function columnsOf(codePoint: number): number {
  if (codePoint >= 0x300 && codePoint <= 0x36f) return 0;
  const wide =
    codePoint >= 0x1100 &&
    (codePoint <= 0x115f ||
      (codePoint >= 0x2e80 && codePoint <= 0xa4cf && codePoint !== 0x303f) ||
      (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
      (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
      (codePoint >= 0xfe30 && codePoint <= 0xfe6f) ||
      (codePoint >= 0xff00 && codePoint <= 0xff60) ||
      (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
      (codePoint >= 0x1f300 && codePoint <= 0x1faff) ||
      (codePoint >= 0x20000 && codePoint <= 0x3fffd));
  return wide ? 2 : 1;
}

// Shortens text to fit `room` terminal columns, ending in … if cut.
function fitColumns(text: string, room: number): string {
  let used = 0;
  let fitted = '';
  for (const char of text) {
    const width = columnsOf(char.codePointAt(0)!);
    if (used + width > room - 1) return `${fitted}…`;
    used += width;
    fitted += char;
  }
  return fitted;
}

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
  // Run on landing; given the exit code when the process is ending.
  private afterLanding: Array<(exitCode?: number) => void> = [];
  private inputMuted = false;

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
    for (const signal of TERMINATING_SIGNALS) process.on(signal, this.onSignal);
    this.options.stream.on('resize', this.onResize);
    this.muteInput();
    // A blank line above the globe, as the static banner has.
    this.raw(`\n${HIDE_CURSOR}`);
    this.drawFrame(this.frames.intro[0]);
    this.position = 1;
    this.timer = setInterval(() => this.advance(), FRAME_MS);
    this.cap = setTimeout(() => void this.settle(), MAX_ANIMATION_MS);
    // While nothing waits on it, the banner never keeps a finished command
    // alive; exit lands it.
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
    // Something may be awaiting the landing (a prompt), so the frame timer
    // must keep the process alive until it lands.
    this.timer?.ref();
    return this.landed;
  }

  /**
   * A spinner whose messages show on the banner's status line while the
   * globe animates, and that becomes a real spinner once it lands.
   */
  spinner(
    create: (indicator?: SpinnerIndicator) => SpinnerResult,
    indicator: SpinnerIndicator = 'timer'
  ): SpinnerResult {
    let real: SpinnerResult | undefined;
    let running = false;
    let message = '';
    let startedAt = 0;
    // Prints a stopped spinner's final line, with the time it really ran.
    const replayFinal = (msg: string, code?: number) => {
      const done = create('dots');
      done.start(message);
      done.stop(
        indicator === 'timer' ? `${msg} ${formatElapsed(startedAt)}` : msg,
        code
      );
    };
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
        startedAt = performance.now();
        if (!this.animating) {
          running = true;
          (real ??= create()).start(msg);
          return;
        }
        running = true;
        this.status = msg;
        this.afterLanding.push((exitCode) => {
          if (!running) return;
          if (exitCode === undefined) return void becomeReal();
          // The process is ending: print the line clack's spinner prints
          // when a process exits under it.
          running = false;
          const text = exitCode > 1 ? 'Something went wrong' : 'Canceled';
          replayFinal(text, exitCode);
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
        if (!running) return;
        running = false;
        this.status = '';
        // Prints the spinner's final line, in order, once the globe lands.
        const final =
          indicator === 'timer' ? `${msg} ${formatElapsed(startedAt)}` : msg;
        const started = message;
        this.held.push({
          run: () => {
            const done = create('dots');
            done.start(started);
            done.stop(final, code);
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
    const text = [...stripVTControlCharacters(this.status).split('\n')[0]]
      .map((char) => {
        const code = char.codePointAt(0)!;
        return code < 0x20 || code === 0x7f ? ' ' : char;
      })
      .join('')
      .trim();
    if (!text) return '';
    const spin =
      STATUS_FRAMES[Math.floor(this.tick / 4) % STATUS_FRAMES.length];
    // One line only: a wrapped status line would break the in-place redraw.
    const room = Math.max(10, (this.options!.stream.columns ?? 80) - 4);
    return `${chalk.magenta(spin)}  ${fitColumns(text, room)}`;
  }

  // Redraws the globe and the status line in place.
  private drawFrame(frame: GlobeFrame): void {
    const lines = [...this.paint(frame), this.statusLine()];
    const up = this.drawn ? `\x1b[${lines.length}A` : '';
    this.raw(`${up}${lines.map((line) => `\r${line}\x1b[K`).join('\n')}\n`);
    this.drawn = true;
  }

  private land(exitCode?: number): void {
    this.status = '';
    this.drawFrame(this.frames!.rest);
    // Step back onto the now-empty status line so output continues there.
    this.raw(`\x1b[1A${SHOW_CURSOR}`);
    this.release(exitCode);
  }

  // Stops animating, restores the streams, and prints the held output. With
  // an exit code the process is ending, so running spinners print their
  // final line instead of restarting.
  private release(exitCode?: number): void {
    if (!this.animating) return;
    this.animating = false;
    clearInterval(this.timer);
    clearTimeout(this.cap);
    process.off('exit', this.onExit);
    for (const signal of TERMINATING_SIGNALS) {
      process.off(signal, this.onSignal);
    }
    this.options!.stream.off('resize', this.onResize);
    this.unmuteInput();
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
    for (const fn of afterLanding) fn(exitCode);
    this.resolveLanded();
  }

  private raw(text: string): void {
    const stream = this.options!.stream;
    (this.writes.get(stream) ?? stream.write).call(stream, text);
  }

  // Keystrokes would echo into the globe and break the in-place redraw, so
  // input is read raw and dropped while it animates, as clack's spinner does.
  // Ctrl+C still interrupts.
  private muteInput(): void {
    const input = process.stdin;
    if (!input.isTTY) return;
    input.setRawMode(true);
    input.on('data', this.onKey);
    input.resume();
    // Reading input must not keep a finished command alive.
    input.unref();
    this.inputMuted = true;
  }

  private unmuteInput(): void {
    if (!this.inputMuted) return;
    this.inputMuted = false;
    const input = process.stdin;
    input.off('data', this.onKey);
    // As clack does, Windows keeps raw mode rather than toggle it back.
    if (process.platform !== 'win32') input.setRawMode(false);
    input.pause();
    input.ref();
  }

  private readonly onKey = (data: Buffer) => {
    if (!data.includes(CTRL_C) || !this.animating) return;
    this.land(1);
    // Raw input means the terminal sent no signal, so raise it ourselves:
    // other handlers get it, and without any, Ctrl+C exits as usual.
    process.kill(process.pid, 'SIGINT');
  };

  // A command that exits mid-animation lands at once, so nothing is lost.
  private readonly onExit = (code: number) => {
    if (this.animating) this.land(code);
  };

  private readonly onSignal = (signal: NodeJS.Signals) => {
    if (!this.animating) return;
    this.land(1);
    // Ours was the only handler, so keep the signal's default: exit.
    if (process.listenerCount(signal) === 0) process.kill(process.pid, signal);
  };

  // A resize can rewrap the block, so redrawing in place is no longer safe:
  // stop where it is and let held output follow below.
  private readonly onResize = () => {
    if (!this.animating) return;
    this.raw(`\n${SHOW_CURSOR}`);
    this.release();
  };
}

export const globeBanner = new GlobeBanner();
