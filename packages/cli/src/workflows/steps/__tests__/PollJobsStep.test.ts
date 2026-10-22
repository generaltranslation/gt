import { describe, expect, it, vi } from 'vitest';
import { awaitJobs, createApiClient } from 'generaltranslation/api';
import { Libraries } from '../../../types/libraries.js';
import type { ProjectHandle } from 'generaltranslation';
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
    {} as ProjectHandle,
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
    const files = ['completed', 'failed', 'not_found'].map((status) => ({
      ...templateFile,
      fileId: `${status}-file`,
    }));
    const awaitJobs = vi.fn<ProjectHandle['awaitJobs']>(
      async (jobIds, options) => {
        const jobs = jobIds.map((id) => ({
          id,
          status: id.replace('job-', '') as
            | 'completed'
            | 'failed'
            | 'not_found',
        }));
        options?.onPoll?.(jobs);
        return { complete: true, jobs };
      }
    );
    const api = {
      awaitJobs,
    } as unknown as ProjectHandle;
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
              fileId: file.fileId,
              versionId: file.versionId,
              branchId: file.branchId,
              targetLocale: file.locale,
            },
          ])
        ),
        message: 'enqueued',
      },
      timeoutDuration: 1,
      forceRetranslation: true,
    });

    expect(awaitJobs).toHaveBeenCalledWith(
      ['job-completed', 'job-failed', 'job-not_found'],
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
      awaitJobs: vi.fn<ProjectHandle['awaitJobs']>(async (jobIds) => ({
        complete: false,
        jobs: jobIds.map((id) => ({ id, status: 'unknown' as const })),
      })),
    } as unknown as ProjectHandle;
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
            fileId: templateFile.fileId,
            versionId: templateFile.versionId,
            branchId: templateFile.branchId,
            targetLocale: templateFile.locale,
          },
        },
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

  it('marks the jobs that completed before the deadline for download', async () => {
    const files = Array.from({ length: 101 }, (_, index) => ({
      ...templateFile,
      fileId: `file-${index}`,
    }));
    // The first batch of 100 completes; the second batch answers only after the deadline.
    const client = createApiClient({
      baseUrl: 'https://example.com',
      retryPolicy: 'none',
      fetch: async (input) => {
        const request = new Request(input);
        const { jobs } = (await request.clone().json()) as {
          jobs: Array<{ id: string }>;
        };
        if (jobs.length < 100) {
          return new Promise<Response>((_, reject) =>
            request.signal.addEventListener('abort', () =>
              setTimeout(() => reject(request.signal.reason), 10)
            )
          );
        }
        return Response.json({
          results: jobs.map(({ id }) => ({ id, status: 'completed' })),
        });
      },
    });
    const api = {
      awaitJobs: ((jobIds, options) =>
        awaitJobs(
          client,
          'project-1',
          jobIds,
          options
        )) satisfies ProjectHandle['awaitJobs'],
    } as unknown as ProjectHandle;
    const step = new PollTranslationJobsStep(api);

    const result = await step.run({
      fileTracker: {
        completed: new Map(),
        failed: new Map(),
        inProgress: new Map(),
        skipped: new Map(),
      },
      fileQueryData: files,
      jobData: {
        jobData: Object.fromEntries(
          files.map((file, index) => [
            `job-${index}`,
            {
              fileId: file.fileId,
              versionId: file.versionId,
              branchId: file.branchId,
              targetLocale: file.locale,
            },
          ])
        ),
        message: 'enqueued',
      },
      timeoutDuration: 1,
      forceRetranslation: true,
    });

    expect(result.success).toBe(false);
    expect([...result.fileTracker.completed.values()]).toEqual(
      files.slice(0, 100)
    );
    expect([...result.fileTracker.inProgress.values()]).toEqual([files[100]]);
  });
});
