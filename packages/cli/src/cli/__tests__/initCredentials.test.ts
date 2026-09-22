import { Command } from 'commander';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../utils/api.js', () => ({
  configureApiClient: vi.fn(),
  api: {
    createProject: vi.fn(),
    createProjectApiKey: vi.fn(),
    listOrgs: vi.fn(),
    listProjects: vi.fn(),
  },
}));
vi.mock('../../auth/oauth.js', () => ({
  createUserTokenProvider: vi.fn(() => ({})),
  hasLogin: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  whoAmI: vi.fn(),
}));
vi.mock('../../setup/detectFramework.js', () => ({
  detectFramework: vi.fn(),
}));
vi.mock('../../setup/userInput.js', () => ({
  getDesiredLocales: vi.fn(async () => ({
    defaultLocale: 'en',
    locales: ['es'],
  })),
}));
vi.mock('../../console/logging.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../console/logging.js')>()),
  displayHeader: vi.fn(),
  exitSync: vi.fn((code: number) => {
    throw new Error(`exit ${code}`);
  }),
  logErrorAndExit: vi.fn((message: string) => {
    throw new Error(message);
  }),
  promptConfirm: vi.fn(),
  promptGlobPatterns: vi.fn(async () => './**/[locale]/*.json'),
  promptMultiSelect: vi.fn(async () => ['json']),
  promptSelect: vi.fn(),
  promptText: vi.fn(),
}));
vi.mock('../../console/logger.js', () => ({
  logger: {
    createSpinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
    debug: vi.fn(),
    endCommand: vi.fn(),
    error: vi.fn(),
    flush: vi.fn(),
    info: vi.fn(),
    message: vi.fn(),
    setQuiet: vi.fn(),
    startCommand: vi.fn(),
    step: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
  },
}));

import { hasLogin, login } from '../../auth/oauth.js';
import { logger } from '../../console/logger.js';
import {
  logErrorAndExit,
  promptConfirm,
  promptSelect,
  promptText,
} from '../../console/logging.js';
import { detectFramework } from '../../setup/detectFramework.js';
import { api } from '../../utils/api.js';
import { BaseCLI } from '../base.js';

const projects = [
  { id: 'p1', name: 'Docs', orgId: 'o1', orgName: 'Acme' },
  { id: 'p2', name: 'App', orgId: 'o1', orgName: 'Acme' },
];
const mintedKey = {
  apiKey: {
    id: 'key-id',
    name: 'Development key (gt init)',
    key: 'gtx-secret-development-key',
    projectId: 'p2',
    type: 'production' as const,
  },
};
const GT_ENV = [
  'GT_API_KEY',
  'GT_PROJECT_ID',
  'GT_DEV_API_KEY',
  'NEXT_PUBLIC_GT_PROJECT_ID',
  'NEXT_PUBLIC_GT_DEV_API_KEY',
  'VITE_GT_PROJECT_ID',
  'VITE_GT_DEV_API_KEY',
];

async function runInit(...args: string[]): Promise<void> {
  const program = new Command().exitOverride();
  new BaseCLI(program, 'base');
  await program.parseAsync(['init', ...args], { from: 'user' });
}

function loggedOutput(): string {
  return [
    ...Object.values(logger).flatMap((fn) => vi.mocked(fn).mock.calls.flat()),
    ...vi.mocked(logErrorAndExit).mock.calls.flat(),
  ].join('\n');
}

describe('init development credentials', () => {
  const originalCwd = process.cwd();
  let appDirectory: string;
  const envPath = () => path.join(appDirectory, '.env.local');

  beforeEach(() => {
    vi.clearAllMocks();
    for (const name of GT_ENV) vi.stubEnv(name, undefined);
    appDirectory = fs.mkdtempSync(path.join(tmpdir(), 'gt-init-credentials-'));
    // oauth.js is fully mocked; sandbox the credential store anyway so no
    // code path can reach the real user's login files.
    vi.stubEnv('XDG_CONFIG_HOME', path.join(appDirectory, 'xdg-config'));
    vi.stubEnv('XDG_STATE_HOME', path.join(appDirectory, 'xdg-state'));
    fs.writeFileSync(
      path.join(appDirectory, 'package.json'),
      JSON.stringify({ name: 'example-app', devDependencies: { gt: '*' } })
    );
    // Setup resolves config paths relative to the real working directory.
    process.chdir(appDirectory);
    vi.mocked(detectFramework).mockResolvedValue({ name: undefined });
    vi.mocked(hasLogin).mockResolvedValue(true);
    vi.mocked(promptConfirm).mockResolvedValue(true); // use defaults
    vi.mocked(api.listProjects).mockResolvedValue(projects);
    vi.mocked(api.createProjectApiKey).mockResolvedValue(mintedKey);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    vi.unstubAllEnvs();
    fs.rmSync(appDirectory, { recursive: true, force: true });
  });

  it('lets a signed-in user pick an existing project without touching organizations', async () => {
    vi.mocked(promptSelect).mockResolvedValueOnce(projects[1]);

    await runInit();

    expect(login).not.toHaveBeenCalled();
    expect(api.listOrgs).not.toHaveBeenCalled();
    expect(api.createProjectApiKey).toHaveBeenCalledTimes(1);
    expect(api.createProjectApiKey).toHaveBeenCalledWith('p2', {
      name: 'Development key (gt init)',
      permissions: ['project:translations:generate'],
    });
    expect(fs.readFileSync(envPath(), 'utf8')).toBe(
      'GT_PROJECT_ID=p2\nGT_DEV_API_KEY=gtx-secret-development-key\n'
    );
    expect(loggedOutput()).not.toContain('gtx-secret-development-key');
    expect(logger.endCommand).toHaveBeenCalledWith(
      expect.stringContaining('Done!')
    );
  });

  it('forwards --config/--src and the detected framework to config and env output', async () => {
    vi.mocked(detectFramework).mockResolvedValue({
      name: 'next-pages',
      type: 'react',
    });
    vi.mocked(promptConfirm)
      .mockResolvedValueOnce(false) // recommended defaults
      .mockResolvedValueOnce(false) // install gt-next
      .mockResolvedValueOnce(true); // set up credentials
    vi.mocked(promptSelect).mockResolvedValueOnce(projects[0]);

    await runInit('--config', 'custom.gt.config.json', '--src', 'src/**/*.tsx');

    const config = JSON.parse(
      fs.readFileSync(path.join(appDirectory, 'custom.gt.config.json'), 'utf8')
    );
    expect(config).toMatchObject({
      defaultLocale: 'en',
      src: ['src/**/*.tsx'],
    });
    expect(fs.existsSync(path.join(appDirectory, 'gt.config.json'))).toBe(
      false
    );
    expect(fs.readFileSync(envPath(), 'utf8')).toBe(
      'NEXT_PUBLIC_GT_PROJECT_ID=p1\nNEXT_PUBLIC_GT_DEV_API_KEY=gtx-secret-development-key\n'
    );
  });

  it('signs in first when no API key or login exists', async () => {
    vi.mocked(hasLogin).mockResolvedValue(false);
    vi.mocked(promptSelect).mockResolvedValueOnce(projects[0]);

    await runInit();

    expect(login).toHaveBeenCalledTimes(1);
    expect(vi.mocked(login).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(api.listProjects).mock.invocationCallOrder[0]
    );
  });

  it('still signs in when only a development runtime key is configured, then skips provisioning', async () => {
    vi.stubEnv('GT_PROJECT_ID', 'p1');
    vi.stubEnv('GT_DEV_API_KEY', 'gtx-existing-dev-key');
    vi.mocked(hasLogin).mockResolvedValue(false);

    await runInit();

    expect(login).toHaveBeenCalledTimes(1);
    expect(api.listProjects).not.toHaveBeenCalled();
    expect(api.createProjectApiKey).not.toHaveBeenCalled();
    expect(fs.existsSync(envPath())).toBe(false);
  });

  it('skips provisioning for an explicit production key with a configured project', async () => {
    vi.stubEnv('GT_API_KEY', 'gtx-production-key');
    vi.stubEnv('GT_PROJECT_ID', 'p1');
    vi.mocked(hasLogin).mockResolvedValue(false);

    await runInit();

    expect(login).not.toHaveBeenCalled();
    expect(api.createProjectApiKey).not.toHaveBeenCalled();
    expect(fs.existsSync(envPath())).toBe(false);
  });

  it('mints for the configured project ID instead of asking', async () => {
    fs.writeFileSync(
      path.join(appDirectory, 'gt.config.json'),
      JSON.stringify({ projectId: 'configured-project', defaultLocale: 'en' })
    );

    await runInit();

    expect(api.listProjects).not.toHaveBeenCalled();
    expect(promptSelect).not.toHaveBeenCalled();
    expect(api.createProjectApiKey).toHaveBeenCalledWith(
      'configured-project',
      expect.anything()
    );
    expect(fs.readFileSync(envPath(), 'utf8')).toContain(
      'GT_PROJECT_ID=configured-project\n'
    );
  });

  it('creates a project in the chosen organization when none is accessible', async () => {
    vi.mocked(api.listProjects).mockResolvedValue([]);
    vi.mocked(api.listOrgs).mockResolvedValue([
      { id: 'o1', name: 'Acme' },
      { id: 'o2', name: 'Beta' },
    ]);
    vi.mocked(promptSelect).mockResolvedValueOnce('o2');
    vi.mocked(promptText).mockResolvedValueOnce(' New App ');
    vi.mocked(api.createProject).mockResolvedValue({
      project: {
        id: 'p-new',
        name: 'New App',
        orgId: 'o2',
        defaultLocale: 'en',
      },
    });

    await runInit();

    expect(api.createProject).toHaveBeenCalledWith('o2', {
      name: 'New App',
      defaultLocale: 'en',
    });
    expect(api.createProjectApiKey).toHaveBeenCalledWith(
      'p-new',
      expect.anything()
    );
    expect(fs.readFileSync(envPath(), 'utf8')).toContain(
      'GT_PROJECT_ID=p-new\n'
    );
  });

  it('uses the only creatable organization without asking', async () => {
    vi.mocked(promptSelect).mockResolvedValueOnce(null); // Create a new project
    vi.mocked(api.listOrgs).mockResolvedValue([{ id: 'o1', name: 'Acme' }]);
    vi.mocked(promptText).mockResolvedValueOnce('New App');
    vi.mocked(api.createProject).mockResolvedValue({
      project: {
        id: 'p-new',
        name: 'New App',
        orgId: 'o1',
        defaultLocale: 'en',
      },
    });

    await runInit();

    expect(promptSelect).toHaveBeenCalledTimes(1);
    expect(api.createProject).toHaveBeenCalledWith('o1', expect.anything());
  });

  it('fails with guidance when the user cannot create in any organization', async () => {
    vi.mocked(api.listProjects).mockResolvedValue([]);
    vi.mocked(api.listOrgs).mockResolvedValue([]);

    await expect(runInit()).rejects.toThrow(
      'not a member of an organization that can create projects'
    );
    expect(api.createProjectApiKey).not.toHaveBeenCalled();
    expect(fs.existsSync(envPath())).toBe(false);
  });

  it('reports a forbidden API response for an explicit key without falling back to login', async () => {
    vi.stubEnv('GT_API_KEY', 'gtx-project-key');
    vi.mocked(hasLogin).mockResolvedValue(false);
    vi.mocked(api.listProjects).mockResolvedValue([]);
    vi.mocked(api.listOrgs).mockRejectedValue(
      new Error('user tokens only (403)')
    );

    await expect(runInit()).rejects.toThrow(
      /Failed to set up the development credentials[\s\S]*user tokens only/
    );
    expect(login).not.toHaveBeenCalled();
    expect(api.createProjectApiKey).not.toHaveBeenCalled();
    expect(fs.existsSync(envPath())).toBe(false);
    expect(logger.endCommand).not.toHaveBeenCalled();
  });

  it('does not mint a key when the project prompt is cancelled', async () => {
    vi.mocked(promptSelect).mockRejectedValueOnce(new Error('exit 0'));

    await expect(runInit()).rejects.toThrow('exit 0');
    expect(api.createProjectApiKey).not.toHaveBeenCalled();
    expect(fs.existsSync(envPath())).toBe(false);
  });

  it.each([true, false])(
    'offers live credentials for local Vite without requiring them: %s',
    async (enableLiveTranslations) => {
      fs.writeFileSync(
        path.join(appDirectory, 'package.json'),
        JSON.stringify({
          name: 'vite-app',
          dependencies: { 'gt-react': '*' },
          devDependencies: { gt: '*' },
        })
      );
      vi.mocked(detectFramework).mockResolvedValue({
        name: 'vite',
        type: 'react',
      });
      vi.mocked(hasLogin).mockResolvedValue(false);
      vi.mocked(promptConfirm).mockImplementation(async ({ message }) =>
        message.includes('live development translations')
          ? enableLiveTranslations
          : false
      );
      vi.mocked(promptSelect)
        .mockResolvedValueOnce('local')
        .mockResolvedValueOnce(projects[0]);
      vi.mocked(promptText).mockResolvedValueOnce('src/_gt');

      await runInit();

      expect(promptConfirm).toHaveBeenCalledWith({
        message: expect.stringContaining('live development translations'),
        defaultValue: false,
      });
      expect(login).toHaveBeenCalledTimes(enableLiveTranslations ? 1 : 0);
      expect(api.createProjectApiKey).toHaveBeenCalledTimes(
        enableLiveTranslations ? 1 : 0
      );
      if (enableLiveTranslations) {
        expect(fs.readFileSync(envPath(), 'utf8')).toBe(
          'VITE_GT_PROJECT_ID=p1\nVITE_GT_DEV_API_KEY=gtx-secret-development-key\n'
        );
      } else {
        expect(api.listProjects).not.toHaveBeenCalled();
        expect(fs.existsSync(envPath())).toBe(false);
      }
    }
  );

  it('does not report saved credentials after an unsafe multiline edit', async () => {
    const existing = 'OTHER="first\nGT_PROJECT_ID=embedded\nlast"\n';
    fs.writeFileSync(envPath(), existing);
    vi.mocked(promptSelect).mockResolvedValueOnce(projects[0]);

    await expect(runInit()).rejects.toThrow('Cannot safely update .env.local');
    expect(fs.readFileSync(envPath(), 'utf8')).toBe(existing);
    expect(logger.endCommand).not.toHaveBeenCalled();
    expect(loggedOutput()).not.toContain('gtx-secret-development-key');
  });

  it('fails without claiming success when .env.local cannot be written', async () => {
    fs.mkdirSync(envPath()); // a directory where the file should be
    vi.mocked(promptSelect).mockResolvedValueOnce(projects[0]);

    await expect(runInit()).rejects.toThrow(
      'Failed to set up the development credentials'
    );
    expect(api.createProjectApiKey).toHaveBeenCalledTimes(1);
    expect(logger.endCommand).not.toHaveBeenCalled();
    expect(loggedOutput()).not.toContain('gtx-secret-development-key');
  });
});
