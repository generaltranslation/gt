import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  downloadFile,
  downloadFiles,
  enqueueFileTranslations,
  getFileInfo,
  getTranslationStatus,
  uploadTranslations,
} from 'generaltranslation/api';

import { api, configureApiClient } from './api';

vi.mock('generaltranslation/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('generaltranslation/api')>()),
  downloadFile: vi.fn(),
  downloadFiles: vi.fn(),
  enqueueFileTranslations: vi.fn(),
  getFileInfo: vi.fn(),
  getTranslationStatus: vi.fn(),
  uploadTranslations: vi.fn(),
}));

function result<T>(data: T) {
  return {
    data,
    request: new Request('https://api.example.com'),
    response: new Response(),
  };
}

const sourceFile = {
  branchId: 'branch-id',
  fileId: 'file-id',
  versionId: 'version-id',
  fileName: 'document.html',
  fileFormat: 'HTML' as const,
  dataFormat: null,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  publishedAt: null,
  locales: ['es-ES'],
  sourceLocale: 'en-US',
};

const translatedFile = {
  branchId: 'branch-id',
  fileId: 'file-id',
  versionId: 'version-id',
  fileFormat: 'HTML' as const,
  dataFormat: null,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  approvedAt: null,
  publishedAt: null,
  completedAt: null,
  locale: 'es-ES',
};

describe('Sanity API adapter', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    configureApiClient({
      baseUrl: 'https://api.example.com',
      customMapping: {
        source: { code: 'en-US' },
        target: { code: 'es-ES' },
      },
    });
  });

  it('canonicalizes the optional source locale when enqueueing files', async () => {
    vi.mocked(enqueueFileTranslations).mockResolvedValue(
      result({ jobData: {}, locales: [], message: 'Enqueued files' })
    );

    await api.enqueueFiles([{ fileId: 'file-id', versionId: 'version-id' }], {
      sourceLocale: 'source',
      targetLocales: ['target'],
    });

    expect(enqueueFileTranslations).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          sourceLocale: 'en-US',
          targetLocales: ['es-ES'],
        }),
      })
    );
  });

  it('canonicalizes translation locales when uploading translations', async () => {
    vi.mocked(uploadTranslations).mockResolvedValue(
      result({ uploadedFiles: [], count: 0, message: 'Uploaded files' })
    );

    await api.uploadTranslations(
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

  it('canonicalizes the locale when downloading one file', async () => {
    vi.mocked(downloadFile).mockResolvedValue(
      result({ data: Buffer.from('translated').toString('base64') })
    );

    await expect(
      api.downloadFile({ fileId: 'file-id', locale: 'target' })
    ).resolves.toBe('translated');
    expect(downloadFile).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({ locale: 'es-ES' }),
      })
    );
  });

  it('maps batch-download locales in both directions', async () => {
    vi.mocked(downloadFiles).mockResolvedValue(
      result({
        files: [
          {
            id: 'id',
            branchId: 'branch-id',
            fileId: 'file-id',
            locale: 'es-ES',
            versionId: 'version-id',
            fileName: 'document.html',
            data: Buffer.from('translated').toString('base64'),
            metadata: {},
            fileFormat: 'HTML',
          },
        ],
        count: 1,
        pending: [],
      })
    );

    const response = await api.downloadFileBatch([
      { fileId: 'file-id', locale: 'target' },
    ]);

    expect(downloadFiles).toHaveBeenCalledWith(
      expect.objectContaining({
        body: [{ fileId: 'file-id', locale: 'es-ES' }],
      })
    );
    expect(response.files[0].locale).toBe('target');
  });

  it('does not request an empty batch download', async () => {
    await expect(api.downloadFileBatch([])).resolves.toEqual({
      files: [],
      count: 0,
    });
    expect(downloadFiles).not.toHaveBeenCalled();
  });

  it('maps file-info locales in both directions', async () => {
    vi.mocked(getFileInfo).mockResolvedValue(
      result({ sourceFiles: [sourceFile], translatedFiles: [translatedFile] })
    );

    const response = await api.queryFileData({
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

  it('alias-resolves translation-status locales', async () => {
    vi.mocked(getTranslationStatus).mockResolvedValue(
      result({
        translations: [
          {
            locale: 'es-ES',
            completedAt: null,
            approvedAt: null,
            publishedAt: null,
            createdAt: null,
            updatedAt: null,
          },
        ],
        sourceFile: {
          id: 'id',
          branchId: 'branch-id',
          fileId: 'file-id',
          versionId: 'version-id',
          fileName: 'document.html',
          sourceLocale: 'en-US',
          fileFormat: 'HTML',
          dataFormat: null,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
          locales: ['es-ES'],
        },
      })
    );

    const response = await api.querySourceFile({ fileId: 'file-id' });

    expect(response.translations[0].locale).toBe('target');
    expect(response.sourceFile).toMatchObject({
      sourceLocale: 'source',
      locales: ['target'],
    });
  });
});
