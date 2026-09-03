import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from 'generaltranslation/errors';
import { api, configureApiClient } from '../api.js';

const uploadedFile = {
  branchId: 'branch-id',
  fileId: 'file-id',
  versionId: 'version-id',
  fileName: 'messages.json',
  fileFormat: 'JSON',
  locale: 'en',
};

describe('CLI API client', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const configure = (
    overrides: Partial<Parameters<typeof configureApiClient>[0]> = {}
  ) =>
    configureApiClient({
      apiKey: 'api-key',
      baseUrl: 'https://api.example.com',
      projectId: 'project-id',
      fetch: fetchMock,
      ...overrides,
    });

  beforeEach(() => {
    fetchMock.mockReset();
    configure();
  });

  it('fails fast when used before configuration', async () => {
    vi.resetModules();
    const unconfiguredModule = await import('../api.js');

    await expect(
      unconfiguredModule.api.queryBranchData({ branchNames: [] })
    ).rejects.toThrow(
      'API client not configured — call configureApiClient first'
    );
  });

  it('maps canonical server locales back to configured aliases', () => {
    configure({
      customMapping: { 'brand-english': { code: 'en-US' } },
    });

    expect(api.resolveAliasLocale('en-US')).toBe('brand-english');
  });

  it('maps query file locales between configured aliases and canonical locales', async () => {
    configure({
      customMapping: { 'brand-english': { code: 'en-US' } },
    });
    fetchMock.mockImplementation(async (request) => {
      const body = JSON.parse(await request.text()) as {
        translatedFiles: Array<{ locale: string }>;
      };
      expect(body.translatedFiles[0].locale).toBe('en-US');
      return Response.json({
        translatedFiles: [{ locale: 'en-US' }],
        sourceFiles: [{ sourceLocale: 'en-US', locales: ['en-US', 'es'] }],
      });
    });

    const result = await api.queryFileData({
      translatedFiles: [
        {
          branchId: 'branch-id',
          fileId: 'file-id',
          versionId: 'version-id',
          locale: 'brand-english',
        },
      ],
    });

    expect(result.translatedFiles[0].locale).toBe('brand-english');
    expect(result.sourceFiles[0].sourceLocale).toBe('brand-english');
    expect(result.sourceFiles[0].locales).toEqual(['brand-english', 'es']);
  });

  it('preserves HTTP status on API errors', async () => {
    fetchMock.mockResolvedValue(
      Response.json({ error: 'branching unavailable' }, { status: 403 })
    );

    await expect(api.queryBranchData({ branchNames: [] })).rejects.toEqual(
      expect.objectContaining<ApiError>({
        code: 403,
        message: 'branching unavailable',
      })
    );
  });

  it('preserves HTTP status for text API errors', async () => {
    configure({ retryPolicy: 'none' });
    fetchMock.mockResolvedValue(
      new Response('service unavailable', { status: 503 })
    );

    await expect(api.queryBranchData({ branchNames: [] })).rejects.toEqual(
      expect.objectContaining<ApiError>({
        code: 503,
        message: 'service unavailable',
      })
    );
  });

  it('preserves HTTP status on job polling errors', async () => {
    fetchMock.mockResolvedValue(
      Response.json({ error: 'job status unavailable' }, { status: 403 })
    );

    await expect(api.awaitJobs(['job-1'])).rejects.toEqual(
      expect.objectContaining<ApiError>({
        code: 403,
        message: 'job status unavailable',
      })
    );
  });

  it('does not hide network errors', async () => {
    const networkError = new Error('connection reset');
    configure({ retryPolicy: 'none' });
    fetchMock.mockRejectedValue(networkError);

    await expect(api.queryBranchData({ branchNames: [] })).rejects.toBe(
      networkError
    );
  });

  it('canonicalizes the default locale when creating a project', async () => {
    configure({
      customMapping: { 'brand-english': { code: 'en-US' } },
    });
    fetchMock.mockImplementation(async (request) => {
      const body = JSON.parse(await request.text()) as {
        defaultLocale: string;
      };
      expect(body.defaultLocale).toBe('en-US');
      return Response.json(
        {
          project: {
            id: 'project-id',
            name: 'Project',
            orgId: 'org-id',
            defaultLocale: 'en-US',
          },
        },
        { status: 201 }
      );
    });

    await api.createProject({
      name: 'Project',
      defaultLocale: 'brand-english',
    });
  });

  it('fetches project information through the SDK adapter', async () => {
    fetchMock.mockImplementation(async (request) => {
      expect(new URL(request.url).pathname).toBe('/v2/project/info/project-id');
      return Response.json({
        id: 'project-id',
        name: 'Project',
        orgId: 'org-id',
        defaultLocale: 'en',
        currentLocales: ['en', 'es'],
        autoApprove: false,
      });
    });

    await expect(api.getProjectInfo(10_000)).resolves.toEqual(
      expect.objectContaining({ id: 'project-id', autoApprove: false })
    );
  });

  it('checks job status through the job info endpoint', async () => {
    fetchMock.mockImplementation(async (request) => {
      expect(new URL(request.url).pathname).toBe('/v2/project/jobs/info');
      await expect(request.json()).resolves.toEqual({ jobIds: ['setup-job'] });
      return Response.json([
        {
          jobId: 'setup-job',
          status: 'failed',
          error: { message: 'Context generation failed' },
        },
      ]);
    });

    await expect(api.checkJobStatus(['setup-job'])).resolves.toEqual([
      {
        jobId: 'setup-job',
        status: 'failed',
        error: { message: 'Context generation failed' },
      },
    ]);
  });

  it('canonicalizes user edit diff locales', async () => {
    configure({
      customMapping: { 'brand-english': { code: 'en-US' } },
    });
    fetchMock.mockImplementation(async (request) => {
      const body = JSON.parse(await request.text()) as {
        diffs: Array<{ locale: string }>;
      };
      expect(body.diffs[0].locale).toBe('en-US');
      return Response.json({
        filesProcessed: 1,
        entriesReceived: 1,
        message: 'processed',
      });
    });

    await api.submitUserEditDiffs({
      diffs: [
        {
          locale: 'brand-english',
          diff: 'diff',
          versionId: 'version-id',
          fileId: 'file-id',
          localContent: 'content',
        },
      ],
    });
  });

  it('base64-encodes and uploads source files in batches of 100', async () => {
    const requestBodies: Array<{
      data: Array<{ source: { content: string } }>;
    }> = [];
    fetchMock.mockImplementation(async (request) => {
      const body = JSON.parse(await request.text()) as {
        data: Array<{ source: { content: string } }>;
      };
      requestBodies.push(body);
      return Response.json(
        {
          uploadedFiles: body.data.map(() => uploadedFile),
          count: body.data.length,
          message: 'uploaded',
        },
        { status: 201 }
      );
    });

    const result = await api.uploadSourceFiles(
      Array.from({ length: 101 }, (_, index) => ({
        source: {
          content: `message-${index}`,
          fileName: `messages-${index}.json`,
          fileFormat: 'JSON',
          locale: 'en',
        },
      })),
      { sourceLocale: 'en' }
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestBodies[0].data).toHaveLength(100);
    expect(requestBodies[0].data[0].source.content).toBe('bWVzc2FnZS0w');
    expect(result.uploadedFiles).toHaveLength(101);
  });

  it('base64-encodes and uploads translation files through the SDK', async () => {
    fetchMock.mockImplementation(async (request) => {
      const body = JSON.parse(await request.text()) as {
        data: Array<{
          source: { content: string };
          translations: Array<{ content: string }>;
        }>;
      };
      expect(body.data[0].source.content).toBe('c291cmNl');
      expect(body.data[0].translations[0].content).toBe('dHJhbnNsYXRpb24=');
      return Response.json(
        { uploadedFiles: [uploadedFile], count: 1, message: 'uploaded' },
        { status: 201 }
      );
    });

    const result = await api.uploadTranslations(
      [
        {
          source: {
            content: 'source',
            fileName: 'messages.json',
            fileFormat: 'JSON',
            locale: 'en',
          },
          translations: [
            {
              content: 'translation',
              fileName: 'es/messages.json',
              fileFormat: 'JSON',
              locale: 'es',
            },
          ],
        },
      ],
      { sourceLocale: 'en' }
    );

    expect(result.uploadedFiles).toEqual([uploadedFile]);
  });

  it('canonicalizes uploaded translation locales', async () => {
    configure({
      customMapping: { 'brand-english': { code: 'en-US' } },
    });
    fetchMock.mockImplementation(async (request) => {
      const body = JSON.parse(await request.text()) as {
        data: Array<{ translations: Array<{ locale: string }> }>;
      };
      expect(body.data[0].translations[0].locale).toBe('en-US');
      return Response.json({
        uploadedFiles: [uploadedFile],
        count: 1,
        message: 'uploaded',
      });
    });

    await api.uploadTranslations(
      [
        {
          source: {
            content: 'source',
            fileName: 'messages.json',
            fileFormat: 'JSON',
            locale: 'en',
          },
          translations: [
            {
              content: 'translation',
              fileName: 'en/messages.json',
              fileFormat: 'JSON',
              locale: 'brand-english',
            },
          ],
        },
      ],
      { sourceLocale: 'en' }
    );
  });

  it('decodes text downloads and preserves binary downloads', async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        files: [
          {
            id: 'text',
            branchId: 'branch-id',
            fileId: 'text-id',
            versionId: 'version-id',
            data: 'aGVsbG8=',
            metadata: {},
            fileFormat: 'JSON',
          },
          {
            id: 'binary',
            branchId: 'branch-id',
            fileId: 'binary-id',
            versionId: 'version-id',
            data: 'binary-base64',
            metadata: {},
            fileFormat: 'LOTTIE',
          },
        ],
        count: 2,
      })
    );

    const result = await api.downloadFileBatch([
      { fileId: 'text-id' },
      { fileId: 'binary-id' },
    ]);

    expect(result.files.map(({ data }) => data)).toEqual([
      'hello',
      'binary-base64',
    ]);
  });

  it('maps download locales between configured aliases and canonical locales', async () => {
    configure({
      customMapping: { 'brand-english': { code: 'en-US' } },
    });
    fetchMock.mockImplementation(async (request) => {
      const body = JSON.parse(await request.text()) as Array<{
        locale: string;
      }>;
      expect(body[0].locale).toBe('en-US');
      return Response.json({
        files: [
          {
            id: 'text',
            branchId: 'branch-id',
            fileId: 'file-id',
            versionId: 'version-id',
            locale: 'en-US',
            data: 'aGVsbG8=',
            metadata: {},
            fileFormat: 'JSON',
          },
        ],
        count: 1,
      });
    });

    const result = await api.downloadFileBatch([
      { fileId: 'file-id', locale: 'brand-english' },
    ]);

    expect(result.files[0].locale).toBe('brand-english');
  });

  it('returns an empty download aggregate without an HTTP request', async () => {
    await expect(api.downloadFileBatch([])).resolves.toEqual({
      files: [],
      count: 0,
      pending: [],
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('downloads files in batches of 100', async () => {
    fetchMock.mockImplementation(async (request) => {
      const body = JSON.parse(await request.text()) as Array<{
        fileId: string;
      }>;
      return Response.json({
        files: body.map(({ fileId }) => ({
          id: fileId,
          branchId: 'branch-id',
          fileId,
          versionId: 'version-id',
          data: 'aGVsbG8=',
          metadata: {},
          fileFormat: 'JSON',
        })),
        count: body.length,
      });
    });

    const result = await api.downloadFileBatch(
      Array.from({ length: 101 }, (_, index) => ({ fileId: `file-${index}` }))
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.files).toHaveLength(101);
  });

  it('intersects orphan results across file ID batches', async () => {
    let requestCount = 0;
    fetchMock.mockImplementation(async () => {
      requestCount += 1;
      return Response.json({
        orphanedFiles: [
          {
            fileId: 'common-orphan',
            versionId: 'version-id',
            fileName: 'orphan.json',
          },
          {
            fileId: `batch-${requestCount}-only`,
            versionId: 'version-id',
            fileName: 'batch.json',
          },
        ],
      });
    });

    const result = await api.getOrphanedFiles(
      'branch-id',
      Array.from({ length: 101 }, (_, index) => `file-${index}`)
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.orphanedFiles).toEqual([
      {
        fileId: 'common-orphan',
        versionId: 'version-id',
        fileName: 'orphan.json',
      },
    ]);
  });

  it('enqueues files in batches of 100 and merges job data', async () => {
    configure({
      customMapping: { 'brand-english': { code: 'en-US' } },
    });
    let requestCount = 0;
    const batchSizes: number[] = [];
    fetchMock.mockImplementation(async (request) => {
      const body = JSON.parse(await request.text()) as {
        files: unknown[];
        sourceLocale?: string;
      };
      expect(body.sourceLocale).toBe('en-US');
      batchSizes.push(body.files.length);
      requestCount += 1;
      return Response.json({
        jobData: {
          [`job-${requestCount}`]: {
            sourceFileId: 'source-file-id',
            fileId: 'file-id',
            versionId: 'version-id',
            branchId: 'branch-id',
            targetLocale: 'es',
            projectId: 'project-id',
            force: false,
          },
        },
        locales: ['es'],
        message: 'enqueued',
      });
    });

    const result = await api.enqueueFiles(
      Array.from({ length: 101 }, (_, index) => ({
        branchId: 'branch-id',
        fileId: `file-${index}`,
        versionId: 'version-id',
        fileName: `messages-${index}.json`,
        fileFormat: 'JSON' as const,
      })),
      { sourceLocale: 'brand-english', targetLocales: ['es'] }
    );

    expect(batchSizes).toEqual([100, 1]);
    expect(Object.keys(result.jobData)).toEqual(['job-1', 'job-2']);
  });
});
