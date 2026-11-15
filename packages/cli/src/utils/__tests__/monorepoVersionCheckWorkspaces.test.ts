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

function writeJson(filePath: string, value: object) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value));
}

describe('checkMonorepoVersionConsistency workspace discovery', () => {
  const originalCwd = process.cwd;
  const originalExit = process.exit;
  let root: string;

  /** Packages app, shared and old; app and the named package disagree on gt-react. */
  function setupRepo(workspaces: string[], mismatched: 'shared' | 'old') {
    writeJson(path.join(root, 'package.json'), { name: 'root', workspaces });
    fs.writeFileSync(path.join(root, 'package-lock.json'), '{}');
    for (const [dir, name] of [
      ['packages/app', 'app'],
      ['packages/legacy/shared', 'shared'],
      ['packages/legacy/old', 'old'],
    ]) {
      writeJson(path.join(root, dir, 'package.json'), {
        name,
        dependencies: {
          'gt-react': name === mismatched ? '^10.19.3' : '^10.19.1',
        },
      });
    }
  }

  beforeEach(() => {
    vi.clearAllMocks();
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'gt-ws-')));
    process.cwd = () => path.join(root, 'packages/app');
    process.exit = vi.fn() as unknown as typeof process.exit;
  });

  afterEach(() => {
    process.cwd = originalCwd;
    process.exit = originalExit;
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('checks a package that a later pattern re-includes', () => {
    setupRepo(
      ['packages/**', '!packages/legacy/**', 'packages/legacy/shared'],
      'shared'
    );

    checkMonorepoVersionConsistency(REACT_LIBRARIES);

    expect(process.exit).toHaveBeenCalledWith(1);
    expect(vi.mocked(logger.error).mock.calls[0][0]).toContain('shared');
  });

  it('skips a package that a pattern excludes', () => {
    setupRepo(['packages/**', '!packages/legacy/old'], 'old');

    checkMonorepoVersionConsistency(REACT_LIBRARIES);

    expect(process.exit).not.toHaveBeenCalled();
  });

  it('skips a package outside the declared workspaces', () => {
    setupRepo(['packages/*'], 'shared');

    checkMonorepoVersionConsistency(REACT_LIBRARIES);

    expect(process.exit).not.toHaveBeenCalled();
  });
});
