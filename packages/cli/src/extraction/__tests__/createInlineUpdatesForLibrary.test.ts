import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInlineUpdates } from '../../react/parse/createInlineUpdates.js';
import { Libraries } from '../../types/libraries.js';
import {
  createInlineUpdatesForLibraries,
  createInlineUpdatesForLibrary,
} from '../createInlineUpdatesForLibrary.js';

vi.mock('../../react/parse/createInlineUpdates.js', () => ({
  createInlineUpdates: vi.fn(async () => ({
    errors: [],
    updates: [],
    warnings: [],
  })),
}));

const vueExtractorMock = vi.hoisted(() => ({
  createVueInlineUpdates: vi.fn(async () => ({
    errors: [],
    updates: [],
    warnings: [],
  })),
  moduleLoadCount: { value: 0 },
}));

vi.mock('../../vue/parse/createVueInlineUpdates.js', () => {
  vueExtractorMock.moduleLoadCount.value += 1;
  return {
    createVueInlineUpdates: vueExtractorMock.createVueInlineUpdates,
  };
});

const parsingFlags = {
  autoderive: false,
  enableAutoJsxInjection: false,
  includeSourceCodeContext: false,
  legacyGtReactImportSource: false,
};
const parsingOptions = { conditionNames: ['import', 'default'] };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createInlineUpdatesForLibrary', () => {
  it('does not load the Vue extractor for a React-only path', async () => {
    await createInlineUpdatesForLibrary(
      Libraries.GT_REACT,
      true,
      ['src/**/*.tsx'],
      parsingFlags,
      parsingOptions
    );

    expect(vueExtractorMock.moduleLoadCount.value).toBe(0);
  });

  it('routes gt-vue exclusively to the Vue SFC extractor', async () => {
    await createInlineUpdatesForLibrary(
      Libraries.GT_VUE,
      true,
      ['src/**/*.vue'],
      parsingFlags,
      parsingOptions
    );

    expect(vueExtractorMock.createVueInlineUpdates).toHaveBeenCalledWith(
      ['src/**/*.vue'],
      parsingFlags
    );
    expect(createInlineUpdates).not.toHaveBeenCalled();
  });

  it('keeps React libraries on the existing extractor', async () => {
    await createInlineUpdatesForLibrary(
      Libraries.GT_REACT,
      true,
      ['src/**/*.tsx'],
      parsingFlags,
      parsingOptions
    );

    expect(createInlineUpdates).toHaveBeenCalledWith(
      Libraries.GT_REACT,
      true,
      ['src/**/*.tsx'],
      parsingFlags,
      parsingOptions
    );
    expect(vueExtractorMock.createVueInlineUpdates).not.toHaveBeenCalled();
  });

  it('routes mixed React and Vue files without passing Vue SFCs to React', async () => {
    const patterns = ['src/**/*.{tsx,vue}'];

    await createInlineUpdatesForLibraries(
      [Libraries.GT_REACT, Libraries.GT_VUE],
      false,
      patterns,
      parsingFlags,
      parsingOptions
    );

    expect(createInlineUpdates).toHaveBeenCalledWith(
      Libraries.GT_REACT,
      false,
      [...patterns, '!**/*.vue'],
      parsingFlags,
      parsingOptions
    );
    expect(vueExtractorMock.createVueInlineUpdates).toHaveBeenCalledWith(
      patterns,
      parsingFlags
    );
  });

  it('runs each library only once when mixed-library inputs repeat', async () => {
    await createInlineUpdatesForLibraries(
      [Libraries.GT_REACT, Libraries.GT_VUE, Libraries.GT_VUE],
      true,
      undefined,
      parsingFlags,
      parsingOptions
    );

    expect(createInlineUpdates).toHaveBeenCalledTimes(1);
    expect(vueExtractorMock.createVueInlineUpdates).toHaveBeenCalledTimes(1);
  });

  it('deduplicates identical hashes across framework extractors', async () => {
    vi.mocked(createInlineUpdates).mockResolvedValueOnce({
      errors: [],
      updates: [
        {
          dataFormat: 'STRING',
          source: 'Shared',
          metadata: { hash: 'shared-hash', filePaths: ['src/React.tsx'] },
        },
      ],
      warnings: [],
    });
    vueExtractorMock.createVueInlineUpdates.mockResolvedValueOnce({
      errors: [],
      updates: [
        {
          dataFormat: 'STRING',
          source: 'Shared',
          metadata: { hash: 'shared-hash', filePaths: ['src/Vue.vue'] },
        },
      ],
      warnings: [],
    });

    const result = await createInlineUpdatesForLibraries(
      [Libraries.GT_REACT, Libraries.GT_VUE],
      false,
      undefined,
      parsingFlags,
      parsingOptions
    );

    expect(result.updates).toEqual([
      expect.objectContaining({
        metadata: expect.objectContaining({
          filePaths: ['src/React.tsx', 'src/Vue.vue'],
        }),
      }),
    ]);
  });
});
