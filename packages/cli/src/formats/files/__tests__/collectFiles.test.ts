import { describe, it, expect, vi, beforeEach } from 'vitest';
import { collectFiles } from '../collectFiles.js';
import { aggregateFiles } from '../aggregateFiles.js';
import { aggregateInlineTranslations } from '../../../translation/stage.js';
import type { Settings, TranslateFlags } from '../../../types/index.js';
import { Libraries } from '../../../types/libraries.js';

vi.mock('../aggregateFiles.js', () => ({
  aggregateFiles: vi.fn(async () => ({
    files: [],
    publishMap: new Map<string, boolean>(),
  })),
}));

vi.mock('../../../translation/stage.js', () => ({
  aggregateInlineTranslations: vi.fn(),
}));

vi.mock('../../../utils/hash.js', () => ({
  hashStringSync: vi.fn((value: string) => `hash_${value}`),
}));

vi.mock('../../../console/logging.js', () => ({
  logErrorAndExit: vi.fn(),
}));

const settings = {
  defaultLocale: 'en',
  publish: true,
  files: {
    resolvedPaths: {},
    placeholderPaths: {},
    transformPaths: {},
    transformFormats: {},
    publishPaths: new Set<string>(),
    unpublishPaths: new Set<string>(),
    parsingFlags: {},
    gtJson: {
      parsingFlags: {},
    },
  },
} as Settings;

const options = {} as TranslateFlags;

describe('collectFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keys inline GTJSON entries by hash while preserving custom id metadata', async () => {
    vi.mocked(aggregateInlineTranslations).mockResolvedValue([
      {
        dataFormat: 'ICU',
        source: 'Hello',
        metadata: {
          id: 'custom-id',
          hash: 'content-hash',
        },
      },
    ]);

    const { files } = await collectFiles(options, settings, Libraries.GT_REACT);

    expect(files).toHaveLength(1);
    expect(JSON.parse(files[0].content)).toEqual({
      'content-hash': 'Hello',
    });
    expect(files[0].formatMetadata).toEqual({
      'content-hash': {
        id: 'custom-id',
        hash: 'content-hash',
        dataFormat: 'ICU',
      },
    });
  });

  it('passes additional inline libraries to mixed-project extraction', async () => {
    vi.mocked(aggregateInlineTranslations).mockResolvedValue([]);

    await collectFiles(options, settings, Libraries.GT_REACT, [
      Libraries.GT_VUE,
    ]);

    expect(aggregateInlineTranslations).toHaveBeenCalledWith(
      options,
      settings,
      Libraries.GT_REACT,
      [Libraries.GT_VUE]
    );
    expect(aggregateFiles).toHaveBeenCalledWith(settings, undefined);
  });

  it('reuses an explicit command-level library snapshot for file formats', async () => {
    vi.mocked(aggregateInlineTranslations).mockResolvedValue([]);

    await collectFiles(
      options,
      settings,
      Libraries.GT_REACT,
      [Libraries.GT_VUE],
      [Libraries.GT_VUE, 'i18next-icu']
    );

    expect(aggregateFiles).toHaveBeenCalledWith(settings, {
      library: Libraries.GT_REACT,
      additionalModules: [Libraries.GT_VUE, 'i18next-icu'],
    });
  });

  it('extracts an inline additional runtime for a file-format primary', async () => {
    vi.mocked(aggregateInlineTranslations).mockResolvedValue([]);

    await collectFiles(
      options,
      settings,
      'i18next',
      [Libraries.GT_VUE],
      ['i18next-icu', Libraries.GT_VUE]
    );

    expect(aggregateInlineTranslations).toHaveBeenCalledWith(
      options,
      settings,
      Libraries.GT_VUE,
      []
    );
    expect(aggregateFiles).toHaveBeenCalledWith(settings, {
      library: 'i18next',
      additionalModules: ['i18next-icu', Libraries.GT_VUE],
    });
  });

  it.each([undefined, true])(
    'does not infer inline collection for a base file project with publish=%s',
    async (publish) => {
      vi.mocked(aggregateInlineTranslations).mockResolvedValue([
        {
          dataFormat: 'STRING',
          source: 'Unintended workspace source',
          metadata: { hash: 'workspace-hash' },
        },
      ]);

      const { files } = await collectFiles(
        options,
        { ...settings, publish },
        'base'
      );

      expect(files).toEqual([]);
      expect(aggregateInlineTranslations).not.toHaveBeenCalled();
    }
  );
});
