import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Settings, TranslateFlags } from '../../types/index.js';
import { Libraries } from '../../types/libraries.js';
import { logger } from '../../console/logger.js';
import { logErrorAndExit } from '../../console/logging.js';
import { createUpdates } from '../parse.js';
import { aggregateInlineTranslations } from '../stage.js';

vi.mock('../../fs/findFilepath.js', () => ({ default: vi.fn() }));
vi.mock('../../console/logger.js', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));
vi.mock('../../console/logging.js', () => ({
  logErrorAndExit: vi.fn(() => {
    throw new Error('exit');
  }),
}));
vi.mock('../parse.js', () => ({
  createUpdates: vi.fn(),
}));

const settings = {
  files: { gtJson: { parsingFlags: {} } },
  parsingOptions: {},
} as Settings;
const options = {} as TranslateFlags;

describe('aggregateInlineTranslations empty-result safety', () => {
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
      aggregateInlineTranslations(options, settings, Libraries.GT_REACT)
    ).resolves.toEqual([]);

    expect(logger.error).toHaveBeenCalledOnce();
    expect(logErrorAndExit).not.toHaveBeenCalled();
  });

  it('fails before a Vue source catalog can be replaced with an empty object', async () => {
    await expect(
      aggregateInlineTranslations(options, settings, Libraries.GT_VUE, [], true)
    ).rejects.toThrow('exit');

    expect(logErrorAndExit).toHaveBeenCalledOnce();
  });

  it('applies Vue catalog safety to a mixed React and Vue project', async () => {
    await expect(
      aggregateInlineTranslations(
        options,
        settings,
        Libraries.GT_REACT,
        [Libraries.GT_VUE],
        true
      )
    ).rejects.toThrow('exit');

    expect(logErrorAndExit).toHaveBeenCalledOnce();
  });

  it('does not block file-only Vue stage and translation workflows', async () => {
    await expect(
      aggregateInlineTranslations(options, settings, Libraries.GT_VUE)
    ).resolves.toEqual([]);

    expect(logger.error).toHaveBeenCalledOnce();
    expect(logErrorAndExit).not.toHaveBeenCalled();
  });
});
