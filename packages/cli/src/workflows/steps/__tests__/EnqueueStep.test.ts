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

    expect(result).toEqual([]);
    expect(gt.translateFiles).not.toHaveBeenCalled();
    expect(spinner.start).not.toHaveBeenCalled();
    expect(spinner.stop).not.toHaveBeenCalled();
  });

  it('returns the file translation jobs and ignores other job types', async () => {
    const fileJob = {
      id: 'job-1',
      status: 'queued',
      subject: {
        type: 'file_translation',
        branchId: 'branch-id',
        fileId: 'file-id',
        versionId: 'version-id',
        locale: 'es',
      },
    };
    gt.translateFiles.mockResolvedValue({
      jobs: [
        fileJob,
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
    expect(result).toEqual([fileJob]);
  });
});
