import fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@clack/prompts', () => ({
  log: {
    message: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    step: vi.fn(),
  },
  spinner: vi.fn(),
  progress: vi.fn(),
  intro: vi.fn(),
  outro: vi.fn(),
}));

// The agent format writes synchronously, so capturing writeSync on the
// console descriptors records every line in order.
function spyConsoleWrites(): Array<[number, string]> {
  const writes: Array<[number, string]> = [];
  const realWriteSync = fs.writeSync;
  vi.spyOn(fs, 'writeSync').mockImplementation(((
    fd: number,
    data: string | Uint8Array,
    ...rest: unknown[]
  ) => {
    if (fd > 2) return (realWriteSync as Function)(fd, data, ...rest);
    writes.push([fd, String(data)]);
    return Buffer.byteLength(String(data));
  }) as typeof fs.writeSync);
  // The JSON format writes asynchronously; keep it off the test output.
  const realWrite = fs.write;
  vi.spyOn(fs, 'write').mockImplementation(((
    fd: number,
    data: string | Uint8Array,
    ...rest: unknown[]
  ) => {
    if (fd > 2) return (realWrite as Function)(fd, data, ...rest);
    const callback = rest.at(-1);
    if (typeof callback === 'function')
      callback(null, Buffer.byteLength(String(data)));
  }) as typeof fs.write);
  return writes;
}

function linesOn(writes: Array<[number, string]>, fd: number): string[] {
  return writes
    .filter(([writeFd]) => writeFd === fd)
    .flatMap(([, data]) => data.split('\n').filter(Boolean));
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv('GT_LOG_LEVEL', '');
  vi.stubEnv('GT_LOG_FILE', '');
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('displayHeader banner', () => {
  it.each(['json', 'agent'])(
    'does not print the ASCII banner in %s format',
    async (format) => {
      vi.stubEnv('GT_LOG_FORMAT', format);
      spyConsoleWrites();
      const { displayHeader } = await import('../logging.js');
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      displayHeader('Doing a thing...');

      expect(logSpy).not.toHaveBeenCalled();
    }
  );
});

describe('agent log format', () => {
  beforeEach(() => {
    vi.stubEnv('GT_LOG_FORMAT', 'agent');
  });

  it('writes timestamped plain-text lines without ANSI styling', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 23, 15, 21, 15, 1));
    const writes = spyConsoleWrites();
    const { logger } = await import('../logger.js');

    logger.info('Marking stalled queue jobs...');
    logger.success('\x1B[36mFound 0 retryable jobs\x1B[39m');
    logger.error('Something broke');

    expect(linesOn(writes, 1)).toEqual([
      '[2026-10-23 15:21:15] INFO: Marking stalled queue jobs...',
      '[2026-10-23 15:21:15] INFO: Found 0 retryable jobs',
      '[2026-10-23 15:21:15] ERROR: Something broke',
    ]);
  });

  it('honors GT_LOG_LEVEL and the quiet floor', async () => {
    vi.stubEnv('GT_LOG_LEVEL', 'debug');
    const writes = spyConsoleWrites();
    const { logger } = await import('../logger.js');

    logger.trace('a trace');
    logger.debug('a debug');
    logger.setQuiet(true);
    logger.info('an info');
    logger.warn('a warning');

    expect(linesOn(writes, 1)).toEqual([
      expect.stringMatching(/\] DEBUG: a debug$/),
      expect.stringMatching(/\] WARN: a warning$/),
    ]);
  });

  it('follows setConsoleOutput()', async () => {
    const writes = spyConsoleWrites();
    const { logger } = await import('../logger.js');

    logger.setConsoleOutput('stderr');
    logger.info('on stderr');
    logger.setConsoleOutput('stdout');
    logger.info('on stdout');

    expect(linesOn(writes, 2)).toEqual([expect.stringMatching(/on stderr$/)]);
    expect(linesOn(writes, 1)).toEqual([expect.stringMatching(/on stdout$/)]);
  });
});

describe('default log format selection', () => {
  let stdoutIsTTY: boolean | undefined;

  beforeEach(() => {
    vi.stubEnv('GT_LOG_FORMAT', '');
    vi.stubEnv('CI', '');
    stdoutIsTTY = process.stdout.isTTY;
  });

  afterEach(() => {
    process.stdout.isTTY = stdoutIsTTY as boolean;
  });

  it('uses the interactive format in a terminal', async () => {
    process.stdout.isTTY = true;
    const { logger } = await import('../logger.js');
    expect(logger.getLogFormat()).toBe('default');
  });

  it('uses the agent format when stdout is not a TTY', async () => {
    process.stdout.isTTY = false;
    const { logger } = await import('../logger.js');
    expect(logger.getLogFormat()).toBe('agent');
  });

  it.each(['true', '1'])(
    'uses the agent format in CI (CI=%s) even in a terminal',
    async (ci) => {
      vi.stubEnv('CI', ci);
      process.stdout.isTTY = true;
      const { logger } = await import('../logger.js');
      expect(logger.getLogFormat()).toBe('agent');
    }
  );

  it('ignores CI=false', async () => {
    vi.stubEnv('CI', 'false');
    process.stdout.isTTY = true;
    const { logger } = await import('../logger.js');
    expect(logger.getLogFormat()).toBe('default');
  });

  it('lets an explicit GT_LOG_FORMAT win', async () => {
    vi.stubEnv('GT_LOG_FORMAT', 'default');
    vi.stubEnv('CI', 'true');
    process.stdout.isTTY = false;
    const { logger } = await import('../logger.js');
    expect(logger.getLogFormat()).toBe('default');
  });
});
