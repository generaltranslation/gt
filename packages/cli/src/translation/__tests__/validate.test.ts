import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Options, Settings } from '../../types/index.js';
import { Libraries } from '../../types/libraries.js';
import { logger } from '../../console/logger.js';
import { logErrorAndExit } from '../../console/logging.js';
import { createUpdates } from '../parse.js';
import { validateProject } from '../validate.js';

vi.mock('../../fs/findFilepath.js', () => ({ default: vi.fn() }));
vi.mock('../../console/logger.js', () => ({
  logger: {
    error: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
  },
}));
vi.mock('../../console/logging.js', () => ({
  logErrorAndExit: vi.fn(() => {
    throw new Error('exit');
  }),
  stripAnsi: (value: string) => value,
}));
vi.mock('../parse.js', () => ({
  createUpdates: vi.fn(),
}));

const settings = {
  files: { gtJson: { parsingFlags: {} } },
  parsingOptions: {},
} as Options & Settings;

describe('validateProject empty-result safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createUpdates).mockResolvedValue({
      updates: [],
      errors: [],
      warnings: [],
    });
  });

  it('preserves the existing non-fatal behavior for React-only projects', async () => {
    await expect(
      validateProject(settings, Libraries.GT_REACT)
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledOnce();
    expect(logErrorAndExit).not.toHaveBeenCalled();
  });

  it('returns a failure status for empty Vue validation', async () => {
    await expect(validateProject(settings, Libraries.GT_VUE)).rejects.toThrow(
      'exit'
    );

    expect(logErrorAndExit).toHaveBeenCalledOnce();
  });

  it('returns a failure status for empty mixed-project validation', async () => {
    await expect(
      validateProject(settings, Libraries.GT_REACT, undefined, [
        Libraries.GT_VUE,
      ])
    ).rejects.toThrow('exit');

    expect(logErrorAndExit).toHaveBeenCalledOnce();
  });
});
