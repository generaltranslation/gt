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
  extractFromVueProject: vi.fn(),
  mergeVueProjectExtraction: vi.fn(),
  inspectVueProjectAsync: vi.fn(),
  partitionVueSourcePatterns: vi.fn(),
  projectModuleLoads: 0,
}));

vi.mock('@generaltranslation/vue-extractor/project', () => {
  mocks.projectModuleLoads += 1;
  return {
    extractFromVueProject: mocks.extractFromVueProject,
    mergeVueProjectExtraction: mocks.mergeVueProjectExtraction,
  };
});

vi.mock('@generaltranslation/vue-extractor/inspect', () => ({
  inspectVueProjectAsync: mocks.inspectVueProjectAsync,
  partitionVueSourcePatterns: mocks.partitionVueSourcePatterns,
}));

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
const cwd = process.cwd();

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
    mocks.partitionVueSourcePatterns.mockReturnValue({
      primaryExclusionPatterns: [],
      vueExclusionPatterns: [],
    });
    mocks.inspectVueProjectAsync.mockResolvedValue({
      projectRoot: '/fixture',
      rootOwnsVue: false,
      hasVueScopes: false,
    });
    mocks.mergeVueProjectExtraction.mockImplementation((primary, vue) => ({
      updates: [...primary.updates, ...vue.updates],
      errors: [...primary.errors, ...vue.errors],
      warnings: [...new Set([...primary.warnings, ...vue.warnings])],
    }));
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
    expect(mocks.inspectVueProjectAsync).toHaveBeenCalledWith(cwd);
    expect(mocks.projectModuleLoads).toBe(0);
    expect(mocks.extractFromVueProject).not.toHaveBeenCalled();
  });

  it('runs default historical extraction while workspace inspection is pending', async () => {
    const inspection = deferred<{
      projectRoot: string;
      rootOwnsVue: boolean;
      hasVueScopes: boolean;
    }>();
    const historicalResult = {
      updates: [update('React', 'react-hash', ['src/App.tsx'])],
      errors: [],
      warnings: [],
    };
    mocks.inspectVueProjectAsync.mockReturnValue(inspection.promise);
    mocks.createInlineUpdates.mockResolvedValue(historicalResult);

    const resultPromise = extractInlineFromProject(
      Libraries.GT_REACT,
      false,
      undefined,
      parsingFlags,
      parsingOptions
    );

    await vi.waitFor(() => {
      expect(mocks.createInlineUpdates).toHaveBeenCalledOnce();
    });
    inspection.resolve({
      projectRoot: '/fixture',
      rootOwnsVue: false,
      hasVueScopes: false,
    });

    await expect(resultPromise).resolves.toBe(historicalResult);
  });

  it('waits for workspace inspection before partitioning explicit patterns', async () => {
    const inspection = deferred<{
      projectRoot: string;
      rootOwnsVue: boolean;
      hasVueScopes: boolean;
    }>();
    mocks.inspectVueProjectAsync.mockReturnValue(inspection.promise);
    mocks.partitionVueSourcePatterns.mockReturnValue({
      primaryExclusionPatterns: ['!src/App.vue'],
      vueExclusionPatterns: [],
    });
    mocks.createInlineUpdates.mockResolvedValue({
      updates: [],
      errors: [],
      warnings: [],
    });
    mocks.extractFromVueProject.mockResolvedValue({
      updates: [],
      errors: [],
      warnings: [],
    });

    const resultPromise = extractInlineFromProject(
      Libraries.GT_REACT,
      false,
      patterns,
      parsingFlags,
      parsingOptions
    );

    await vi.waitFor(() => {
      expect(mocks.inspectVueProjectAsync).toHaveBeenCalledOnce();
    });
    expect(mocks.createInlineUpdates).not.toHaveBeenCalled();
    inspection.resolve({
      projectRoot: '/fixture',
      rootOwnsVue: true,
      hasVueScopes: true,
    });
    await resultPromise;

    expect(mocks.createInlineUpdates).toHaveBeenCalledWith(
      Libraries.GT_REACT,
      false,
      [...patterns, '!src/App.vue'],
      parsingFlags,
      parsingOptions
    );
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

  it('partitions explicit SFCs owned by a discovered Vue scope', async () => {
    mocks.partitionVueSourcePatterns.mockReturnValue({
      primaryExclusionPatterns: ['!src/App.vue'],
      vueExclusionPatterns: [],
    });
    mocks.inspectVueProjectAsync.mockResolvedValue({
      projectRoot: '/fixture',
      rootOwnsVue: true,
      hasVueScopes: true,
    });
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
      [...patterns, '!src/App.vue'],
      parsingFlags,
      parsingOptions
    );
    expect(mocks.extractFromVueProject).toHaveBeenCalledWith({
      cwd,
      filePatterns: patterns,
      inspection: {
        projectRoot: '/fixture',
        rootOwnsVue: true,
        hasVueScopes: true,
      },
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

  it('keeps ambiguous JSX modules on the primary pass only', async () => {
    const ambiguousExclusion = '!src/Ambiguous.vue';
    mocks.partitionVueSourcePatterns.mockReturnValue({
      primaryExclusionPatterns: [],
      vueExclusionPatterns: [ambiguousExclusion],
    });
    const inspection = {
      projectRoot: '/fixture',
      rootOwnsVue: true,
      hasVueScopes: true,
    } as const;
    mocks.inspectVueProjectAsync.mockResolvedValue(inspection);
    mocks.createInlineUpdates.mockResolvedValue({
      updates: [update('Historical', 'historical-hash', ['src/Ambiguous.vue'])],
      errors: [],
      warnings: [],
    });
    mocks.extractFromVueProject.mockResolvedValue({
      updates: [],
      errors: [],
      warnings: [],
    });

    await extractInlineFromProject(
      Libraries.GT_REACT,
      false,
      patterns,
      parsingFlags,
      parsingOptions
    );

    expect(mocks.createInlineUpdates).toHaveBeenCalledWith(
      Libraries.GT_REACT,
      false,
      patterns,
      parsingFlags,
      parsingOptions
    );
    expect(mocks.extractFromVueProject).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd,
        filePatterns: [...patterns, ambiguousExclusion],
        inspection,
      })
    );
  });

  it('preserves exact historical patterns for descendant-only Vue scopes', async () => {
    const inspection = {
      projectRoot: '/fixture',
      rootOwnsVue: false,
      hasVueScopes: true,
    } as const;
    mocks.inspectVueProjectAsync.mockResolvedValue(inspection);
    mocks.createInlineUpdates.mockResolvedValue({
      updates: [update('Legacy React', 'react-hash', ['src/Legacy.vue'])],
      errors: [],
      warnings: [],
    });
    mocks.extractFromVueProject.mockResolvedValue({
      updates: [update('Child Vue', 'vue-hash', ['apps/vue/App.vue'])],
      errors: [],
      warnings: [],
    });

    await extractInlineFromProject(
      Libraries.GT_REACT,
      false,
      patterns,
      parsingFlags,
      parsingOptions
    );

    expect(mocks.createInlineUpdates).toHaveBeenCalledWith(
      Libraries.GT_REACT,
      false,
      patterns,
      parsingFlags,
      parsingOptions
    );
    expect(mocks.extractFromVueProject).toHaveBeenCalledWith(
      expect.objectContaining({ filePatterns: patterns, inspection })
    );
  });

  it('appends Vue results while preserving primary ordering and combining diagnostics', async () => {
    mocks.inspectVueProjectAsync.mockResolvedValue({
      projectRoot: '/fixture',
      rootOwnsVue: true,
      hasVueScopes: true,
    });
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
    expect(mocks.mergeVueProjectExtraction).toHaveBeenCalledWith(
      expect.objectContaining({ updates: [primaryUpdate] }),
      expect.objectContaining({ updates: [vueUpdate] })
    );
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

    expect(mocks.createInlineUpdates).not.toHaveBeenCalled();
    expect(mocks.createPythonInlineUpdates).not.toHaveBeenCalled();
    expect(mocks.extractFromVueProject).toHaveBeenCalledOnce();
    expect(mocks.extractFromVueProject).toHaveBeenCalledWith({
      cwd,
      filePatterns: patterns,
      includeSourceCodeContext: true,
      conditionNames: parsingOptions.conditionNames,
      vueCompilerOptions: parsingFlags.vueCompilerOptions,
      viteConfigPath: parsingFlags.viteConfigPath,
    });
    expect(result).toEqual(vueResult);
  });
});

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}
