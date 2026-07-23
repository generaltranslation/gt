import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GT } from 'generaltranslation';
import type { FileProperties } from '../../../types/files.js';
import { PollTranslationJobsStep } from '../PollJobsStep.js';

const spinner = {
  start: vi.fn(),
  stop: vi.fn(),
  advance: vi.fn(),
};

vi.mock('../../../console/logger.js', () => ({
  logger: {
    createProgressBar: vi.fn(() => spinner),
    error: vi.fn(),
  },
}));

describe('PollTranslationJobsStep', () => {
  const fileQueryData: FileProperties[] = ['es', 'fr'].map((locale) => ({
    branchId: 'branch-1',
    fileId: 'file-1',
    versionId: 'version-1',
    fileName: 'messages.json',
    locale,
  }));

  const gt = {
    resolveAliasLocale: vi.fn((locale: string) => locale),
    queryFileData: vi.fn(),
    checkJobStatus: vi.fn(),
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reuses known locale completion while polling the remaining locale', async () => {
    gt.checkJobStatus.mockResolvedValue([
      { jobId: 'job-fr', status: 'completed' },
    ]);
    const step = new PollTranslationJobsStep(gt as unknown as GT);

    const resultPromise = step.run({
      fileTracker: {
        completed: new Map(),
        inProgress: new Map(),
        failed: new Map(),
        skipped: new Map(),
      },
      fileQueryData,
      jobData: {
        jobData: {
          'job-fr': {
            sourceFileId: 'source-1',
            fileId: 'file-1',
            versionId: 'version-1',
            branchId: 'branch-1',
            targetLocale: 'fr',
            projectId: 'project-1',
            force: false,
          },
        },
        locales: ['es', 'fr'],
        message: 'Translation queued',
      },
      timeoutDuration: 30,
      completedTranslationKeys: new Set(['branch-1:file-1:version-1:es']),
    });

    await vi.advanceTimersByTimeAsync(10_000);
    const result = await resultPromise;

    expect(gt.queryFileData).not.toHaveBeenCalled();
    expect(gt.checkJobStatus).toHaveBeenCalledWith(['job-fr']);
    expect([...result.fileTracker.completed.keys()]).toEqual([
      'branch-1:file-1:version-1:es',
      'branch-1:file-1:version-1:fr',
    ]);
  });
});
