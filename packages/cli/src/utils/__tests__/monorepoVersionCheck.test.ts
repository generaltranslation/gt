import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Mock dependencies before importing the module
vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  },
}));

vi.mock('fast-glob', () => ({
  default: {
    sync: vi.fn(),
  },
}));

vi.mock('../../console/logger.js', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    flush: vi.fn(),
  },
}));

import fg from 'fast-glob';
import { logger } from '../../console/logger.js';
import { checkMonorepoVersionConsistency } from '../monorepoVersionCheck.js';
import { Libraries, REACT_LIBRARIES } from '../../types/libraries.js';

const mockExistsSync = vi.mocked(fs.existsSync);
const mockReadFileSync = vi.mocked(fs.readFileSync);
const mockFgSync = vi.mocked(fg.sync);

type Dependencies = Record<string, string>;

/** A monorepo whose packages app-a, app-b, ... have the given dependencies. */
function setupApps(apps: Dependencies[], lockfile?: string) {
  const dirs = apps.map(
    (_, index) => `/repo/packages/app-${String.fromCharCode(97 + index)}`
  );
  setupMocks({
    lockfile,
    packageDirs: dirs,
    packages: Object.fromEntries(
      dirs.map((dir, index) => [
        dir,
        { name: path.basename(dir), dependencies: apps[index] },
      ])
    ),
  });
}

describe('checkMonorepoVersionConsistency', () => {
  const originalCwd = process.cwd;
  const originalExit = process.exit;

  beforeEach(() => {
    vi.clearAllMocks();
    process.cwd = () => '/repo/packages/app-a';
    process.exit = vi.fn() as unknown;
  });

  afterEach(() => {
    process.cwd = originalCwd;
    process.exit = originalExit;
  });

  it('silently returns when no lockfile is found', () => {
    mockExistsSync.mockReturnValue(false);

    checkMonorepoVersionConsistency(REACT_LIBRARIES);

    expect(process.exit).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it.each<
    [
      string,
      Dependencies[],
      Parameters<typeof checkMonorepoVersionConsistency>[0],
    ]
  >([
    ['only one package exists', [{ 'gt-react': '^10.11.0' }], REACT_LIBRARIES],
    [
      'every package uses the same specifier',
      [{ 'gt-react': '^10.11.0' }, { 'gt-react': '^10.11.0' }],
      REACT_LIBRARIES,
    ],
    [
      'gt-react and gt-react-native specifiers match',
      [{ 'gt-react': '^10.19.3' }, { 'gt-react-native': '^10.19.3' }],
      REACT_LIBRARIES,
    ],
    [
      'gt-react and gt-react-native differ but both are below 10.19.1',
      [{ 'gt-react': '^10.18.0' }, { 'gt-react-native': '^10.19.0' }],
      REACT_LIBRARIES,
    ],
    [
      'gt-react and gt-react-native differ but only one library is checked',
      [{ 'gt-react': '^10.19.3' }, { 'gt-react-native': '^10.18.0' }],
      [Libraries.GT_REACT],
    ],
    [
      'the other packages do not depend on GT packages',
      [{ 'gt-react': '^10.11.0' }, { lodash: '^4.0.0' }],
      REACT_LIBRARIES,
    ],
  ])('silently returns when %s', (_name, apps, libraries) => {
    setupApps(apps);

    checkMonorepoVersionConsistency(libraries);

    expect(process.exit).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  // Only package.json files are read, so this works without node_modules.
  it.each<[string, Dependencies[], string[], string[]]>([
    [
      'a GT package has different specifiers',
      [{ 'gt-react': '^10.5.0' }, { 'gt-react': '^10.11.0' }],
      ['gt-react:'],
      ['gt-react / gt-react-native'],
    ],
    [
      'only gt-react is present and its specifiers differ',
      [{ 'gt-react': '^10.19.1' }, { 'gt-react': '^10.19.3' }],
      ['gt-react:'],
      ['gt-react / gt-react-native'],
    ],
    [
      'only gt-react-native is present and its specifiers differ',
      [{ 'gt-react-native': '^10.19.1' }, { 'gt-react-native': '^10.19.3' }],
      ['gt-react-native:'],
      ['gt-react / gt-react-native'],
    ],
    [
      'gt-react and gt-react-native differ at or above 10.19.1',
      [{ 'gt-react': '^10.19.1' }, { 'gt-react-native': '^10.18.0' }],
      [
        'gt-react / gt-react-native',
        'gt-react in app-a',
        'gt-react-native in app-b',
      ],
      [],
    ],
    [
      'a transitive GT dependency like react-core differs too',
      [
        { 'gt-react': '^10.5.0', '@generaltranslation/react-core': '^1.3.0' },
        { 'gt-react': '^10.11.0', '@generaltranslation/react-core': '^1.5.0' },
      ],
      ['gt-react:', '@generaltranslation/react-core:'],
      [],
    ],
    [
      'several packages share one of the differing specifiers',
      [
        { 'gt-react': '^10.5.0' },
        { 'gt-react': '^10.11.0' },
        { 'gt-react': '^10.11.0' },
      ],
      ['app-a', 'app-b', 'app-c'],
      [],
    ],
  ])('exits with code 1 when %s', (_name, apps, mentions, omits) => {
    setupApps(apps);

    checkMonorepoVersionConsistency(REACT_LIBRARIES);

    expect(process.exit).toHaveBeenCalledWith(1);
    const errorMessage = vi.mocked(logger.error).mock.calls[0][0];
    for (const text of mentions) expect(errorMessage).toContain(text);
    for (const text of omits) expect(errorMessage).not.toContain(text);
  });

  it.each(['package-lock.json', 'yarn.lock', 'bun.lock'])(
    'finds the monorepo root through %s',
    (lockfile) => {
      setupApps([{ 'gt-next': '^6.10.0' }, { 'gt-next': '^6.13.0' }], lockfile);

      checkMonorepoVersionConsistency(REACT_LIBRARIES);

      expect(logger.error).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(1);
    }
  );
});

// Helper to set up common mock patterns
function setupMocks(config: {
  lockfile?: string;
  packageDirs: string[];
  packages: Record<
    string,
    {
      name: string;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    }
  >;
}) {
  const { lockfile = 'pnpm-lock.yaml', packageDirs, packages } = config;

  mockExistsSync.mockImplementation((p: unknown) => {
    const pStr = String(p);

    // Lockfile detection at monorepo root
    if (pStr === path.join('/repo', lockfile)) return true;

    // Package directory package.json files
    for (const dir of packageDirs) {
      if (pStr === path.join(dir, 'package.json')) return true;
    }

    return false;
  });

  mockReadFileSync.mockImplementation((p: unknown) => {
    const pStr = String(p);

    for (const [dir, pkgJson] of Object.entries(packages)) {
      if (pStr === path.join(dir, 'package.json')) {
        return JSON.stringify(pkgJson);
      }
    }

    return '';
  });

  // fg.sync returns package.json paths for scanned directories (excluding root)
  mockFgSync.mockReturnValue(
    packageDirs.map((dir) => path.join(dir, 'package.json'))
  );
}
