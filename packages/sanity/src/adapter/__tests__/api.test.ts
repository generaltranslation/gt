// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from 'generaltranslation/errors';

import { api, configureApiClient } from '../api';

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

  it.each([
    ['source', 'target'],
    ['en-us', 'es-es'],
  ])(
    'canonicalizes enqueue locales %s / %s',
    async (sourceLocale, targetLocale) => {
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
        sourceLocale,
        targetLocales: [targetLocale],
      });

      expect(fetchMock).toHaveBeenCalledOnce();
    }
  );

  it.each([
    ['source', 'target'],
    ['en-us', 'es-es'],
  ])(
    'canonicalizes upload locales %s / %s',
    async (sourceLocale, targetLocale) => {
      fetchMock.mockImplementation(async (request) => {
        const body = JSON.parse(await new Request(request).text()) as {
          sourceLocale: string;
          data: Array<{
            source: { locale: string };
            translations: Array<{ locale: string }>;
          }>;
        };
        expect(body.sourceLocale).toBe('en-US');
        expect(body.data[0].source.locale).toBe('en-US');
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

      expect(fetchMock).toHaveBeenCalledOnce();
    }
  );

  it('canonicalizes source upload locales without mutating input', async () => {
    fetchMock.mockImplementation(async (request) => {
      const body = JSON.parse(await new Request(request).text());
      expect(body).toMatchObject({
        sourceLocale: 'en-US',
        data: [{ source: { locale: 'en-US' } }],
      });
      return Response.json({
        uploadedFiles: [],
        count: 0,
        message: 'Uploaded files',
      });
    });
    const files = [
      {
        source: {
          content: 'source',
          fileName: 'document.html',
          fileFormat: 'HTML' as const,
          locale: 'en-us',
        },
      },
    ];

    await api.uploadSourceFiles(files, { sourceLocale: 'en-us' });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(files[0].source.locale).toBe('en-us');
  });

  it('canonicalizes project setup locales', async () => {
    fetchMock.mockImplementation(async (request) => {
      const body = JSON.parse(await new Request(request).text());
      expect(body.locales).toEqual(['en-US', 'es-ES']);
      return Response.json({ status: 'completed' });
    });

    await api.setupProject([], { locales: ['source', 'es-es'] });

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each(['target', 'es-es'])(
    'maps batch-download locale %s in both directions',
    async (locale) => {
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
        { fileId: 'file-id', locale },
      ]);

      expect(fetchMock).toHaveBeenCalledOnce();
      expect(response.files[0].locale).toBe('target');
    }
  );

  it('does not request an empty batch download', async () => {
    await expect(api.downloadFileBatch([])).resolves.toEqual({
      files: [],
      count: 0,
      pending: [],
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

  it('translates through the shared adapter with canonical configured locales', async () => {
    configureApiClient({
      baseUrl: 'https://api.example.com',
      apiKey: 'api-key',
      projectId: 'project-id',
      fetch: fetchMock,
      customMapping: { source: { code: 'en-US' }, target: { code: 'es-ES' } },
    });
    fetchMock.mockImplementation(async (request) => {
      const parsed = new Request(request);
      expect(new URL(parsed.url).pathname).toBe('/v2/translate');
      const body = JSON.parse(await parsed.text()) as {
        requests: Record<string, unknown>;
        sourceLocale: string;
        targetLocale: string;
      };
      expect(body).toMatchObject({
        sourceLocale: 'en-US',
        targetLocale: 'es-ES',
      });
      return Response.json(
        Object.fromEntries(
          Object.keys(body.requests).map((hash) => [
            hash,
            {
              success: true,
              translation: 'Hola',
              locale: 'es-ES',
              dataFormat: 'STRING',
            },
          ])
        )
      );
    });

    await expect(
      api.translate('Hello', { targetLocale: 'target', sourceLocale: 'source' })
    ).resolves.toMatchObject({ success: true, locale: 'es-ES' });
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
    fetchMock.mockImplementation(async (request) => {
      const url = new URL(new Request(request).url);
      expect(url.pathname).toBe(
        '/v2/project/translations/files/status/file-id'
      );
      expect(url.searchParams.get('branchId')).toBe('branch-id');
      return Response.json({
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
        sourceFile: { ...sourceFile, id: 'id' },
      });
    });

    const response = await api.querySourceFile({
      fileId: 'file-id',
      branchId: 'branch-id',
    });

    expect(fetchMock).toHaveBeenCalledOnce();

    expect(response.translations[0].locale).toBe('target');
    expect(response.sourceFile).toMatchObject({
      sourceLocale: 'source',
      locales: ['target'],
    });
  });
});
