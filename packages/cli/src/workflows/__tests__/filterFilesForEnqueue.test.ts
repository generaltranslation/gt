import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FileReference } from 'generaltranslation/types';
import { createMockSettings } from '../../api/__mocks__/settings.js';
import type { BranchData } from '../../types/branch.js';
import type { Settings } from '../../types/index.js';
import { filterFilesForEnqueue } from '../utils/filterFilesForEnqueue.js';

describe('filterFilesForEnqueue', () => {
  const originalCwd = process.cwd();
  let tempDir: string;

  const branchData: BranchData = {
    currentBranch: { id: 'branch-1', name: 'main' },
    incomingBranch: null,
    checkedOutBranch: null,
  };

  const file: FileReference = {
    branchId: 'branch-1',
    fileId: 'file-1',
    versionId: 'version-1',
    fileName: 'messages/en.json',
    fileFormat: 'JSON',
  };

  function settings(): Settings {
    return createMockSettings({
      defaultLocale: 'en',
      locales: ['es', 'fr'],
      files: {
        resolvedPaths: {
          json: [path.join(tempDir, 'messages/en.json')],
        },
        placeholderPaths: {
          json: [path.join(tempDir, 'messages/[locale].json')],
        },
        transformPaths: {},
        transformFormats: {},
        publishPaths: new Set(),
        unpublishPaths: new Set(),
        parsingFlags: {},
        gtJson: {
          parsingFlags: {},
        },
      },
    });
  }

  function writeLockfile(branchId = 'branch-1'): void {
    fs.writeFileSync(
      path.join(tempDir, 'gt-lock.json'),
      JSON.stringify(
        {
          version: 2,
          branchId,
          entries: [
            {
              fileId: 'file-1',
              versionId: 'version-1',
              fileName: 'messages/en.json',
              translations: {
                es: {
                  updatedAt: '2026-01-01T00:00:00.000Z',
                  fileName: 'messages/es.json',
                },
                fr: {
                  updatedAt: '2026-01-01T00:00:00.000Z',
                  fileName: 'messages/fr.json',
                },
              },
            },
          ],
        },
        null,
        2
      )
    );
  }

  beforeEach(() => {
    tempDir = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'enqueue-filter-'))
    );
    process.chdir(tempDir);
    fs.mkdirSync(path.join(tempDir, 'messages'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'messages/en.json'), '{}');
    fs.writeFileSync(path.join(tempDir, 'messages/es.json'), '{}');
    fs.writeFileSync(path.join(tempDir, 'messages/fr.json'), '{}');
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('skips enqueue when the current branch lockfile has every locale locally', () => {
    writeLockfile();

    const result = filterFilesForEnqueue({
      files: [file],
      settings: settings(),
      branchData,
    });

    expect(result.filesToEnqueue).toEqual([]);
    expect(result.skippedFiles).toEqual([file]);
  });

  it('enqueues when the lockfile belongs to a different branch', () => {
    writeLockfile('branch-2');

    const result = filterFilesForEnqueue({
      files: [file],
      settings: settings(),
      branchData,
    });

    expect(result.filesToEnqueue).toEqual([file]);
    expect(result.skippedFiles).toEqual([]);
  });

  it('uses legacy empty-branch lockfiles when branching is disabled', () => {
    writeLockfile('');

    const result = filterFilesForEnqueue({
      files: [file],
      settings: settings(),
      branchData,
    });

    expect(result.filesToEnqueue).toEqual([]);
    expect(result.skippedFiles).toEqual([file]);
  });

  it('does not use legacy empty-branch lockfiles when branching is enabled', () => {
    writeLockfile('');

    const result = filterFilesForEnqueue({
      files: [file],
      settings: createMockSettings({
        ...settings(),
        branchOptions: {
          enabled: true,
          currentBranch: 'main',
          autoDetectBranches: false,
          remoteName: 'origin',
        },
      }),
      branchData,
    });

    expect(result.filesToEnqueue).toEqual([file]);
    expect(result.skippedFiles).toEqual([]);
  });

  it('enqueues when any target locale output is missing locally', () => {
    writeLockfile();
    fs.rmSync(path.join(tempDir, 'messages/fr.json'));

    const result = filterFilesForEnqueue({
      files: [file],
      settings: settings(),
      branchData,
    });

    expect(result.filesToEnqueue).toEqual([file]);
    expect(result.skippedFiles).toEqual([]);
  });

  it('does not skip when force is enabled', () => {
    writeLockfile();

    const result = filterFilesForEnqueue({
      files: [file],
      settings: settings(),
      branchData,
      force: true,
    });

    expect(result.filesToEnqueue).toEqual([file]);
    expect(result.skippedFiles).toEqual([]);
  });
});
