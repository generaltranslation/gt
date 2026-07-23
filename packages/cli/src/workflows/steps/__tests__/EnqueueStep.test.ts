import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GT } from 'generaltranslation';
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
    enqueueFiles: vi.fn(),
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
    const step = new EnqueueStep(gt as unknown as GT, settings);

    const result = await step.run([]);

    expect(result).toEqual({
      jobData: {},
      locales: ['es'],
      message: 'No files need to be enqueued',
    });
    expect(gt.enqueueFiles).not.toHaveBeenCalled();
    expect(spinner.start).not.toHaveBeenCalled();
    expect(spinner.stop).not.toHaveBeenCalled();
  });
});
