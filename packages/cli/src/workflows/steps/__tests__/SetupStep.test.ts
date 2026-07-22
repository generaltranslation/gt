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
    checkJobStatus: vi.fn(),
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
    expect(gt.checkJobStatus).not.toHaveBeenCalled();
    expect(spinner.stop).toHaveBeenCalledWith(
      expect.stringContaining('Setup status unknown')
    );
  });
});
