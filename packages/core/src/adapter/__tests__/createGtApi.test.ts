import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getFileInfo,
  getOrphanedFiles,
  publishFiles,
  submitUserEditDiffs,
  uploadTranslations,
} from '@generaltranslation/api';
import type {
  PublishFilesData,
  SubmitUserEditDiffsData,
} from '@generaltranslation/api';
import { createGtApiAdapter } from '../createGtApi';

vi.mock('@generaltranslation/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@generaltranslation/api')>()),
  getFileInfo: vi.fn(),
  getOrphanedFiles: vi.fn(),
  publishFiles: vi.fn(),
  submitUserEditDiffs: vi.fn(),
  uploadTranslations: vi.fn(),
}));

function result<T>(data: T) {
  return {
    data,
    request: new Request('https://api.example.com'),
    response: new Response(),
  };
}

const customMapping = {
  source: { code: 'en-US' },
  target: { code: 'es-ES' },
};

describe.sequential('createGtApiAdapter', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('fails before an adapter without defaults is configured', async () => {
    const adapter = createGtApiAdapter();

    await expect(adapter.createBranch({ branchName: 'main' })).rejects.toThrow(
      'API client not configured'
    );
  });

  it('resolves configured locales in both directions', () => {
    const adapter = createGtApiAdapter();
    adapter.configure({ baseUrl: 'https://api.example.com', customMapping });

    expect(adapter.resolveCanonicalLocale('target')).toBe('es-ES');
    expect(adapter.resolveCanonicalLocale('en-us')).toBe('en-US');
    expect(adapter.resolveAliasLocale('es-ES')).toBe('target');
  });

  it.each([
    ['source', 'target'],
    ['en-us', 'es-es'],
  ])(
    'canonicalizes upload locales %s / %s',
    async (sourceLocale, targetLocale) => {
      vi.mocked(uploadTranslations).mockResolvedValue(
        result({ uploadedFiles: [], count: 0, message: 'Uploaded files' })
      );
      const adapter = createGtApiAdapter();
      adapter.configure({
        baseUrl: 'https://api.example.com',
        customMapping: {
          source: { code: 'en-US' },
          target: { code: 'es-ES' },
        },
      });

      await adapter.uploadTranslations(
        [
          {
            source: {
              content: 'source',
              fileName: 'document.html',
              fileFormat: 'HTML',
              locale: sourceLocale,
            },
            translations: [
              {
                content: 'translation',
                fileName: 'document.html',
                fileFormat: 'HTML',
                locale: targetLocale,
              },
            ],
          },
        ],
        { sourceLocale }
      );

      expect(uploadTranslations).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            sourceLocale: 'en-US',
            data: [
              expect.objectContaining({
                source: expect.objectContaining({ locale: 'en-US' }),
                translations: [expect.objectContaining({ locale: 'es-ES' })],
              }),
            ],
          }),
        })
      );
    }
  );

  it('intersects orphaned files returned across request batches', async () => {
    vi.mocked(getOrphanedFiles)
      .mockResolvedValueOnce(
        result({
          orphanedFiles: [
            { fileId: 'only-first', versionId: 'v1', fileName: 'first.json' },
            { fileId: 'orphan', versionId: 'v2', fileName: 'orphan.json' },
          ],
        })
      )
      .mockResolvedValueOnce(
        result({
          orphanedFiles: [
            { fileId: 'orphan', versionId: 'v2', fileName: 'orphan.json' },
            { fileId: 'only-second', versionId: 'v3', fileName: 'second.json' },
          ],
        })
      );
    const adapter = createGtApiAdapter({
      baseUrl: 'https://api.example.com',
    });

    const response = await adapter.getOrphanedFiles(
      'branch-id',
      Array.from({ length: 101 }, (_, index) => `file-${index}`)
    );

    expect(getOrphanedFiles).toHaveBeenCalledTimes(2);
    expect(response.orphanedFiles).toEqual([
      { fileId: 'orphan', versionId: 'v2', fileName: 'orphan.json' },
    ]);
  });

  it('sends only contract fields for publish and user-edit diffs', async () => {
    vi.mocked(publishFiles).mockResolvedValue(result({ results: [] }));
    vi.mocked(submitUserEditDiffs).mockResolvedValue(
      result({ filesProcessed: 1, entriesReceived: 1, message: 'ok' })
    );
    const adapter = createGtApiAdapter();
    adapter.configure({
      baseUrl: 'https://api.example.com',
      projectId: 'project-id',
      customMapping,
    });

    await adapter.publishFiles([
      {
        fileId: 'file-id',
        versionId: 'version-id',
        branchId: 'branch-id',
        publish: true,
        fileName: 'document.json',
      } as PublishFilesData['body']['files'][number],
    ]);
    await adapter.submitUserEditDiffs({
      projectId: 'project-id',
      diffs: [
        {
          fileName: 'document.json',
          locale: 'target',
          diff: '@@',
          branchId: 'branch-id',
          versionId: 'version-id',
          fileId: 'file-id',
          localContent: '{}',
        } as SubmitUserEditDiffsData['body']['diffs'][number],
      ],
    });

    const publishBody = vi.mocked(publishFiles).mock.calls[0][0]!.body;
    expect(publishBody.files[0]).toEqual({
      fileId: 'file-id',
      versionId: 'version-id',
      branchId: 'branch-id',
      publish: true,
    });
    const diffBody = vi.mocked(submitUserEditDiffs).mock.calls[0][0]!.body;
    expect(diffBody.diffs[0]).toEqual({
      diff: '@@',
      branchId: 'branch-id',
      versionId: 'version-id',
      fileId: 'file-id',
      localContent: '{}',
      locale: 'es-ES',
    });
  });

  it('maps file-info locales in both directions', async () => {
    vi.mocked(getFileInfo).mockResolvedValue(
      result({
        sourceFiles: [
          {
            branchId: 'branch-id',
            fileId: 'file-id',
            versionId: 'version-id',
            fileName: 'document.html',
            fileFormat: 'HTML',
            dataFormat: null,
            createdAt: '2026-01-01',
            updatedAt: '2026-01-01',
            publishedAt: null,
            locales: ['es-ES'],
            sourceLocale: 'en-US',
          },
        ],
        translatedFiles: [
          {
            branchId: 'branch-id',
            fileId: 'file-id',
            versionId: 'version-id',
            fileFormat: 'HTML',
            dataFormat: null,
            createdAt: '2026-01-01',
            updatedAt: '2026-01-01',
            approvedAt: null,
            publishedAt: null,
            completedAt: null,
            locale: 'es-ES',
          },
        ],
      })
    );
    const adapter = createGtApiAdapter();
    adapter.configure({ baseUrl: 'https://api.example.com', customMapping });

    const response = await adapter.queryFileData({
      translatedFiles: [
        {
          branchId: 'branch-id',
          fileId: 'file-id',
          versionId: 'version-id',
          locale: 'target',
        },
      ],
    });

    expect(getFileInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          translatedFiles: [expect.objectContaining({ locale: 'es-ES' })],
        }),
      })
    );
    expect(response.translatedFiles[0].locale).toBe('target');
    expect(response.sourceFiles[0]).toMatchObject({
      sourceLocale: 'source',
      locales: ['target'],
    });
  });
});
