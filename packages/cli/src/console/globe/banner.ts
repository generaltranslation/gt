import chalk from 'chalk';
import { format, stripVTControlCharacters } from 'node:util';
import type { ProgressResult, SpinnerResult } from '@clack/prompts';
import stringWidth from 'string-width';
import { getGlobeFrames } from './frames.js';
import type { GlobeFrame, GlobeFrameSet } from './frames.js';
import { readProcessGroups } from './motion.js';
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
// Autowrap (DECAWM) is off while a frame is written, so a line the terminal
// measures wider than we do is clipped instead of wrapping the redraw.
const NO_WRAP = '\x1b[?7l';
const WRAP = '\x1b[?7h';
// Keys that raw input turns into plain bytes, and the signals they stand for.
const SIGNAL_KEYS = new Map<number, NodeJS.Signals>([
  [0x03, 'SIGINT'],
  [0x1a, 'SIGTSTP'],
  [0x1c, 'SIGQUIT'],
]);
const TERMINATING_SIGNALS: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGHUP'];
// A frame that takes longer than this to write means the terminal can't
// keep up (a slow SSH link); the globe lands rather than slow the command.
const SLOW_WRITE_MS = FRAME_MS / 2;
const CONSOLE_METHODS = [
  'log',
  'info',
  'debug',
  'warn',
  'error',
  'trace',
] as const;
type ConsoleMethod = (typeof CONSOLE_METHODS)[number];

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
  // Node 18's performance.now is read-only, so it can't be assigned; a
  // temporary own property overrides it, and the original is put back after.
  const own = Object.getOwnPropertyDescriptor(performance, 'now');
  try {
    Object.defineProperty(performance, 'now', {
      value: () => time,
      configurable: true,
      writable: true,
    });
  } catch {
    // Without a clock to pin, the spinner times from now instead.
    return fn();
  }
  try {
    fn();
  } finally {
    if (own) Object.defineProperty(performance, 'now', own);
    else Reflect.deleteProperty(performance, 'now');
  }
}

// Terminal columns a grapheme takes. string-width measures whole graphemes,
// which is right for emoji and keycap sequences (one glyph), but it counts
// some spacing characters inside a grapheme as zero, such as a half-width
// kana's voiced mark or Thai's spacing vowel SARA AM, which terminals draw in
// a cell of their own. So outside emoji, every code point that isn't a
// non-spacing mark, enclosing mark or format character counts too.
const NON_SPACING = /[\p{Mn}\p{Me}\p{Cf}]/u;
function columnsOf(text: string): number {
  // Composed form, so decomposed Hangul jamo measure as their syllable.
  const grapheme = text.normalize('NFC');
  const whole = stringWidth(grapheme);
  if (/\p{Extended_Pictographic}/u.test(grapheme)) return whole;
  let spacing = 0;
  for (const char of grapheme) {
    if (!NON_SPACING.test(char)) spacing += stringWidth(char);
  }
  return Math.max(whole, spacing);
}

// Shortens text to fit `room` terminal columns, ending in … if cut.
function fitColumns(text: string, room: number): string {
  let used = 0;
  let fitted = '';
  for (const { segment } of new Intl.Segmenter().segment(text)) {
    const width = columnsOf(segment);
    if (used + width > room - 1) return `${fitted}…`;
    used += width;
    fitted += segment;
  }
  return fitted;
}

/**
 * Sends `signal` the way the terminal would for a key: to the whole
 * foreground job when this process is in it, so a launcher running the CLI
 * (pnpm exec, the binary's wrapper) stops, resumes or exits with it, and to
 * this process alone otherwise. Target 0 means this process's own group; a
 * group ID is never negated, because kill(-1) signals every process the
 * caller may signal.
 */
export function signalForegroundJob(
  signal: NodeJS.Signals,
  groups: ReturnType<typeof readProcessGroups>,
  kill: (pid: number, signal: NodeJS.Signals) => void = (pid, sig) =>
    void process.kill(pid, sig)
): void {
  const inForegroundJob =
    groups !== undefined && groups.group === groups.foreground;
  try {
    kill(inForegroundJob ? 0 : process.pid, signal);
  } catch {
    kill(process.pid, signal);
  }
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
  private crashed = false;
  private lastLines: string[] = [];
  private readonly consoleMethods = new Map<
    ConsoleMethod,
    Console[ConsoleMethod]
  >();

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
    this.routeConsole();
    process.on('exit', this.onExit);
    process.on('uncaughtExceptionMonitor', this.onCrash);
    // First, so other listeners (even once listeners) are still registered
    // when it runs and can be counted.
    if (process.versions.bun)
      process.prependListener('unhandledRejection', this.onRejection);
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
            this.exitMessage(exitCode),
            this.exitStopCode(exitCode)
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
        real.stop(this.exitMessage(exitCode), this.exitStopCode(exitCode));
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
      .trim()
      .normalize('NFC');
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
    // Unchanged lines are stepped over rather than written again.
    const body = lines
      .map((line, i) =>
        this.drawn && line === this.lastLines[i] ? '' : `\r${line}\x1b[K`
      )
      .join('\n');
    const before = performance.now();
    const accepted = this.raw(`${NO_WRAP}${up}${body}\n${WRAP}`);
    const took = performance.now() - before;
    this.lastLines = lines;
    this.drawn = true;
    // Too slow to write, or not accepted (an asynchronous terminal, as on
    // Windows, that is already behind).
    if (took > SLOW_WRITE_MS || !accepted) {
      // Land at once: fast-forwarding would mean writing more frames.
      this.phase = 'rest';
      this.settling = true;
    }
  }

  // The line clack's spinner prints when the process ends under it.
  private exitMessage(exitCode: number): string {
    return this.crashed || exitCode > 1 ? 'Something went wrong' : 'Canceled';
  }

  // The stop code clack's spinner uses when the process ends under it: the
  // exit code, except that a crash shows as an error.
  private exitStopCode(exitCode: number): number {
    return this.crashed ? 2 : exitCode;
  }

  // Bun's console writes to the terminal without going through
  // process.stdout.write, so on Bun it's routed through the held writes.
  // Node's console already uses them.
  private routeConsole(): void {
    if (!process.versions.bun) return;
    for (const name of CONSOLE_METHODS) {
      const toErr = name === 'warn' || name === 'error' || name === 'trace';
      const stream = toErr ? process.stderr : process.stdout;
      if (!this.writes.has(stream)) continue;
      this.consoleMethods.set(name, console[name]);
      console[name] = (...args: unknown[]) => {
        const text =
          name === 'trace'
            ? `Trace: ${format(...args)}\n${new Error().stack?.split('\n').slice(2).join('\n') ?? ''}`
            : format(...args);
        stream.write(`${text}\n`);
      };
    }
  }

  private land(exitCode?: number): void {
    this.status = '';
    this.drawFrame(this.frames!.rest);
    // Step back onto the now-empty status line so output continues there.
    this.raw(`\x1b[1A${WRAP}${SHOW_CURSOR}`);
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
    process.off('uncaughtExceptionMonitor', this.onCrash);
    process.off('unhandledRejection', this.onRejection);
    for (const signal of TERMINATING_SIGNALS) {
      process.off(signal, this.onSignal);
    }
    this.options!.stream.off('resize', this.onResize);
    this.unmuteInput();
    for (const [stream, write] of this.writes) stream.write = write;
    for (const [name, method] of this.consoleMethods) console[name] = method;
    this.consoleMethods.clear();
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

  private raw(text: string): boolean {
    const stream = this.options!.stream;
    return (this.writes.get(stream) ?? stream.write).call(stream, text);
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
    if (!this.animating) return;
    const signal = [...data].map((byte) => SIGNAL_KEYS.get(byte)).find(Boolean);
    if (!signal) return;
    // Suspending comes back later, so the command carries on as landed;
    // the others end it.
    this.land(signal === 'SIGTSTP' ? undefined : 1);
    // Raw input means the terminal sent no signal, so raise it as the
    // terminal would: on its whole foreground job, so a launcher running
    // this CLI (pnpm exec, the binary's wrapper) stops or exits with it.
    // The key then does what it usually does (Ctrl+C exits, Ctrl+Z
    // suspends, Ctrl+\ quits), and other handlers still get it.
    signalForegroundJob(signal, readProcessGroups());
  };

  // An uncaught error lands the globe before its trace prints.
  private readonly onCrash = () => {
    this.crashed = true;
    if (this.animating) this.land(1);
  };

  // Bun reports an unhandled rejection without uncaughtExceptionMonitor, so
  // land first, then hand the same rejection back, unhandled: the runtime
  // reports it as usual, with its original stack and exit code. Rethrowing
  // here would report this handler as where it failed.
  // Only stands in when no other listener handles the rejection; otherwise
  // that listener decides what happens, and the globe lands on its output.
  private readonly onRejection = (reason: unknown) => {
    if (process.listenerCount('unhandledRejection') > 1) return;
    this.onCrash();
    process.off('unhandledRejection', this.onRejection);
    void Promise.reject(reason);
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
    this.raw(`\n${WRAP}${SHOW_CURSOR}`);
    this.release();
  };
}

export const globeBanner = new GlobeBanner();
