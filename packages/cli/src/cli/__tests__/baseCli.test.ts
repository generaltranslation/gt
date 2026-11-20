import { Command } from 'commander';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../../console/logger.js';
import { logErrorAndExit } from '../../console/logging.js';
import { warnReactPackageCompatibility } from '../../utils/reactPackageCompatibility.js';
import { BaseCLI } from '../base.js';

vi.mock('../../utils/reactPackageCompatibility.js', () => ({
  warnReactPackageCompatibility: vi.fn(),
}));
vi.mock('../../console/logging.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../console/logging.js')>()),
  exitSync: vi.fn((code: number): never => {
    throw new Error(`exit ${code}`);
  }),
  logErrorAndExit: vi.fn((message: string) => {
    throw new Error(message);
  }),
}));

function createProgram(): Command {
  const program = new Command().exitOverride();
  new BaseCLI(program, 'base');
  return program;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('root options and hooks', () => {
  function createProgramWithCommands(): Command {
    const program = createProgram();
    program.command('download').action(() => {});
    program.command('translate').action(() => {});
    program.command('noop').action(() => {});
    program
      .command('group')
      .command('translate')
      .action(() => {});
    return program;
  }

  it('registers -q, --quiet on the root program', () => {
    const option = createProgram().options.find((o) => o.long === '--quiet');
    expect(option?.short).toBe('-q');
  });

  it.each([
    [['--quiet', 'noop'], true],
    [['noop', '--quiet'], true],
    [['noop', '-q'], true],
    [['noop'], false],
  ])('applies quiet=%s to the logger for %j', async (args, quiet) => {
    const setQuiet = vi.spyOn(logger, 'setQuiet');

    await createProgramWithCommands().parseAsync(args, { from: 'user' });

    expect(setQuiet).toHaveBeenCalledExactlyOnceWith(quiet);
    logger.setQuiet(false);
  });

  it.each([
    ['translation commands', ['translate'], false],
    ['downloading unstaged translations', ['download'], false],
    [
      'the suppression flag',
      ['translate', '--suppress-id-compatibility-warning'],
      true,
    ],
  ])(
    'checks React package compatibility before %s',
    async (_case, args, suppressed) => {
      await createProgramWithCommands().parseAsync(args, { from: 'user' });

      expect(warnReactPackageCompatibility).toHaveBeenCalledWith(suppressed);
    }
  );

  it.each([
    ['unrelated commands', ['noop']],
    ['nested commands with colliding leaf names', ['group', 'translate']],
  ])(
    'does not check React package compatibility for %s',
    async (_case, args) => {
      await createProgramWithCommands().parseAsync(args, { from: 'user' });

      expect(warnReactPackageCompatibility).not.toHaveBeenCalled();
    }
  );
});

const json = (value: unknown) => JSON.stringify(value, null, 2);

describe('gt git merge-driver command', () => {
  let tempDir: string | null = null;

  beforeEach(() => {
    vi.spyOn(logger, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  function writeMergeFiles(base: unknown, ours: unknown, theirs: unknown) {
    tempDir = fs.mkdtempSync(path.join(tmpdir(), 'gt-merge-cli-'));
    const basePath = path.join(tempDir, 'base.json');
    const oursPath = path.join(tempDir, 'ours.json');
    const theirsPath = path.join(tempDir, 'theirs.json');
    fs.writeFileSync(basePath, json(base));
    fs.writeFileSync(oursPath, json(ours));
    fs.writeFileSync(theirsPath, json(theirs));
    return { basePath, oursPath, theirsPath };
  }

  it('exits with code 1 for unknown driver names', async () => {
    vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    await expect(
      createProgram().parseAsync(
        ['git', 'merge-driver', 'bogus', 'a', 'b', 'c'],
        {
          from: 'user',
        }
      )
    ).rejects.toMatchObject({
      code: 'commander.invalidArgument',
      exitCode: 1,
      message: expect.stringContaining('Allowed choices are gt-lock, gtjson'),
    });
  });

  it('merges and writes the ours file for a clean gtjson merge', async () => {
    const { basePath, oursPath, theirsPath } = writeMergeFiles(
      { hello: 'Hello' },
      { hello: 'Hello', bye: 'Bye' },
      { hello: 'Hello', nav: 'Nav' }
    );

    await createProgram().parseAsync(
      ['git', 'merge-driver', 'gtjson', basePath, oursPath, theirsPath],
      { from: 'user' }
    );

    expect(fs.readFileSync(oursPath, 'utf8')).toBe(
      json({ hello: 'Hello', bye: 'Bye', nav: 'Nav' }) + '\n'
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('exits with code 1 and reports the reason on conflict', async () => {
    const { basePath, oursPath, theirsPath } = writeMergeFiles(
      { hello: 'Hello' },
      { hello: 'Hi' },
      { hello: 'Hola' }
    );

    await expect(
      createProgram().parseAsync(
        ['git', 'merge-driver', 'gt-lock', basePath, oursPath, theirsPath],
        { from: 'user' }
      )
    ).rejects.toThrow('exit 1');
    expect(logger.error).toHaveBeenCalledWith(
      'base gt-lock.json contains unsupported top-level fields'
    );
    expect(fs.readFileSync(oursPath, 'utf8')).toBe(json({ hello: 'Hi' }));
  });
});

describe('workspace root setup guard', () => {
  const originalCwd = process.cwd();
  let workspaceRoot: string;
  let packageJsonContents: string;

  beforeEach(() => {
    workspaceRoot = fs.mkdtempSync(path.join(tmpdir(), 'gt-workspace-setup-'));
    packageJsonContents = JSON.stringify(
      { name: 'example-monorepo', private: true },
      null,
      2
    );
    fs.writeFileSync(
      path.join(workspaceRoot, 'package.json'),
      packageJsonContents
    );
    fs.writeFileSync(
      path.join(workspaceRoot, 'pnpm-workspace.yaml'),
      "packages:\n  - 'apps/*'\n"
    );
    process.chdir(workspaceRoot);
    vi.spyOn(process, 'cwd').mockReturnValue(workspaceRoot);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it.each(['init', 'configure'])(
    'stops %s before changing the workspace',
    async (command) => {
      await expect(
        createProgram().parseAsync([command], { from: 'user' })
      ).rejects.toThrow(
        'The setup wizard cannot run from a monorepo workspace root'
      );

      expect(logErrorAndExit).toHaveBeenCalledWith(
        expect.stringContaining(
          "Change to that app's directory and rerun `npx gt@latest`."
        )
      );
      expect(fs.existsSync(path.join(workspaceRoot, 'gt.config.json'))).toBe(
        false
      );
      expect(
        fs.readFileSync(path.join(workspaceRoot, 'package.json'), 'utf8')
      ).toBe(packageJsonContents);
    }
  );

  it.each([
    [
      'a pnpm list with child packages',
      "packages:\n  - '.'\n  - 'apps/*'\n",
      {},
    ],
    ['package.json workspaces', undefined, { workspaces: ['packages/*'] }],
    [
      'Yarn workspaces.packages',
      undefined,
      { workspaces: { packages: ['packages/*'] } },
    ],
    ['an unreadable pnpm-workspace.yaml', 'packages: [\n', {}],
  ])('stops configure at a monorepo root with %s', async (_case, pnpm, pkg) => {
    if (pnpm === undefined)
      fs.rmSync(path.join(workspaceRoot, 'pnpm-workspace.yaml'));
    else
      fs.writeFileSync(path.join(workspaceRoot, 'pnpm-workspace.yaml'), pnpm);
    fs.writeFileSync(
      path.join(workspaceRoot, 'package.json'),
      JSON.stringify({ name: 'example-monorepo', ...pkg })
    );

    await expect(
      createProgram().parseAsync(['configure', '--no-interactive'], {
        from: 'user',
      })
    ).rejects.toThrow(
      'The setup wizard cannot run from a monorepo workspace root'
    );
  });

  it.each([
    [
      'lists only the app itself',
      "packages:\n  - '.'\n\nenableGlobalVirtualStore: true\nhoist: false\n",
    ],
    ['only holds settings', 'enableGlobalVirtualStore: true\n'],
  ])(
    'runs setup in a single app whose pnpm-workspace.yaml %s',
    async (_case, pnpm) => {
      fs.writeFileSync(path.join(workspaceRoot, 'pnpm-workspace.yaml'), pnpm);

      for (const command of ['init', 'configure']) {
        // Past the guard, the noninteractive run stops on its missing
        // answers before changing any file.
        await expect(
          createProgram().parseAsync([command, '--no-interactive'], {
            from: 'user',
          })
        ).rejects.toThrow('Setup needs these options');
      }
      expect(fs.existsSync(path.join(workspaceRoot, 'gt.config.json'))).toBe(
        false
      );
    }
  );

  it.each(['init', 'configure'])(
    'stops %s for Electron applications',
    async (command) => {
      packageJsonContents = JSON.stringify({
        name: 'example-electron-app',
        devDependencies: { electron: '^40.0.0' },
      });
      fs.writeFileSync(
        path.join(workspaceRoot, 'package.json'),
        packageJsonContents
      );
      fs.rmSync(path.join(workspaceRoot, 'pnpm-workspace.yaml'));

      await expect(
        createProgram().parseAsync([command], { from: 'user' })
      ).rejects.toThrow(
        'The automatic setup wizard is not ready for Electron applications'
      );

      expect(logErrorAndExit).toHaveBeenCalledWith(
        expect.stringContaining('https://generaltranslation.com/docs/react')
      );
      expect(fs.existsSync(path.join(workspaceRoot, 'gt.config.json'))).toBe(
        false
      );
      expect(
        fs.readFileSync(path.join(workspaceRoot, 'package.json'), 'utf8')
      ).toBe(packageJsonContents);
    }
  );
});

describe('--dry-run', () => {
  const originalCwd = process.cwd();
  const source = 'messages/en/common.json';
  const downloadReport = [
    'Dry run: No translations were downloaded from General Translation.',
    'Translations that would be requested:\n' +
      `- ${source} (es) → messages/es/common.json\n` +
      `- ${source} (fr) → messages/fr/common.json`,
  ];
  const collectedFiles = `Files found in project:\n- ${source}`;
  let projectRoot: string;
  let fetchMock: ReturnType<typeof vi.fn>;

  function writeProjectFile(relativePath: string, content: string) {
    const filePath = path.join(projectRoot, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  }

  function writeProject(config: Record<string, unknown> = {}) {
    writeProjectFile('package.json', json({ name: 'example-app' }));
    writeProjectFile(source, json({ greeting: 'Hello' }));
    writeProjectFile(
      'gt.config.json',
      json({
        defaultLocale: 'en',
        locales: ['es', 'fr'],
        files: { json: { include: ['messages/[locale]/*.json'] } },
        ...config,
      })
    );
    if (config.stageTranslations) {
      writeProjectFile(
        'gt-lock.json',
        json({
          version: 2,
          branchId: 'branch-id',
          entries: [
            {
              fileId: 'file-id',
              versionId: 'version-id',
              fileName: source,
              staged: true,
              translations: {},
            },
          ],
        })
      );
    }
  }

  function readProject(directory = projectRoot): Record<string, string> {
    return Object.fromEntries(
      fs
        .readdirSync(directory, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => path.join(entry.parentPath, entry.name))
        .map((filePath) => [
          path.relative(projectRoot, filePath),
          fs.readFileSync(filePath, 'utf8'),
        ])
    );
  }

  /** Runs the command and returns what it reported. */
  async function dryRun(command: string, ...args: string[]) {
    const report: string[] = [];
    const record = (message: string) => {
      const text = stripVTControlCharacters(message);
      if (!text.startsWith('Project ID:')) report.push(text);
    };
    vi.spyOn(logger, 'success').mockImplementation(record);
    vi.spyOn(logger, 'message').mockImplementation(record);
    const program = new Command().exitOverride();
    new BaseCLI(program, 'base').init();
    await program.parseAsync([command, '--dry-run', ...args], { from: 'user' });
    return report;
  }

  beforeEach(() => {
    projectRoot = fs.realpathSync(
      fs.mkdtempSync(path.join(tmpdir(), 'gt-dry-run-'))
    );
    process.chdir(projectRoot);
    vi.stubEnv('GT_PROJECT_ID', '');
    vi.stubEnv('GT_API_KEY', '');
    fetchMock = vi.fn(() => Promise.reject(new Error('fetch was called')));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    process.chdir(originalCwd);
    fs.rmSync(projectRoot, { recursive: true, force: true });
  });

  it.each([
    ['translate', { stageTranslations: true }, downloadReport],
    ['download', { stageTranslations: true }, downloadReport],
    ['download', {}, downloadReport],
    [
      'translate',
      {},
      ['Dry run: No files were sent to General Translation.', collectedFiles],
    ],
    [
      'stage',
      {},
      ['Dry run: No files were sent to General Translation.', collectedFiles],
    ],
    [
      'setup',
      {},
      [
        'Dry run: No files were uploaded to General Translation.',
        collectedFiles,
      ],
    ],
    [
      'enqueue',
      {},
      ['Dry run: No translations were enqueued.', collectedFiles],
    ],
    [
      'upload',
      {},
      [
        'Dry run: No files were uploaded to General Translation.',
        collectedFiles,
      ],
    ],
  ])(
    'gt %s with %j reports without a request or a write',
    async (command, config, expectedReport) => {
      writeProject(config);
      const before = readProject();

      const withCredentials = await dryRun(
        command,
        '--project-id',
        'project-id',
        '--api-key',
        'gtx-api-key'
      );
      const withoutCredentials = await dryRun(command);

      expect(withCredentials).toEqual(expectedReport);
      expect(withoutCredentials).toEqual(expectedReport);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(readProject()).toEqual(before);
    }
  );

  it.each(['translate', 'stage', 'setup'])(
    'gt %s leaves shared static assets and their references in place',
    async (command) => {
      writeProject({
        files: { md: { include: ['docs/[locale]/*.md'] } },
        sharedStaticAssets: { include: 'docs/en/*.png', outDir: 'public' },
      });
      writeProjectFile('docs/en/guide.md', '![Diagram](./diagram.png)\n');
      writeProjectFile('docs/en/diagram.png', 'image');
      const before = readProject();

      await dryRun(command);

      expect(fetchMock).not.toHaveBeenCalled();
      expect(readProject()).toEqual(before);
    }
  );

  it.each([
    ['translate', {}],
    ['translate', { stageTranslations: true }],
    ['download', {}],
  ])(
    'gt %s with %j does not mirror shared static assets to locales',
    async (command, config) => {
      writeProject({
        ...config,
        files: { md: { include: ['docs/[locale]/*.md'] } },
        sharedStaticAssets: { include: 'docs/en/*.png', mirrorToLocales: true },
      });
      writeProjectFile('docs/en/guide.md', '![Diagram](./diagram.png)\n');
      writeProjectFile('docs/en/diagram.png', 'image');
      const before = readProject();

      await dryRun(command);

      expect(fetchMock).not.toHaveBeenCalled();
      expect(readProject()).toEqual(before);
    }
  );
});
