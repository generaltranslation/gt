import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

function succeededBatch<T>(results: T[]) {
  return {
    summary: { total: results.length, succeeded: results.length, failed: 0 },
    results: results.map((result) => ({ ...result, status: 'succeeded' })),
  };
}

describe('CLI API client', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const configure = (
    overrides: Partial<Parameters<typeof configureApiClient>[0]> = {}
  ) =>
    configureApiClient({
      apiKey: 'api-key',
      baseUrl: 'https://api.example.com',
      projectId: 'project-id',
      ...overrides,
    });

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    configure();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves configured aliases and spellings to standardized canonical locales', () => {
    configure({
      customMapping: { 'brand-english': { code: 'en-US' } },
    });

    expect(api.resolveCanonicalLocale('brand-english')).toBe('en-US');
    expect(api.resolveCanonicalLocale('en-us')).toBe('en-US');
  });

  it('keeps resolving with the configured custom mapping after the caller mutates it', () => {
    const customMapping = { 'brand-english': { code: 'en-US' } };
    configure({ customMapping });
    customMapping['brand-english'].code = 'fr';

    expect(api.resolveCanonicalLocale('brand-english')).toBe('en-US');
  });

  it('maps query file locales between configured aliases and canonical locales', async () => {
    configure({
      customMapping: { 'brand-english': { code: 'en-US' } },
    });
    fetchMock.mockImplementation(async (request) => {
      const body = JSON.parse(await request.text()) as {
        files: Array<{ locale?: string }>;
      };
      expect(body.files[1].locale).toBe('en-US');
      return Response.json({
        results: [
          {
            status: 'found',
            fileId: 'file-id',
            sourceLocale: 'en-US',
            locales: ['en-US', 'es'],
          },
          { status: 'found', fileId: 'file-id', locale: 'en-US' },
        ],
      });
    });

    const { results } = await api.queryFiles([
      { branchId: 'branch-id', fileId: 'file-id', versionId: 'version-id' },
      {
        branchId: 'branch-id',
        fileId: 'file-id',
        versionId: 'version-id',
        locale: 'brand-english',
      },
    ]);

    expect(results[1].locale).toBe('brand-english');
    expect(results[0].sourceLocale).toBe('brand-english');
    expect(results[0].locales).toEqual(['brand-english', 'es']);
  });

  it('standardizes lowercase file query locales for the service', async () => {
    fetchMock.mockImplementation(async (request) => {
      const body = JSON.parse(await request.text()) as {
        files: Array<{ fileId: string; locale: string }>;
      };
      expect(body.files[0].locale).toBe('en-US');
      return Response.json({
        results: body.files.map((file) => ({ ...file, status: 'not_found' })),
      });
    });

    await api.queryFiles([
      {
        branchId: 'branch-id',
        fileId: 'file-id',
        versionId: 'version-id',
        locale: 'en-us',
      },
    ]);
  });

  it('preserves HTTP status on API errors', async () => {
    fetchMock.mockResolvedValue(
      Response.json({ error: 'branching unavailable' }, { status: 403 })
    );

    await expect(api.listBranches()).rejects.toEqual(
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

    await expect(api.listBranches()).rejects.toEqual(
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

    await expect(api.listBranches()).rejects.toBe(networkError);
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

  it('fetches project information with configured locale aliases', async () => {
    configure({
      customMapping: { 'brand-english': { code: 'en-US' } },
    });
    fetchMock.mockImplementation(async (request) => {
      expect(new URL(request.url).pathname).toBe('/v2/projects/project-id');
      return Response.json({
        id: 'project-id',
        name: 'Project',
        orgId: 'org-id',
        defaultLocale: 'en-US',
        currentLocales: ['en-US', 'es'],
        autoApprove: false,
        cdnEnabled: true,
      });
    });

    await expect(api.getProject({ timeout: 10_000 })).resolves.toEqual(
      expect.objectContaining({
        id: 'project-id',
        autoApprove: false,
        defaultLocale: 'brand-english',
        currentLocales: ['brand-english', 'es'],
      })
    );
  });

  it('restores a project locale to the alias configured with that exact code', async () => {
    configure({
      customMapping: { en: { code: 'en-US' }, generic: { code: 'en' } },
    });
    fetchMock.mockResolvedValue(
      Response.json({
        id: 'project-id',
        name: 'Project',
        orgId: 'org-id',
        defaultLocale: 'en-US',
        currentLocales: ['en-US', 'en'],
        autoApprove: false,
        cdnEnabled: true,
      })
    );

    await expect(api.getProject()).resolves.toMatchObject({
      defaultLocale: 'en',
      currentLocales: ['en', 'generic'],
    });
  });

  it('requires a project ID for project operations', async () => {
    configure({ projectId: undefined });

    await expect(api.getProject({ timeout: 10_000 })).rejects.toThrow(
      'No project ID was found'
    );
    await expect(api.listBranches()).rejects.toThrow('No project ID was found');
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

    await expect(api.getProject({ timeout: 0 })).rejects.toThrow(
      'Request timed out after 0ms'
    );
  });

  it('checks job status through the job query endpoint', async () => {
    fetchMock.mockImplementation(async (request) => {
      expect(new URL(request.url).pathname).toBe(
        '/v2/projects/project-id/jobs/query'
      );
      await expect(request.json()).resolves.toEqual({
        jobs: [{ id: 'setup-job' }],
      });
      return Response.json({
        results: [{ id: 'setup-job', status: 'failed', error: null }],
      });
    });

    await expect(api.queryJobs(['setup-job'])).resolves.toEqual({
      results: [{ id: 'setup-job', status: 'failed', error: null }],
    });
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
    const pendingRequest = api.queryJobs(['setup-job'], {
      signal: controller.signal,
    });
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
      return Response.json(
        succeededBatch([
          { fileId: 'file-id', versionId: 'version-id', locale: 'en-US' },
        ])
      );
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
    const result = await api.overwriteTranslations(diffs);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result.summary).toEqual({ total: 1, succeeded: 1, failed: 0 });
  });

  it('publishes only contract fields for CDN entries', async () => {
    fetchMock.mockImplementation(async (request) => {
      expect(new URL(request.url).pathname).toBe(
        '/v2/projects/project-id/files/publish'
      );
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
      return Response.json(succeededBatch([]));
    });

    const entries: (PublishFileEntry & { fileName: string })[] = [
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
      const { locale: _locale, ...sourceResult } = uploadedFile;
      return Response.json(succeededBatch(body.data.map(() => sourceResult)));
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
    expect(result.summary.succeeded).toBe(101);
    expect(result.results).toHaveLength(101);
  });

  it('canonicalizes project setup locales', async () => {
    configure({
      customMapping: { 'brand-english': { code: 'en-us' } },
    });
    fetchMock.mockImplementation(async (request) => {
      const body = JSON.parse(await request.text()) as { locales: string[] };
      expect(body.locales).toEqual(['en-US', 'es-ES']);
      return Response.json({ job: null });
    });

    await expect(
      api.generateProjectContext([], {
        locales: ['brand-english', 'es-es'],
      })
    ).resolves.toEqual({ job: null });
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
      return Response.json(succeededBatch([uploadedFile]));
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

    expect(result.results).toEqual([{ ...uploadedFile, status: 'succeeded' }]);
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
      expect(body.sourceLocale).toBeUndefined();
      expect(body.data[0].source.locale).toBe('en-US');
      expect(body.data[0].translations[0].locale).toBe('es-ES');
      return Response.json(succeededBatch([uploadedFile]));
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
        results: [
          {
            status: 'ready',
            branchId: 'branch-id',
            fileId: 'text-id',
            versionId: 'version-id',
            data: 'aGVsbG8=',
            metadata: {},
            fileFormat: 'JSON',
          },
          {
            status: 'ready',
            branchId: 'branch-id',
            fileId: 'binary-id',
            versionId: 'version-id',
            data: 'binary-base64',
            metadata: {},
            fileFormat: 'LOTTIE',
          },
        ],
      })
    );

    const result = await api.queryFilesContent([
      { fileId: 'text-id' },
      { fileId: 'binary-id' },
    ]);

    expect(result.results.map(({ data }) => data)).toEqual([
      'hello',
      'binary-base64',
    ]);
  });

  it('maps download locales between configured aliases and canonical locales', async () => {
    configure({
      customMapping: { 'brand-english': { code: 'en-US' } },
    });
    fetchMock.mockImplementation(async (request) => {
      const body = JSON.parse(await request.text()) as {
        files: Array<{ locale: string }>;
      };
      expect(body.files[0].locale).toBe('en-US');
      return Response.json({
        results: [
          {
            status: 'ready',
            branchId: 'branch-id',
            fileId: 'file-id',
            versionId: 'version-id',
            locale: 'en-US',
            data: 'aGVsbG8=',
            metadata: {},
            fileFormat: 'JSON',
          },
        ],
      });
    });

    const result = await api.queryFilesContent([
      { fileId: 'file-id', locale: 'brand-english' },
    ]);

    expect(result.results[0].locale).toBe('brand-english');
  });

  it('returns no content results without an HTTP request', async () => {
    await expect(api.queryFilesContent([])).resolves.toEqual({
      results: [],
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('downloads files in batches of 100', async () => {
    fetchMock.mockImplementation(async (request) => {
      const body = JSON.parse(await request.text()) as {
        files: Array<{ fileId: string }>;
      };
      return Response.json({
        results: body.files.map(({ fileId }) => ({
          status: 'ready',
          branchId: 'branch-id',
          fileId,
          versionId: 'version-id',
          data: 'aGVsbG8=',
          metadata: {},
          fileFormat: 'JSON',
        })),
      });
    });

    const result = await api.queryFilesContent(
      Array.from({ length: 101 }, (_, index) => ({ fileId: `file-${index}` }))
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.results).toHaveLength(101);
  });

  it('lists one page of branch files', async () => {
    const branchFile = {
      fileId: 'file-id',
      versionId: 'version-id',
      fileName: 'messages.json',
    };
    fetchMock.mockImplementation(async (request) => {
      const url = new URL(request.url);
      expect(url.pathname).toBe(
        '/v2/projects/project-id/branches/branch-id/files'
      );
      expect(url.searchParams.get('cursor')).toBe('next');
      expect(url.searchParams.get('limit')).toBe('100');
      return Response.json({ items: [branchFile], nextCursor: null });
    });

    await expect(
      api.listBranchFiles('branch-id', { cursor: 'next', limit: 100 })
    ).resolves.toEqual({ items: [branchFile], nextCursor: null });
  });

  it('awaits jobs through queryJobs with not_found as terminal', async () => {
    const statuses = [
      [
        { id: 'job-1', status: 'processing' },
        { id: 'job-2', status: 'not_found' },
      ],
      [{ id: 'job-1', status: 'completed' }],
    ];
    fetchMock.mockImplementation(async (request) => {
      expect(new URL(request.url).pathname).toBe(
        '/v2/projects/project-id/jobs/query'
      );
      return Response.json({ results: statuses.shift() });
    });

    await expect(
      api.awaitJobs(['job-1', 'job-2'], { pollingIntervalSeconds: 0 })
    ).resolves.toEqual({
      complete: true,
      jobs: [
        { id: 'job-1', status: 'completed' },
        { id: 'job-2', status: 'not_found' },
      ],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('translates files in batches of 100 and merges jobs', async () => {
    configure({
      customMapping: { 'brand-english': { code: 'en-US' } },
    });
    const batchSizes: number[] = [];
    fetchMock.mockImplementation(async (request) => {
      const body = JSON.parse(await request.text()) as {
        files: Array<{ fileId: string }>;
        sourceLocale?: string;
      };
      expect(body.sourceLocale).toBe('en-US');
      batchSizes.push(body.files.length);
      const [{ fileId }] = body.files;
      return Response.json(
        {
          jobs: [
            {
              id: `job-${fileId}`,
              status: 'queued',
              subject: {
                type: 'file_translation',
                branchId: 'branch-id',
                fileId,
                versionId: 'version-id',
                locale: 'es',
              },
            },
          ],
        },
        { status: 202 }
      );
    });

    const result = await api.translateFiles(
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
    expect(result.jobs.map((job) => job.id)).toEqual([
      'job-file-0',
      'job-file-100',
    ]);
  });

  it('lists projects across every cursor page', async () => {
    const cursors: Array<string | null> = [];
    fetchMock.mockImplementation(async (request) => {
      const url = new URL(request.url);
      expect(url.pathname).toBe('/v2/projects');
      cursors.push(url.searchParams.get('cursor'));
      const page = cursors.length;
      return Response.json({
        items: [
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
        items: [{ id: `o${cursors.length}`, name: 'Org' }],
        nextCursor: cursors.length === 1 ? 'next' : null,
      });
    });

    const orgs = await api.listOrgs();

    expect(cursors).toEqual([null, 'next']);
    expect(orgs.map((org) => org.id)).toEqual(['o1', 'o2']);
  });

  it('surfaces a forbidden listing as an ApiError', async () => {
    fetchMock.mockResolvedValue(
      Response.json({ error: 'Forbidden' }, { status: 403 })
    );

    const error = await api.listProjects().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      code: 403,
      message: 'Forbidden',
    });
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
