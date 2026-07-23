import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GT } from 'generaltranslation';
import type { FileReference } from 'generaltranslation/types';
import type { Settings } from '../../../types/index.js';
import { SetupStep } from '../SetupStep.js';

const spinner = {
  start: vi.fn(),
  stop: vi.fn(),
};

vi.mock('../../../console/logger.js', () => ({
  logger: {
    createSpinner: vi.fn(() => spinner),
  },
}));

describe('SetupStep', () => {
  const gt = {
    setupProject: vi.fn(),
    awaitJobs: vi.fn(),
  };

  const settings = {
    locales: ['es'],
  } as Settings;

  const files = [
    {
      branchId: 'branch-id',
      fileId: 'file-id',
      versionId: 'version-id',
    },
  ] as FileReference[];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['an unexpected status', { status: 'unknown' }],
    ['a queued response without a job ID', { status: 'queued' }],
  ])('does not poll for %s', async (_description, setupResult) => {
    gt.setupProject.mockResolvedValue(setupResult);
    const step = new SetupStep(gt as unknown as GT, settings, 1_000);

    const result = await step.run(files);

    expect(result).toBe(files);
    expect(gt.awaitJobs).not.toHaveBeenCalled();
    expect(spinner.stop).toHaveBeenCalledWith(
      expect.stringContaining('Setup status unknown')
    );
  });

  it.each([
    [
      'completed jobs',
      { complete: true, jobs: [{ jobId: 'setup-job', status: 'completed' }] },
      'Setup successfully completed',
    ],
    [
      'failed jobs',
      {
        complete: true,
        jobs: [
          {
            jobId: 'setup-job',
            status: 'failed',
            error: { message: 'Setup failed' },
          },
        ],
      },
      'Setup failed: Setup failed',
    ],
    [
      'unknown jobs',
      { complete: true, jobs: [{ jobId: 'setup-job', status: 'unknown' }] },
      'Setup status unknown',
    ],
    [
      'timed out jobs',
      { complete: false, jobs: [{ jobId: 'setup-job', status: 'processing' }] },
      'Setup timed out',
    ],
  ])('reports %s', async (_description, awaitResult, expectedMessage) => {
    gt.setupProject.mockResolvedValue({
      status: 'queued',
      setupJobId: 'setup-job',
    });
    gt.awaitJobs.mockResolvedValue(awaitResult);
    const step = new SetupStep(gt as unknown as GT, settings, 1_000);

    const result = await step.run(files);

    expect(result).toBe(files);
    expect(gt.awaitJobs).toHaveBeenCalledWith(
      ['setup-job'],
      expect.objectContaining({ timeoutSeconds: 1 })
    );
    expect(spinner.stop).toHaveBeenCalledWith(
      expect.stringContaining(expectedMessage)
    );
  });
});
