import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import os from 'node:os';
import { saveLocalEdits } from '../saveLocalEdits.js';
import { createMockSettings } from '../__mocks__/settings.js';
import { TEMPLATE_FILE_ID } from '../../utils/constants.js';
import type { DownloadedVersionsV1 } from '../../fs/config/downloadedVersions.js';

vi.mock('../../utils/api.js', () => ({
  api: {
    queryBranchData: vi.fn(),
    createBranch: vi.fn(),
  },
}));
vi.mock('../../workflows/steps/BranchStep.js', () => ({
  BranchStep: vi.fn(() => ({
    run: vi.fn(async () => ({
      currentBranch: { id: 'branch-1', name: 'main' },
    })),
  })),
}));
vi.mock('../../formats/files/aggregateFiles.js', () => ({
  aggregateFiles: vi.fn(async () => ({
    files: [
      {
        fileName: 'app.json',
        fileFormat: 'JSON',
        fileId: 'file-json',
        versionId: 'version-json',
      },
    ],
    publishMap: new Map<string, boolean>(),
  })),
}));
vi.mock('../collectUserEditDiffs.js', () => ({
  collectAndSendUserEditDiffs: vi.fn(async () => true),
}));
vi.mock('../../workflows/publish.js', () => ({
  runPublishWorkflow: vi.fn(async () => {}),
}));
vi.mock('../../console/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    success: vi.fn(),
    createSpinner: vi.fn(() => ({
      start: vi.fn(),
      stop: vi.fn(),
      message: vi.fn(),
      succeed: vi.fn(),
      fail: vi.fn(),
    })),
  },
}));

import { collectAndSendUserEditDiffs } from '../collectUserEditDiffs.js';
import { runPublishWorkflow } from '../../workflows/publish.js';

describe('saveLocalEdits - template lookup uses the resolved branch', () => {
  const originalCwd = process.cwd();
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'gt-save-local-'))
    );
    process.chdir(tempDir);
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const buildSettings = () =>
    createMockSettings({
      configDirectory: tempDir,
      config: path.join(tempDir, 'gt.config.json'),
      defaultLocale: 'en',
      locales: ['en', 'ja'],
      branchOptions: {
        enabled: true,
        currentBranch: '',
        autoDetectBranches: false,
        remoteName: 'origin',
      },
      files: {
        resolvedPaths: {},
        placeholderPaths: { gt: path.join(tempDir, 'files.gt') },
        transformPaths: {},
        gtJson: {},
      },
    });

  /**
   * The stale branch is listed first and carries no template entry, while the
   * current branch has one — the case where the first branch hides the template.
   */
  const writeLockFile = () => {
    const lockfile: DownloadedVersionsV1 = {
      version: 1,
      entries: {
        'stale-branch': {
          file1: {
            'version-stale': {
              ja: { updatedAt: '2026-01-01T00:00:00.000Z' },
            },
          },
        },
        'branch-1': {
          [TEMPLATE_FILE_ID]: {
            'version-template-current': {
              ja: { updatedAt: '2026-11-01T00:00:00.000Z' },
            },
          },
        },
      },
    };
    fs.writeFileSync(
      path.join(tempDir, 'gt-lock.json'),
      JSON.stringify(lockfile, null, 2)
    );
  };

  it('finds the template on the resolved branch and passes its version to the collector', async () => {
    const settings = buildSettings();
    writeLockFile();

    await saveLocalEdits(settings);

    expect(collectAndSendUserEditDiffs).toHaveBeenCalledTimes(1);
    const [uploads] = vi.mocked(collectAndSendUserEditDiffs).mock.calls[0];
    const template = uploads.find((file) => file.fileId === TEMPLATE_FILE_ID);
    expect(template?.versionId).toBe('version-template-current');
    expect(template?.branchId).toBe('branch-1');
  });

  it('reports no saved edits instead of an unqualified success', async () => {
    const settings = buildSettings();
    writeLockFile();
    vi.mocked(collectAndSendUserEditDiffs).mockResolvedValue(false);

    await saveLocalEdits(settings);

    expect(collectAndSendUserEditDiffs).toHaveBeenCalledTimes(1);
    // Nothing was published without a diff.
    expect(runPublishWorkflow).not.toHaveBeenCalled();
  });
});
