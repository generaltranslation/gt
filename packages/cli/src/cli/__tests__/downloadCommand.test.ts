import { Command } from 'commander';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DownloadedVersionEntry } from '../../fs/config/downloadedVersions.js';
import type { Settings } from '../../types/index.js';

vi.mock('../../config/generateSettings.js', () => ({
  generateSettings: vi.fn(),
}));

vi.mock('../commands/download.js', () => ({
  handleDownload: vi.fn(),
}));

vi.mock('../../fs/config/downloadedVersions.js', () => ({
  findOrCreateEntry: vi.fn(),
  readLockfile: vi.fn(),
  writeLockfile: vi.fn(),
}));

vi.mock('../../utils/reactPackageCompatibility.js', () => ({
  warnReactPackageCompatibility: vi.fn(),
}));

vi.mock('../../console/logging.js', () => ({
  displayHeader: vi.fn(),
  exitSync: vi.fn(),
  logErrorAndExit: vi.fn(),
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
    setQuiet: vi.fn(),
    warn: vi.fn(),
  },
}));

import { BaseCLI } from '../base.js';
import { handleDownload } from '../commands/download.js';
import { generateSettings } from '../../config/generateSettings.js';
import {
  findOrCreateEntry,
  readLockfile,
  writeLockfile,
} from '../../fs/config/downloadedVersions.js';
import {
  getDownloaded,
  recordDownloaded,
} from '../../state/recentDownloads.js';
import { hashStringSync } from '../../utils/hash.js';

describe('download command', () => {
  let projectDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    projectDir = mkdtempSync(path.join(tmpdir(), 'gt-download-command-'));
    vi.mocked(generateSettings).mockResolvedValue({
      config: path.join(projectDir, 'gt.config.json'),
    } as Settings);
    vi.mocked(readLockfile).mockReturnValue({
      data: { version: 2, branchId: 'branch-1', entries: [] },
      entryMap: new Map(),
      originalV1: null,
    });
  });

  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  it('records the hash of each downloaded file as written', async () => {
    const outputPath = path.join(projectDir, 'es.json');
    const content = '{"hello":"Hola"}';
    const entry: DownloadedVersionEntry = {
      fileId: 'file-1',
      versionId: 'version-1',
      translations: {
        es: {
          updatedAt: '2026-01-01T00:00:00.000Z',
          postProcessHash: 'stale-hash',
        },
      },
    };
    vi.mocked(findOrCreateEntry).mockReturnValue(entry);
    vi.mocked(handleDownload).mockImplementation(async () => {
      writeFileSync(outputPath, content);
      recordDownloaded(outputPath, {
        branchId: 'branch-1',
        fileId: 'file-1',
        versionId: 'version-1',
        locale: 'es',
        fileFormat: 'JSON',
      });
    });

    const program = new Command();
    new BaseCLI(program, 'base').init();
    await program.parseAsync(['download'], { from: 'user' });

    // No postprocessing follows a standalone download, so the lockfile has to
    // hold the hash of the file as written rather than the previous run's hash
    expect(entry.translations.es.postProcessHash).toBe(hashStringSync(content));
    expect(writeLockfile).toHaveBeenCalledTimes(1);
    expect(getDownloaded().size).toBe(0);
  });
});
