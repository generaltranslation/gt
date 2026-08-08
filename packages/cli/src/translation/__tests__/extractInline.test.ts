import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { planVueExtraction } from '@generaltranslation/vue-extractor/integration';
import { INLINE_LIBRARIES, Libraries } from '../../types/libraries.js';
import type {
  GTParsingFlags,
  ParsingConfigOptions,
} from '../../types/parsing.js';
import {
  extractInlineFromProject,
  type InlineExtractionOutput,
} from '../extractInline.js';

vi.mock('@generaltranslation/vue-extractor/integration', () => ({
  planVueExtraction: vi.fn(),
}));

const parsingFlags: GTParsingFlags = {
  autoderive: false,
  includeSourceCodeContext: true,
  enableAutoJsxInjection: false,
  legacyGtReactImportSource: false,
  viteConfigPath: 'vite.custom.ts',
  vueCompilerOptions: {
    whitespace: 'preserve',
    delimiters: ['[[', ']]'],
  },
};
const parsingOptions: ParsingConfigOptions = {
  conditionNames: ['browser', 'import'],
};
const output: InlineExtractionOutput = {
  updates: [],
  errors: [],
  warnings: [],
};

const mockPlanVueExtraction = vi.mocked(planVueExtraction);
const historicalInlineLibraries = INLINE_LIBRARIES.filter(
  (library) => library !== Libraries.GT_VUE
);
const patternCases: ReadonlyArray<
  readonly [name: string, patterns: string[] | undefined]
> = [
  ['undefined', undefined],
  ['empty', []],
  ['frozen empty', Object.freeze([]) as unknown as string[]],
  [
    'frozen explicit',
    Object.freeze([
      'src/**/*.{js,jsx,ts,tsx}',
      '!src/generated/**',
    ]) as unknown as string[],
  ],
];

describe('extractInlineFromProject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe.each(historicalInlineLibraries)(
    '%s inert-path parity',
    (library) => {
      it.each(patternCases)(
        'returns the exact historical promise for %s patterns',
        (_name, patterns) => {
          const historicalPromise = Promise.resolve(output);
          const extractPrimary = vi.fn(() => historicalPromise);
          mockPlanVueExtraction.mockReturnValue({ handled: false });

          const result = extractInlineFromProject(
            library,
            patterns,
            parsingFlags,
            parsingOptions,
            extractPrimary
          );

          expect(result).toBe(historicalPromise);
          expect(extractPrimary).toHaveBeenCalledOnce();
          expect(extractPrimary.mock.calls[0][0]).toBe(patterns);
        }
      );

      it('returns the exact historical rejection', async () => {
        const expectedError = new Error(`${library} rejection`);
        const historicalPromise = Promise.reject(expectedError);
        const extractPrimary = vi.fn(() => historicalPromise);
        mockPlanVueExtraction.mockReturnValue({ handled: false });

        const result = extractInlineFromProject(
          library,
          undefined,
          parsingFlags,
          parsingOptions,
          extractPrimary
        );

        expect(result).toBe(historicalPromise);
        await expect(result).rejects.toBe(expectedError);
      });
    }
  );

  it('invokes the historical callback synchronously on an unhandled plan', () => {
    let invoked = false;
    mockPlanVueExtraction.mockReturnValue({ handled: false });

    extractInlineFromProject(
      Libraries.GT_NODE,
      undefined,
      parsingFlags,
      parsingOptions,
      () => {
        invoked = true;
        return Promise.resolve(output);
      }
    );

    expect(invoked).toBe(true);
  });

  it('preserves a synchronously thrown historical error by identity', () => {
    const expectedError = new Error('historical failure');
    mockPlanVueExtraction.mockReturnValue({ handled: false });

    let caught: unknown;
    try {
      extractInlineFromProject(
        Libraries.GT_REACT_NATIVE,
        [],
        parsingFlags,
        parsingOptions,
        () => {
          throw expectedError;
        }
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBe(expectedError);
  });

  it('captures cwd and forwards only extraction configuration to the planner', () => {
    const patterns: string[] = [];
    const extractPrimary = vi.fn(async () => output);
    vi.spyOn(process, 'cwd').mockReturnValue('/project-at-call-time');
    mockPlanVueExtraction.mockReturnValue({ handled: false });

    extractInlineFromProject(
      Libraries.GT_TANSTACK_START,
      patterns,
      parsingFlags,
      parsingOptions,
      extractPrimary
    );

    expect(mockPlanVueExtraction).toHaveBeenCalledWith({
      library: Libraries.GT_TANSTACK_START,
      projectRoot: '/project-at-call-time',
      filePatterns: patterns,
      includeSourceCodeContext: true,
      conditionNames: parsingOptions.conditionNames,
      vueCompilerOptions: parsingFlags.vueCompilerOptions,
      viteConfigPath: 'vite.custom.ts',
    });
  });

  it('runs a handled plan with the historical callback unchanged', () => {
    const patterns = ['src/App.vue'];
    const extractPrimary = vi.fn(async () => output);
    const plannedPromise = Promise.resolve(output);
    const run = vi.fn(() => plannedPromise);
    mockPlanVueExtraction.mockReturnValue({ handled: true, run });

    const result = extractInlineFromProject(
      Libraries.GT_REACT,
      patterns,
      parsingFlags,
      parsingOptions,
      extractPrimary
    );

    expect(result).toBe(plannedPromise);
    expect(run).toHaveBeenCalledWith({ extractPrimary });
    expect(extractPrimary).not.toHaveBeenCalled();
  });

  it('does not invent a primary extractor for a direct Vue plan', () => {
    const plannedPromise = Promise.resolve(output);
    const run = vi.fn(() => plannedPromise);
    mockPlanVueExtraction.mockReturnValue({ handled: true, run });

    const result = extractInlineFromProject(
      Libraries.GT_VUE,
      undefined,
      parsingFlags,
      parsingOptions
    );

    expect(result).toBe(plannedPromise);
    expect(run).toHaveBeenCalledWith({ extractPrimary: undefined });
  });
});
