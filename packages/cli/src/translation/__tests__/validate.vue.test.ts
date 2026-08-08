import { beforeEach, describe, expect, it, vi } from 'vitest';
import { planVueExtraction } from '@generaltranslation/vue-extractor/integration';
import type { VueExtractionRunOptions } from '@generaltranslation/vue-extractor/integration';
import { createInlineUpdates } from '../../react/parse/createInlineUpdates.js';
import type { Options, Settings } from '../../types/index.js';
import { Libraries } from '../../types/libraries.js';
import { getValidateJson, validateProject } from '../validate.js';

vi.mock('@generaltranslation/vue-extractor/integration', () => ({
  planVueExtraction: vi.fn(),
}));

vi.mock('../../react/parse/createInlineUpdates.js', () => ({
  createInlineUpdates: vi.fn(),
}));

vi.mock('../../console/logger.js', () => ({
  logger: {
    error: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
  },
}));

const parsingFlags = {
  autoderive: false,
  includeSourceCodeContext: false,
  enableAutoJsxInjection: false,
  legacyGtReactImportSource: false,
};
const parsingOptions = { conditionNames: ['browser', 'import'] };
const settings = {
  files: { gtJson: { parsingFlags } },
  parsingOptions,
} as unknown as Options & Settings;

const mockPlanVueExtraction = vi.mocked(planVueExtraction);

describe('targeted Vue-aware validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlanVueExtraction.mockReturnValue({ handled: false });
    vi.mocked(createInlineUpdates).mockResolvedValue({
      updates: [],
      errors: [],
      warnings: [],
    });
  });

  it('preserves the historical targeted React call', async () => {
    const files = ['src/App.tsx'];

    await validateProject(settings, Libraries.GT_REACT, files);

    expect(createInlineUpdates).toHaveBeenCalledWith(
      Libraries.GT_REACT,
      true,
      files,
      parsingFlags,
      parsingOptions
    );
    expect(vi.mocked(createInlineUpdates).mock.calls[0][2]).toBe(files);
  });

  it('preserves historical targeted Python behavior', async () => {
    const files = ['src/app.py'];

    await validateProject(settings, Libraries.GT_FLASK, files);

    expect(createInlineUpdates).toHaveBeenCalledWith(
      Libraries.GT_FLASK,
      true,
      files,
      parsingFlags,
      parsingOptions
    );
  });

  it('supports gt-vue in the programmatic validation API', async () => {
    const run = vi.fn(async ({ extractPrimary }: VueExtractionRunOptions) => {
      expect(extractPrimary).toBeUndefined();
      return {
        updates: [],
        errors: ['src/App.vue (2:3): invalid content'],
        warnings: [],
      };
    });
    mockPlanVueExtraction.mockReturnValue({ handled: true, run });

    const result = await getValidateJson(settings, Libraries.GT_VUE, [
      'src/App.vue',
    ]);

    expect(result).toEqual({
      'src/App.vue': [{ level: 'error', message: 'invalid content' }],
    });
    expect(createInlineUpdates).not.toHaveBeenCalled();
  });
});
