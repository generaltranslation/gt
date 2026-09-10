import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getFileInfo, uploadTranslations } from '@generaltranslation/api';
import { createGtApiAdapter } from './createGtApi';

vi.mock('@generaltranslation/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@generaltranslation/api')>()),
  getFileInfo: vi.fn(),
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

describe('createGtApiAdapter', () => {
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
    expect(adapter.resolveAliasLocale('es-ES')).toBe('target');
  });

  it('canonicalizes upload locales at the shared boundary', async () => {
    vi.mocked(uploadTranslations).mockResolvedValue(
      result({ uploadedFiles: [], count: 0, message: 'Uploaded files' })
    );
    const adapter = createGtApiAdapter();
    adapter.configure({ baseUrl: 'https://api.example.com', customMapping });

    await adapter.uploadTranslations(
      [
        {
          source: {
            content: 'source',
            fileName: 'document.html',
            fileFormat: 'HTML',
            locale: 'source',
          },
          translations: [
            {
              content: 'translation',
              fileName: 'document.html',
              fileFormat: 'HTML',
              locale: 'target',
            },
          ],
        },
      ],
      { sourceLocale: 'source' }
    );

    expect(uploadTranslations).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          sourceLocale: 'en-US',
          data: [
            expect.objectContaining({
              translations: [expect.objectContaining({ locale: 'es-ES' })],
            }),
          ],
        }),
      })
    );
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
