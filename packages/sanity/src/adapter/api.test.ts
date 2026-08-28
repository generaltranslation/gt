// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadFile, getTranslationStatus } from 'generaltranslation/api';
import { ApiError } from 'generaltranslation/errors';

import { api, configureApiClient } from './api';

vi.mock('generaltranslation/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('generaltranslation/api')>()),
  downloadFile: vi.fn(),
  getTranslationStatus: vi.fn(),
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
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.resetAllMocks();
    configureApiClient({
      baseUrl: 'https://api.example.com',
      fetch: fetchMock,
      customMapping: {
        source: { code: 'en-US' },
        target: { code: 'es-ES' },
      },
    });
  });

  it('canonicalizes the optional source locale when enqueueing files', async () => {
    fetchMock.mockImplementation(async (request) => {
      const body = JSON.parse(await new Request(request).text()) as {
        sourceLocale?: string;
        targetLocales: string[];
      };
      expect(body.sourceLocale).toBe('en-US');
      expect(body.targetLocales).toEqual(['es-ES']);
      return Response.json({
        jobData: {},
        locales: [],
        message: 'Enqueued files',
      });
    });

    await api.enqueueFiles([{ fileId: 'file-id', versionId: 'version-id' }], {
      sourceLocale: 'source',
      targetLocales: ['target'],
    });

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('canonicalizes translation locales when uploading translations', async () => {
    fetchMock.mockImplementation(async (request) => {
      const body = JSON.parse(await new Request(request).text()) as {
        sourceLocale: string;
        data: Array<{ translations: Array<{ locale: string }> }>;
      };
      expect(body.sourceLocale).toBe('en-US');
      expect(body.data[0].translations[0].locale).toBe('es-ES');
      return Response.json({
        uploadedFiles: [],
        count: 0,
        message: 'Uploaded files',
      });
    });

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

    expect(fetchMock).toHaveBeenCalledOnce();
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
    fetchMock.mockImplementation(async (request) => {
      const body = JSON.parse(await new Request(request).text()) as Array<{
        locale?: string;
      }>;
      expect(body).toEqual([{ fileId: 'file-id', locale: 'es-ES' }]);
      return Response.json({
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
      });
    });

    const response = await api.downloadFileBatch([
      { fileId: 'file-id', locale: 'target' },
    ]);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(response.files[0].locale).toBe('target');
  });

  it('does not request an empty batch download', async () => {
    await expect(api.downloadFileBatch([])).resolves.toEqual({
      files: [],
      count: 0,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('preserves HTTP status on job polling errors', async () => {
    fetchMock.mockResolvedValue(
      Response.json({ error: 'job status unavailable' }, { status: 403 })
    );

    await expect(api.awaitJobs(['job-id'])).rejects.toEqual(
      expect.objectContaining<ApiError>({
        name: 'ApiError',
        code: 403,
        message: 'job status unavailable',
      })
    );
  });

  it('does not expose shared adapter configuration internals', () => {
    expect(api).not.toHaveProperty('getClientConfig');
  });

  it('maps file-info locales in both directions', async () => {
    fetchMock.mockImplementation(async (request) => {
      const body = JSON.parse(await new Request(request).text()) as {
        translatedFiles: Array<{ locale: string }>;
      };
      expect(body.translatedFiles[0].locale).toBe('es-ES');
      return Response.json({
        sourceFiles: [sourceFile],
        translatedFiles: [translatedFile],
      });
    });

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

    expect(fetchMock).toHaveBeenCalledOnce();
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
