import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import type { Settings } from '../../types/index.js';
import {
  getDefaultDriverCommand,
  getGitAttributesEntries,
  getGitConfigCommands,
  mergeGitAttributes,
  setupGitMergeDrivers,
} from '../setupMergeDrivers.js';
import { createMockSettings } from '../../api/__mocks__/settings.js';

describe('setupGitMergeDrivers', () => {
  let tempDir: string | null = null;

  afterEach(() => {
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it('supports dry-run without writing attributes, git config, or GT config', async () => {
    tempDir = createTempGitRepo();
    const configPath = path.join(tempDir, 'gt.config.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({ _versionId: 'version-a', _branchId: 'branch-a' })
    );

    const result = await setupGitMergeDrivers(createSettings(tempDir), {
      cwd: tempDir,
      dryRun: true,
      omitConfigIds: true,
      driverCommand: 'gt',
    });

    expect(result.addedAttributes).toEqual([
      'gt-lock.json merge=gt-lock',
      'public/_gt/*.json merge=gtjson',
    ]);
    expect(fs.existsSync(path.join(tempDir, '.gitattributes'))).toBe(false);
    expect(
      fs.readFileSync(path.join(tempDir, '.git/config'), 'utf8')
    ).not.toContain('merge.gt-lock');
    expect(JSON.parse(fs.readFileSync(configPath, 'utf8'))).toEqual({
      _versionId: 'version-a',
      _branchId: 'branch-a',
    });
  });

  it('writes attributes, local git config, and optional config ID omission', async () => {
    tempDir = createTempGitRepo();
    const configPath = path.join(tempDir, 'gt.config.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({ _versionId: 'version-a', _branchId: 'branch-a' })
    );

    await setupGitMergeDrivers(createSettings(tempDir), {
      cwd: tempDir,
      omitConfigIds: true,
      driverCommand: 'gt',
    });

    expect(fs.readFileSync(path.join(tempDir, '.gitattributes'), 'utf8')).toBe(
      'gt-lock.json merge=gt-lock\npublic/_gt/*.json merge=gtjson\n'
    );
    expect(
      execFileSync(
        'git',
        ['config', '--local', '--get', 'merge.gt-lock.driver'],
        {
          cwd: tempDir,
          encoding: 'utf8',
        }
      ).trim()
    ).toBe('gt git merge-driver gt-lock %O %A %B %P');
    expect(JSON.parse(fs.readFileSync(configPath, 'utf8'))).toEqual({
      omitConfigIds: true,
    });
  });

  it('fails with a clear error outside a git repository', async () => {
    tempDir = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'gt-driver-'))
    );

    await expect(
      setupGitMergeDrivers(createSettings(tempDir), { cwd: tempDir })
    ).rejects.toThrow('No Git repository found');
  });
});

describe('getGitAttributesEntries', () => {
  it('creates lockfile and gtjson attribute entries relative to the git root', () => {
    const settings = createMockSettings({
      files: {
        resolvedPaths: {},
        placeholderPaths: {
          gt: '/repo/public/_gt/[locale].json',
        },
        transformPaths: {},
      },
    }) as Settings;

    expect(getGitAttributesEntries(settings, '/repo', '/repo')).toEqual([
      { pattern: 'gt-lock.json', driver: 'merge=gt-lock' },
      { pattern: 'public/_gt/*.json', driver: 'merge=gtjson' },
    ]);
  });

  it('escapes spaces in generated patterns', () => {
    const settings = createMockSettings({
      files: {
        resolvedPaths: {},
        placeholderPaths: {
          gt: '/repo/public/my translations/[locale].json',
        },
        transformPaths: {},
      },
    }) as Settings;

    expect(getGitAttributesEntries(settings, '/repo', '/repo')[1]).toEqual({
      pattern: 'public/my\\ translations/*.json',
      driver: 'merge=gtjson',
    });
  });
});

function createTempGitRepo(): string {
  const tempDir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'gt-driver-'))
  );
  execFileSync('git', ['init'], { cwd: tempDir, stdio: 'ignore' });
  return tempDir;
}

function createSettings(tempDir: string): Settings {
  return createMockSettings({
    config: path.join(tempDir, 'gt.config.json'),
    files: {
      resolvedPaths: {},
      placeholderPaths: {
        gt: path.join(tempDir, 'public/_gt/[locale].json'),
      },
      transformPaths: {},
    },
  }) as Settings;
}

describe('mergeGitAttributes', () => {
  it('appends missing entries without duplicating existing entries', () => {
    const result = mergeGitAttributes('gt-lock.json merge=gt-lock\n', [
      'gt-lock.json merge=gt-lock',
      'public/_gt/*.json merge=gtjson',
    ]);

    expect(result).toEqual({
      content: 'gt-lock.json merge=gt-lock\npublic/_gt/*.json merge=gtjson\n',
      added: ['public/_gt/*.json merge=gtjson'],
    });
  });
});

describe('getGitConfigCommands', () => {
  it('builds local git config commands for both merge drivers', () => {
    expect(getGitConfigCommands('pnpm exec gt')).toEqual([
      ['merge.gt-lock.name', 'GT lockfile merge driver'],
      [
        'merge.gt-lock.driver',
        'pnpm exec gt git merge-driver gt-lock %O %A %B %P',
      ],
      ['merge.gtjson.name', 'GTJSON merge driver'],
      [
        'merge.gtjson.driver',
        'pnpm exec gt git merge-driver gtjson %O %A %B %P',
      ],
    ]);
  });
});

describe('getDefaultDriverCommand', () => {
  let tempDir: string | null = null;

  afterEach(() => {
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it('prefers the local sh shim with forward slashes when present', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-driver-'));
    const binDir = path.join(tempDir, 'node_modules', '.bin');
    fs.mkdirSync(binDir, { recursive: true });
    const binPath = path.join(binDir, 'gt');
    fs.writeFileSync(binPath, '');

    expect(getDefaultDriverCommand(tempDir)).toBe(
      `"${binPath.split(path.sep).join('/')}"`
    );
  });

  it('falls back to gt on PATH when no local binary exists', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-driver-'));

    expect(getDefaultDriverCommand(tempDir)).toBe('gt');
  });
});
