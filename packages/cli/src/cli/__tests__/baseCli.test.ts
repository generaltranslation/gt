import { Command } from 'commander';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
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
