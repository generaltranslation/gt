import { EventEmitter } from 'node:events';
import { stripVTControlCharacters } from 'node:util';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpinnerResult } from '@clack/prompts';
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
const { rest, columns } = getGlobeFrames();
const restingLogo = paintFrame(rest, columns, false).join('\n');

beforeEach(() => {
  vi.useFakeTimers();
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
    const create = (): SpinnerResult => ({
      start: (msg) => void calls.push(`start ${msg}`),
      message: (msg) => void calls.push(`message ${msg}`),
      stop: (msg) => void calls.push(`stop ${msg}`),
      isCancelled: false,
    });
    const spinner = banner.spinner(create);
    spinner.start('Fetching project');
    await vi.advanceTimersByTimeAsync(4000);
    spinner.stop('Fetched project');
    await vi.advanceTimersByTimeAsync(4000);

    expect(banner.isAnimating()).toBe(true);
    expect(plain(terminal.output)).toContain('Fetching project');
    expect(calls).toEqual([]);

    const landed = banner.settle();
    await vi.advanceTimersByTimeAsync(4000);
    await landed;
    expect(calls).toEqual(['start Fetching project', 'stop Fetched project']);
  });

  it('shows progress notes under the globe and lands within 10 seconds', async () => {
    const { banner, terminal } = setup();
    const printed: string[] = [];
    banner.note('Files found in project:\n- en/common.json', () =>
      printed.push('files')
    );
    await vi.advanceTimersByTimeAsync(9000);

    expect(banner.isAnimating()).toBe(true);
    expect(plain(terminal.output)).toContain('Files found in project:');
    expect(plain(terminal.output)).not.toContain('en/common.json');
    expect(printed).toEqual([]);

    await vi.advanceTimersByTimeAsync(5000);
    expect(banner.isAnimating()).toBe(false);
    expect(printed).toEqual(['files']);
  });

  it('stops redrawing and releases held output when the window resizes', () => {
    const { banner, stream, terminal } = setup();
    stream.write('held\n');
    terminal.emit('resize');

    expect(banner.isAnimating()).toBe(false);
    expect(terminal.output.endsWith('held\n')).toBe(true);
  });
});
