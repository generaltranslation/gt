import { describe, it, expect, vi, beforeEach } from 'vitest';
import { collectFiles } from '../collectFiles.js';
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
});
