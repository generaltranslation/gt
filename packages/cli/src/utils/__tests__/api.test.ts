import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from 'generaltranslation/errors';
import type { PublishFileEntry } from 'generaltranslation/types';
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

  it('exposes runtime translation through the shared adapter with the configured transport', async () => {
    configure({
      customMapping: { 'brand-english': { code: 'en-US' } },
      retryPolicy: 'exponential',
    });
    const bodies: Array<{ sourceLocale: string; targetLocale: string }> = [];
    fetchMock.mockImplementation(async (request) => {
      expect(new URL(request.url).pathname).toBe('/v2/translate');
      expect(request.headers.get('authorization')).toBe('Bearer api-key');
      expect(request.headers.get('gt-project-id')).toBe('project-id');
      const body = JSON.parse(await request.text()) as {
        requests: Record<string, unknown>;
        sourceLocale: string;
        targetLocale: string;
      };
      bodies.push(body);
      return Response.json(
        Object.fromEntries(
          Object.keys(body.requests).map((hash) => [
            hash,
            {
              success: true,
              translation: 'Hola',
              locale: 'es',
              dataFormat: 'STRING',
            },
          ])
        )
      );
    });

    await expect(
      api.translateMany(['Hello'], {
        targetLocale: 'es',
        sourceLocale: 'brand-english',
      })
    ).resolves.toEqual([
      {
        success: true,
        translation: 'Hola',
        locale: 'es',
        dataFormat: 'STRING',
      },
    ]);
    await expect(api.translate('Hello', 'es', 10_000)).resolves.toMatchObject({
      translation: 'Hola',
    });
    expect(bodies).toEqual([
      expect.objectContaining({ sourceLocale: 'en-US', targetLocale: 'es' }),
      expect.objectContaining({ sourceLocale: 'en', targetLocale: 'es' }),
    ]);
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

  it('standardizes lowercase file query locales for the service', async () => {
    fetchMock.mockImplementation(async (request) => {
      const body = JSON.parse(await request.text()) as {
        translatedFiles: Array<{ locale: string }>;
      };
      expect(body.translatedFiles[0].locale).toBe('en-US');
      return Response.json({ translatedFiles: [], sourceFiles: [] });
    });

    await api.queryFileData({
      translatedFiles: [
        {
          branchId: 'branch-id',
          fileId: 'file-id',
          versionId: 'version-id',
          locale: 'en-us',
        },
      ],
    });
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

  it('creates a project in the selected organization with a canonical default locale', async () => {
    configure({
      projectId: undefined,
      customMapping: { 'brand-english': { code: 'en-us' } },
    });
    fetchMock.mockImplementation(async (request) => {
      expect(new URL(request.url).pathname).toBe('/v2/orgs/org-id/projects');
      expect(request.method).toBe('POST');
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

    await api.createProject('org-id', {
      name: 'Project',
      defaultLocale: 'brand-english',
    });
  });

  it('fetches raw project information through the SDK adapter', async () => {
    configure({
      customMapping: { 'brand-english': { code: 'en-US' } },
    });
    fetchMock.mockImplementation(async (request) => {
      expect(new URL(request.url).pathname).toBe('/v2/project/info/project-id');
      return Response.json({
        id: 'project-id',
        name: 'Project',
        orgId: 'org-id',
        defaultLocale: 'en-US',
        currentLocales: ['en-US', 'es'],
        autoApprove: false,
      });
    });

    await expect(api.getProjectInfo(10_000)).resolves.toEqual(
      expect.objectContaining({
        id: 'project-id',
        autoApprove: false,
        defaultLocale: 'en-US',
        currentLocales: ['en-US', 'es'],
      })
    );
  });

  it('requires a project ID to fetch project information', async () => {
    configure({ projectId: undefined });

    await expect(api.getProjectInfo(10_000)).rejects.toThrow(
      'Project ID is required to fetch project information'
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('honors an explicit zero project information timeout', async () => {
    configure({ retryPolicy: 'none' });
    fetchMock.mockImplementation(
      (request) =>
        new Promise<Response>((_resolve, reject) => {
          request.signal.addEventListener('abort', () =>
            reject(request.signal.reason)
          );
        })
    );

    await expect(api.getProjectInfo(0)).rejects.toThrow(
      'Request timed out after 0ms'
    );
  });

  it('checks job status through the job info endpoint', async () => {
    fetchMock.mockImplementation(async (request) => {
      expect(new URL(request.url).pathname).toBe('/v2/project/jobs/info');
      await expect(request.json()).resolves.toEqual({ jobIds: ['setup-job'] });
      return Response.json([
        { jobId: 'setup-job', status: 'failed', error: { message: null } },
      ]);
    });

    await expect(api.checkJobStatus(['setup-job'])).resolves.toEqual([
      { jobId: 'setup-job', status: 'failed', error: { message: null } },
    ]);
  });

  it('forwards abort signals to in-flight job status requests', async () => {
    configure({ retryPolicy: 'none' });
    let requestSignal: AbortSignal | undefined;
    fetchMock.mockImplementation(
      (request) =>
        new Promise<Response>((_resolve, reject) => {
          requestSignal = request.signal;
          const rejectOnAbort = () => reject(request.signal.reason);
          if (request.signal.aborted) rejectOnAbort();
          else request.signal.addEventListener('abort', rejectOnAbort);
        })
    );

    const controller = new AbortController();
    const pendingRequest = api.checkJobStatus(['setup-job'], controller.signal);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const rejection = expect(pendingRequest).rejects.toThrow(
      'poll deadline exceeded'
    );

    controller.abort(new Error('poll deadline exceeded'));

    await rejection;
    expect(requestSignal?.aborted).toBe(true);
  });

  it('canonicalizes user edit diff locales and sends only contract fields', async () => {
    configure({
      customMapping: { 'brand-english': { code: 'en-US' } },
    });
    fetchMock.mockImplementation(async (request) => {
      const body = JSON.parse(await request.text()) as {
        diffs: Array<{ locale: string }>;
      };
      expect(body.diffs).toEqual([
        {
          locale: 'en-US',
          diff: 'diff',
          versionId: 'version-id',
          fileId: 'file-id',
          localContent: 'content',
        },
      ]);
      return Response.json({
        filesProcessed: 1,
        entriesReceived: 1,
        message: 'processed',
      });
    });

    const diffs = [
      {
        fileName: 'messages.json',
        locale: 'brand-english',
        diff: 'diff',
        versionId: 'version-id',
        fileId: 'file-id',
        localContent: 'content',
      },
    ];
    await api.submitUserEditDiffs({ diffs });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('publishes only contract fields for CDN entries', async () => {
    fetchMock.mockImplementation(async (request) => {
      expect(new URL(request.url).pathname).toBe('/v2/project/files/publish');
      await expect(request.json()).resolves.toEqual({
        files: [
          {
            fileId: 'file-id',
            versionId: 'version-id',
            branchId: 'branch-id',
            publish: true,
          },
        ],
      });
      return Response.json({ results: [] });
    });

    const entries: PublishFileEntry[] = [
      {
        fileId: 'file-id',
        versionId: 'version-id',
        branchId: 'branch-id',
        publish: true,
        fileName: 'messages.json',
      },
    ];
    await api.publishFiles(entries);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('base64-encodes and uploads source files in batches of 100', async () => {
    const requestBodies: Array<{
      data: Array<{ source: { content: string; locale: string } }>;
      sourceLocale: string;
    }> = [];
    fetchMock.mockImplementation(async (request) => {
      const body = JSON.parse(await request.text()) as {
        data: Array<{ source: { content: string; locale: string } }>;
        sourceLocale: string;
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
          locale: 'en-us',
        },
      })),
      { sourceLocale: 'en-us' }
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestBodies[0].data).toHaveLength(100);
    expect(requestBodies[0].data[0].source.content).toBe('bWVzc2FnZS0w');
    expect(requestBodies[0].data[0].source.locale).toBe('en-US');
    expect(requestBodies[0].sourceLocale).toBe('en-US');
    expect(result.uploadedFiles).toHaveLength(101);
  });

  it('canonicalizes project setup locales', async () => {
    configure({
      customMapping: { 'brand-english': { code: 'en-us' } },
    });
    fetchMock.mockImplementation(async (request) => {
      const body = JSON.parse(await request.text()) as { locales: string[] };
      expect(body.locales).toEqual(['en-US', 'es-ES']);
      return Response.json({ status: 'completed' });
    });

    await api.setupProject([], {
      locales: ['brand-english', 'es-es'],
    });
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
      customMapping: {
        'brand-english': { code: 'en-us' },
        'brand-spanish': { code: 'es-es' },
      },
    });
    fetchMock.mockImplementation(async (request) => {
      const body = JSON.parse(await request.text()) as {
        data: Array<{
          source: { locale: string };
          translations: Array<{ locale: string }>;
        }>;
        sourceLocale: string;
      };
      expect(body.sourceLocale).toBe('en-US');
      expect(body.data[0].source.locale).toBe('en-US');
      expect(body.data[0].translations[0].locale).toBe('es-ES');
      return Response.json({
        uploadedFiles: [uploadedFile],
        count: 1,
        message: 'uploaded',
      });
    });

    const files = [
      {
        source: {
          content: 'source',
          fileName: 'messages.json',
          fileFormat: 'JSON' as const,
          locale: 'brand-english',
        },
        translations: [
          {
            content: 'translation',
            fileName: 'en/messages.json',
            fileFormat: 'JSON' as const,
            locale: 'brand-spanish',
          },
        ],
      },
    ];
    await api.uploadTranslations(files, {
      sourceLocale: 'brand-english',
    });

    expect(files[0].source.locale).toBe('brand-english');
    expect(files[0].translations[0].locale).toBe('brand-spanish');
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

  it('lists projects across every cursor page', async () => {
    const cursors: Array<string | null> = [];
    fetchMock.mockImplementation(async (request) => {
      const url = new URL(request.url);
      expect(url.pathname).toBe('/v2/projects');
      cursors.push(url.searchParams.get('cursor'));
      const page = cursors.length;
      return Response.json({
        projects: [
          {
            id: `p${page}`,
            name: `Project ${page}`,
            orgId: 'o',
            orgName: 'Org',
          },
        ],
        nextCursor: page < 3 ? `cursor-${page}` : null,
      });
    });

    const projects = await api.listProjects();

    expect(cursors).toEqual([null, 'cursor-1', 'cursor-2']);
    expect(projects.map((project) => project.id)).toEqual(['p1', 'p2', 'p3']);
  });

  it('lists organizations across every cursor page', async () => {
    const cursors: Array<string | null> = [];
    fetchMock.mockImplementation(async (request) => {
      const url = new URL(request.url);
      expect(url.pathname).toBe('/v2/orgs');
      cursors.push(url.searchParams.get('cursor'));
      return Response.json({
        orgs: [{ id: `o${cursors.length}`, name: 'Org' }],
        nextCursor: cursors.length === 1 ? 'next' : null,
      });
    });

    const orgs = await api.listOrgs();

    expect(cursors).toEqual([null, 'next']);
    expect(orgs.map((org) => org.id)).toEqual(['o1', 'o2']);
  });

  it('creates a project key with exactly the requested permissions', async () => {
    let body: unknown;
    fetchMock.mockImplementation(async (request) => {
      expect(new URL(request.url).pathname).toBe('/v2/projects/p1/api-keys');
      body = JSON.parse(await request.text());
      return Response.json(
        {
          apiKey: {
            id: 'key-id',
            name: 'Dev',
            key: 'gtx-secret',
            projectId: 'p1',
            type: 'production',
          },
        },
        { status: 201 }
      );
    });

    const result = await api.createProjectApiKey('p1', {
      name: 'Dev',
      permissions: ['project:translations:generate'],
    });

    expect(body).toEqual({
      name: 'Dev',
      permissions: ['project:translations:generate'],
    });
    expect(result.apiKey.key).toBe('gtx-secret');
  });

  it('surfaces a forbidden key creation as an ApiError', async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        { error: 'missing project:api_keys:write' },
        { status: 403 }
      )
    );

    await expect(
      api.createProjectApiKey('p1', {
        name: 'Dev',
        permissions: ['project:translations:generate'],
      })
    ).rejects.toEqual(
      expect.objectContaining<ApiError>({
        code: 403,
        message: 'missing project:api_keys:write',
      })
    );
  });
});
