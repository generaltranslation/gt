import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

// Mock @clack/prompts so we can assert exactly which chatter reaches the
// human (default-format) output path.
const clack = vi.hoisted(() => ({
  text: vi.fn(),
  select: vi.fn(),
  confirm: vi.fn(),
  multiselect: vi.fn(),
  isCancel: vi.fn(() => false),
  cancel: vi.fn(),
  log: {
    message: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    step: vi.fn(),
  },
  spinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    message: vi.fn(),
    isCancelled: false,
  })),
  progress: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    message: vi.fn(),
    advance: vi.fn(),
    isCancelled: false,
  })),
  intro: vi.fn(),
  outro: vi.fn(),
}));

vi.mock('@clack/prompts', () => clack);

// Mock pino so we can inspect the level the JSON console logger is created
// with and the level --quiet forces it to.
const pinoState = vi.hoisted(() => ({
  instances: [] as Array<{ level?: string; info: Mock }>,
  optionsLog: [] as Array<{ level?: string }>,
}));

const pinoMock = vi.hoisted(() => {
  const makeInstance = (opts?: { level?: string }) => {
    const inst = {
      level: opts?.level,
      trace: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      fatal: vi.fn(),
      silent: vi.fn(),
      flush: vi.fn(),
    };
    return inst;
  };
  const pino = vi.fn((opts?: { level?: string }) => {
    pinoState.optionsLog.push({ level: opts?.level });
    const inst = makeInstance(opts);
    pinoState.instances.push(inst);
    return inst;
  });
  return { pino, destination: vi.fn(() => ({})) };
});

vi.mock('pino', () => pinoMock);

function resetPinoState() {
  pinoState.instances.length = 0;
  pinoState.optionsLog.length = 0;
}

describe('quiet flag: clack chatter gating (default format)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    resetPinoState();
    vi.stubEnv('GT_LOG_FORMAT', 'default');
    vi.stubEnv('GT_LOG_LEVEL', '');
    vi.stubEnv('GT_LOG_FILE', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('suppresses info/step/success/message chatter under quiet', async () => {
    const { logger } = await import('../logger.js');
    logger.setQuiet(true);

    logger.info('an info');
    logger.step('a step');
    logger.success('a success');
    logger.message('a message');
    logger.debug('a debug');
    logger.startCommand('start');
    logger.endCommand('end');

    expect(clack.log.info).not.toHaveBeenCalled();
    expect(clack.log.step).not.toHaveBeenCalled();
    expect(clack.log.success).not.toHaveBeenCalled();
    expect(clack.log.message).not.toHaveBeenCalled();
    expect(clack.intro).not.toHaveBeenCalled();
    expect(clack.outro).not.toHaveBeenCalled();
  });

  it('still emits warnings and errors under quiet', async () => {
    const { logger } = await import('../logger.js');
    logger.setQuiet(true);

    logger.warn('a warning');
    logger.error('an error');

    expect(clack.log.warn).toHaveBeenCalledWith('a warning');
    expect(clack.log.error).toHaveBeenCalledWith('an error');
  });

  it('emits chatter normally when not quiet', async () => {
    const { logger } = await import('../logger.js');

    logger.info('an info');
    logger.step('a step');
    logger.success('a success');

    expect(clack.log.info).toHaveBeenCalledWith('an info');
    expect(clack.log.step).toHaveBeenCalledWith('a step');
    expect(clack.log.success).toHaveBeenCalledWith('a success');
  });

  it('returns a silent spinner that emits nothing under quiet', async () => {
    const { logger } = await import('../logger.js');
    logger.setQuiet(true);

    const sp = logger.createSpinner();
    sp.start('working');
    sp.message('still working');
    sp.stop('done');

    expect(clack.spinner).not.toHaveBeenCalled();
    expect(clack.log.info).not.toHaveBeenCalled();
  });

  it('reports quiet state via isQuiet()', async () => {
    const { logger } = await import('../logger.js');
    expect(logger.isQuiet()).toBe(false);
    logger.setQuiet(true);
    expect(logger.isQuiet()).toBe(true);
  });
});

describe('quiet flag: displayHeader banner gating (default format)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    resetPinoState();
    vi.stubEnv('GT_LOG_FORMAT', 'default');
    vi.stubEnv('GT_LOG_LEVEL', '');
    vi.stubEnv('GT_LOG_FILE', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('prints the ASCII banner when not quiet but nothing when quiet', async () => {
    const { logger } = await import('../logger.js');
    const { displayHeader } = await import('../logging.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    displayHeader('Doing a thing...');
    expect(logSpy).toHaveBeenCalled();

    logSpy.mockClear();
    logger.setQuiet(true);
    displayHeader('Doing a thing...');
    expect(logSpy).not.toHaveBeenCalled();

    logSpy.mockRestore();
  });

  it('still writes the [START] file-log marker under quiet', async () => {
    vi.stubEnv('GT_LOG_FILE', '/tmp/gt-quiet-marker-test.log');
    const { logger } = await import('../logger.js');
    const { displayHeader } = await import('../logging.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    logger.setQuiet(true);
    displayHeader('Doing a thing...');

    // Console stays silent: no banner, no clack intro.
    expect(logSpy).not.toHaveBeenCalled();
    expect(clack.intro).not.toHaveBeenCalled();
    // But the file log still gets its [START] marker, so [END] from
    // endCommand never appears unpaired.
    const fileInfoCalls = pinoState.instances.flatMap((inst) =>
      inst.info.mock.calls.map((call) => call[0])
    );
    expect(fileInfoCalls).toContain('[START] Doing a thing...');

    logSpy.mockRestore();
  });
});

describe('quiet flag: pino level gating (json format)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    resetPinoState();
    vi.stubEnv('GT_LOG_FORMAT', 'json');
    vi.stubEnv('GT_LOG_FILE', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('honors GT_LOG_LEVEL when constructing the console logger', async () => {
    vi.stubEnv('GT_LOG_LEVEL', 'debug');
    await import('../logger.js');
    expect(pinoState.optionsLog[0]?.level).toBe('debug');
  });

  it('raises the pino level to warn under quiet (quiet wins over GT_LOG_LEVEL=debug)', async () => {
    vi.stubEnv('GT_LOG_LEVEL', 'debug');
    const { logger } = await import('../logger.js');
    expect(pinoState.instances[0]?.level).toBe('debug');
    logger.setQuiet(true);
    expect(pinoState.instances[0]?.level).toBe('warn');
  });

  it('defaults to info then warn under quiet when GT_LOG_LEVEL is unset', async () => {
    vi.stubEnv('GT_LOG_LEVEL', '');
    const { logger } = await import('../logger.js');
    expect(pinoState.instances[0]?.level).toBe('info');
    logger.setQuiet(true);
    expect(pinoState.instances[0]?.level).toBe('warn');
  });

  it('does not lower an already-restrictive level (error stays error under quiet)', async () => {
    vi.stubEnv('GT_LOG_LEVEL', 'error');
    const { logger } = await import('../logger.js');
    logger.setQuiet(true);
    expect(pinoState.instances[0]?.level).toBe('error');
  });

  it('still routes warnings and errors to pino under quiet', async () => {
    vi.stubEnv('GT_LOG_LEVEL', 'debug');
    const { logger } = await import('../logger.js');
    logger.setQuiet(true);
    logger.warn('a warning');
    logger.error('an error');
    expect(pinoState.instances[0]?.warn).toHaveBeenCalledWith('a warning');
    expect(pinoState.instances[0]?.error).toHaveBeenCalledWith('an error');
  });
});

describe('quiet flag: parsing (global -q / --quiet)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    resetPinoState();
    vi.stubEnv('GT_LOG_FORMAT', 'default');
    vi.stubEnv('GT_LOG_LEVEL', '');
    vi.stubEnv('GT_LOG_FILE', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  async function buildProgram() {
    const { BaseCLI } = await import('../../cli/base.js');
    const { Libraries } = await import('../../types/libraries.js');
    const { Command } = await import('commander');
    const program = new Command();
    program.name('gt');
    new BaseCLI(program, Libraries.GT_REACT);
    program.exitOverride();
    program.command('noop').action(() => {});
    return program;
  }

  it('registers -q, --quiet on the root program', async () => {
    const program = await buildProgram();
    const opt = program.options.find((o) => o.long === '--quiet');
    expect(opt).toBeTruthy();
    expect(opt?.short).toBe('-q');
  });

  it('parses --quiet before the subcommand', async () => {
    const program = await buildProgram();
    program.parse(['--quiet', 'noop'], { from: 'user' });
    expect(program.opts().quiet).toBe(true);
  });

  it('parses --quiet after the subcommand', async () => {
    const program = await buildProgram();
    program.parse(['noop', '--quiet'], { from: 'user' });
    expect(program.opts().quiet).toBe(true);
  });

  it('parses -q after the subcommand', async () => {
    const program = await buildProgram();
    program.parse(['noop', '-q'], { from: 'user' });
    expect(program.opts().quiet).toBe(true);
  });

  it('leaves quiet unset when the flag is absent', async () => {
    const program = await buildProgram();
    program.parse(['noop'], { from: 'user' });
    expect(program.opts().quiet).toBeFalsy();
  });
});
