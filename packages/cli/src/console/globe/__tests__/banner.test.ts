import { EventEmitter } from 'node:events';
import { stripVTControlCharacters } from 'node:util';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { spinner as clackSpinner } from '@clack/prompts';
import type { ProgressResult, SpinnerResult } from '@clack/prompts';
import { GlobeBanner } from '../banner.js';
import { getGlobeFrames } from '../frames.js';
import { paintFrame } from '../paint.js';

class FakeTerminal extends EventEmitter {
  isTTY = true;
  rows = 48;
  columns = 100;
  output = '';
  write(chunk: string | Uint8Array): boolean {
    this.output += String(chunk);
    return true;
  }
}

function setup() {
  const terminal = new FakeTerminal();
  const stream = terminal as unknown as NodeJS.WriteStream;
  const banner = new GlobeBanner();
  banner.start({ stream, hold: [stream] });
  return { banner, stream, terminal };
}

const plain = (text: string) => stripVTControlCharacters(text);

// A stand-in clack spinner that records each call with the clock reading it
// would time from.
function recordingSpinner(calls: string[]) {
  return (): SpinnerResult => ({
    start: (msg) => void calls.push(`start ${msg} @${performance.now()}`),
    message: (msg) => void calls.push(`message ${msg}`),
    stop: (msg) => void calls.push(`stop ${msg} @${performance.now()}`),
    isCancelled: false,
  });
}
const { rest, columns } = getGlobeFrames();
const restingLogo = paintFrame(rest, columns, false).join('\n');

beforeEach(() => {
  vi.useFakeTimers({
    toFake: [
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'performance',
    ],
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('GlobeBanner', () => {
  it('holds output while animating, then prints it in order under the logo', async () => {
    const { banner, stream, terminal } = setup();
    banner.defer(() => stream.write('General Translation, Inc.\n'));
    stream.write('Found 12 files\n');

    expect(plain(terminal.output)).not.toContain('Found 12 files');
    const landed = banner.settle();
    await vi.advanceTimersByTimeAsync(3000);
    await landed;

    const shown = plain(terminal.output);
    const logo = shown.lastIndexOf(restingLogo.split('\n')[0]);
    const header = shown.indexOf('General Translation, Inc.');
    expect(banner.isAnimating()).toBe(false);
    expect(logo).toBeGreaterThan(-1);
    expect(header).toBeGreaterThan(logo);
    expect(shown.indexOf('Found 12 files')).toBeGreaterThan(header);
    stream.write('after landing\n');
    expect(terminal.output.endsWith('after landing\n')).toBe(true);
  });

  it('keeps looping while only spinner messages arrive', async () => {
    const { banner, terminal } = setup();
    const calls: string[] = [];
    const spinner = banner.spinner(recordingSpinner(calls));
    const startedAt = performance.now();
    spinner.start('Fetching project');
    await vi.advanceTimersByTimeAsync(4000);
    const stoppedAt = performance.now();
    spinner.stop('Fetched project');
    await vi.advanceTimersByTimeAsync(4000);

    expect(banner.isAnimating()).toBe(true);
    expect(plain(terminal.output)).toContain('Fetching project');
    expect(calls).toEqual([]);

    const landed = banner.settle();
    await vi.advanceTimersByTimeAsync(4000);
    await landed;
    // Replayed with the clock it really started and stopped at.
    expect(calls).toEqual([
      `start Fetching project @${startedAt}`,
      `stop Fetched project @${stoppedAt}`,
    ]);
  });

  it('prints nothing for a spinner stopped before it started', async () => {
    const { banner } = setup();
    const calls: string[] = [];
    const spinner = banner.spinner(() => ({
      start: (msg) => void calls.push(`start ${msg}`),
      message: () => {},
      stop: (msg) => void calls.push(`stop ${msg}`),
      isCancelled: false,
    }));
    spinner.stop('Never ran');
    const landed = banner.settle();
    await vi.advanceTimersByTimeAsync(4000);
    await landed;
    expect(calls).toEqual([]);
  });

  it('keeps the process alive only while something awaits the landing', () => {
    const intervals = vi.spyOn(globalThis, 'setInterval');
    const { banner, stream } = setup();
    const frameTimer = intervals.mock.results[0].value as NodeJS.Timeout;

    // A finished command must not be held open by the banner, even after
    // printing its last line...
    stream.write('Done!\n');
    expect(frameTimer.hasRef()).toBe(false);
    // ...but a prompt awaiting the landing must be, or Node exits under it.
    void banner.settle();
    expect(frameTimer.hasRef()).toBe(true);
    intervals.mockRestore();
  });

  it('keeps the spinner clock running across the landing', async () => {
    const { banner } = setup();
    const calls: string[] = [];
    const spinner = banner.spinner(recordingSpinner(calls));
    const startedAt = performance.now();
    spinner.start('Installing');
    await vi.advanceTimersByTimeAsync(2000);
    const landed = banner.settle();
    await vi.advanceTimersByTimeAsync(2000);
    await landed;

    // The real spinner takes over still timing from the original start, so
    // its live clock and final total both cover the time under the globe.
    expect(calls).toEqual([`start Installing @${startedAt}`]);
    expect(performance.now()).toBeGreaterThan(startedAt + 3000);
  });

  it('times a real clack spinner that stops before the landing by when it ran', async () => {
    const { banner, stream, terminal } = setup();
    const spinner = banner.spinner(() =>
      clackSpinner({ indicator: 'timer', output: stream })
    );
    spinner.start('Fetching');
    await vi.advanceTimersByTimeAsync(1200);
    spinner.stop('Fetched');
    // The globe lands well after the spinner has stopped.
    await vi.advanceTimersByTimeAsync(3500);
    const landed = banner.settle();
    await vi.advanceTimersByTimeAsync(3000);
    await landed;

    expect(plain(terminal.output)).toContain('Fetched [1s]');
  });

  it('times a real clack spinner across the landing by its whole run', async () => {
    const { banner, stream, terminal } = setup();
    const spinner = banner.spinner(() =>
      clackSpinner({ indicator: 'timer', output: stream })
    );
    spinner.start('Fetching');
    await vi.advanceTimersByTimeAsync(2000);
    const landed = banner.settle();
    await vi.advanceTimersByTimeAsync(3000);
    await landed;
    await vi.advanceTimersByTimeAsync(1500);
    spinner.stop('Fetched');

    // 2s under the globe, up to 3s landing, then 1.5s as a real spinner.
    expect(plain(terminal.output)).toMatch(/Fetched \[6s\]/);
  });

  it.each([
    ['the same label', ['Fetching', 'Fetching'], 0, 'Fetching'],
    ['different labels', ['Uploading files', 'Watching'], 1, 'Uploading files'],
  ])(
    'keeps the status line for a spinner still running, with %s',
    async (_case, [firstLabel, secondLabel], stopIndex, expected) => {
      const { banner, terminal } = setup();
      const quiet = (): SpinnerResult => ({
        start: () => {},
        message: () => {},
        stop: () => {},
        isCancelled: false,
      });
      const spinners = [banner.spinner(quiet), banner.spinner(quiet)];
      spinners[0].start(firstLabel);
      spinners[1].start(secondLabel);
      spinners[stopIndex].stop('Done');
      spinners[stopIndex].message('Late message');
      const before = terminal.output.length;
      await vi.advanceTimersByTimeAsync(200);

      const redrawn = plain(terminal.output.slice(before));
      expect(redrawn).toContain(expected);
      expect(redrawn).not.toContain('Late message');
      terminal.emit('resize');
    }
  );

  it('starts a progress bar only after the banner hands back the terminal', async () => {
    const { banner } = setup();
    const calls: string[] = [];
    let created = 0;
    const bar = banner.progress((): ProgressResult => {
      created++;
      return {
        start: (msg) => void calls.push(`start ${msg}`),
        advance: (step) => void calls.push(`advance ${step}`),
        message: () => {},
        stop: (msg) => void calls.push(`stop ${msg}`),
        isCancelled: false,
      };
    });
    bar.start('Downloading');
    bar.advance(1);

    expect(created).toBe(0);
    expect(banner.isAnimating()).toBe(true);
    await vi.advanceTimersByTimeAsync(3000);
    expect(banner.isAnimating()).toBe(false);
    bar.stop('Downloaded');
    expect(created).toBe(1);
    expect(calls).toEqual([
      'start Downloading',
      'advance 1',
      'stop Downloaded',
    ]);
  });

  it('prints a progress bar that finishes before landing in order', async () => {
    const { banner, stream, terminal } = setup();
    const bar = banner.progress(
      (): ProgressResult => ({
        start: (msg) => void stream.write(`bar: ${msg}\n`),
        advance: () => {},
        message: () => {},
        stop: (msg) => void stream.write(`bar done: ${msg}\n`),
        isCancelled: false,
      })
    );
    bar.start('Downloading');
    bar.stop('No files to download');
    stream.write('Done!\n');
    await vi.advanceTimersByTimeAsync(3000);

    const shown = plain(terminal.output);
    expect(banner.isAnimating()).toBe(false);
    expect(shown.indexOf('bar done: No files to download')).toBeGreaterThan(-1);
    expect(shown.indexOf('bar done: No files to download')).toBeLessThan(
      shown.indexOf('Done!')
    );
  });

  it('lets a redirected stream write straight through', () => {
    const terminal = new FakeTerminal();
    const tty = terminal as unknown as NodeJS.WriteStream;
    const piped = new FakeTerminal();
    piped.isTTY = false;
    const pipedStream = piped as unknown as NodeJS.WriteStream;
    const banner = new GlobeBanner();
    banner.start({ stream: tty, hold: [tty, pipedStream] });
    pipedStream.write('warning: to a log file\n');

    expect(piped.output).toBe('warning: to a log file\n');
    expect(banner.isAnimating()).toBe(true);
    terminal.emit('resize');
  });

  it.each([
    ['CJK', '漢'],
    ['emoji', '⌚'],
    ['half-width kana with a voiced mark', 'ｶﾞ'],
  ])('keeps wide %s status text on one line', (_kind, char) => {
    const terminal = new FakeTerminal();
    terminal.columns = 30;
    const stream = terminal as unknown as NodeJS.WriteStream;
    const banner = new GlobeBanner();
    banner.start({ stream, hold: [stream] });
    banner.note(char.repeat(40), () => {});
    vi.advanceTimersByTime(100);

    const shown = plain(terminal.output);
    expect(shown).toContain(`${char.repeat(12)}…`);
    expect(shown).not.toContain(char.repeat(13));
    terminal.emit('resize');
  });

  it('lands rather than slow the command when the terminal cannot keep up', async () => {
    const { banner } = setup();
    // Every frame write takes 20ms, more than half a frame.
    let clock = performance.now();
    const now = vi
      .spyOn(performance, 'now')
      .mockImplementation(() => (clock += 20));
    await vi.advanceTimersByTimeAsync(200);
    now.mockRestore();

    expect(banner.isAnimating()).toBe(false);
  });

  it('lands before an uncaught error prints and labels running spinners', () => {
    const { banner, stream, terminal } = setup();
    const calls: string[] = [];
    banner.spinner(recordingSpinner(calls)).start('Uploading');
    stream.write('held line\n');
    process.emit(
      'uncaughtExceptionMonitor',
      new Error('boom'),
      'uncaughtException'
    );

    expect(banner.isAnimating()).toBe(false);
    expect(plain(terminal.output)).toContain('held line');
    expect(calls.at(-1)).toMatch(/^stop Something went wrong @/);
  });

  it('hands off a spinner where performance.now is read-only, as on Node 18', async () => {
    const original = Object.getOwnPropertyDescriptor(performance, 'now');
    const now = performance.now.bind(performance);
    Object.defineProperty(performance, 'now', {
      value: () => now(),
      writable: false,
      configurable: true,
    });
    try {
      const { banner } = setup();
      const calls: string[] = [];
      const spinner = banner.spinner(recordingSpinner(calls));
      const startedAt = performance.now();
      spinner.start('Installing');
      await vi.advanceTimersByTimeAsync(1000);
      const landed = banner.settle();
      await vi.advanceTimersByTimeAsync(3000);
      await landed;

      expect(calls).toEqual([`start Installing @${startedAt}`]);
    } finally {
      if (original) Object.defineProperty(performance, 'now', original);
      else Reflect.deleteProperty(performance, 'now');
    }
  });

  it('lands when an asynchronous terminal stops accepting writes', async () => {
    const terminal = new FakeTerminal();
    // Backpressure: the terminal queues writes rather than taking long.
    terminal.write = (chunk) => {
      terminal.output += String(chunk);
      return false;
    };
    const stream = terminal as unknown as NodeJS.WriteStream;
    const banner = new GlobeBanner();
    banner.start({ stream, hold: [stream] });
    await vi.advanceTimersByTimeAsync(200);

    expect(banner.isAnimating()).toBe(false);
  });

  it('stops redrawing and releases held output when the window resizes', () => {
    const { banner, stream, terminal } = setup();
    stream.write('held\n');
    terminal.emit('resize');

    expect(banner.isAnimating()).toBe(false);
    expect(terminal.output.endsWith('held\n')).toBe(true);
  });
});
