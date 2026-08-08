import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ESC = String.fromCharCode(27);
// Spinner animation frame glyphs used by @clack/prompts (◒◐◓◑).
const FRAME_GLYPHS = ['◒', '◐', '◓', '◑'];

// Regression test: when stdout is not a TTY (e.g. `gt migrate | cat`),
// createSpinner must not stream @clack/prompts animation frames or
// cursor-control escapes ([?25l, [1G, [J) into the pipe. It should emit a
// single plain start line and a single completion line.
describe('logger.createSpinner in non-TTY output', () => {
  const originalIsTTY = process.stdout.isTTY;
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    delete process.env.GT_LOG_FORMAT;
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    Object.defineProperty(process.stdout, 'isTTY', {
      value: originalIsTTY,
      configurable: true,
    });
    writeSpy.mockRestore();
    vi.restoreAllMocks();
  });

  function setIsTTY(value: boolean | undefined) {
    Object.defineProperty(process.stdout, 'isTTY', {
      value,
      configurable: true,
    });
  }

  function joinWrites(): string {
    return writeSpy.mock.calls.map((call) => String(call[0])).join('');
  }

  it('emits plain start/completion lines with no frames or cursor escapes', async () => {
    setIsTTY(undefined);
    const { logger } = await import('../logger.js');

    const spinner = logger.createSpinner('timer');
    spinner.start('Installing gt-next with npm...');
    spinner.message('still installing');
    spinner.stop('Installed gt-next.');

    const output = joinWrites();

    expect(output).toContain('Installing gt-next with npm...');
    expect(output).toContain('Installed gt-next.');
    // No ESC/CSI escape sequences (cursor hide/move/erase, colors, etc.).
    expect(output.includes(ESC)).toBe(false);
    // No spinner animation frame glyphs.
    for (const glyph of FRAME_GLYPHS) {
      expect(output.includes(glyph)).toBe(false);
    }
    // message() must not emit an extra line.
    expect(output).not.toContain('still installing');
  });

  it('preserves the SpinnerResult API surface in non-TTY mode', async () => {
    setIsTTY(false);
    const { logger } = await import('../logger.js');

    const spinner = logger.createSpinner();
    expect(typeof spinner.start).toBe('function');
    expect(typeof spinner.stop).toBe('function');
    expect(typeof spinner.message).toBe('function');
    expect(spinner.isCancelled).toBe(false);
  });

  it('falls back to the stored message when stop is called without one', async () => {
    setIsTTY(false);
    const { logger } = await import('../logger.js');

    const spinner = logger.createSpinner('dots');
    spinner.start('Working...');
    spinner.stop();

    // start line + completion line reusing the stored message.
    expect(joinWrites()).toBe('Working...\nWorking...\n');
  });
});

// Regression test: createProgressBar has the same non-TTY hazard as
// createSpinner. `gt translate`'s poll/download steps drive a progress bar, and
// @clack/prompts' animated bar streams a frame plus cursor escapes on every
// advance — noise when stdout is piped. Non-TTY 'default' output must emit only
// a plain start line and a plain completion line, advancing silently.
describe('logger.createProgressBar in non-TTY output', () => {
  const originalIsTTY = process.stdout.isTTY;
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    delete process.env.GT_LOG_FORMAT;
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    Object.defineProperty(process.stdout, 'isTTY', {
      value: originalIsTTY,
      configurable: true,
    });
    writeSpy.mockRestore();
    vi.restoreAllMocks();
  });

  function setIsTTY(value: boolean | undefined) {
    Object.defineProperty(process.stdout, 'isTTY', {
      value,
      configurable: true,
    });
  }

  function joinWrites(): string {
    return writeSpy.mock.calls.map((call) => String(call[0])).join('');
  }

  it('emits plain start/completion lines, advancing silently with no escapes', async () => {
    setIsTTY(undefined);
    const { logger } = await import('../logger.js');

    const bar = logger.createProgressBar(3);
    bar.start('Downloading files...');
    bar.advance(1, 'downloaded a.json');
    bar.advance(1, 'downloaded b.json');
    bar.message('almost there');
    bar.stop('Downloaded 3 files.');

    const output = joinWrites();

    expect(output).toContain('Downloading files...');
    expect(output).toContain('Downloaded 3 files.');
    // No ESC/CSI escape sequences (cursor hide/move/erase, colors, etc.).
    expect(output.includes(ESC)).toBe(false);
    // No spinner/progress animation frame glyphs.
    for (const glyph of FRAME_GLYPHS) {
      expect(output.includes(glyph)).toBe(false);
    }
    // Per-advance and message() updates must not emit their own lines.
    expect(output).not.toContain('downloaded a.json');
    expect(output).not.toContain('downloaded b.json');
    expect(output).not.toContain('almost there');
  });

  it('preserves the ProgressResult API surface in non-TTY mode', async () => {
    setIsTTY(false);
    const { logger } = await import('../logger.js');

    const bar = logger.createProgressBar(5);
    expect(typeof bar.start).toBe('function');
    expect(typeof bar.stop).toBe('function');
    expect(typeof bar.message).toBe('function');
    expect(typeof bar.advance).toBe('function');
    expect(bar.isCancelled).toBe(false);
  });

  it('falls back to the latest advanced status when stop is called without one', async () => {
    setIsTTY(false);
    const { logger } = await import('../logger.js');

    const bar = logger.createProgressBar(2);
    bar.start('Downloading...');
    bar.advance(1, 'file 1 of 2');
    bar.stop();

    // start line + completion line reusing the most recent advance status.
    expect(joinWrites()).toBe('Downloading...\nfile 1 of 2\n');
  });
});
