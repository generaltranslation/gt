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

  it('forwards the per-poll abort signal to the CLI API loader', async () => {
    const checkJobStatus = vi
      .fn()
      .mockResolvedValue([{ jobId: 'job-1', status: 'completed' }]);
    const api = {
      checkJobStatus,
      resolveAliasLocale: (locale: string) => locale,
    } as unknown as ApiClient;
    const step = new PollTranslationJobsStep(api);
    const fileTracker: FileStatusTracker = {
      completed: new Map(),
      failed: new Map(),
      inProgress: new Map(),
      skipped: new Map(),
    };

    await step.run({
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
      timeoutDuration: 1,
      forceRetranslation: true,
    });

    expect(checkJobStatus).toHaveBeenCalledWith(
      ['job-1'],
      expect.any(AbortSignal)
    );
  });
});
