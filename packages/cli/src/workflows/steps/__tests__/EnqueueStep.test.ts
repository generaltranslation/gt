import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Settings } from '../../../types/index.js';
import { EnqueueStep } from '../EnqueueStep.js';

const spinner = {
  start: vi.fn(),
  stop: vi.fn(),
};

vi.mock('../../../console/logger.js', () => ({
  logger: {
    createSpinner: vi.fn(() => spinner),
  },
}));

describe('EnqueueStep', () => {
  const gt = {
    translateFiles: vi.fn(),
  };

  const settings = {
    defaultLocale: 'en',
    locales: ['es'],
    stageTranslations: false,
  } as Settings;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not call the enqueue API when there are no files to enqueue', async () => {
    const step = new EnqueueStep(gt, settings);

    const result = await step.run([]);

    expect(result).toEqual({
      jobData: {},
      message: 'No files need to be enqueued',
    });
    expect(gt.translateFiles).not.toHaveBeenCalled();
    expect(spinner.start).not.toHaveBeenCalled();
    expect(spinner.stop).not.toHaveBeenCalled();
  });

  it('keys file translation jobs by job ID and ignores other job types', async () => {
    gt.translateFiles.mockResolvedValue({
      jobs: [
        {
          id: 'job-1',
          status: 'queued',
          subject: {
            type: 'file_translation',
            branchId: 'branch-id',
            fileId: 'file-id',
            versionId: 'version-id',
            locale: 'es',
          },
        },
        { id: 'job-2', status: 'queued', subject: { type: 'search_index' } },
      ],
    });
    const files = [
      {
        branchId: 'branch-id',
        fileId: 'file-id',
        versionId: 'version-id',
        fileName: 'messages.json',
        fileFormat: 'JSON' as const,
      },
    ];
    const step = new EnqueueStep(gt, settings, true);

    const result = await step.run(files);

    expect(gt.translateFiles).toHaveBeenCalledWith(files, {
      sourceLocale: 'en',
      targetLocales: ['es'],
      modelProvider: undefined,
      force: true,
    });
    expect(result.jobData).toEqual({
      'job-1': {
        fileId: 'file-id',
        versionId: 'version-id',
        branchId: 'branch-id',
        targetLocale: 'es',
      },
    });
    expect(result.message).toBe(
      'Successfully enqueued 1 file translation jobs'
    );
  });
});
