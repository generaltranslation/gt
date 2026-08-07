import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Options, Settings } from '../../types/index.js';
import { Libraries } from '../../types/libraries.js';

const mocks = vi.hoisted(() => ({
  extractInlineFromProject: vi.fn(),
}));

vi.mock('../extractInline.js', () => ({
  extractInlineFromProject: mocks.extractInlineFromProject,
}));

import { getValidateJson } from '../validate.js';

describe('getValidateJson Vue dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps gt-vue as the programmatic validation runtime', async () => {
    mocks.extractInlineFromProject.mockResolvedValue({
      updates: [],
      errors: ['src/App.vue (2:3): Vue validation error'],
      warnings: [],
    });
    const settings = {
      files: {
        gtJson: {
          parsingFlags: {
            autoderive: false,
            enableAutoJsxInjection: false,
            includeSourceCodeContext: false,
            legacyGtReactImportSource: false,
          },
        },
      },
      parsingOptions: { conditionNames: ['browser', 'import'] },
    } as unknown as Options & Settings;

    const result = await getValidateJson(settings, Libraries.GT_VUE, [
      'src/App.vue',
    ]);

    expect(mocks.extractInlineFromProject).toHaveBeenCalledWith(
      Libraries.GT_VUE,
      true,
      ['src/App.vue'],
      settings.files.gtJson.parsingFlags,
      settings.parsingOptions
    );
    expect(result).toEqual({
      'src/App.vue': [{ level: 'error', message: 'Vue validation error' }],
    });
  });
});
