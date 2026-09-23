import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Settings } from '../../types/index.js';

vi.mock('../../config/generateSettings.js', () => ({
  generateSettings: vi.fn(),
}));

vi.mock('../../utils/api.js', () => ({
  api: {
    createProjectApiKey: vi.fn(),
  },
}));

vi.mock('../../console/logging.js', () => ({
  displayHeader: vi.fn(),
  exitSync: vi.fn((code: number) => {
    throw new Error(`exit ${code}`);
  }),
  logErrorAndExit: vi.fn((message: string) => {
    throw new Error(message);
  }),
  promptConfirm: vi.fn(),
  promptGlobPatterns: vi.fn(),
  promptMultiSelect: vi.fn(),
  promptSelect: vi.fn(),
  promptText: vi.fn(),
}));

vi.mock('../../console/logger.js', () => ({
  logger: {
    endCommand: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    message: vi.fn(),
    success: vi.fn(),
    setQuiet: vi.fn(),
    setConsoleOutput: vi.fn(),
  },
}));

import { BaseCLI } from '../base.js';
import { UserAuthError } from '../../auth/errors.js';
import { generateSettings } from '../../config/generateSettings.js';
import { api } from '../../utils/api.js';
import { logger } from '../../console/logger.js';

const settings = {
  apiKey: 'gtx-api-key',
  projectId: 'project-id',
} as Settings;

const SECRET = 'gtx-api-new-secret-key';

function createProgram(): Command {
  const program = new Command().exitOverride();
  program.configureOutput({ writeErr: vi.fn(), writeOut: vi.fn() });
  new BaseCLI(program, 'base');
  return program;
}

function run(args: string[]) {
  return createProgram().parseAsync(['api-key', 'create', ...args], {
    from: 'user',
  });
}

describe('api-key create', () => {
  let stdout: ReturnType<typeof vi.spyOn>;
  let appDirectory: string;
  const originalCwd = process.cwd();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateSettings).mockResolvedValue(settings);
    vi.mocked(api.createProjectApiKey).mockResolvedValue({
      apiKey: {
        id: 'key-id',
        name: 'CI',
        key: SECRET,
        projectId: 'project-id',
        type: 'production',
      },
    });
    stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    appDirectory = fs.mkdtempSync(path.join(tmpdir(), 'gt-api-key-'));
    process.chdir(appDirectory);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    stdout.mockRestore();
    fs.rmSync(appDirectory, { recursive: true, force: true });
  });

  it('is registered as a nested command and gt auth is gone', () => {
    const names = createProgram().commands.map((command) => command.name());
    expect(names).toContain('api-key');
    expect(names).not.toContain('auth');
  });

  it('creates a key with exactly the requested permissions and prints the secret once', async () => {
    await run([
      '--name',
      'CI',
      '--permission',
      'project:files:read',
      'project:files:write',
      '--permission',
      'project:translations:enqueue',
    ]);

    expect(api.createProjectApiKey).toHaveBeenCalledTimes(1);
    expect(api.createProjectApiKey).toHaveBeenCalledWith('project-id', {
      name: 'CI',
      permissions: [
        'project:files:read',
        'project:files:write',
        'project:translations:enqueue',
      ],
    });
    expect(stdout).toHaveBeenCalledTimes(1);
    expect(stdout).toHaveBeenCalledWith(`${SECRET}\n`);
    // Console diagnostics move to stderr before settings can log anything.
    expect(logger.setConsoleOutput).toHaveBeenCalledWith('stderr');
    expect(
      vi.mocked(logger.setConsoleOutput).mock.invocationCallOrder[0]
    ).toBeLessThan(vi.mocked(generateSettings).mock.invocationCallOrder[0]);
    // The secret never goes through the logger (and so never into a log file).
    for (const call of Object.values(logger)) {
      expect(JSON.stringify(vi.mocked(call).mock.calls)).not.toContain(SECRET);
    }
    expect(fs.readdirSync(appDirectory)).toEqual([]);
  });

  it('honors the resolved project and key settings', async () => {
    await run([
      '--name',
      'CI',
      '--permission',
      'project:files:read',
      '--project-id',
      'flag-project',
      '--api-key',
      'gtx-flag-key',
    ]);

    expect(generateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'flag-project',
        apiKey: 'gtx-flag-key',
      })
    );
  });

  it.each([
    [[], "required option '--name <name>' not specified"],
    [
      ['--name', 'CI'],
      "required option '--permission <permissions...>' not specified",
    ],
    [
      ['--name', '   ', '--permission', 'project:files:read'],
      'The key name cannot be empty. Pass a non-empty value with --name.',
    ],
    [
      ['--name', 'CI', '--permission', 'project:files:read', 'org:admin'],
      /argument 'org:admin' is invalid\. Allowed choices are project:write, .*project:translations:enqueue\./,
    ],
  ])('rejects %j before any request', async (args, message) => {
    await expect(run(args)).rejects.toThrow(message);
    expect(generateSettings).not.toHaveBeenCalled();
    expect(api.createProjectApiKey).not.toHaveBeenCalled();
    expect(stdout).not.toHaveBeenCalled();
  });

  it('requires a project ID before creating a key', async () => {
    vi.mocked(generateSettings).mockResolvedValue({
      apiKey: 'gtx-api-key',
    } as Settings);

    await expect(
      run(['--name', 'CI', '--permission', 'project:files:read'])
    ).rejects.toThrow('exit 1');
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(api.createProjectApiKey).not.toHaveBeenCalled();
    expect(stdout).not.toHaveBeenCalled();
  });

  it('formats API failures and prints nothing to stdout', async () => {
    vi.mocked(api.createProjectApiKey).mockRejectedValue(
      new Error('Insufficient permissions')
    );

    await expect(
      run(['--name', 'CI', '--permission', 'project:write'])
    ).rejects.toThrow(
      /Failed to create the API key[\s\S]*Insufficient permissions/
    );
    expect(stdout).not.toHaveBeenCalled();
    expect(fs.readdirSync(appDirectory)).toEqual([]);
  });

  it('surfaces a login problem as-is instead of falling back', async () => {
    vi.mocked(api.createProjectApiKey).mockRejectedValue(
      new UserAuthError('login_required', 'Sign in first', 'Run `gt login`')
    );

    await expect(
      run(['--name', 'CI', '--permission', 'project:write'])
    ).rejects.toThrow(/Sign in first/);
    expect(stdout).not.toHaveBeenCalled();
  });
});
