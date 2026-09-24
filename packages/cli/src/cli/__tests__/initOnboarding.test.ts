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
vi.mock('../../utils/installPackage.js', () => ({
  installPackage: vi.fn(),
}));
vi.mock('open', () => ({ default: vi.fn() }));
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
  promptGlobPatterns: vi.fn(),
  promptLocale: vi.fn(),
  promptLocaleList: vi.fn(),
  promptMultiSelect: vi.fn(),
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
    setAnimatedProgress: vi.fn(),
    setConsoleOutput: vi.fn(),
    setQuiet: vi.fn(),
    startCommand: vi.fn(),
    step: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
  },
}));

import open from 'open';
import { hasLogin, login } from '../../auth/oauth.js';
import { logger } from '../../console/logger.js';
import * as logging from '../../console/logging.js';
import { detectFramework } from '../../setup/detectFramework.js';
import { api } from '../../utils/api.js';
import { installPackage } from '../../utils/installPackage.js';
import { BaseCLI } from '../base.js';

const prompts = [
  logging.promptConfirm,
  logging.promptGlobPatterns,
  logging.promptLocale,
  logging.promptLocaleList,
  logging.promptMultiSelect,
  logging.promptSelect,
  logging.promptText,
].map((prompt) => vi.mocked(prompt));
const projects = [
  { id: 'p1', name: 'Docs', orgId: 'o1', orgName: 'Acme' },
  { id: 'p2', name: 'App', orgId: 'o1', orgName: 'Acme' },
];
const SECRET_KEY = 'gtx-secret-development-key';
const GT_ENV = [
  'GT_API_KEY',
  'GT_PROJECT_ID',
  'GT_DEV_API_KEY',
  'NEXT_PUBLIC_GT_PROJECT_ID',
  'NEXT_PUBLIC_GT_DEV_API_KEY',
];
const originalTerminal = {
  stdin: process.stdin.isTTY,
  stdout: process.stdout.isTTY,
};

function setTerminal(isTTY: boolean): void {
  process.stdin.isTTY = isTTY;
  process.stdout.isTTY = isTTY;
}

async function run(...args: string[]): Promise<void> {
  const program = new Command().exitOverride();
  new BaseCLI(program, 'base');
  await program.parseAsync(args, { from: 'user' });
}

describe('init and configure onboarding', () => {
  const originalCwd = process.cwd();
  let appDirectory: string;
  let stdoutEvents: string[];
  const file = (name: string) => path.join(appDirectory, name);
  const readConfig = () =>
    JSON.parse(fs.readFileSync(file('gt.config.json'), 'utf8'));
  const events = () => stdoutEvents.map((line) => JSON.parse(line));

  function useFreshApp(
    packageJson: Record<string, unknown> = {
      name: 'example-app',
      dependencies: { 'gt-react': '*' },
      devDependencies: { gt: '*' },
    }
  ) {
    if (appDirectory) fs.rmSync(appDirectory, { recursive: true, force: true });
    appDirectory = fs.mkdtempSync(path.join(tmpdir(), 'gt-onboarding-'));
    fs.writeFileSync(file('package.json'), JSON.stringify(packageJson));
    process.chdir(appDirectory);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    for (const prompt of prompts) prompt.mockReset();
    for (const name of GT_ENV) vi.stubEnv(name, undefined);
    appDirectory = '';
    useFreshApp();
    vi.stubEnv('XDG_CONFIG_HOME', path.join(appDirectory, 'xdg-config'));
    vi.stubEnv('XDG_STATE_HOME', path.join(appDirectory, 'xdg-state'));
    setTerminal(true);
    vi.mocked(detectFramework).mockResolvedValue({ name: undefined });
    vi.mocked(hasLogin).mockResolvedValue(true);
    vi.mocked(api.listProjects).mockResolvedValue(projects);
    vi.mocked(api.createProjectApiKey).mockResolvedValue({
      apiKey: {
        id: 'key-id',
        name: 'Development key (gt init)',
        key: SECRET_KEY,
        projectId: 'p2',
        type: 'production',
      },
    });
    stdoutEvents = [];
    const writeSync = fs.writeSync;
    vi.spyOn(fs, 'writeSync').mockImplementation(((
      fd: number,
      data: string,
      ...rest: unknown[]
    ) => {
      if (fd === process.stdout.fd) {
        stdoutEvents.push(...String(data).trim().split('\n'));
        return String(data).length;
      }
      return (writeSync as (...args: unknown[]) => number)(fd, data, ...rest);
    }) as typeof fs.writeSync);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.stdin.isTTY = originalTerminal.stdin;
    process.stdout.isTTY = originalTerminal.stdout;
    process.chdir(originalCwd);
    vi.unstubAllEnvs();
    fs.rmSync(appDirectory, { recursive: true, force: true });
  });

  it('resolves prompted answers and the equivalent flags to the same setup', async () => {
    vi.mocked(logging.promptConfirm).mockImplementation(
      async ({ message }) =>
        !message.includes('recommended General Translation defaults')
    );
    vi.mocked(logging.promptLocale).mockResolvedValue('en');
    vi.mocked(logging.promptLocaleList).mockResolvedValue(['fr', 'de']);
    vi.mocked(logging.promptSelect)
      .mockResolvedValueOnce('local')
      .mockResolvedValueOnce(projects[1]);
    vi.mocked(logging.promptText).mockResolvedValue('public/i18n');
    vi.mocked(logging.promptMultiSelect).mockResolvedValue(['md']);
    vi.mocked(logging.promptGlobPatterns).mockResolvedValue(
      'docs/[locale]/*.md'
    );

    await run('init');
    const prompted = {
      config: readConfig(),
      env: fs.readFileSync(file('.env.local'), 'utf8'),
      loader: fs.existsSync(file('loadTranslations.js')),
    };

    useFreshApp();
    for (const prompt of prompts) prompt.mockClear();
    setTerminal(false);
    await run(
      'configure',
      '--default-locale',
      'en',
      '--locales',
      'fr',
      'de',
      '--storage',
      'local',
      '--translations-dir',
      'public/i18n',
      '--file-patterns',
      'md=docs/[locale]/*.md',
      '--dev-credentials',
      '--project-id',
      'p2'
    );

    for (const prompt of prompts) expect(prompt).not.toHaveBeenCalled();
    expect({
      config: readConfig(),
      env: fs.readFileSync(file('.env.local'), 'utf8'),
      loader: fs.existsSync(file('loadTranslations.js')),
    }).toEqual(prompted);
    expect(prompted.config).toMatchObject({
      defaultLocale: 'en',
      locales: ['fr', 'de'],
      files: {
        md: { include: ['docs/[locale]/*.md'] },
        gt: { output: path.join('public/i18n', '[locale].json') },
      },
    });
    expect(prompted.env).toBe(
      `GT_PROJECT_ID=p2\nGT_DEV_API_KEY=${SECRET_KEY}\n`
    );
  });

  it.each([
    ['with --non-interactive in a terminal', true, ['--non-interactive']],
    ['without a terminal', false, []],
  ])(
    'never prompts %s and lists missing options before any change',
    async (_case, isTTY, args) => {
      setTerminal(isTTY);

      await expect(run('init', ...args)).rejects.toThrow(
        /Setup needs these options: --default-locale, --locales, --storage, --file-formats\./
      );

      for (const prompt of prompts) expect(prompt).not.toHaveBeenCalled();
      expect(hasLogin).not.toHaveBeenCalled();
      expect(fs.readdirSync(appDirectory)).toEqual(['package.json']);
    }
  );

  it('keeps configured values under --defaults and lets flags replace them', async () => {
    fs.writeFileSync(
      file('gt.config.json'),
      JSON.stringify({
        defaultLocale: 'en',
        locales: ['fr', 'de'],
        custom: { keep: true },
        files: { json: { include: ['a/[locale].json'], exclude: ['x'] } },
      })
    );
    const common = ['--non-interactive', '--no-dev-credentials'];

    await run('configure', ...common, '--defaults');
    expect(readConfig()).toMatchObject({
      defaultLocale: 'en',
      locales: ['fr', 'de'],
      custom: { keep: true },
      files: {
        json: { include: ['a/[locale].json'], exclude: ['x'] },
        gt: { output: path.join('public/_gt', '[locale].json') },
      },
    });

    await run(
      'configure',
      ...common,
      '--locales',
      'ja',
      '--file-patterns',
      'json=b/[locale].json'
    );
    expect(readConfig()).toMatchObject({
      locales: ['ja'],
      custom: { keep: true },
      files: { json: { include: ['b/[locale].json'], exclude: ['x'] } },
    });
  });

  it.each([
    [
      'keeps configured CDN storage under --defaults',
      { publish: true },
      ['--defaults'],
      true,
    ],
    [
      'drops stale CDN intent for explicit local storage',
      { publish: true },
      ['--defaults', '--storage', 'local'],
      false,
    ],
    [
      'selects CDN storage explicitly',
      {},
      ['--defaults', '--storage', 'cdn'],
      true,
    ],
  ])('%s', async (_case, existing, args, publish) => {
    fs.writeFileSync(
      file('gt.config.json'),
      JSON.stringify({ defaultLocale: 'en', locales: ['fr'], ...existing })
    );

    await run(
      'configure',
      '--non-interactive',
      '--no-dev-credentials',
      ...args
    );

    const config = readConfig();
    expect(config.publish).toBe(publish ? true : undefined);
    expect(config.files?.gt?.output).toBe(
      publish ? undefined : path.join('public/_gt', '[locale].json')
    );
  });

  it('propagates a framework override to the config, storage and runtime env names', async () => {
    vi.mocked(detectFramework).mockResolvedValue({
      name: 'vite',
      type: 'react',
    });

    await run(
      'init',
      '--non-interactive',
      '--defaults',
      '--react-setup',
      '--framework',
      'next-pages',
      '--locales',
      'fr',
      '--dev-credentials',
      '--project-id',
      'p1'
    );

    expect(readConfig()).toMatchObject({
      framework: 'next-pages',
      files: { gt: { output: path.join('public/_gt', '[locale].json') } },
    });
    expect(fs.readFileSync(file('.env.local'), 'utf8')).toBe(
      `NEXT_PUBLIC_GT_PROJECT_ID=p1\nNEXT_PUBLIC_GT_DEV_API_KEY=${SECRET_KEY}\n`
    );
    expect(installPackage).not.toHaveBeenCalled();
  });

  it('requires explicit consent and inputs for remote projects and keys', async () => {
    const base = ['init', '--non-interactive', '--defaults', '--locales', 'fr'];
    await expect(run(...base)).rejects.toThrow(
      'Setup needs these options: --dev-credentials'
    );
    await expect(run(...base, '--dev-credentials')).rejects.toThrow(
      '--project-id or --create-project'
    );
    await expect(
      run(...base, '--dev-credentials', '--create-project')
    ).rejects.toThrow('--project-name');

    vi.mocked(api.listOrgs).mockResolvedValue([
      { id: 'o1', name: 'Acme' },
      { id: 'o2', name: 'Beta' },
    ]);
    await expect(
      run(
        ...base,
        '--dev-credentials',
        '--create-project',
        '--project-name',
        'New App'
      )
    ).rejects.toThrow('Setup needs these options: --org-id');

    expect(api.listProjects).not.toHaveBeenCalled();
    expect(api.createProject).not.toHaveBeenCalled();
    expect(api.createProjectApiKey).not.toHaveBeenCalled();
    expect(fs.readdirSync(appDirectory)).toEqual(['package.json']);
  });

  it('signs in with a device code before changing files and reports JSON events', async () => {
    vi.mocked(hasLogin).mockResolvedValue(false);
    vi.mocked(login).mockImplementation(async (options) => {
      expect(fs.existsSync(file('gt.config.json'))).toBe(false);
      options?.onDeviceCode?.({
        userCode: 'ABCD-EFGH',
        verificationUri: 'https://auth.example/device',
      });
      return {} as Awaited<ReturnType<typeof login>>;
    });
    const stdoutWrite = vi.spyOn(process.stdout, 'write');

    await run(
      'init',
      '--json',
      '--defaults',
      '--locales',
      'fr',
      '--dev-credentials',
      '--project-id',
      'p1'
    );

    expect(login).toHaveBeenCalledWith(
      expect.objectContaining({ noBrowser: true })
    );
    expect(logger.setConsoleOutput).toHaveBeenCalledWith('stderr');
    expect(stdoutWrite).not.toHaveBeenCalled();
    expect(events()).toEqual([
      {
        type: 'authorization_required',
        userCode: 'ABCD-EFGH',
        verificationUri: 'https://auth.example/device',
      },
      {
        type: 'result',
        command: 'init',
        outcome: 'success',
        completedSteps: [
          'created loadTranslations.js',
          'updated gt.config.json',
          'created a development key',
          'saved development credentials to .env.local',
        ],
      },
    ]);
    expect(stdoutEvents.join('\n')).not.toContain(SECRET_KEY);
  });

  it('hands off to Locadex without a browser or local changes', async () => {
    vi.mocked(detectFramework).mockResolvedValue({
      name: 'next-app',
      type: 'react',
    });

    await run('init', '--json', '--locadex');

    expect(open).not.toHaveBeenCalled();
    const [handoff, result] = events();
    expect(handoff).toMatchObject({ type: 'handoff', reason: 'locadex' });
    expect(handoff.url).toContain('/api/integrations/github/start');
    expect(result).toEqual({
      type: 'result',
      command: 'init',
      outcome: 'needs_human_action',
      completedSteps: [],
      url: handoff.url,
    });
    expect(fs.readdirSync(appDirectory)).toEqual(['package.json']);
  });

  it('exits nonzero with the completed steps when a later step fails', async () => {
    useFreshApp({ name: 'example-app', dependencies: { 'gt-react': '*' } });
    vi.stubEnv('GT_API_KEY', 'gtx-tooling-key');
    vi.stubEnv('GT_PROJECT_ID', 'p1');
    vi.mocked(installPackage).mockRejectedValue(new Error('network down'));

    await expect(
      run(
        'init',
        '--json',
        '--defaults',
        '--locales',
        'fr',
        '--package-manager',
        'npm'
      )
    ).rejects.toThrow(/Failed to install gt[\s\S]*network down/);

    expect(readConfig()).toMatchObject({ locales: ['fr'] });
    expect(events().at(-1)).toMatchObject({
      type: 'result',
      outcome: 'failed',
      completedSteps: ['created loadTranslations.js', 'updated gt.config.json'],
      error: expect.stringContaining('Failed to install gt'),
    });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Setup stopped after these steps')
    );
  });

  it('reuses existing development credentials instead of minting another key', async () => {
    vi.stubEnv('GT_PROJECT_ID', 'p1');
    vi.stubEnv('GT_DEV_API_KEY', 'gtx-existing-dev-key');

    await run(
      'init',
      '--non-interactive',
      '--defaults',
      '--locales',
      'fr',
      '--dev-credentials'
    );

    expect(api.createProjectApiKey).not.toHaveBeenCalled();
    expect(fs.existsSync(file('.env.local'))).toBe(false);
  });

  it('stops on an invalid gt.config.json before changing anything', async () => {
    fs.writeFileSync(file('gt.config.json'), '{bad');

    await expect(
      run('configure', '--non-interactive', '--defaults')
    ).rejects.toThrow('gt.config.json is not a valid JSON config');

    expect(fs.readFileSync(file('gt.config.json'), 'utf8')).toBe('{bad');
    expect(fs.existsSync(file('loadTranslations.js'))).toBe(false);
  });

  describe('review regressions', () => {
    const local = ['--non-interactive', '--defaults'];
    const writeConfig = (config: Record<string, unknown>) =>
      fs.writeFileSync(file('gt.config.json'), JSON.stringify(config));

    it('creates a new project with the resolved default locale', async () => {
      vi.mocked(api.listOrgs).mockResolvedValue([{ id: 'o1', name: 'Acme' }]);
      vi.mocked(api.createProject).mockResolvedValue({
        project: { id: 'p-new', name: 'App', orgId: 'o1', defaultLocale: 'es' },
      });

      await run(
        'init',
        ...local,
        '--default-locale',
        'es',
        '--locales',
        'fr',
        '--dev-credentials',
        '--create-project',
        '--project-name',
        'App'
      );

      expect(api.createProject).toHaveBeenCalledWith('o1', {
        name: 'App',
        defaultLocale: 'es',
      });
      expect(readConfig()).toMatchObject({ defaultLocale: 'es' });
    });

    it('validates the resolved locales before any change', async () => {
      await expect(
        run(
          'configure',
          ...local,
          '--default-locale',
          'en',
          '--locales',
          'en-GB',
          '--no-dev-credentials'
        )
      ).rejects.toThrow(
        'defaultLocale "en" is broader than configured locale "en-GB"'
      );
      expect(fs.readdirSync(appDirectory)).toEqual(['package.json']);

      writeConfig({ defaultLocale: 'en', locales: ['not_a_locale'] });
      await run(
        'configure',
        ...local,
        '--locales',
        'fr',
        '--no-dev-credentials'
      );
      expect(readConfig().locales).toEqual(['fr']);
    });

    it('lets --project-id replace the configured project and its credentials', async () => {
      writeConfig({ projectId: 'p1', defaultLocale: 'en', locales: ['fr'] });

      await run(
        'configure',
        ...local,
        '--project-id',
        'p2',
        '--dev-credentials'
      );

      expect(api.createProjectApiKey).toHaveBeenCalledWith(
        'p2',
        expect.anything()
      );
      expect(readConfig().projectId).toBe('p2');
      expect(fs.readFileSync(file('.env.local'), 'utf8')).toContain(
        'GT_PROJECT_ID=p2\n'
      );
    });

    it('only reuses runtime credentials that belong to the selected project', async () => {
      vi.stubEnv('GT_PROJECT_ID', 'p1');
      vi.stubEnv('GT_DEV_API_KEY', 'gtx-p1-key');
      const args = [
        'configure',
        ...local,
        '--locales',
        'fr',
        '--project-id',
        'p2',
      ];

      await expect(run(...args, '--no-dev-credentials')).rejects.toThrow(
        'belong to project p1, not p2'
      );
      expect(fs.readdirSync(appDirectory)).toEqual(['package.json']);

      await run(...args, '--dev-credentials');
      expect(api.createProjectApiKey).toHaveBeenCalledWith(
        'p2',
        expect.anything()
      );
      expect(fs.readFileSync(file('.env.local'), 'utf8')).toBe(
        `GT_PROJECT_ID=p2\nGT_DEV_API_KEY=${SECRET_KEY}\n`
      );
    });

    it('resolves the framework from flag, then config, and saves it', async () => {
      vi.mocked(detectFramework).mockResolvedValue({
        name: 'vite',
        type: 'react',
      });
      writeConfig({ framework: 'vite', defaultLocale: 'en', locales: ['fr'] });
      const args = [
        'init',
        ...local,
        '--no-react-setup',
        '--no-dev-credentials',
      ];

      await run(...args, '--framework', 'next-pages');
      expect(readConfig()).toMatchObject({
        framework: 'next-pages',
        files: { gt: { output: path.join('public/_gt', '[locale].json') } },
      });

      // Reruns and configure keep the saved framework over detection.
      await run(...args);
      expect(readConfig().framework).toBe('next-pages');
      await run(
        'configure',
        ...local,
        '--dev-credentials',
        '--project-id',
        'p1'
      );
      expect(readConfig().framework).toBe('next-pages');
      expect(fs.readFileSync(file('.env.local'), 'utf8')).toContain(
        'NEXT_PUBLIC_GT_PROJECT_ID=p1\n'
      );
    });

    it('does not sign in for local-only setup without new credentials', async () => {
      vi.mocked(hasLogin).mockResolvedValue(false);

      await run(
        'configure',
        ...local,
        '--locales',
        'fr',
        '--no-dev-credentials'
      );

      expect(hasLogin).not.toHaveBeenCalled();
      expect(login).not.toHaveBeenCalled();
      expect(readConfig()).toMatchObject({ locales: ['fr'] });
    });

    it('rejects an unsafe multiline .env.local assignment before any change', async () => {
      const existing = 'GT_PROJECT_ID="first\nsecond"\n';
      fs.writeFileSync(file('.env.local'), existing);
      vi.mocked(hasLogin).mockResolvedValue(false);

      await expect(
        run(
          'init',
          ...local,
          '--locales',
          'fr',
          '--dev-credentials',
          '--project-id',
          'p1'
        )
      ).rejects.toThrow('Cannot safely update .env.local');

      expect(login).not.toHaveBeenCalled();
      expect(api.createProjectApiKey).not.toHaveBeenCalled();
      expect(fs.readFileSync(file('.env.local'), 'utf8')).toBe(existing);
      expect(fs.existsSync(file('gt.config.json'))).toBe(false);
    });

    it('fails honestly when the translations directory cannot be created', async () => {
      fs.writeFileSync(file('blocked'), 'not a directory');

      await expect(
        run(
          'configure',
          '--json',
          '--defaults',
          '--locales',
          'fr',
          '--translations-dir',
          'blocked/tx',
          '--no-dev-credentials'
        )
      ).rejects.toThrow(/ENOTDIR|EEXIST/);

      expect(events().at(-1)).toMatchObject({
        type: 'result',
        outcome: 'failed',
        completedSteps: [],
      });
      expect(fs.existsSync(file('loadTranslations.js'))).toBe(false);
      expect(fs.existsSync(file('gt.config.json'))).toBe(false);
    });

    it('lets an explicit format list replace the configured formats', async () => {
      writeConfig({
        defaultLocale: 'en',
        locales: ['fr'],
        custom: true,
        files: {
          md: { include: ['docs/[locale]/*.md'] },
          json: { include: ['i18n/[locale].json'], exclude: ['x'] },
          gt: { output: 'public/_gt/[locale].json' },
        },
      });
      const args = ['configure', ...local, '--no-dev-credentials'];

      await run(...args, '--file-formats', 'json');
      expect(readConfig()).toMatchObject({
        custom: true,
        files: {
          json: { include: ['i18n/[locale].json'], exclude: ['x'] },
          gt: { output: 'public/_gt/[locale].json' },
        },
      });
      expect(readConfig().files.md).toBeUndefined();

      await run(...args, '--file-formats', 'none');
      expect(readConfig().files).toEqual({
        gt: { output: 'public/_gt/[locale].json' },
      });
    });

    it('keeps an explicit CDN switch on later default runs', async () => {
      writeConfig({
        defaultLocale: 'en',
        locales: ['fr'],
        files: {
          gt: { output: 'public/_gt/[locale].json', parsingFlags: { a: 1 } },
        },
      });
      const args = ['configure', ...local, '--no-dev-credentials'];

      await run(...args, '--storage', 'cdn');
      await run(...args);

      expect(readConfig()).toMatchObject({
        publish: true,
        files: { gt: { parsingFlags: { a: 1 } } },
      });
      expect(readConfig().files.gt.output).toBeUndefined();

      writeConfig({
        defaultLocale: 'en',
        locales: ['fr'],
        publish: true,
        files: { gt: { output: 'public/_gt/[locale].json' } },
      });
      await run(...args);
      expect(readConfig()).toMatchObject({
        publish: true,
        files: { gt: { output: 'public/_gt/[locale].json' } },
      });
    });

    it.each([
      [{ name: 'next-app', type: 'react' } as const],
      [{ name: 'mintlify' } as const],
    ])(
      'answers the Locadex choice from --defaults for %o',
      async (framework) => {
        vi.mocked(detectFramework).mockResolvedValue(framework);

        await run(
          'init',
          '--json',
          '--defaults',
          '--no-react-setup',
          '--locales',
          'fr',
          '--no-dev-credentials'
        );

        expect(open).not.toHaveBeenCalled();
        expect(events()).toEqual([
          expect.objectContaining({ type: 'result', outcome: 'success' }),
        ]);
      }
    );

    it('asks before creating a project when the account has none', async () => {
      vi.mocked(api.listProjects).mockResolvedValue([]);
      vi.mocked(api.listOrgs).mockResolvedValue([{ id: 'o1', name: 'Acme' }]);
      vi.mocked(logging.promptConfirm).mockResolvedValue(false);

      await expect(
        run(
          'init',
          '--defaults',
          '--dev-credentials',
          '--project-name',
          'App',
          '--org-id',
          'o1',
          '--locales',
          'fr'
        )
      ).rejects.toThrow('No project was chosen');

      expect(logging.promptConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Create a new project?'),
        })
      );
      expect(api.createProject).not.toHaveBeenCalled();
      expect(api.createProjectApiKey).not.toHaveBeenCalled();
      expect(fs.readdirSync(appDirectory)).toEqual(['package.json']);
    });

    it('requires [locale] in supplied file patterns', async () => {
      await expect(
        run('configure', ...local, '--file-patterns', 'md=docs/*.md')
      ).rejects.toThrow('"docs/*.md" must include [locale]');
      expect(fs.readdirSync(appDirectory)).toEqual(['package.json']);
    });
  });

  describe('rerun regressions', () => {
    it('reports argument errors through the exit hook as a JSON result', async () => {
      vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
        throw new Error(`exit ${code}`);
      }) as typeof process.exit);
      vi.spyOn(process.stderr, 'write').mockReturnValue(true);

      await expect(
        run('init', '--json', '--storage', 'invalid')
      ).rejects.toThrow('exit 1');
      expect(events()).toEqual([
        expect.objectContaining({
          type: 'result',
          command: 'init',
          outcome: 'failed',
          error: expect.stringContaining("argument 'invalid' is invalid"),
        }),
      ]);

      stdoutEvents = [];
      await expect(run('configure', '--storage', 'invalid')).rejects.toThrow(
        'exit 1'
      );
      expect(events()).toEqual([]);
    });

    const configure = (...args: string[]) =>
      run('configure', '--json', '--defaults', '--no-dev-credentials', ...args);

    it('points the generated loader at a changed translations directory', async () => {
      await configure('--locales', 'fr', '--translations-dir', 'old-tx');
      fs.mkdirSync(file('new-tx'));
      fs.writeFileSync(file('new-tx/fr.json'), '{"kept":"yes"}');
      stdoutEvents = [];

      await configure('--translations-dir', 'new-tx');

      const loader = fs.readFileSync(file('loadTranslations.js'), 'utf8');
      expect(loader).toContain('import(`./new-tx/${locale}.json`)');
      expect(loader).not.toContain('old-tx');
      expect(readConfig().files.gt.output).toBe(
        path.join('new-tx', '[locale].json')
      );
      expect(fs.readFileSync(file('new-tx/fr.json'), 'utf8')).toBe(
        '{"kept":"yes"}'
      );
      expect(events().at(-1)).toMatchObject({
        outcome: 'success',
        completedSteps: [
          'updated loadTranslations.js',
          'updated gt.config.json',
        ],
      });
    });

    it('keeps a custom loader and asks for a manual update when the directory changes', async () => {
      await configure('--locales', 'fr', '--translations-dir', 'old-tx');
      const custom = 'export default async () => ({ custom: true });\n';
      fs.writeFileSync(file('loadTranslations.js'), custom);

      stdoutEvents = [];
      await configure('--translations-dir', 'old-tx');
      expect(events().at(-1)).toMatchObject({ outcome: 'success' });

      stdoutEvents = [];
      await configure('--translations-dir', 'new-tx');
      expect(fs.readFileSync(file('loadTranslations.js'), 'utf8')).toBe(custom);
      expect(events().at(-1)).toMatchObject({
        type: 'result',
        outcome: 'needs_human_action',
        completedSteps: ['updated gt.config.json'],
        actions: [expect.stringContaining('new-tx')],
      });
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('loadTranslations.js')
      );
    });

    it.each([
      [
        'init',
        { name: 'next-pages', type: 'react' } as const,
        ['--no-react-setup', '--framework', 'vite'],
        {},
      ],
      [
        'configure',
        { name: 'next-pages', type: 'react' } as const,
        [],
        { framework: 'vite' },
      ],
    ])(
      '%s keeps using src/gt.config.json across the Vite boundary',
      async (command, detected, args, existing) => {
        vi.mocked(detectFramework).mockResolvedValue(detected);
        fs.mkdirSync(file('src'));
        fs.writeFileSync(
          file('src/gt.config.json'),
          JSON.stringify({
            defaultLocale: 'de',
            custom: { keep: 1 },
            ...existing,
          })
        );

        await run(
          command,
          '--json',
          '--defaults',
          '--locales',
          'ja',
          '--no-dev-credentials',
          ...args
        );

        expect(fs.existsSync(file('gt.config.json'))).toBe(false);
        expect(
          JSON.parse(fs.readFileSync(file('src/gt.config.json'), 'utf8'))
        ).toMatchObject({
          defaultLocale: 'de',
          locales: ['ja'],
          custom: { keep: 1 },
          framework: 'vite',
        });
      }
    );
  });
});
