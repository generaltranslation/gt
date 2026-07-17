import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Settings, TranslateFlags } from '../../types/index.js';
import type { FileToUpload } from 'generaltranslation/types';
import { logger } from '../../console/logger.js';
import { runStageFilesWorkflow } from '../stage.js';

const mocks = vi.hoisted(() => ({
  branchRun: vi.fn(),
  uploadRun: vi.fn(),
  userEditDiffsRun: vi.fn(),
  userEditDiffsFailed: false,
  setupRun: vi.fn(),
  enqueueRun: vi.fn(),
  stepWait: vi.fn(),
}));

vi.mock('../steps/BranchStep.js', () => ({
  BranchStep: vi.fn(() => ({ run: mocks.branchRun, wait: mocks.stepWait })),
}));

vi.mock('../steps/UploadSourcesStep.js', () => ({
  UploadSourcesStep: vi.fn(() => ({
    run: mocks.uploadRun,
    wait: mocks.stepWait,
  })),
}));

vi.mock('../steps/UserEditDiffsStep.js', () => ({
  UserEditDiffsStep: vi.fn(() => ({
    run: mocks.userEditDiffsRun,
    wait: mocks.stepWait,
    get hasFailed() {
      return mocks.userEditDiffsFailed;
    },
  })),
}));

vi.mock('../steps/SetupStep.js', () => ({
  SetupStep: vi.fn(() => ({ run: mocks.setupRun, wait: mocks.stepWait })),
}));

vi.mock('../steps/EnqueueStep.js', () => ({
  EnqueueStep: vi.fn(() => ({ run: mocks.enqueueRun, wait: mocks.stepWait })),
}));

vi.mock('../steps/TagStep.js', () => ({
  TagStep: vi.fn(() => ({ run: vi.fn(), wait: vi.fn() })),
}));

vi.mock('../utils/filterFilesForEnqueue.js', () => ({
  filterFilesForEnqueue: vi.fn(
    async ({ files }: { files: FileToUpload[] }) => ({
      filesToEnqueue: files,
      skippedFiles: [],
    })
  ),
}));

vi.mock('../../console/logging.js', () => ({
  logCollectedFiles: vi.fn(),
  logErrorAndExit: vi.fn((message: unknown) => {
    throw new Error(String(message));
  }),
}));

vi.mock('../../console/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('../../utils/gt.js', () => ({
  gt: {},
}));

describe('runStageFilesWorkflow', () => {
  const settings = {
    locales: ['es'],
  } as Settings;

  const files = [{ fileName: 'messages/en.json' }] as FileToUpload[];

  const branchData = {
    currentBranch: { id: 'branch-1', name: 'main' },
    incomingBranch: null,
    checkedOutBranch: null,
  };

  const uploadedFiles = [
    {
      fileId: 'file-1',
      versionId: 'version-1',
      branchId: 'branch-1',
      fileName: 'messages/en.json',
    },
  ];

  const enqueueResult = {
    jobData: {},
    locales: ['es'],
    message: 'Files enqueued',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userEditDiffsFailed = false;
    mocks.branchRun.mockResolvedValue(branchData);
    mocks.uploadRun.mockResolvedValue(uploadedFiles);
    mocks.userEditDiffsRun.mockImplementation(async (f) => f);
    mocks.setupRun.mockImplementation(async (f) => f);
    mocks.enqueueRun.mockResolvedValue(enqueueResult);
    mocks.stepWait.mockResolvedValue(undefined);
  });

  it('skips the user edit diffs step by default', async () => {
    await runStageFilesWorkflow({
      files,
      options: {} as TranslateFlags,
      settings,
    });

    expect(mocks.userEditDiffsRun).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('runs the user edit diffs step when saveLocal is set', async () => {
    await runStageFilesWorkflow({
      files,
      options: { saveLocal: true } as TranslateFlags,
      settings,
    });

    expect(mocks.userEditDiffsRun).toHaveBeenCalledWith(uploadedFiles);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('uploads user edit diffs before enqueueing when force is set', async () => {
    await runStageFilesWorkflow({
      files,
      options: { force: true } as TranslateFlags,
      settings,
    });

    expect(mocks.userEditDiffsRun).toHaveBeenCalledWith(uploadedFiles);
    expect(mocks.userEditDiffsRun.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.enqueueRun.mock.invocationCallOrder[0]
    );
  });

  it('uploads user edit diffs before enqueueing when forceDownload is set', async () => {
    await runStageFilesWorkflow({
      files,
      options: { forceDownload: true } as TranslateFlags,
      settings,
    });

    expect(mocks.userEditDiffsRun).toHaveBeenCalledWith(uploadedFiles);
    expect(mocks.userEditDiffsRun.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.enqueueRun.mock.invocationCallOrder[0]
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('--force-download')
    );
  });

  it('aborts the force run before enqueueing when the diff upload fails', async () => {
    mocks.userEditDiffsFailed = true;

    await expect(
      runStageFilesWorkflow({
        files,
        options: { force: true } as TranslateFlags,
        settings,
      })
    ).rejects.toThrow();

    expect(mocks.enqueueRun).not.toHaveBeenCalled();
  });

  it('does not abort a saveLocal run when the diff upload fails', async () => {
    mocks.userEditDiffsFailed = true;

    await runStageFilesWorkflow({
      files,
      options: { saveLocal: true } as TranslateFlags,
      settings,
    });

    expect(mocks.enqueueRun).toHaveBeenCalled();
  });

  it('warns that force overwrites existing translations', async () => {
    await runStageFilesWorkflow({
      files,
      options: { force: true } as TranslateFlags,
      settings,
    });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('--force')
    );
  });
});
