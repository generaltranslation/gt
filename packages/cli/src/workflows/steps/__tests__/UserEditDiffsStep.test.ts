import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FileReference } from 'generaltranslation/types';
import type { Settings } from '../../../types/index.js';
import { collectAndSendUserEditDiffs } from '../../../api/collectUserEditDiffs.js';
import { logger } from '../../../console/logger.js';
import { UserEditDiffsStep } from '../UserEditDiffsStep.js';

vi.mock('../../../console/logger.js', () => ({
  logger: {
    createSpinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
  },
}));

vi.mock('../../../api/collectUserEditDiffs.js', () => ({
  collectAndSendUserEditDiffs: vi.fn(),
}));

describe('UserEditDiffsStep', () => {
  const settings = {} as Settings;
  const files = [{ fileName: 'messages/en.json' }] as FileReference[];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports no failure when the diff upload succeeds', async () => {
    vi.mocked(collectAndSendUserEditDiffs).mockResolvedValue(true);

    const step = new UserEditDiffsStep(settings);
    await expect(step.run(files)).resolves.toEqual(files);

    expect(step.hasFailed).toBe(false);
  });

  it('reports failure without throwing when the diff upload rejects', async () => {
    vi.mocked(collectAndSendUserEditDiffs).mockRejectedValue(
      new Error('api down')
    );

    const step = new UserEditDiffsStep(settings);
    await expect(step.run(files)).resolves.toEqual(files);

    expect(step.hasFailed).toBe(true);
  });

  it('abort stops the spinner with a failure message', async () => {
    vi.mocked(collectAndSendUserEditDiffs).mockRejectedValue(
      new Error('api down')
    );

    const step = new UserEditDiffsStep(settings);
    await step.run(files);
    step.abort();

    const spinner = vi.mocked(logger.createSpinner).mock.results[0]
      .value as unknown as { stop: ReturnType<typeof vi.fn> };
    expect(spinner.stop).toHaveBeenCalledWith(
      expect.stringContaining('Could not')
    );
  });
});
