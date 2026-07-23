import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FileReference, FileToUpload } from 'generaltranslation/types';
import type { Settings, TranslateFlags } from '../../types/index.js';
import { runStageFilesWorkflow } from '../stage.js';
import { filterFilesForEnqueue } from '../utils/filterFilesForEnqueue.js';

const mocks = vi.hoisted(() => ({
  branchRun: vi.fn(),
  branchWait: vi.fn(),
  uploadRun: vi.fn(),
  uploadWait: vi.fn(),
  setupRun: vi.fn(),
  setupWait: vi.fn(),
  enqueueRun: vi.fn(),
  enqueueWait: vi.fn(),
}));

vi.mock('../steps/BranchStep.js', () => ({
  BranchStep: class {
    run = mocks.branchRun;
    wait = mocks.branchWait;
  },
}));

vi.mock('../steps/UploadSourcesStep.js', () => ({
  UploadSourcesStep: class {
    run = mocks.uploadRun;
    wait = mocks.uploadWait;
  },
}));

vi.mock('../steps/UserEditDiffsStep.js', () => ({
  UserEditDiffsStep: class {
    run = vi.fn();
    wait = vi.fn();
  },
}));

vi.mock('../steps/SetupStep.js', () => ({
  SetupStep: class {
    run = mocks.setupRun;
    wait = mocks.setupWait;
  },
}));

vi.mock('../steps/EnqueueStep.js', () => ({
  EnqueueStep: class {
    run = mocks.enqueueRun;
    wait = mocks.enqueueWait;
  },
}));

vi.mock('../steps/TagStep.js', () => ({
  TagStep: class {
    run = vi.fn();
    wait = vi.fn();
  },
}));

vi.mock('../utils/filterFilesForEnqueue.js', () => ({
  filterFilesForEnqueue: vi.fn(),
}));

vi.mock('../../utils/gt.js', () => ({ gt: {} }));

vi.mock('../../console/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../../console/logging.js', () => ({
  logCollectedFiles: vi.fn(),
  logErrorAndExit: vi.fn((error: unknown) => {
    throw error;
  }),
}));

describe('runStageFilesWorkflow', () => {
  const sourceFile: FileToUpload = {
    fileId: 'file-1',
    versionId: 'version-1',
    fileName: 'messages.json',
    fileFormat: 'JSON',
    content: '{}',
    locale: 'en',
  };
  const uploadedFile: FileReference = {
    fileId: 'file-1',
    versionId: 'version-1',
    branchId: 'branch-1',
    fileName: 'messages.json',
    fileFormat: 'JSON',
  };
  const branchData = {
    currentBranch: { id: 'branch-1', name: 'main' },
    incomingBranch: null,
    checkedOutBranch: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.branchRun.mockResolvedValue(branchData);
    mocks.uploadRun.mockResolvedValue([uploadedFile]);
    mocks.setupRun.mockResolvedValue(undefined);
    mocks.enqueueRun.mockResolvedValue({
      jobData: {},
      locales: ['es'],
      message: 'No files need to be enqueued',
    });
    vi.mocked(filterFilesForEnqueue).mockResolvedValue({
      filesToEnqueue: [],
      skippedFiles: [uploadedFile],
      completedTranslationKeys: new Set(['branch-1:file-1:version-1:es']),
    });
  });

  it('runs setup for uploaded files even when enqueue can be skipped', async () => {
    const result = await runStageFilesWorkflow({
      files: [sourceFile],
      options: { timeout: 30 } as TranslateFlags,
      settings: {
        locales: ['es'],
      } as Settings,
    });

    expect(mocks.setupRun).toHaveBeenCalledWith([uploadedFile]);
    expect(mocks.enqueueRun).toHaveBeenCalledWith([]);
    expect(mocks.setupRun.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(filterFilesForEnqueue).mock.invocationCallOrder[0]
    );
    expect(result.completedTranslationKeys).toEqual(
      new Set(['branch-1:file-1:version-1:es'])
    );
  });
});
