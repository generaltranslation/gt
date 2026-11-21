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
import { aggregateFiles } from '../../formats/files/aggregateFiles.js';
import { BranchStep } from '../../workflows/steps/BranchStep.js';
import { clearWarnings, recordWarning } from '../../state/translateWarnings.js';
import { saveLocalEditsMessage } from '../saveLocalEdits.js';

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

    const outcome = await saveLocalEdits(settings);

    expect(outcome).toEqual({ saved: false, skipped: 0 });
    expect(collectAndSendUserEditDiffs).toHaveBeenCalledTimes(1);
    // Nothing was published without a diff.
    expect(runPublishWorkflow).not.toHaveBeenCalled();
  });

  it('does not resolve a branch when there is nothing to save', async () => {
    // No configured files and no files.gt: the run cannot collect anything, so
    // it must not reach the branch step, which can create the branch remotely.
    const settings = createMockSettings({
      configDirectory: tempDir,
      config: path.join(tempDir, 'gt.config.json'),
      defaultLocale: 'en',
      locales: ['en', 'ja'],
      files: {
        resolvedPaths: {},
        placeholderPaths: {},
        transformPaths: {},
        gtJson: {},
      },
    });
    vi.mocked(aggregateFiles).mockResolvedValueOnce({
      files: [],
      publishMap: new Map<string, boolean>(),
    });

    const outcome = await saveLocalEdits(settings);

    expect(outcome).toEqual({ saved: false, skipped: 0 });
    expect(BranchStep).not.toHaveBeenCalled();
    expect(collectAndSendUserEditDiffs).not.toHaveBeenCalled();
  });

  it('says a partial save is partial instead of reporting a clean success', async () => {
    const settings = buildSettings();
    writeLockFile();
    // The collector saved this locale and skipped another one, which it
    // reports as a warning of its own.
    vi.mocked(collectAndSendUserEditDiffs).mockImplementationOnce(async () => {
      recordWarning(
        'skipped_file',
        'docs/ja/doc.md',
        'the ja baseline could not be retrieved'
      );
      return true;
    });

    const outcome = await saveLocalEdits(settings);

    expect(outcome).toEqual({ saved: true, skipped: 1 });
    expect(saveLocalEditsMessage(outcome)).toContain('1 could not be saved');
  });

  it('does not call a save partial because of an earlier unrelated warning', async () => {
    const settings = buildSettings();
    writeLockFile();
    // A warning left over from an earlier collection describes a different
    // run and must not turn this run's clean save into a partial one.
    recordWarning('skipped_file', 'docs/ja/old.md', 'unrelated earlier skip');
    vi.mocked(collectAndSendUserEditDiffs).mockResolvedValueOnce(true);

    const outcome = await saveLocalEdits(settings);

    expect(outcome).toEqual({ saved: true, skipped: 0 });
    expect(saveLocalEditsMessage(outcome)).toBe(
      'Local edits saved successfully'
    );
    clearWarnings();
  });

  it('reports the skipped edits when every edit was skipped', async () => {
    const settings = buildSettings();
    writeLockFile();
    // Nothing was submitted and an edit was skipped, so reporting only "no
    // edits were saved" would hide that the edit was detected.
    vi.mocked(collectAndSendUserEditDiffs).mockImplementationOnce(async () => {
      recordWarning('skipped_file', 'docs/ja/doc.md', 'baseline unavailable');
      return false;
    });

    const outcome = await saveLocalEdits(settings);

    expect(outcome).toEqual({ saved: false, skipped: 1 });
    expect(saveLocalEditsMessage(outcome)).toContain(
      '1 local edit(s) could not be saved'
    );
  });
});
