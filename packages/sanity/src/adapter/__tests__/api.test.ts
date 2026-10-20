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

const emptyBatch = {
  summary: { total: 0, succeeded: 0, failed: 0 },
  results: [],
};

describe('Sanity API adapter', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.resetAllMocks();
    configureApiClient({
      baseUrl: 'https://api.example.com',
      projectId: 'project-id',
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
    'canonicalizes translateFiles locales %s / %s',
    async (sourceLocale, targetLocale) => {
      fetchMock.mockImplementation(async (request) => {
        const body = JSON.parse(await new Request(request).text()) as {
          sourceLocale?: string;
          targetLocales: string[];
        };
        expect(body.sourceLocale).toBe('en-US');
        expect(body.targetLocales).toEqual(['es-ES']);
        return Response.json({ jobs: [] }, { status: 202 });
      });

      await api.translateFiles(
        [{ fileId: 'file-id', versionId: 'version-id' }],
        { sourceLocale, targetLocales: [targetLocale] }
      );

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
        expect(body.sourceLocale).toBeUndefined();
        expect(body.data[0].source.locale).toBe('en-US');
        expect(body.data[0].translations[0].locale).toBe('es-ES');
        return Response.json(emptyBatch);
      });

      await api.uploadTranslations([
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
      ]);

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
      return Response.json(emptyBatch);
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

  it('canonicalizes project context locales', async () => {
    fetchMock.mockImplementation(async (request) => {
      const body = JSON.parse(await new Request(request).text());
      expect(body.locales).toEqual(['en-US', 'es-ES']);
      return Response.json({ job: null });
    });

    await expect(
      api.generateProjectContext([], { locales: ['source', 'es-es'] })
    ).resolves.toEqual({ job: null });

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each(['target', 'es-es'])(
    'sends queryFilesContent locale %s as its service locale, answers with the requested locale, and decodes data',
    async (locale) => {
      fetchMock.mockImplementation(async (request) => {
        const body = JSON.parse(await new Request(request).text()) as {
          files: Array<{ locale?: string }>;
        };
        expect(body.files).toEqual([{ fileId: 'file-id', locale: 'es-ES' }]);
        return Response.json({
          results: [
            {
              status: 'ready',
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
        });
      });

      const response = await api.queryFilesContent([
        { fileId: 'file-id', locale },
      ]);

      expect(fetchMock).toHaveBeenCalledOnce();
      expect(response.results[0]).toMatchObject({
        locale,
        data: 'translated',
      });
    }
  );

  it('does not request an empty content query', async () => {
    await expect(api.queryFilesContent([])).resolves.toEqual({ results: [] });
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

  it('returns the existing main branch when createBranch conflicts by name', async () => {
    fetchMock.mockImplementation(async (request) => {
      const parsed = new Request(request);
      const url = new URL(parsed.url);
      expect(url.pathname).toBe('/v2/projects/project-id/branches');
      if (parsed.method === 'POST') {
        expect(JSON.parse(await parsed.text())).toEqual({
          name: 'main',
          isDefault: true,
        });
        return Response.json({ error: 'branch exists' }, { status: 409 });
      }
      expect(url.searchParams.getAll('name')).toEqual(['main']);
      return Response.json({
        items: [{ id: 'main-id', name: 'main', isDefault: true }],
        nextCursor: null,
      });
    });

    await expect(
      api.createBranch({ name: 'main', isDefault: true })
    ).resolves.toEqual({
      branch: { id: 'main-id', name: 'main', isDefault: true },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
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
      expect(new URL(parsed.url).pathname).toBe(
        '/v2/projects/project-id/translate'
      );
      const body = JSON.parse(await parsed.text()) as {
        requests: Record<string, unknown>;
        sourceLocale: string;
        targetLocale: string;
      };
      expect(body).toMatchObject({
        sourceLocale: 'en-US',
        targetLocale: 'es-ES',
      });
      return Response.json({
        translations: Object.fromEntries(
          Object.keys(body.requests).map((hash) => [
            hash,
            {
              success: true,
              translation: 'Hola',
              locale: 'es-ES',
              dataFormat: 'STRING',
            },
          ])
        ),
        generated: true,
      });
    });

    await expect(
      api.translate('Hello', { targetLocale: 'target', sourceLocale: 'source' })
    ).resolves.toMatchObject({ success: true, locale: 'es-ES' });
  });

  it('maps file-info locales in both directions', async () => {
    fetchMock.mockImplementation(async (request) => {
      const body = JSON.parse(await new Request(request).text()) as {
        files: Array<{ locale?: string }>;
      };
      expect(body.files[1].locale).toBe('es-ES');
      return Response.json({
        results: [
          { ...sourceFile, status: 'found' },
          { ...translatedFile, status: 'found' },
        ],
      });
    });

    const response = await api.queryFiles([
      { branchId: 'branch-id', fileId: 'file-id', versionId: 'version-id' },
      {
        branchId: 'branch-id',
        fileId: 'file-id',
        versionId: 'version-id',
        locale: 'target',
      },
    ]);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(response.results[1].locale).toBe('target');
    expect(response.results[0]).toMatchObject({
      sourceLocale: 'source',
      locales: ['target'],
    });
  });

  it('alias-resolves translation-status locales', async () => {
    fetchMock.mockImplementation(async (request) => {
      const url = new URL(new Request(request).url);
      expect(url.pathname).toBe('/v2/projects/project-id/files/file-id/status');
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

    const response = await api.getFileStatus('file-id', {
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
