import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInlineUpdates } from '../../react/parse/createInlineUpdates.js';
import { createVueInlineUpdates } from '../../vue/parse/createVueInlineUpdates.js';
import { Libraries } from '../../types/libraries.js';
import { createInlineUpdatesForLibrary } from '../createInlineUpdatesForLibrary.js';

vi.mock('../../react/parse/createInlineUpdates.js', () => ({
  createInlineUpdates: vi.fn(async () => ({
    errors: [],
    updates: [],
    warnings: [],
  })),
}));

vi.mock('../../vue/parse/createVueInlineUpdates.js', () => ({
  createVueInlineUpdates: vi.fn(async () => ({
    errors: [],
    updates: [],
    warnings: [],
  })),
}));

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
  it('routes gt-vue exclusively to the Vue SFC extractor', async () => {
    await createInlineUpdatesForLibrary(
      Libraries.GT_VUE,
      true,
      ['src/**/*.vue'],
      parsingFlags,
      parsingOptions
    );

    expect(createVueInlineUpdates).toHaveBeenCalledWith(
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
    expect(createVueInlineUpdates).not.toHaveBeenCalled();
  });
});
