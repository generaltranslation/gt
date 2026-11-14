import chalk from 'chalk';
import { Command } from 'commander';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Settings } from '../../types/index.js';

// Every command here runs through the real Commander program; settings, the
// API client, sign-in and console output are mocked.
vi.mock('../../config/generateSettings.js', () => ({
  generateSettings: vi.fn(),
}));
vi.mock('../../config/resolveConfig.js', () => ({
  resolveConfig: vi.fn(),
}));
const api = vi.hoisted(() => ({
  queryJobs: vi.fn(),
  createOrgApiKey: vi.fn(),
  createProject: vi.fn(),
  createProjectApiKey: vi.fn(),
}));
vi.mock('generaltranslation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('generaltranslation')>()),
  GeneralTranslation: (await import('./forwardingGT.js')).forwardingGT(api),
}));
vi.mock('../../auth/oauth.js', () => ({
  login: vi.fn(),
  logout: vi.fn(),
  whoAmI: vi.fn(),
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
vi.mock('../commands/download.js', () => ({
  handleDownload: vi.fn(),
}));
vi.mock('../commands/translate.js', () => ({
  handleTranslate: vi.fn(),
  postProcessTranslations: vi.fn(),
}));
vi.mock('../../state/recentDownloads.js', () => ({
  getNeedsPostprocessing: vi.fn(),
  clearDownloaded: vi.fn(),
}));
vi.mock('../../utils/splitMintlifyLanguageRefs.js', () => ({
  splitMintlifyLanguageRefs: vi.fn(),
}));
vi.mock('../../utils/sharedStaticAssets.js', () => ({
  default: vi.fn(),
  mirrorAssetsToLocales: vi.fn(),
}));
vi.mock('../../console/displayTranslateSummary.js', () => ({
  displayTranslateSummary: vi.fn(),
}));

import { GeneralTranslation } from 'generaltranslation';
import { UserAuthError } from '../../auth/errors.js';
import { login } from '../../auth/oauth.js';
import { generateSettings } from '../../config/generateSettings.js';
import { resolveConfig } from '../../config/resolveConfig.js';
import { displayTranslateSummary } from '../../console/displayTranslateSummary.js';
import { logger } from '../../console/logger.js';
import {
  clearDownloaded,
  getNeedsPostprocessing,
} from '../../state/recentDownloads.js';
import { mirrorAssetsToLocales } from '../../utils/sharedStaticAssets.js';
import { splitMintlifyLanguageRefs } from '../../utils/splitMintlifyLanguageRefs.js';
import { BaseCLI } from '../base.js';
import { handleDownload } from '../commands/download.js';
import { postProcessTranslations } from '../commands/translate.js';

const settings = {
  apiKey: 'gtx-api-key',
  projectId: 'project-id',
} as Settings;

function createProgram(): Command {
  const program = new Command().exitOverride();
  program.configureOutput({ writeErr: vi.fn(), writeOut: vi.fn() });
  new BaseCLI(program, 'base');
  return program;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(generateSettings).mockResolvedValue(settings);
});

const SECRET = 'gtx-api-new-secret-key';

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
    vi.mocked(api.createProjectApiKey).mockResolvedValue({
      id: 'key-id',
      name: 'CI',
      key: SECRET,
      permissions: ['project:files:read'],
      createdAt: '2026-01-01T00:00:00.000Z',
      lastUsedAt: null,
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
      /argument 'org:admin' is invalid\. Allowed choices are org:projects:create, .*project:translations:enqueue\./,
    ],
    [
      [
        '--name',
        'CI',
        '--permission',
        'project:files:read',
        'org:context:read',
        'project:api_keys:write',
      ],
      'org:context:read, project:api_keys:write can only be granted to organization API keys. Pass --org-id, or remove those permissions.',
    ],
  ])('rejects %j before any request', async (args, message) => {
    await expect(run(args)).rejects.toThrow(message);
    expect(generateSettings).not.toHaveBeenCalled();
    expect(api.createProjectApiKey).not.toHaveBeenCalled();
    expect(stdout).not.toHaveBeenCalled();
  });

  it('creates an org key with --org-id using the signed-in user, not a configured API key', async () => {
    const userTokenProvider = {
      getAccessToken: vi.fn(),
      refreshAccessToken: vi.fn(),
    };
    vi.mocked(generateSettings).mockResolvedValue({
      apiKey: 'gtx-api-key',
      baseUrl: 'https://api.example.com',
      userTokenProvider,
    } as unknown as Settings);
    vi.mocked(api.createOrgApiKey).mockResolvedValue({
      id: 'key-id',
      name: 'CI',
      key: SECRET,
      permissions: ['org:context:read'],
      createdAt: '2026-01-01T00:00:00.000Z',
      lastUsedAt: null,
    });

    await run([
      '--name',
      'CI',
      '--org-id',
      'org-1',
      '--permission',
      'org:context:read',
      'project:files:read',
    ]);

    expect(GeneralTranslation).toHaveBeenCalledTimes(1);
    expect(GeneralTranslation).toHaveBeenCalledWith({
      baseUrl: 'https://api.example.com',
      userTokenProvider,
      localeConfig: {},
    });
    expect(api.createOrgApiKey).toHaveBeenCalledWith('org-1', {
      name: 'CI',
      permissions: ['org:context:read', 'project:files:read'],
    });
    expect(api.createProjectApiKey).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
    expect(stdout).toHaveBeenCalledTimes(1);
    expect(stdout).toHaveBeenCalledWith(`${SECRET}\n`);
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

describe('project commands', () => {
  it('creates a project in the requested organization without a project ID', async () => {
    vi.mocked(generateSettings).mockResolvedValue({
      apiKey: 'gtx-organization-key',
    } as Settings);
    vi.mocked(api.createProject).mockResolvedValue({
      id: 'new-project-id',
      name: 'Project',
      orgId: 'org-id',
      defaultLocale: 'en',
      currentLocales: [],
      autoApprove: false,
      cdnEnabled: false,
    });

    await createProgram().parseAsync(
      [
        'project',
        'create',
        '--org-id',
        'org-id',
        '--name',
        'Project',
        '--default-locale',
        'en',
        '--cdn-enabled',
      ],
      { from: 'user' }
    );

    expect(api.createProject).toHaveBeenCalledWith('org-id', {
      name: 'Project',
      defaultLocale: 'en',
      cdnEnabled: true,
    });
    expect(logger.info).toHaveBeenCalledWith(
      'Created Project (new-project-id)'
    );
  });

  it('requires an organization ID before creating a project', async () => {
    await expect(
      createProgram().parseAsync(
        ['project', 'create', '--name', 'Project', '--default-locale', 'en'],
        { from: 'user' }
      )
    ).rejects.toThrow("required option '--org-id <orgId>' not specified");
    expect(generateSettings).not.toHaveBeenCalled();
    expect(api.createProject).not.toHaveBeenCalled();
  });

  it('explains that a project API key cannot create projects before any request', async () => {
    vi.mocked(generateSettings).mockResolvedValue({
      apiKey: 'gtx-api-project-key',
    } as Settings);

    await expect(
      createProgram().parseAsync(
        [
          'project',
          'create',
          '--org-id',
          'org-id',
          '--name',
          'Project',
          '--default-locale',
          'en',
        ],
        { from: 'user' }
      )
    ).rejects.toThrow(
      /project API key, which cannot create projects[\s\S]*Organization API key with org:projects:create[\s\S]*sign in/
    );
    expect(api.createProject).not.toHaveBeenCalled();
  });

  it('formats project creation failures instead of leaking a rejection', async () => {
    // Organization keys create the project before a project ID exists.
    vi.mocked(generateSettings).mockResolvedValue({
      apiKey: 'gtx-organization-key',
    } as Settings);
    vi.mocked(api.createProject).mockRejectedValue(
      new Error('upstream denied')
    );

    await expect(
      createProgram().parseAsync(
        [
          'project',
          'create',
          '--org-id',
          'org-id',
          '--name',
          'Project',
          '--default-locale',
          'en',
        ],
        { from: 'user' }
      )
    ).rejects.toThrow(/Failed to create the project[\s\S]*upstream denied/);
  });

  it.each(['processing', 'not_found'] as const)(
    'prints the %s status of a project setup job',
    async (status) => {
      vi.mocked(api.queryJobs).mockResolvedValue({
        results: [{ id: 'job-id', status }],
      });

      await createProgram().parseAsync(['project', 'status', 'job-id'], {
        from: 'user',
      });

      expect(api.queryJobs).toHaveBeenCalledWith(['job-id']);
      expect(logger.info).toHaveBeenCalledWith(status);
    }
  );

  it('formats project status failures instead of leaking a rejection', async () => {
    vi.mocked(api.queryJobs).mockRejectedValue(new Error('status unavailable'));

    await expect(
      createProgram().parseAsync(['project', 'status', 'job-id'], {
        from: 'user',
      })
    ).rejects.toThrow(
      /Failed to check the project setup status[\s\S]*status unavailable/
    );
  });
});

const verificationUri = 'https://auth.example/device';
const verificationUriComplete = `${verificationUri}?user_code=ABCD-EFGH`;

describe('login device prompt', () => {
  it.each([true, false])(
    'prints the prefilled URL when browser=%s',
    async (browser) => {
      vi.mocked(login).mockImplementation(async (options = {}) => {
        options.onDeviceCode?.({
          userCode: 'ABCD-EFGH',
          verificationUri,
          verificationUriComplete,
        });
      });
      await createProgram().parseAsync(
        browser ? ['login'] : ['login', '--no-browser'],
        {
          from: 'user',
        }
      );
      expect(login).toHaveBeenCalledWith(
        expect.objectContaining({ noBrowser: !browser })
      );
      expect(logger.message).toHaveBeenCalledWith(
        expect.stringContaining(`\n${chalk.cyan(verificationUriComplete)}\n`)
      );
      expect(logger.message).not.toHaveBeenCalledWith(
        expect.stringContaining('confirm the code')
      );
      expect(logger.message).not.toHaveBeenCalledWith(
        expect.stringContaining('Opening your browser')
      );
      expect(logger.message).toHaveBeenCalledWith(
        expect.stringContaining('Waiting for authentication...')
      );
      expect(logger.endCommand).toHaveBeenCalledWith('You are now signed in.');
    }
  );

  it('falls back to the plain URL and code when no prefilled URL is supplied', async () => {
    vi.mocked(login).mockImplementation(async (options = {}) => {
      options.onDeviceCode?.({ userCode: 'ABCD-EFGH', verificationUri });
    });
    await createProgram().parseAsync(['login', '--no-browser'], {
      from: 'user',
    });
    expect(logger.message).toHaveBeenCalledWith(
      expect.stringContaining(`\n${chalk.cyan(verificationUri)}\n`)
    );
    expect(logger.message).toHaveBeenCalledWith(
      expect.stringContaining('enter the code')
    );
    expect(logger.message).toHaveBeenCalledWith(
      expect.stringContaining('ABCD-EFGH')
    );
  });

  it('signs in to the baseUrl of an explicit --config', async () => {
    const dir = fs.mkdtempSync(path.join(tmpdir(), 'gt-login-config-'));
    const configPath = path.join(dir, 'gt.config.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({ baseUrl: 'https://api.example' })
    );
    try {
      await createProgram().parseAsync(['login', '--config', configPath], {
        from: 'user',
      });
      expect(login).toHaveBeenCalledWith(
        expect.objectContaining({ baseUrl: 'https://api.example' })
      );
      expect(resolveConfig).not.toHaveBeenCalled();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('gt download', () => {
  const settings = { stageTranslations: true, files: {} };

  function createProgram(): Command {
    const program = new Command();
    new BaseCLI(program, 'gt-react').init();
    return program;
  }

  beforeEach(() => {
    vi.mocked(generateSettings).mockResolvedValue(settings as never);
  });

  it('postprocesses the files it downloaded, like translate does', async () => {
    const downloaded = new Set(['docs/es/index.mdx']);
    vi.mocked(getNeedsPostprocessing).mockReturnValue(downloaded);

    await createProgram().parseAsync(['download'], { from: 'user' });

    expect(handleDownload).toHaveBeenCalledOnce();
    expect(postProcessTranslations).toHaveBeenCalledWith(settings, downloaded);
    expect(splitMintlifyLanguageRefs).toHaveBeenCalledWith(settings);
    expect(mirrorAssetsToLocales).toHaveBeenCalledWith(settings);
    expect(displayTranslateSummary).toHaveBeenCalledOnce();
    expect(clearDownloaded).toHaveBeenCalledOnce();
  });

  it('skips postprocessing when nothing was downloaded', async () => {
    vi.mocked(getNeedsPostprocessing).mockReturnValue(new Set());

    await createProgram().parseAsync(['download'], { from: 'user' });

    expect(handleDownload).toHaveBeenCalledOnce();
    expect(postProcessTranslations).not.toHaveBeenCalled();
    expect(mirrorAssetsToLocales).toHaveBeenCalledWith(settings);
  });
});
