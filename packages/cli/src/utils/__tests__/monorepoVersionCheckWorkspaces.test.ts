import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

vi.mock('../../console/logger.js', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    flush: vi.fn(),
  },
}));

import { logger } from '../../console/logger.js';
import { checkMonorepoVersionConsistency } from '../monorepoVersionCheck.js';
import { REACT_LIBRARIES } from '../../types/libraries.js';

const PACKAGES = {
  app: 'packages/app',
  old: 'packages/old',
  shared: 'packages/legacy/shared',
  archived: 'packages/legacy/archived',
};

type PackageName = keyof typeof PACKAGES;

function writeJson(filePath: string, value: object) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value));
}

describe('checkMonorepoVersionConsistency workspace discovery', () => {
  const originalCwd = process.cwd;
  const originalExit = process.exit;
  let root: string;

  beforeEach(() => {
    vi.clearAllMocks();
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'gt-ws-')));
    fs.writeFileSync(path.join(root, 'package-lock.json'), '{}');
    // Every package declares a different version, so the error names each package checked.
    Object.entries(PACKAGES).forEach(([name, dir], index) => {
      writeJson(path.join(root, dir, 'package.json'), {
        name,
        dependencies: { 'gt-react': `^10.19.${index + 1}` },
      });
    });
    process.cwd = () => path.join(root, PACKAGES.app);
    process.exit = vi.fn() as unknown as typeof process.exit;
  });

  afterEach(() => {
    process.cwd = originalCwd;
    process.exit = originalExit;
    fs.rmSync(root, { recursive: true, force: true });
  });

  // Expected packages are the ones both npm and bun treat as workspaces.
  it.each<[string, string[], PackageName[]]>([
    ['only declared packages', ['packages/*'], ['app', 'old']],
    [
      'no package that a pattern excludes',
      ['packages/**', '!packages/old'],
      ['app', 'shared', 'archived'],
    ],
    [
      'no excluded package that a later glob matches',
      ['packages/*', '!packages/old', 'packages/**'],
      ['app', 'shared', 'archived'],
    ],
    [
      'an excluded package that a later pattern names',
      ['packages/**', '!packages/legacy/**', 'packages/legacy/shared'],
      ['app', 'old', 'shared'],
    ],
    [
      'no named package that a later pattern excludes',
      [
        'packages/app',
        'packages/old',
        'packages/legacy/shared',
        '!packages/old',
      ],
      ['app', 'shared'],
    ],
  ])('checks %s', (_name, workspaces, expected) => {
    writeJson(path.join(root, 'package.json'), { name: 'root', workspaces });

    checkMonorepoVersionConsistency(REACT_LIBRARIES);

    expect(process.exit).toHaveBeenCalledWith(1);
    const message = vi.mocked(logger.error).mock.calls[0][0];
    const checked = Object.keys(PACKAGES).filter((name) =>
      new RegExp(`\\b${name}\\b`).test(message)
    );
    expect(checked.sort()).toEqual([...expected].sort());
  });
});
