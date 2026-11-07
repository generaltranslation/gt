import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import os from 'node:os';
import { saveLocalEdits } from '../saveLocalEdits.js';
import { createMockSettings } from '../__mocks__/settings.js';
import { logger } from '../../console/logger.js';
import { aggregateFiles } from '../../formats/files/aggregateFiles.js';
import { runPublishWorkflow } from '../../workflows/publish.js';
import { getGitUnifiedDiff } from '../../utils/gitDiff.js';
import { hashStringSync } from '../../utils/hash.js';
import { clearWarnings, getWarnings } from '../../state/translateWarnings.js';

const api = vi.hoisted(() => ({
  queryFiles: vi.fn(),
  queryFilesContent: vi.fn(),
  overwriteTranslations: vi.fn(),
}));
vi.mock('../../utils/api.js', () => ({
  createClients: () => ({ project: api }),
  resolveCanonicalLocale: (locale: string) => locale,
}));

const mockSpinner = vi.hoisted(() => ({ start: vi.fn(), stop: vi.fn() }));
vi.mock('../../console/logger.js', () => ({
  logger: { warn: vi.fn(), createSpinner: () => mockSpinner },
}));

vi.mock('../../utils/gitDiff.js', () => ({ getGitUnifiedDiff: vi.fn() }));
vi.mock('../../formats/files/aggregateFiles.js', () => ({
  aggregateFiles: vi.fn(),
}));
vi.mock('../../workflows/publish.js', () => ({
  runPublishWorkflow: vi.fn(async () => true),
}));
vi.mock('../../workflows/steps/BranchStep.js', () => ({
  BranchStep: class {
    run = async () => ({ currentBranch: { id: 'branch1' } });
  },
}));

describe('saveLocalEdits', () => {
  const originalCwd = process.cwd();
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'gt-save-local-'))
    );
    process.chdir(tempDir);
    vi.clearAllMocks();
    clearWarnings();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('publishes every configured file except versions with a failed edit', async () => {
    const settings = createMockSettings({
      configDirectory: tempDir,
      config: path.join(tempDir, 'gt.config.json'),
      defaultLocale: 'en',
      locales: ['en', 'ja'],
      files: {
        resolvedPaths: {
          md: ['a', 'b', 'c'].map((name) => path.join(tempDir, `${name}.md`)),
        },
        placeholderPaths: {
          md: ['a', 'b', 'c'].map((name) =>
            path.join(tempDir, '[locale]', `${name}.md`)
          ),
        },
        transformPaths: {},
      },
    });
    // Both ja translations of a and b were edited on disk since their
    // download; c has no edits.
    fs.mkdirSync(path.join(tempDir, 'ja'));
    const lockEntries: Record<string, unknown> = {};
    for (const name of ['a', 'b']) {
      fs.writeFileSync(path.join(tempDir, 'ja', `${name}.md`), 'edited');
      lockEntries[`file-${name}`] = {
        [`version-${name}`]: {
          ja: {
            updatedAt: '2026-01-01T00:00:00Z',
            postProcessHash: hashStringSync('server content'),
          },
        },
      };
    }
    fs.writeFileSync(
      path.join(tempDir, 'gt-lock.json'),
      JSON.stringify({ version: 1, entries: { branch1: lockEntries } })
    );
    const refs = ['a', 'b', 'c'].map((name) => ({
      fileName: `${name}.md`,
      fileFormat: 'MD' as const,
      fileId: `file-${name}`,
      versionId: `version-${name}`,
    }));
    const publishMap = new Map([
      ['file-a', true],
      ['file-b', true],
      ['file-c', true],
    ]);
    vi.mocked(aggregateFiles).mockResolvedValue({
      files: refs.map((ref) => ({ ...ref, content: '', locale: 'en' })),
      publishMap,
    });
    const selectors = refs.slice(0, 2).map(({ fileId, versionId }) => ({
      branchId: 'branch1',
      fileId,
      versionId,
      locale: 'ja',
    }));
    vi.mocked(api.queryFiles).mockResolvedValue({
      results: selectors.map((selector) => ({
        ...selector,
        status: 'found' as const,
        completedAt: '2026-01-01T00:00:00Z',
      })),
    });
    vi.mocked(api.queryFilesContent).mockResolvedValue({
      results: selectors.map((selector) => ({
        ...selector,
        status: 'ready' as const,
        fileFormat: 'MD' as const,
        data: 'server content',
      })),
    });
    vi.mocked(getGitUnifiedDiff).mockResolvedValue('mock-diff');
    vi.mocked(api.overwriteTranslations).mockResolvedValue({
      summary: { total: 2, succeeded: 1, failed: 1 },
      results: [
        { ...selectors[0], status: 'succeeded' },
        { ...selectors[1], status: 'failed', error: 'translation not found' },
      ],
    });

    await expect(saveLocalEdits(settings)).resolves.toBe(true);

    expect(runPublishWorkflow).toHaveBeenCalledTimes(1);
    expect(vi.mocked(runPublishWorkflow).mock.calls[0][0]).toEqual([
      refs[0],
      refs[2],
    ]);
    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to save local edits to b.md: Locale ja: translation not found'
    );
    expect(getWarnings()).toEqual([
      {
        category: 'failed_edit_save',
        fileName: 'b.md',
        reason: 'Locale ja: translation not found',
      },
    ]);
    const [completion] = mockSpinner.stop.mock.calls.at(-1)!;
    expect(completion).toContain('Saved 1 of 2 local edits');
    expect(completion).not.toContain('saved successfully');

    vi.mocked(runPublishWorkflow).mockResolvedValueOnce(false);
    await expect(saveLocalEdits(settings)).resolves.toBe(false);
  });

  it('publishes the version an edit was saved to and the current version', async () => {
    const settings = createMockSettings({
      configDirectory: tempDir,
      config: path.join(tempDir, 'gt.config.json'),
      defaultLocale: 'en',
      locales: ['en', 'ja'],
      files: {
        resolvedPaths: { md: [path.join(tempDir, 'a.md')] },
        placeholderPaths: { md: [path.join(tempDir, '[locale]', 'a.md')] },
        transformPaths: {},
      },
    });
    // ja was downloaded at version-1; the source has since changed to version-2.
    fs.mkdirSync(path.join(tempDir, 'ja'));
    fs.writeFileSync(path.join(tempDir, 'ja', 'a.md'), 'edited');
    fs.writeFileSync(
      path.join(tempDir, 'gt-lock.json'),
      JSON.stringify({
        version: 1,
        entries: {
          branch1: {
            'file-a': {
              'version-1': {
                ja: {
                  updatedAt: '2026-01-01T00:00:00Z',
                  postProcessHash: hashStringSync('server content'),
                },
              },
            },
          },
        },
      })
    );
    vi.mocked(aggregateFiles).mockResolvedValue({
      files: [
        {
          fileName: 'a.md',
          fileFormat: 'MD',
          fileId: 'file-a',
          versionId: 'version-2',
          content: '',
          locale: 'en',
        },
      ],
      publishMap: new Map([['file-a', true]]),
    });
    const selector = {
      branchId: 'branch1',
      fileId: 'file-a',
      versionId: 'version-1',
      locale: 'ja',
    };
    vi.mocked(api.queryFiles).mockResolvedValue({
      results: [
        { ...selector, status: 'found', completedAt: '2026-01-01T00:00:00Z' },
      ],
    });
    vi.mocked(api.queryFilesContent).mockResolvedValue({
      results: [
        {
          ...selector,
          status: 'ready',
          fileFormat: 'MD',
          data: 'server content',
        },
      ],
    });
    vi.mocked(getGitUnifiedDiff).mockResolvedValue('mock-diff');
    vi.mocked(api.overwriteTranslations).mockResolvedValue({
      summary: { total: 1, succeeded: 1, failed: 0 },
      results: [{ ...selector, status: 'succeeded' }],
    });

    await expect(saveLocalEdits(settings)).resolves.toBe(true);

    expect(
      vi
        .mocked(runPublishWorkflow)
        .mock.calls[0][0].map((file) => `${file.fileId}:${file.versionId}`)
        .sort()
    ).toEqual(['file-a:version-1', 'file-a:version-2']);
  });

  it.each([
    ['one of its edits fails', 'succeeded', true],
    ['every edit fails', 'failed', false],
  ] as const)(
    'does not publish a file version when %s',
    async (_case, jaStatus, succeeded) => {
      const settings = createMockSettings({
        configDirectory: tempDir,
        config: path.join(tempDir, 'gt.config.json'),
        defaultLocale: 'en',
        locales: ['en', 'ja', 'fr'],
        files: {
          resolvedPaths: { md: [path.join(tempDir, 'a.md')] },
          placeholderPaths: { md: [path.join(tempDir, '[locale]', 'a.md')] },
          transformPaths: {},
        },
      });
      const locales = ['ja', 'fr'];
      const translations: Record<string, unknown> = {};
      for (const locale of locales) {
        fs.mkdirSync(path.join(tempDir, locale));
        fs.writeFileSync(path.join(tempDir, locale, 'a.md'), 'edited');
        translations[locale] = {
          updatedAt: '2026-01-01T00:00:00Z',
          postProcessHash: hashStringSync('server content'),
        };
      }
      fs.writeFileSync(
        path.join(tempDir, 'gt-lock.json'),
        JSON.stringify({
          version: 1,
          entries: { branch1: { 'file-a': { 'version-a': translations } } },
        })
      );
      const ref = {
        fileName: 'a.md',
        fileFormat: 'MD' as const,
        fileId: 'file-a',
        versionId: 'version-a',
      };
      vi.mocked(aggregateFiles).mockResolvedValue({
        files: [{ ...ref, content: '', locale: 'en' }],
        publishMap: new Map([['file-a', true]]),
      });
      const selectors = locales.map((locale) => ({
        branchId: 'branch1',
        fileId: 'file-a',
        versionId: 'version-a',
        locale,
      }));
      vi.mocked(api.queryFiles).mockResolvedValue({
        results: selectors.map((selector) => ({
          ...selector,
          status: 'found' as const,
          completedAt: '2026-01-01T00:00:00Z',
        })),
      });
      vi.mocked(api.queryFilesContent).mockResolvedValue({
        results: selectors.map((selector) => ({
          ...selector,
          status: 'ready' as const,
          fileFormat: 'MD' as const,
          data: 'server content',
        })),
      });
      vi.mocked(getGitUnifiedDiff).mockResolvedValue('mock-diff');
      vi.mocked(api.overwriteTranslations).mockResolvedValue({
        summary: { total: 2, succeeded: 1, failed: 1 },
        results: [
          { ...selectors[0], status: jaStatus },
          { ...selectors[1], status: 'failed', error: 'translation not found' },
        ],
      });

      await expect(saveLocalEdits(settings)).resolves.toBe(succeeded);

      expect(api.overwriteTranslations).toHaveBeenCalledTimes(1);
      expect(
        vi.mocked(runPublishWorkflow).mock.calls.flatMap(([files]) => files)
      ).toEqual([]);
    }
  );
});
