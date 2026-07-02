import { describe, it, expect, vi, beforeEach } from 'vitest';
import { collectFiles } from '../collectFiles.js';
import { hashStringSync } from '../../../utils/hash.js';
import { TEMPLATE_FILE_ID } from '../../../utils/constants.js';
import type { Settings, TranslateFlags } from '../../../types/index.js';
import type { Updates } from 'generaltranslation/types';

vi.mock('../aggregateFiles.js', () => ({
  aggregateFiles: vi.fn(async () => ({
    files: [],
    publishMap: new Map<string, boolean>(),
  })),
}));

vi.mock('../../../translation/stage.js', () => ({
  aggregateInlineTranslations: vi.fn(),
}));

import { aggregateInlineTranslations } from '../../../translation/stage.js';

const makeSettings = (overrides: Partial<Settings> = {}): Settings =>
  ({
    defaultLocale: 'en',
    locales: ['es'],
    publish: false,
    files: {
      resolvedPaths: {},
      placeholderPaths: { gt: '/project/i18n/[locale].json' },
      transformPaths: {},
      transformFormats: {},
      publishPaths: new Set<string>(),
      unpublishPaths: new Set<string>(),
      requiresReviewPaths: new Set<string>(),
      parsingFlags: {},
      gtJson: { parsingFlags: {} },
    },
    ...overrides,
  }) as unknown as Settings;

const makeUpdates = (
  entries: Array<{ hash: string; requiresReview?: boolean }>
): Updates =>
  entries.map(({ hash, requiresReview }) => ({
    dataFormat: 'JSX' as const,
    source: ['Hello'],
    metadata: {
      hash,
      ...(requiresReview !== undefined && { requiresReview }),
    },
  }));

const getGtFile = async (settings: Settings) => {
  const { files } = await collectFiles(
    {} as TranslateFlags,
    settings,
    'gt-react'
  );
  return files.find((f) => f.fileId === TEMPLATE_FILE_ID);
};

describe('collectFiles GTJSON requiresReview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps the legacy versionId when nothing requires review', async () => {
    vi.mocked(aggregateInlineTranslations).mockResolvedValue(
      makeUpdates([{ hash: 'aaa' }, { hash: 'bbb' }])
    );
    const gtFile = await getGtFile(makeSettings());

    expect(gtFile?.versionId).toBe(
      hashStringSync(JSON.stringify(['aaa', 'bbb']))
    );
    const metadata = gtFile?.formatMetadata as Record<
      string,
      { requiresReview?: boolean }
    >;
    expect(metadata.aaa.requiresReview).toBeUndefined();
    expect(metadata.bbb.requiresReview).toBeUndefined();
  });

  it('materializes the top-level default into component metadata', async () => {
    vi.mocked(aggregateInlineTranslations).mockResolvedValue(
      makeUpdates([{ hash: 'aaa' }, { hash: 'bbb', requiresReview: false }])
    );
    const gtFile = await getGtFile(makeSettings({ requiresReview: true }));

    const metadata = gtFile?.formatMetadata as Record<
      string,
      { requiresReview?: boolean }
    >;
    // no prop -> inherits default true
    expect(metadata.aaa.requiresReview).toBe(true);
    // explicit false prop wins over the default
    expect(metadata.bbb.requiresReview).toBe(false);
  });

  it('keeps an explicit true prop without a default', async () => {
    vi.mocked(aggregateInlineTranslations).mockResolvedValue(
      makeUpdates([{ hash: 'aaa', requiresReview: true }, { hash: 'bbb' }])
    );
    const gtFile = await getGtFile(makeSettings());

    const metadata = gtFile?.formatMetadata as Record<
      string,
      { requiresReview?: boolean }
    >;
    expect(metadata.aaa.requiresReview).toBe(true);
    expect(metadata.bbb.requiresReview).toBeUndefined();
  });

  it('changes the versionId when effective review flags change', async () => {
    vi.mocked(aggregateInlineTranslations).mockResolvedValue(
      makeUpdates([{ hash: 'aaa' }, { hash: 'bbb' }])
    );
    const withoutReview = await getGtFile(makeSettings());

    vi.mocked(aggregateInlineTranslations).mockResolvedValue(
      makeUpdates([{ hash: 'aaa' }, { hash: 'bbb' }])
    );
    const withReview = await getGtFile(makeSettings({ requiresReview: true }));

    expect(withoutReview?.versionId).not.toBe(withReview?.versionId);
  });

  it('changes the versionId when a single component opts out', async () => {
    vi.mocked(aggregateInlineTranslations).mockResolvedValue(
      makeUpdates([{ hash: 'aaa' }, { hash: 'bbb' }])
    );
    const allReview = await getGtFile(makeSettings({ requiresReview: true }));

    vi.mocked(aggregateInlineTranslations).mockResolvedValue(
      makeUpdates([{ hash: 'aaa' }, { hash: 'bbb', requiresReview: false }])
    );
    const partialReview = await getGtFile(
      makeSettings({ requiresReview: true })
    );

    expect(allReview?.versionId).not.toBe(partialReview?.versionId);
  });
});
