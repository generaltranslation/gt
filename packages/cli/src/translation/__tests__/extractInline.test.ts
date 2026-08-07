import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Updates } from '../../types/index.js';
import { Libraries, type InlineLibrary } from '../../types/libraries.js';
import type {
  GTParsingFlags,
  ParsingConfigOptions,
} from '../../types/parsing.js';

const mocks = vi.hoisted(() => ({
  createInlineUpdates: vi.fn(),
  createPythonInlineUpdates: vi.fn(),
  detectVueProject: vi.fn(),
  extractFromVueProject: vi.fn(),
  projectModuleLoads: 0,
}));

vi.mock('@generaltranslation/vue-extractor/detect', () => ({
  detectVueProject: mocks.detectVueProject,
}));

vi.mock('@generaltranslation/vue-extractor/project', () => {
  mocks.projectModuleLoads += 1;
  return { extractFromVueProject: mocks.extractFromVueProject };
});

vi.mock('../../react/parse/createInlineUpdates.js', () => ({
  createInlineUpdates: mocks.createInlineUpdates,
}));

vi.mock('../../python/parse/createPythonInlineUpdates.js', () => ({
  createPythonInlineUpdates: mocks.createPythonInlineUpdates,
}));

import { extractInlineFromProject } from '../extractInline.js';

const parsingFlags: GTParsingFlags = {
  autoderive: false,
  enableAutoJsxInjection: false,
  includeSourceCodeContext: true,
  legacyGtReactImportSource: false,
  viteConfigPath: 'vite.config.ts',
  vueCompilerOptions: { whitespace: 'preserve' },
};
const parsingOptions: ParsingConfigOptions = {
  conditionNames: ['browser', 'import'],
};
const patterns = ['src/**/*.{ts,tsx,vue}', '!src/vendor/**'];

function update(
  source: string,
  hash: string,
  filePaths: string[]
): Updates[number] {
  return {
    dataFormat: 'ICU',
    source,
    metadata: { hash, filePaths },
  };
}

describe('extractInlineFromProject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.detectVueProject.mockReturnValue(false);
  });

  it('does not load or call the Vue project extractor when Vue is absent', async () => {
    const historicalResult = {
      updates: [update('React', 'react-hash', ['src/App.tsx'])],
      errors: [],
      warnings: [],
    };
    mocks.createInlineUpdates.mockResolvedValue(historicalResult);

    const result = await extractInlineFromProject(
      Libraries.GT_REACT,
      true,
      undefined,
      parsingFlags,
      parsingOptions
    );

    expect(result).toBe(historicalResult);
    expect(mocks.createInlineUpdates).toHaveBeenCalledWith(
      Libraries.GT_REACT,
      true,
      undefined,
      parsingFlags,
      parsingOptions
    );
    expect(mocks.projectModuleLoads).toBe(0);
    expect(mocks.extractFromVueProject).not.toHaveBeenCalled();
  });

  it.each([
    Libraries.GT_REACT,
    Libraries.GT_NEXT,
    Libraries.GT_REACT_NATIVE,
    Libraries.GT_TANSTACK_START,
    Libraries.GT_NODE,
  ] satisfies InlineLibrary[])(
    'preserves the historical %s extractor call and result identity',
    async (library) => {
      const historicalResult = {
        updates: [update(library, `${library}-hash`, [`${library}.ts`])],
        errors: [`${library}-error`],
        warnings: [`${library}-warning`],
      };
      mocks.createInlineUpdates.mockResolvedValue(historicalResult);

      const result = await extractInlineFromProject(
        library,
        true,
        patterns,
        parsingFlags,
        parsingOptions
      );

      expect(mocks.createInlineUpdates).toHaveBeenCalledOnce();
      expect(mocks.createInlineUpdates).toHaveBeenCalledWith(
        library,
        true,
        patterns,
        parsingFlags,
        parsingOptions
      );
      expect(mocks.createPythonInlineUpdates).not.toHaveBeenCalled();
      expect(mocks.extractFromVueProject).not.toHaveBeenCalled();
      expect(result).toBe(historicalResult);
    }
  );

  it.each([Libraries.GT_FLASK, Libraries.GT_FASTAPI] satisfies InlineLibrary[])(
    'preserves the historical %s extractor call and result identity',
    async (library) => {
      const historicalResult = {
        updates: [update(library, `${library}-hash`, [`${library}.py`])],
        errors: [],
        warnings: [],
      };
      mocks.createPythonInlineUpdates.mockResolvedValue(historicalResult);

      const result = await extractInlineFromProject(
        library,
        false,
        patterns,
        parsingFlags,
        parsingOptions
      );

      expect(mocks.createPythonInlineUpdates).toHaveBeenCalledOnce();
      expect(mocks.createPythonInlineUpdates).toHaveBeenCalledWith(patterns);
      expect(mocks.createInlineUpdates).not.toHaveBeenCalled();
      expect(mocks.extractFromVueProject).not.toHaveBeenCalled();
      expect(result).toBe(historicalResult);
    }
  );

  it('keeps explicit patterns intact for Vue and excludes only .vue from the legacy parser', async () => {
    mocks.detectVueProject.mockReturnValue(true);
    mocks.createInlineUpdates.mockResolvedValue({
      updates: [update('Primary', 'primary-hash', ['src/App.tsx'])],
      errors: [],
      warnings: [],
    });
    mocks.extractFromVueProject.mockResolvedValue({
      updates: [update('Vue', 'vue-hash', ['src/App.vue'])],
      errors: [],
      warnings: [],
    });

    const result = await extractInlineFromProject(
      Libraries.GT_REACT,
      true,
      patterns,
      parsingFlags,
      parsingOptions
    );

    expect(mocks.createInlineUpdates).toHaveBeenCalledWith(
      Libraries.GT_REACT,
      true,
      [...patterns, '!**/*.vue'],
      parsingFlags,
      parsingOptions
    );
    expect(mocks.extractFromVueProject).toHaveBeenCalledWith({
      filePatterns: patterns,
      includeSourceCodeContext: true,
      conditionNames: parsingOptions.conditionNames,
      vueCompilerOptions: parsingFlags.vueCompilerOptions,
      viteConfigPath: parsingFlags.viteConfigPath,
    });
    expect(result.updates.map(({ source }) => source)).toEqual([
      'Primary',
      'Vue',
    ]);
  });

  it('appends Vue results while preserving primary ordering and combining diagnostics', async () => {
    mocks.detectVueProject.mockReturnValue(true);
    const primaryUpdate = update('Primary', 'primary-hash', ['primary.tsx']);
    const vueUpdate = update('Vue', 'vue-hash', ['component.vue']);
    mocks.createInlineUpdates.mockResolvedValue({
      updates: [primaryUpdate],
      errors: ['primary error'],
      warnings: ['shared warning', 'primary warning'],
    });
    mocks.extractFromVueProject.mockResolvedValue({
      updates: [vueUpdate],
      errors: ['vue error'],
      warnings: ['shared warning', 'vue warning'],
    });

    const result = await extractInlineFromProject(
      Libraries.GT_NEXT,
      false,
      undefined,
      parsingFlags,
      parsingOptions
    );

    expect(mocks.createInlineUpdates).toHaveBeenCalledWith(
      Libraries.GT_NEXT,
      false,
      undefined,
      parsingFlags,
      parsingOptions
    );
    expect(result.updates).toEqual([primaryUpdate, vueUpdate]);
    expect(result.errors).toEqual(['primary error', 'vue error']);
    expect(result.warnings).toEqual([
      'shared warning',
      'primary warning',
      'vue warning',
    ]);
  });

  it('deduplicates mixed hash collisions and merges their file paths', async () => {
    mocks.detectVueProject.mockReturnValue(true);
    const primaryUpdate = update('Shared', 'shared-hash', ['primary.tsx']);
    mocks.createInlineUpdates.mockResolvedValue({
      updates: [primaryUpdate],
      errors: [],
      warnings: [],
    });
    mocks.extractFromVueProject.mockResolvedValue({
      updates: [
        update('Shared', 'shared-hash', ['component.vue', 'primary.tsx']),
      ],
      errors: [],
      warnings: [],
    });

    const result = await extractInlineFromProject(
      Libraries.GT_REACT,
      false,
      undefined,
      parsingFlags,
      parsingOptions
    );

    expect(result.updates).toHaveLength(1);
    expect(result.updates[0]).toBe(primaryUpdate);
    expect(result.updates[0].metadata.filePaths).toEqual([
      'primary.tsx',
      'component.vue',
    ]);
  });

  it('uses only the package project API for a Vue-primary project', async () => {
    const vueResult = {
      updates: [update('Vue only', 'vue-only-hash', ['App.vue'])],
      errors: ['vue error'],
      warnings: ['vue warning'],
    };
    mocks.extractFromVueProject.mockResolvedValue(vueResult);

    const result = await extractInlineFromProject(
      Libraries.GT_VUE,
      true,
      patterns,
      parsingFlags,
      parsingOptions
    );

    expect(mocks.detectVueProject).not.toHaveBeenCalled();
    expect(mocks.createInlineUpdates).not.toHaveBeenCalled();
    expect(mocks.createPythonInlineUpdates).not.toHaveBeenCalled();
    expect(mocks.extractFromVueProject).toHaveBeenCalledOnce();
    expect(mocks.extractFromVueProject).toHaveBeenCalledWith({
      filePatterns: patterns,
      includeSourceCodeContext: true,
      conditionNames: parsingOptions.conditionNames,
      vueCompilerOptions: parsingFlags.vueCompilerOptions,
      viteConfigPath: parsingFlags.viteConfigPath,
    });
    expect(result).toEqual(vueResult);
  });
});
