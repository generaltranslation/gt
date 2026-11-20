import chalk from 'chalk';
import { stripVTControlCharacters } from 'node:util';
import type { ProgressResult, SpinnerResult } from '@clack/prompts';
import stringWidth from 'string-width';
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

export type GlobeBannerOptions = {
  /** Where the globe draws. */
  stream: NodeJS.WriteStream;
  /** Streams whose writes are held while the globe animates. */
  hold?: NodeJS.WriteStream[];
};

// Runs `fn` with performance.now() reading `time`. Clack's spinner reads it
// once in start() and again in stop() to time itself, so pinning those
// calls lets a spinner replayed or handed off at landing report the time it
// really ran, both live and in its final line.
function atTime(time: number, fn: () => void): void {
  const ownNow = Object.hasOwn(performance, 'now');
  const now = performance.now;
  performance.now = () => time;
  try {
    fn();
  } finally {
    if (ownNow) performance.now = now;
    else Reflect.deleteProperty(performance, 'now');
  }
}

// Shortens text to fit `room` terminal columns, ending in … if cut.
function fitColumns(text: string, room: number): string {
  let used = 0;
  let fitted = '';
  for (const { segment } of new Intl.Segmenter().segment(text)) {
    const width = stringWidth(segment);
    if (used + width > room - 1) return `${fitted}…`;
    used += width;
    fitted += segment;
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
  // Whoever set the status line (a running spinner, or none for a note),
  // and the running spinners' latest messages, most recent last.
  private statusOwner?: object;
  private spinnerStatuses: Array<{ owner: object; text: string }> = [];
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

  /** Whether writes to `stream` are being held for after landing. */
  holds(stream: NodeJS.WriteStream): boolean {
    return this.animating && this.writes.has(stream);
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
      // A redirected stream can't draw over the globe, and holding it would
      // replay its writes during exit, too late for a pipe to drain.
      if (!stream.isTTY) continue;
      const write = stream.write;
      this.writes.set(stream, write);
      stream.write = ((...args: Parameters<Write>) => {
        this.held.push({ stream, args });
        if (this.deferring === 0) this.requestLanding();
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
    this.cap = setTimeout(() => this.requestLanding(), MAX_ANIMATION_MS);
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
    this.statusOwner = undefined;
  }

  // A running spinner's message takes the status line.
  private showSpinner(owner: object, text: string): void {
    this.spinnerStatuses = this.spinnerStatuses.filter(
      (s) => s.owner !== owner
    );
    this.spinnerStatuses.push({ owner, text });
    this.status = text;
    this.statusOwner = owner;
  }

  // A stopped spinner gives the status line back to the most recent one
  // still running, if it held it.
  private clearSpinner(owner: object): void {
    this.spinnerStatuses = this.spinnerStatuses.filter(
      (s) => s.owner !== owner
    );
    if (this.statusOwner !== owner) return;
    const latest = this.spinnerStatuses.at(-1);
    this.status = latest?.text ?? '';
    this.statusOwner = latest?.owner;
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

  /**
   * Starts the fast-forward to rest without waiting for it. A command that
   * finishes meanwhile exits at once, and exit lands the globe.
   */
  requestLanding(): void {
    if (this.animating) this.settling = true;
  }

  /** Fast-forwards the globe to rest; resolves once held output has printed. */
  settle(): Promise<void> {
    if (!this.animating) return Promise.resolve();
    this.requestLanding();
    // The caller waits on the landing (a prompt), so the frame timer must
    // keep the process alive until it lands.
    this.timer?.ref();
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
    let startedAt = 0;
    // Prints a spinner's final line as clack would have, timed from when it
    // really started to when it stopped (or to now, when the process ends).
    const printFinal = (
      run: { message: string; startedAt: number; stoppedAt?: number },
      msg: string,
      code?: number
    ) => {
      const done = create();
      atTime(run.startedAt, () => done.start(run.message));
      if (run.stoppedAt === undefined) done.stop(msg, code);
      else atTime(run.stoppedAt, () => done.stop(msg, code));
    };
    // The real spinner, started with the current message if one is running.
    const becomeReal = () => {
      if (!real) {
        const spinner = create();
        real = spinner;
        if (running) atTime(startedAt, () => spinner.start(message));
      }
      return real;
    };
    // Identifies this spinner on the shared status line.
    const owner = {};
    const show = (msg: string) => this.showSpinner(owner, msg);
    return {
      start: (msg = '') => {
        message = msg;
        startedAt = performance.now();
        running = true;
        if (!this.animating) {
          (real ??= create()).start(msg);
          return;
        }
        show(msg);
        this.afterLanding.push((exitCode) => {
          if (!running) return;
          if (exitCode === undefined) return void becomeReal();
          // The process is ending: print the line clack's spinner prints
          // when a process exits under it.
          running = false;
          printFinal(
            { message, startedAt },
            exitCode > 1 ? 'Something went wrong' : 'Canceled',
            exitCode
          );
        });
      },
      message: (msg = '') => {
        message = msg;
        if (this.animating) {
          if (running) show(msg);
        } else if (real) real.message(msg);
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
        this.clearSpinner(owner);
        // Prints the spinner's final line, in order, once the globe lands,
        // timed by when this run started and stopped.
        const run = { message, startedAt, stoppedAt: performance.now() };
        this.held.push({ run: () => printFinal(run, msg, code) });
      },
      get isCancelled() {
        return real?.isCancelled ?? false;
      },
    };
  }

  /**
   * A progress bar that starts once the globe has landed, so it takes over
   * the terminal only after the banner has handed it back. Calls made before
   * then are replayed on it; a bar that finishes before then prints its
   * final line in order with the rest of the held output.
   */
  progress(create: () => ProgressResult): ProgressResult {
    let real: ProgressResult | undefined;
    let pending: Array<(bar: ProgressResult) => void> = [];
    let running = false;
    // Replays the calls so far on a new real bar.
    const replay = (calls: Array<(bar: ProgressResult) => void>) => {
      const bar = create();
      for (const fn of calls) fn(bar);
      return bar;
    };
    const call = (fn: (bar: ProgressResult) => void) => {
      if (!real && !this.animating) real = replay(pending.splice(0));
      if (real) fn(real);
      else pending.push(fn);
    };
    this.afterLanding.push((exitCode) => {
      if (!running) return;
      real = replay(pending.splice(0));
      // The process is ending under a running bar: stop it as clack would.
      if (exitCode !== undefined) {
        real.stop(exitCode > 1 ? 'Something went wrong' : 'Canceled', exitCode);
      }
    });
    this.requestLanding();
    return {
      start: (msg) => {
        running = true;
        call((bar) => bar.start(msg));
      },
      advance: (step, msg) => call((bar) => bar.advance(step, msg)),
      message: (msg) => call((bar) => bar.message(msg)),
      stop: (msg, code) => {
        if (real || !this.animating) {
          running = false;
          return call((bar) => bar.stop(msg, code));
        }
        if (!running) return;
        running = false;
        // Finished before the landing: its whole run goes in order with the
        // rest of the held output.
        const calls = [
          ...pending,
          (bar: ProgressResult) => bar.stop(msg, code),
        ];
        pending = [];
        this.held.push({ run: () => void replay(calls) });
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
    // On Windows, raw mode turns off Ctrl+C and is not reliably switched
    // back, so console input is left as it is there.
    if (!input.isTTY || process.platform === 'win32') return;
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
    input.setRawMode(false);
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
