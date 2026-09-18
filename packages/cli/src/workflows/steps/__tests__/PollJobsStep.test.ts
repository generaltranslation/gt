import { describe, expect, it, vi } from 'vitest';
import { Libraries } from '../../../types/libraries.js';
import type { ApiClient } from '../../../utils/api.js';
import { TEMPLATE_FILE_NAME } from '../../../utils/constants.js';
import {
  PollTranslationJobsStep,
  type FileStatusTracker,
} from '../PollJobsStep.js';

vi.mock('../../../console/logger.js', () => ({
  logger: {
    createProgressBar: vi.fn(() => ({
      start: vi.fn(),
      stop: vi.fn(),
      advance: vi.fn(),
    })),
  },
}));

type StatusFormatter = {
  generateStatusSuffixText(
    fileTracker: FileStatusTracker,
    fileQueryData: Array<{
      branchId: string;
      fileId: string;
      fileName: string;
      locale: string;
      versionId: string;
    }>
  ): string;
};

const templateFile = {
  branchId: 'branch-1',
  fileId: 'template-1',
  fileName: TEMPLATE_FILE_NAME,
  locale: 'fr',
  versionId: 'version-1',
};

function getStatusText(inlineLibrary?: 'gt-react' | 'gt-vue'): string {
  const step = new PollTranslationJobsStep(
    {} as ApiClient,
    inlineLibrary
  ) as unknown as StatusFormatter;
  const tracker: FileStatusTracker = {
    completed: new Map([['template', templateFile]]),
    failed: new Map(),
    inProgress: new Map(),
    skipped: new Map(),
  };

  return step.generateStatusSuffixText(tracker, [templateFile]);
}

describe('PollTranslationJobsStep inline catalog labels', () => {
  it('labels Vue catalogs as Vue elements', () => {
    expect(getStatusText(Libraries.GT_VUE)).toContain('<Vue Elements>');
  });

  it('preserves the historical React catalog label', () => {
    expect(getStatusText(Libraries.GT_REACT)).toContain('<React Elements>');
    expect(getStatusText()).toContain('<React Elements>');
  });

  it('moves files between tracker maps from awaited job statuses', async () => {
    const files = ['completed', 'failed', 'unknown'].map((status) => ({
      ...templateFile,
      fileId: `${status}-file`,
    }));
    const awaitJobs = vi.fn<ApiClient['awaitJobs']>(async (jobIds, options) => {
      const jobs = jobIds.map((jobId) => ({
        jobId,
        status: jobId.replace('job-', '') as 'completed' | 'failed' | 'unknown',
      }));
      options?.onPoll?.(jobs as never);
      return { complete: true, jobs };
    });
    const api = {
      awaitJobs,
      resolveAliasLocale: (locale: string) => locale,
    } as unknown as ApiClient;
    const step = new PollTranslationJobsStep(api);
    const fileTracker: FileStatusTracker = {
      completed: new Map(),
      failed: new Map(),
      inProgress: new Map(),
      skipped: new Map(),
    };

    const result = await step.run({
      fileTracker,
      fileQueryData: files,
      jobData: {
        jobData: Object.fromEntries(
          files.map((file) => [
            `job-${file.fileId.replace('-file', '')}`,
            {
              sourceFileId: 'source-1',
              fileId: file.fileId,
              versionId: file.versionId,
              branchId: file.branchId,
              targetLocale: file.locale,
              projectId: 'project-1',
              force: false,
            },
          ])
        ),
        locales: [templateFile.locale],
        message: 'enqueued',
      },
      timeoutDuration: 1,
      forceRetranslation: true,
    });

    expect(awaitJobs).toHaveBeenCalledWith(
      ['job-completed', 'job-failed', 'job-unknown'],
      expect.objectContaining({ pollingIntervalSeconds: 5 })
    );
    expect(result.success).toBe(true);
    expect([...result.fileTracker.completed.values()]).toEqual([files[0]]);
    expect([...result.fileTracker.failed.values()]).toEqual([files[1]]);
    expect([...result.fileTracker.skipped.values()]).toEqual([files[2]]);
    expect(result.fileTracker.inProgress.size).toBe(0);
  });

  it('keeps unobserved jobs in progress when polling times out', async () => {
    const api = {
      awaitJobs: vi.fn<ApiClient['awaitJobs']>(async (jobIds) => ({
        complete: false,
        jobs: jobIds.map((jobId) => ({ jobId, status: 'unknown' as const })),
      })),
      resolveAliasLocale: (locale: string) => locale,
    } as unknown as ApiClient;
    const step = new PollTranslationJobsStep(api);
    const fileTracker: FileStatusTracker = {
      completed: new Map(),
      failed: new Map(),
      inProgress: new Map(),
      skipped: new Map(),
    };

    const result = await step.run({
      fileTracker,
      fileQueryData: [templateFile],
      jobData: {
        jobData: {
          'job-1': {
            sourceFileId: 'source-1',
            fileId: templateFile.fileId,
            versionId: templateFile.versionId,
            branchId: templateFile.branchId,
            targetLocale: templateFile.locale,
            projectId: 'project-1',
            force: false,
          },
        },
        locales: [templateFile.locale],
        message: 'enqueued',
      },
      timeoutDuration: 0,
      forceRetranslation: true,
    });

    expect(result.success).toBe(false);
    expect(result.fileTracker.inProgress.size).toBe(1);
    expect(result.fileTracker.skipped.size).toBe(0);
    expect(api.awaitJobs).toHaveBeenCalledWith(
      ['job-1'],
      expect.objectContaining({ timeoutSeconds: 0 })
    );
  });
});
