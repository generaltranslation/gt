import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Libraries, type InlineLibrary } from '../../types/libraries.js';
import type {
  GTParsingFlags,
  ParsingConfigOptions,
} from '../../types/parsing.js';
import type { PrimaryInlineExtractor } from '@generaltranslation/vue-extractor/integration';

const mocks = vi.hoisted(() => ({
  planVueExtraction: vi.fn(),
}));

vi.mock('@generaltranslation/vue-extractor/integration', () => ({
  planVueExtraction: mocks.planVueExtraction,
}));

import { extractInlineFromProject } from '../extractInline.js';

const projectRoot = '/project';
const parsingFlags = {
  includeSourceCodeContext: true,
  viteConfigPath: 'vite.config.ts',
  vueCompilerOptions: {
    whitespace: 'preserve' as const,
  },
} as GTParsingFlags;
const parsingOptions = {
  conditionNames: ['source', 'import'],
} as ParsingConfigOptions;
const emptyOutput = { updates: [], errors: [], warnings: [] };

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(process, 'cwd').mockReturnValue(projectRoot);
  mocks.planVueExtraction.mockReturnValue({ handled: false });
});

describe('extractInlineFromProject', () => {
  it.each([
    Libraries.GT_REACT,
    Libraries.GT_NEXT,
    Libraries.GT_REACT_NATIVE,
    Libraries.GT_TANSTACK_START,
    Libraries.GT_NODE,
    Libraries.GT_FLASK,
    Libraries.GT_FASTAPI,
  ] satisfies InlineLibrary[])(
    'preserves the historical %s extractor invocation when Vue is inert',
    async (library) => {
      const patterns = Object.freeze([
        'src/**/*.{js,jsx,ts,tsx}',
      ]) as unknown as string[];
      const primaryOutput = {
        updates: [],
        errors: [`${library} error`],
        warnings: [`${library} warning`],
      };
      const extractPrimary = vi.fn(() => Promise.resolve(primaryOutput));

      const result = extractInlineFromProject(
        library,
        patterns,
        parsingFlags,
        parsingOptions,
        extractPrimary
      );

      expect(extractPrimary).toHaveBeenCalledOnce();
      expect(extractPrimary).toHaveBeenCalledWith(patterns);
      expect(await result).toBe(primaryOutput);
      expect(mocks.planVueExtraction).toHaveBeenCalledWith({
        library,
        projectRoot,
        filePatterns: patterns,
        includeSourceCodeContext: true,
        conditionNames: parsingOptions.conditionNames,
        vueCompilerOptions: parsingFlags.vueCompilerOptions,
        viteConfigPath: parsingFlags.viteConfigPath,
      });
    }
  );

  it('delegates mixed React and Vue merging to the handled package plan', async () => {
    const primaryOutput = {
      updates: [
        {
          dataFormat: 'STRING' as const,
          source: 'React message',
          metadata: { hash: 'react-hash' },
        },
      ],
      errors: [],
      warnings: [],
    };
    const mergedOutput = {
      updates: [
        ...primaryOutput.updates,
        {
          dataFormat: 'STRING' as const,
          source: 'Vue message',
          metadata: { hash: 'vue-hash' },
        },
      ],
      errors: [],
      warnings: [],
    };
    const extractPrimary = vi.fn(() => Promise.resolve(primaryOutput));
    const run = vi.fn(
      async ({
        extractPrimary: delegatedPrimary = undefined,
      }: { extractPrimary?: PrimaryInlineExtractor } = {}) => {
        expect(delegatedPrimary).toBe(extractPrimary);
        await delegatedPrimary?.(undefined);
        return mergedOutput;
      }
    );
    mocks.planVueExtraction.mockReturnValue({ handled: true, run });

    const result = await extractInlineFromProject(
      Libraries.GT_REACT,
      undefined,
      parsingFlags,
      parsingOptions,
      extractPrimary
    );

    expect(run).toHaveBeenCalledOnce();
    expect(extractPrimary).toHaveBeenCalledWith(undefined);
    expect(result).toBe(mergedOutput);
  });

  it('lets the package-owned plan partition explicit targeted files', async () => {
    const requestedPatterns = ['src/App.tsx', 'src/App.vue'];
    const partitionedPrimaryPatterns = [
      ...requestedPatterns,
      '!/project/src/App.vue',
    ];
    const extractPrimary = vi.fn(() => Promise.resolve(emptyOutput));
    const run = vi.fn(
      async ({
        extractPrimary: delegatedPrimary = undefined,
      }: { extractPrimary?: PrimaryInlineExtractor } = {}) => {
        await delegatedPrimary?.(partitionedPrimaryPatterns);
        return emptyOutput;
      }
    );
    mocks.planVueExtraction.mockReturnValue({ handled: true, run });

    await extractInlineFromProject(
      Libraries.GT_REACT,
      requestedPatterns,
      parsingFlags,
      parsingOptions,
      extractPrimary
    );

    expect(mocks.planVueExtraction).toHaveBeenCalledWith(
      expect.objectContaining({ filePatterns: requestedPatterns })
    );
    expect(extractPrimary).toHaveBeenCalledOnce();
    expect(extractPrimary).toHaveBeenCalledWith(partitionedPrimaryPatterns);
  });

  it('preserves a synchronous historical extractor throw when Vue is inert', () => {
    const primaryError = new Error('synchronous primary failure');

    expect(() =>
      extractInlineFromProject(
        Libraries.GT_REACT,
        undefined,
        parsingFlags,
        parsingOptions,
        () => {
          throw primaryError;
        }
      )
    ).toThrow(primaryError);
  });

  it('returns the handled plan early-rejection promise unchanged', async () => {
    const primaryError = new Error('early primary failure');
    const rejection = Promise.reject(primaryError);
    const run = vi.fn(() => rejection);
    mocks.planVueExtraction.mockReturnValue({ handled: true, run });

    const result = extractInlineFromProject(
      Libraries.GT_REACT,
      undefined,
      parsingFlags,
      parsingOptions,
      vi.fn()
    );

    expect(result).toBe(rejection);
    await expect(result).rejects.toBe(primaryError);
  });
});
