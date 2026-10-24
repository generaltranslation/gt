import { beforeEach, describe, expect, it, vi } from 'vitest';
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
    generateProjectContext: vi.fn(),
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

  it('does not poll when the project context is already current', async () => {
    gt.generateProjectContext.mockResolvedValue({ job: null });
    const step = new SetupStep(gt, settings, 1_000);

    const result = await step.run(files);

    expect(result).toBe(files);
    expect(gt.generateProjectContext).toHaveBeenCalledWith(files, {
      locales: ['es'],
      force: false,
    });
    expect(gt.awaitJobs).not.toHaveBeenCalled();
    expect(spinner.stop).toHaveBeenCalledWith(
      expect.stringContaining('Setup successfully completed')
    );
  });

  it.each([
    [
      'completed jobs',
      { complete: true, jobs: [{ id: 'setup-job', status: 'completed' }] },
      'Setup successfully completed',
    ],
    [
      'failed jobs',
      {
        complete: true,
        jobs: [
          {
            id: 'setup-job',
            status: 'failed',
            error: 'Setup failed',
          },
        ],
      },
      'Setup failed: Setup failed',
    ],
    [
      'missing jobs',
      { complete: true, jobs: [{ id: 'setup-job', status: 'not_found' }] },
      'Setup status unknown',
    ],
    [
      'timed out jobs',
      { complete: false, jobs: [{ id: 'setup-job', status: 'processing' }] },
      'Setup timed out',
    ],
  ])('reports %s', async (_description, awaitResult, expectedMessage) => {
    gt.generateProjectContext.mockResolvedValue({
      job: { id: 'setup-job', status: 'queued' },
    });
    gt.awaitJobs.mockResolvedValue(awaitResult);
    const step = new SetupStep(gt, settings, 1_000);

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
