import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  API_VERSION,
  ApiError,
  createBranch,
  createFileUploads,
  createProject,
  createProjectApiKey,
  ErrorCode,
  getProject,
  listBranches,
  listOrgs,
  listProjects,
  moveFiles,
  overwriteTranslations,
  publishFiles,
  putFileUpload,
  queryFiles,
  queryFilesContent,
  translateFiles,
  updateFiles,
  uploadSourceFiles,
  uploadTranslations,
  upsertAssets,
} from '@generaltranslation/api';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { GeneralTranslation } from '../index';

vi.mock('@generaltranslation/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@generaltranslation/api')>()),
  createBranch: vi.fn(),
  createFileUploads: vi.fn(),
  createProject: vi.fn(),
  createProjectApiKey: vi.fn(),
  getProject: vi.fn(),
  listBranches: vi.fn(),
  listOrgs: vi.fn(),
  listProjects: vi.fn(),
  moveFiles: vi.fn(),
  overwriteTranslations: vi.fn(),
  publishFiles: vi.fn(),
  putFileUpload: vi.fn(),
  queryFiles: vi.fn(),
  queryFilesContent: vi.fn(),
  translateFiles: vi.fn(),
  updateFiles: vi.fn(),
  uploadSourceFiles: vi.fn(),
  uploadTranslations: vi.fn(),
  upsertAssets: vi.fn(),
}));

function result<T>(data: T) {
  return {
    data,
    request: new Request('https://api.example.com'),
    response: new Response(),
  };
}

function failure(status: number, code?: string) {
  return {
    data: undefined,
    error: { error: `HTTP ${status}`, code },
    request: new Request('https://api.example.com'),
    response: new Response(null, { status }),
  };
}

function succeeded<T>(results: T[]) {
  return {
    summary: { total: results.length, succeeded: results.length, failed: 0 },
    results,
  };
}

function bodyOf(mock: unknown, call = 0) {
  return vi.mocked(mock as (options: { body: never }) => unknown).mock.calls[
    call
  ][0].body as Record<string, unknown[]>;
}

const customMapping = {
  source: { code: 'en-US' },
  target: { code: 'es-ES' },
};

const project = {
  id: 'project-id',
  name: 'Project',
  orgId: 'org-id',
  defaultLocale: 'en-US',
  currentLocales: ['es-ES'],
  autoApprove: false,
  cdnEnabled: true,
};

const branch = { id: 'branch-id', name: 'main', isDefault: true };

// The API client reads the global fetch when GeneralTranslation is constructed.
function account(fetch?: typeof globalThis.fetch) {
  if (fetch) vi.stubGlobal('fetch', fetch);
  return new GeneralTranslation({
    apiKey: 'key',
    baseUrl: 'https://api.example.com',
    localeConfig: { customMapping },
  });
}

function configuredProject(fetch?: typeof globalThis.fetch) {
  return account(fetch).project('project-id');
}

// queryJobs is called inside @generaltranslation/api, so it is served over fetch.
function jobsFetch(statusOf: (id: string) => Record<string, unknown>) {
  const requests: { pathname: string; jobs: { id: string }[] }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const { jobs } = await request.json();
    requests.push({ pathname: new URL(request.url).pathname, jobs });
    return Response.json({
      results: jobs.map(({ id }: { id: string }) => ({ id, ...statusOf(id) })),
    });
  };
  return { fetch, requests };
}

describe.sequential('GeneralTranslation project and organization operations', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends canonical requests to each project scope without gt-project-id', async () => {
    const { createBranch: realCreateBranch } = await vi.importActual<
      typeof import('@generaltranslation/api')
    >('@generaltranslation/api');
    vi.mocked(createBranch).mockImplementation(realCreateBranch as never);
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json(branch, { status: 201 })
    );
    vi.stubGlobal('fetch', fetchMock);
    await new GeneralTranslation({
      baseUrl: 'https://api.example.com',
      apiKey: 'old-key',
      localeConfig: { customMapping },
    })
      .project('old-project')
      .createBranch({ name: 'main' });

    await new GeneralTranslation({
      baseUrl: 'https://reconfigured.example.com',
      apiKey: 'new-key',
      projectId: 'new-project',
    }).createBranch({ name: 'main' });

    const [first, second] = fetchMock.mock.calls.map(
      ([input, init]) => new Request(input, init)
    );
    expect(new URL(first.url).pathname).toBe(
      '/v2/projects/old-project/branches'
    );
    expect(first.headers.get('gt-api-version')).toBe(API_VERSION);
    expect(first.headers.has('gt-project-id')).toBe(false);
    expect(new URL(second.url).origin).toBe('https://reconfigured.example.com');
    expect(new URL(second.url).pathname).toBe(
      '/v2/projects/new-project/branches'
    );
    expect(second.headers.get('authorization')).toBe('Bearer new-key');
    expect(second.headers.get('gt-api-version')).toBe(API_VERSION);
    expect(second.headers.has('gt-project-id')).toBe(false);
  });

  it('propagates a createBranch conflict without looking the branch up', async () => {
    vi.mocked(createBranch).mockResolvedValue(
      failure(409, 'already_exists') as never
    );

    await expect(
      configuredProject().createBranch({ name: 'feature', isDefault: true })
    ).rejects.toEqual(
      expect.objectContaining({
        name: 'ApiError',
        status: 409,
        code: 'already_exists',
      })
    );
    expect(listBranches).not.toHaveBeenCalled();
  });

  it('aliases the project locales from getProject', async () => {
    vi.mocked(getProject).mockResolvedValue(result(project));
    const adapter = configuredProject();

    await expect(adapter.get()).resolves.toEqual({
      ...project,
      defaultLocale: 'source',
      currentLocales: ['target'],
    });
  });

  it('restores a response locale to the identity configured with that exact code', async () => {
    vi.mocked(getProject).mockResolvedValue(
      result({ ...project, defaultLocale: 'en-US', currentLocales: ['en'] })
    );
    vi.stubGlobal('fetch', vi.fn());
    const handle = new GeneralTranslation({
      apiKey: 'key',
      projectId: 'project-id',
      localeConfig: {
        customMapping: { en: { code: 'en-US' }, generic: { code: 'en' } },
      },
    });

    await expect(handle.get()).resolves.toMatchObject({
      defaultLocale: 'en',
      currentLocales: ['generic'],
    });
  });

  it('restores configured identities without dialect fallback, the first alias winning a shared code', async () => {
    vi.mocked(getProject).mockResolvedValue(
      result({
        ...project,
        defaultLocale: 'en-US',
        currentLocales: ['en-US', 'en-GB', 'fr-FR', 'en-AU'],
      })
    );
    const handle = new GeneralTranslation({
      apiKey: 'key',
      projectId: 'project-id',
      localeConfig: {
        defaultLocale: 'en-us',
        locales: ['en-us', 'british', 'partner-uk'],
        customMapping: {
          british: { code: 'en-gb' },
          'partner-uk': { code: 'en-gb' },
        },
      },
    });

    await expect(handle.get()).resolves.toMatchObject({
      defaultLocale: 'en-us',
      currentLocales: ['en-us', 'british', 'fr-FR', 'en-AU'],
    });
  });

  it.each([
    ['source', 'target'],
    ['en-us', 'es-es'],
  ])(
    'canonicalizes upload locales %s / %s and stops sending sourceLocale for translations',
    async (sourceLocale, targetLocale) => {
      const uploadedFile = {
        branchId: 'branch-id',
        fileId: 'file-id',
        versionId: 'version-id',
        fileName: 'document.html',
        fileFormat: 'HTML' as const,
        status: 'succeeded' as const,
      };
      vi.mocked(uploadTranslations).mockResolvedValue(
        result(
          succeeded([
            { ...uploadedFile, locale: 'en-US' },
            { ...uploadedFile, locale: 'es-ES' },
          ])
        )
      );
      const adapter = configuredProject();

      const response = await adapter.uploadTranslations(
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

      expect(bodyOf(uploadTranslations)).toEqual({
        data: [
          expect.objectContaining({
            source: expect.objectContaining({ locale: 'en-US' }),
            translations: [expect.objectContaining({ locale: 'es-ES' })],
          }),
        ],
      });
      expect(response.results.map((file) => file.locale)).toEqual([
        'source',
        'target',
      ]);
    }
  );

  it('reports partial source upload failures without throwing', async () => {
    const saved = {
      branchId: 'branch-id',
      fileId: 'saved',
      versionId: 'version-id',
      fileName: 'saved.json',
      fileFormat: 'JSON' as const,
    };
    const failed = {
      ...saved,
      fileId: 'failed',
      fileName: 'failed.json',
      status: 'failed' as const,
      error: 'bad content',
    };
    vi.mocked(uploadSourceFiles).mockResolvedValue(
      result({
        summary: { total: 2, succeeded: 1, failed: 1 },
        results: [{ ...saved, status: 'succeeded' as const }, failed],
      })
    );
    const source = (fileName: string) => ({
      source: {
        content: '{}',
        fileName,
        fileFormat: 'JSON' as const,
        locale: 'source',
      },
    });

    const response = await configuredProject().uploadSourceFiles(
      [source('saved.json'), source('failed.json')],
      { sourceLocale: 'source' }
    );

    expect(response.summary).toEqual({ total: 2, succeeded: 1, failed: 1 });
    expect(response.results[1]).toEqual(failed);
    expect(bodyOf(uploadSourceFiles).sourceLocale).toBe('en-US');
  });

  it.each([
    ['the option', { sourceLocale: 'target' }, 'source', 'es-ES'],
    ['localeConfig.defaultLocale', {}, 'source', 'en-US'],
    ["neither, leaving the project's default", {}, undefined, undefined],
  ])(
    'takes the source upload locale from %s',
    async (_from, options, defaultLocale, sent) => {
      vi.mocked(uploadSourceFiles).mockResolvedValue(result(succeeded([])));
      const gt = new GeneralTranslation({
        apiKey: 'key',
        projectId: 'project-id',
        localeConfig: { defaultLocale, customMapping },
      });

      await gt.uploadSourceFiles(
        [
          {
            source: {
              content: '{}',
              fileName: 'file.json',
              fileFormat: 'JSON',
              locale: 'source',
            },
          },
        ],
        options
      );

      expect(bodyOf(uploadSourceFiles).sourceLocale).toBe(sent);
      expect('sourceLocale' in bodyOf(uploadSourceFiles)).toBe(
        sent !== undefined
      );
    }
  );

  it('reports partial translation upload and publish failures without throwing', async () => {
    const ids = {
      branchId: 'branch-id',
      fileId: 'file-id',
      versionId: 'version-id',
    };
    const translation = {
      ...ids,
      fileName: 'document.json',
      fileFormat: 'JSON' as const,
      locale: 'es-ES',
    };
    vi.mocked(uploadTranslations).mockResolvedValue(
      result({
        summary: { total: 2, succeeded: 1, failed: 1 },
        results: [
          { ...translation, status: 'succeeded' as const },
          {
            ...translation,
            locale: 'fr-FR',
            status: 'failed' as const,
            error: 'bad content',
          },
        ],
      })
    );
    vi.mocked(publishFiles).mockResolvedValue(
      result({
        summary: { total: 2, succeeded: 1, failed: 1 },
        results: [
          { ...ids, status: 'succeeded' as const, translations: [] },
          {
            ...ids,
            fileId: 'other-id',
            status: 'failed' as const,
            error: 'not found',
            translations: [],
          },
        ],
      })
    );
    const adapter = configuredProject();
    const file = (locale: string) => ({
      content: '{}',
      fileName: 'document.json',
      fileFormat: 'JSON' as const,
      locale,
    });

    const uploaded = await adapter.uploadTranslations([
      { source: file('source'), translations: [file('target'), file('fr')] },
    ]);
    const published = await adapter.publishFiles([
      { ...ids, publish: true },
      { ...ids, fileId: 'other-id', publish: true },
    ]);

    expect(uploaded.summary).toEqual({ total: 2, succeeded: 1, failed: 1 });
    expect(uploaded.results[1]).toEqual({
      ...translation,
      locale: 'fr-FR',
      status: 'failed',
      error: 'bad content',
    });
    expect(published.summary).toEqual({ total: 2, succeeded: 1, failed: 1 });
    expect(published.results[1]).toMatchObject({
      fileId: 'other-id',
      status: 'failed',
      error: 'not found',
    });
  });

  it('awaits jobs through queryJobs with not_found as a terminal status', async () => {
    const statuses: Record<string, Record<string, unknown>> = {
      'failed-job': { status: 'failed', error: null },
      'missing-job': { status: 'not_found' },
      'done-job': { status: 'completed' },
    };
    const { fetch, requests } = jobsFetch((id) => statuses[id]);
    const adapter = configuredProject(fetch);
    const jobIds = ['failed-job', 'missing-job', 'done-job'];
    const jobs = jobIds.map((id) => ({ id, ...statuses[id] }));

    const onPoll = vi.fn();
    await expect(adapter.awaitJobs(jobIds, { onPoll })).resolves.toEqual({
      complete: true,
      jobs,
    });
    expect(onPoll).toHaveBeenCalledWith(jobs);
    expect(requests[0]).toEqual({
      pathname: '/v2/projects/project-id/jobs/query',
      jobs: jobIds.map((id) => ({ id })),
    });
  });

  it('aliases the locale of job subjects from every job read', async () => {
    const subject = {
      type: 'file_translation' as const,
      branchId: 'branch-id',
      fileId: 'file-id',
      versionId: 'version-id',
      locale: 'es-ES',
    };
    const job = {
      id: 'job-id',
      status: 'completed' as const,
      subject,
      error: null,
    };
    const aliased = { ...job, subject: { ...subject, locale: 'target' } };
    vi.mocked(translateFiles).mockResolvedValue(result({ jobs: [job] }));
    const adapter = configuredProject(async (input, init) => {
      const request = new Request(input, init);
      return Response.json(request.method === 'GET' ? job : { results: [job] });
    });
    const onPoll = vi.fn();

    await expect(
      adapter.translateFiles([{ fileId: 'file-id', versionId: 'version-id' }])
    ).resolves.toEqual({ jobs: [aliased] });
    await expect(adapter.queryJobs(['job-id'])).resolves.toEqual({
      results: [aliased],
    });
    await expect(adapter.getJob('job-id')).resolves.toEqual(aliased);
    await expect(adapter.awaitJobs(['job-id'], { onPoll })).resolves.toEqual({
      complete: true,
      jobs: [aliased],
    });
    expect(onPoll).toHaveBeenCalledWith([aliased]);
  });

  it('sends a translateFiles transform selector unchanged', async () => {
    vi.mocked(translateFiles).mockResolvedValue(result({ jobs: [] }));
    const adapter = configuredProject();

    await adapter.translateFiles([
      { fileId: 'file-id', versionId: 'version-id', transformFormat: 'HTML' },
    ]);

    expect(bodyOf(translateFiles).files).toEqual([
      { fileId: 'file-id', versionId: 'version-id', transformFormat: 'HTML' },
    ]);
  });

  it('rejects a publish list that repeats a file version before sending any request', async () => {
    const files = Array.from({ length: 101 }, (_, i) => ({
      fileId: `id-${i}`,
      versionId: 'v',
      branchId: 'b',
      publish: true,
    }));
    files[100] = { ...files[0], publish: false };
    const adapter = configuredProject();

    await expect(adapter.publishFiles(files)).rejects.toThrow(
      'Each branch, file, and version may appear once in a publish list'
    );
    expect(publishFiles).not.toHaveBeenCalled();
  });

  it('sends only contract fields for publish and overwrite', async () => {
    vi.mocked(publishFiles).mockResolvedValue(
      result(
        succeeded([
          {
            fileId: 'file-id',
            versionId: 'version-id',
            branchId: 'branch-id',
            status: 'succeeded' as const,
            translations: [{ locale: 'es-ES', status: 'succeeded' as const }],
          },
        ])
      )
    );
    vi.mocked(overwriteTranslations).mockResolvedValue(
      result(
        succeeded([
          {
            fileId: 'file-id',
            versionId: 'version-id',
            branchId: 'branch-id',
            locale: 'es-ES',
            status: 'succeeded' as const,
          },
        ])
      )
    );
    const adapter = configuredProject();

    const published = await adapter.publishFiles([
      {
        fileId: 'file-id',
        versionId: 'version-id',
        branchId: 'branch-id',
        publish: true,
        fileName: 'document.json',
      } as Parameters<typeof adapter.publishFiles>[0][number],
    ]);
    await adapter.overwriteTranslations([
      {
        fileName: 'document.json',
        locale: 'target',
        diff: '@@',
        branchId: 'branch-id',
        versionId: 'version-id',
        fileId: 'file-id',
        localContent: '{}',
      } as Parameters<typeof adapter.overwriteTranslations>[0][number],
    ]);

    expect(bodyOf(publishFiles)).toEqual({
      files: [
        {
          fileId: 'file-id',
          versionId: 'version-id',
          branchId: 'branch-id',
          publish: true,
        },
      ],
    });
    expect(published.results[0]).toMatchObject({
      status: 'succeeded',
      translations: [{ locale: 'target', status: 'succeeded' }],
    });
    expect(published.summary).toEqual({ total: 1, succeeded: 1, failed: 0 });
    expect(bodyOf(overwriteTranslations)).toEqual({
      diffs: [
        {
          diff: '@@',
          branchId: 'branch-id',
          versionId: 'version-id',
          fileId: 'file-id',
          localContent: '{}',
          locale: 'es-ES',
        },
      ],
    });
  });

  it('sends canonical read selectors that normalize alike once and answers every position in order', async () => {
    const metadata = {
      status: 'found' as const,
      fileId: 'file-id',
      locale: 'es-ES',
    };
    const content = {
      status: 'ready' as const,
      fileId: 'file-id',
      locale: 'es-ES',
      data: Buffer.from('{}').toString('base64'),
      fileFormat: 'JSON' as const,
    };
    const other = { status: 'not_found' as const, fileId: 'other-id' };
    vi.mocked(queryFiles).mockResolvedValue(
      result({ results: [metadata, other] })
    );
    vi.mocked(queryFilesContent).mockResolvedValue(
      result({ results: [content, other] })
    );
    const adapter = configuredProject();
    // The alias `target` and the canonical `es-es` both resolve to `es-ES`.
    const files = [
      { fileId: 'file-id', locale: 'target' },
      { fileId: 'other-id' },
      { fileId: 'file-id', locale: 'es-es' },
    ];

    const queried = await adapter.queryFiles(files);
    const downloaded = await adapter.queryFilesContent(files);

    const wire = [
      { fileId: 'file-id', locale: 'es-ES' },
      { fileId: 'other-id' },
    ];
    expect(bodyOf(queryFiles)).toEqual({ files: wire });
    expect(bodyOf(queryFilesContent)).toEqual({ files: wire });
    // Each position gets back the locale it requested.
    expect(queried.results).toEqual([
      { ...metadata, locale: 'target' },
      other,
      { ...metadata, locale: 'es-es' },
    ]);
    const ready = { ...content, data: '{}' };
    expect(downloaded.results).toEqual([
      { ...ready, locale: 'target' },
      other,
      { ...ready, locale: 'es-es' },
    ]);
  });

  it("uploads fonts to the scope's organization without a project lookup", async () => {
    vi.mocked(upsertAssets).mockResolvedValue(result(succeeded([])));
    const font = { assetType: 'FONT' as const, content: 'x', fileName: 'f' };

    await account().org('org-id').upsertAssets([font]);

    expect(getProject).not.toHaveBeenCalled();
    expect(
      vi.mocked(upsertAssets).mock.calls.map(([options]) => options.path)
    ).toEqual([{ orgId: 'org-id' }]);
  });

  it.each([
    ['moveFiles', 25],
    ['upsertAssets', 10],
  ] as const)(
    'batches %s at %i items and merges the summaries in request order',
    async (operation, cap) => {
      const ids = Array.from({ length: cap + 1 }, (_, i) => `item-${i}`);
      const items =
        operation === 'moveFiles'
          ? ids.map((id) => ({
              oldFileId: id,
              newFileId: `${id}-new`,
              newFileName: `${id}.json`,
            }))
          : ids.map((fileName) => ({ fileName }));
      const echo = (key: string, itemKey: string) =>
        (async ({
          body,
        }: {
          body: Record<string, Array<Record<string, string>>>;
        }) =>
          result(
            succeeded(
              body[key].map((item) => ({
                [itemKey]: item[itemKey],
                status: 'succeeded',
              }))
            )
          )) as never;
      vi.mocked(moveFiles).mockImplementation(echo('moves', 'oldFileId'));
      vi.mocked(upsertAssets).mockImplementation(echo('assets', 'fileName'));
      const adapter = account();

      const response =
        operation === 'moveFiles'
          ? await adapter.project('project-id').moveFiles(items as never)
          : await adapter.org('org-id').upsertAssets(items as never);

      const mock = operation === 'moveFiles' ? moveFiles : upsertAssets;
      expect(
        vi
          .mocked(mock)
          .mock.calls.map(
            ([options]) =>
              (options.body as Record<string, unknown[]>)[
                operation === 'moveFiles' ? 'moves' : 'assets'
              ].length
          )
      ).toEqual([cap, 1]);
      expect(response.summary).toEqual({
        total: cap + 1,
        succeeded: cap + 1,
        failed: 0,
      });
      expect(response.results).toHaveLength(cap + 1);
      expect(
        response.results.map(
          (item) => Object.values(item as Record<string, string>)[0]
        )
      ).toEqual(ids);
    }
  );

  it.each([
    ['a chain across batches', ['A', 'B'], ['B', 'C']],
    ['a repeated old file ID', ['A', 'B'], ['A', 'C']],
    ['a repeated new file ID', ['A', 'B'], ['C', 'B']],
  ])(
    'rejects moves with %s before sending any request',
    async (_label, [firstOld, firstNew], [lastOld, lastNew]) => {
      const move = (oldFileId: string, newFileId: string) => ({
        oldFileId,
        newFileId,
        newFileName: `${newFileId}.json`,
      });
      // 26 moves: the first and last land in different 25-move batches.
      const moves = [
        move(firstOld, firstNew),
        ...Array.from({ length: 24 }, (_, i) => move(`old-${i}`, `new-${i}`)),
        move(lastOld, lastNew),
      ];

      await expect(configuredProject().moveFiles(moves)).rejects.toThrow(
        'Each old and each new file ID may appear once in a move list'
      );
      expect(moveFiles).not.toHaveBeenCalled();
    }
  );

  it('sends no request for an empty font list', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const adapter = account(fetchMock);

    await expect(adapter.org('org-id').upsertAssets([])).resolves.toEqual({
      summary: { total: 0, succeeded: 0, failed: 0 },
      results: [],
    });
    expect(upsertAssets).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('renames a branch or makes it the default on the canonical route', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({ id: 'branch-id', name: 'main', isDefault: true })
    );

    await expect(
      configuredProject(fetchMock).updateBranch('branch-id', {
        name: 'main',
        isDefault: true,
      })
    ).resolves.toEqual({ id: 'branch-id', name: 'main', isDefault: true });

    const request = new Request(...fetchMock.mock.calls[0]);
    expect(request.method).toBe('PATCH');
    expect(new URL(request.url).pathname).toBe(
      '/v2/projects/project-id/branches/branch-id'
    );
    expect(request.headers.get('gt-api-version')).toBe(API_VERSION);
    expect(request.headers.has('gt-project-id')).toBe(false);
    await expect(request.json()).resolves.toEqual({
      name: 'main',
      isDefault: true,
    });
  });

  describe('a batch that fails', () => {
    const moves = Array.from({ length: 26 }, (_, i) => ({
      oldFileId: `item-${i}`,
      newFileId: `item-${i}-new`,
      newFileName: `item-${i}.json`,
    }));
    const rejected = new ApiError(
      'Bad request',
      400,
      ErrorCode.INVALID_REQUEST
    );

    it('reports its items as failed when another batch succeeds', async () => {
      vi.mocked(moveFiles)
        .mockResolvedValueOnce(
          result(
            succeeded(
              moves.slice(0, 25).map(({ oldFileId, newFileId }) => ({
                oldFileId,
                newFileId,
                status: 'succeeded' as const,
              }))
            )
          )
        )
        .mockRejectedValueOnce(rejected);

      const response = await account().project('project-id').moveFiles(moves);

      expect(response.summary).toEqual({ total: 26, succeeded: 25, failed: 1 });
      expect(response.results[25]).toEqual({
        oldFileId: 'item-25',
        newFileId: 'item-25-new',
        status: 'failed',
        error: 'Bad request',
        code: 'invalid_request',
      });
    });

    it('is thrown when every batch fails', async () => {
      vi.mocked(moveFiles).mockRejectedValue(rejected);

      await expect(
        account().project('project-id').moveFiles(moves)
      ).rejects.toBe(rejected);
    });
  });

  it('batches every 100-item operation at the server cap', async () => {
    const ids = Array.from({ length: 101 }, (_, i) => `id-${i}`);
    const file = (fileId: string) => ({
      fileId,
      versionId: 'v',
      branchId: 'b',
    });
    const upload = (fileId: string) => ({
      source: {
        ...file(fileId),
        content: '{}',
        fileName: `${fileId}.json`,
        fileFormat: 'JSON' as const,
        locale: 'en-US',
      },
    });
    vi.mocked(publishFiles).mockResolvedValue(result(succeeded([])));
    // Reads answer one result per selector, in selector order.
    const notFound = ({ body }: { body: { files: { fileId: string }[] } }) =>
      Promise.resolve(
        result({
          results: body.files.map(({ fileId }) => ({
            status: 'not_found' as const,
            fileId,
          })),
        })
      ) as never;
    vi.mocked(queryFiles).mockImplementation(notFound);
    vi.mocked(queryFilesContent).mockImplementation(notFound);
    vi.mocked(translateFiles).mockResolvedValue(result({ jobs: [] }));
    vi.mocked(overwriteTranslations).mockResolvedValue(result(succeeded([])));
    vi.mocked(uploadSourceFiles).mockResolvedValue(result(succeeded([])));
    vi.mocked(uploadTranslations).mockResolvedValue(result(succeeded([])));
    const { fetch, requests } = jobsFetch(() => ({ status: 'completed' }));
    const adapter = configuredProject(fetch);

    await adapter.publishFiles(
      ids.map((id) => ({ ...file(id), publish: true }))
    );
    await adapter.queryFiles(ids.map(file));
    await adapter.queryFilesContent(ids.map(file));
    await adapter.translateFiles(ids.map(file));
    await adapter.overwriteTranslations(
      ids.map((id) => ({
        ...file(id),
        locale: 'es',
        diff: '',
        localContent: '{}',
      }))
    );
    await adapter.uploadSourceFiles(ids.map(upload), { sourceLocale: 'en-US' });
    await adapter.uploadTranslations(
      ids.map((id) => ({ ...upload(id), translations: [] }))
    );
    const { results } = await adapter.queryJobs(ids);

    for (const [mock, key] of [
      [publishFiles, 'files'],
      [queryFiles, 'files'],
      [queryFilesContent, 'files'],
      [translateFiles, 'files'],
      [overwriteTranslations, 'diffs'],
      [uploadSourceFiles, 'data'],
      [uploadTranslations, 'data'],
    ] as const) {
      expect(
        vi
          .mocked(mock)
          .mock.calls.map(
            ([options]) =>
              (options.body as Record<string, unknown[]>)[key].length
          ),
        key
      ).toEqual([100, 1]);
    }
    expect(requests.map(({ jobs }) => jobs.length)).toEqual([100, 1]);
    expect(results.map(({ id }) => id)).toEqual(ids);
  });

  it('rejects an update list that repeats a target before sending any request', async () => {
    const files = Array.from({ length: 101 }, (_, i) => ({
      fileId: `id-${i}`,
      versionId: 'v',
      locale: 'target',
      metadata: { previewUrl: 'https://example.com/new' },
    }));
    // The canonical code names the same translation as its alias.
    files[100] = { ...files[0], locale: 'es-ES' };
    const adapter = configuredProject();

    await expect(adapter.updateFiles(files)).rejects.toThrow(
      'Each branch, file, version, and locale may appear once in an update list'
    );
    expect(updateFiles).not.toHaveBeenCalled();
  });

  it('updates files in the project, mapping translation locales in both directions', async () => {
    vi.mocked(updateFiles).mockResolvedValue(
      result({
        files: [
          {
            branchId: 'branch-id',
            fileId: 'page',
            versionId: 'v1',
            metadata: { previewUrl: 'https://example.com/page' },
          },
          {
            branchId: 'branch-id',
            fileId: 'page',
            versionId: 'v1',
            locale: 'es-ES',
            metadata: { previewUrl: 'https://example.com/es/page' },
          },
        ],
      }) as never
    );

    await expect(
      configuredProject().updateFiles([
        {
          fileId: 'page',
          versionId: 'v1',
          metadata: { previewUrl: 'https://example.com/page' },
        },
        {
          fileId: 'page',
          versionId: 'v1',
          locale: 'target',
          metadata: { previewUrl: 'https://example.com/es/page' },
        },
      ])
    ).resolves.toEqual({
      files: [
        {
          branchId: 'branch-id',
          fileId: 'page',
          versionId: 'v1',
          metadata: { previewUrl: 'https://example.com/page' },
        },
        {
          branchId: 'branch-id',
          fileId: 'page',
          versionId: 'v1',
          locale: 'target',
          metadata: { previewUrl: 'https://example.com/es/page' },
        },
      ],
    });
    expect(updateFiles).toHaveBeenCalledWith(
      expect.objectContaining({
        path: { projectId: 'project-id' },
        body: {
          files: [
            {
              fileId: 'page',
              versionId: 'v1',
              metadata: { previewUrl: 'https://example.com/page' },
            },
            {
              fileId: 'page',
              versionId: 'v1',
              locale: 'es-ES',
              metadata: { previewUrl: 'https://example.com/es/page' },
            },
          ],
        },
      })
    );
  });

  describe('files over the inline limit', () => {
    const large = '{"a":"' + 'x'.repeat(4_000_000) + '"}';
    const hashOf = (text: string) => bytesToHex(sha256(utf8ToBytes(text)));
    const source = (content: string) => ({
      content,
      fileName: 'messages.json',
      fileFormat: 'JSON' as const,
      locale: 'en-US',
    });
    const presigned = {
      url: 'https://bucket.example.com/staged',
      headers: { 'x-amz-checksum-sha256': 'checksum' },
      expiresAt: '2026-11-05T00:00:00.000Z',
    };

    beforeEach(() => {
      vi.mocked(uploadSourceFiles).mockResolvedValue(result(succeeded([])));
      vi.mocked(uploadTranslations).mockResolvedValue(result(succeeded([])));
      vi.mocked(createFileUploads).mockImplementation((({
        body,
      }: {
        body: { files: { sha256: string }[] };
      }) =>
        Promise.resolve(
          result({
            files: body.files.map(({ sha256: hash }) => ({
              sha256: hash,
              status: 'upload_required' as const,
              upload: presigned,
            })),
          })
        )) as never);
    });

    it('PUTs a large source through createFileUploads and sends a reference to it', async () => {
      await configuredProject().uploadSourceFiles([{ source: source(large) }]);

      expect(bodyOf(createFileUploads)).toEqual({
        files: [
          {
            sha256: hashOf(large),
            fileFormat: 'JSON',
            size: large.length,
          },
        ],
      });
      expect(putFileUpload).toHaveBeenCalledOnce();
      const [upload, bytes] = vi.mocked(putFileUpload).mock.calls[0];
      expect(upload).toEqual(presigned);
      // Comparing the hash: deep-equal on 4MB of bytes takes seconds.
      expect(bytesToHex(sha256(bytes))).toBe(hashOf(large));
      expect(bodyOf(uploadSourceFiles).data).toEqual([
        {
          source: {
            fileName: 'messages.json',
            fileFormat: 'JSON',
            locale: 'en-US',
            upload: { sha256: hashOf(large) },
          },
        },
      ]);
    });

    it('sends formatMetadata inline as content while the file fits', async () => {
      const formatMetadata = { keyedMetadata: { a: { context: 'Greeting' } } };

      await configuredProject().uploadSourceFiles([
        { source: { ...source('{"a":"A"}'), formatMetadata } },
      ]);

      expect(createFileUploads).not.toHaveBeenCalled();
      expect(bodyOf(uploadSourceFiles).data[0].source).toMatchObject({
        formatMetadata: { content: formatMetadata },
      });
    });

    it("PUTs a large source's formatMetadata as JSON and sends a reference to it too", async () => {
      const formatMetadata = { keyedMetadata: { a: { context: 'Greeting' } } };
      const metadataJson = JSON.stringify(formatMetadata);

      await configuredProject().uploadSourceFiles([
        { source: { ...source(large), formatMetadata } },
      ]);

      expect(bodyOf(createFileUploads)).toEqual({
        files: [
          { sha256: hashOf(large), fileFormat: 'JSON', size: large.length },
          {
            sha256: hashOf(metadataJson),
            fileFormat: 'JSON',
            size: metadataJson.length,
          },
        ],
      });
      expect(putFileUpload).toHaveBeenCalledTimes(2);
      expect(bodyOf(uploadSourceFiles).data[0].source).toMatchObject({
        upload: { sha256: hashOf(large) },
        formatMetadata: { upload: { sha256: hashOf(metadataJson) } },
      });
    });

    it("leaves a translation upload's source without formatMetadata", async () => {
      await configuredProject().uploadTranslations([
        {
          source: { ...source('{"a":"A"}'), formatMetadata: { a: {} } },
          translations: [
            {
              content: '{"a":"B"}',
              fileName: 'messages.json',
              fileFormat: 'JSON',
              locale: 'fr',
            },
          ],
        },
      ]);

      expect(bodyOf(uploadTranslations).data[0].source).not.toHaveProperty(
        'formatMetadata'
      );
    });

    it('PUTs at most four files at a time', async () => {
      let inFlight = 0;
      let maxInFlight = 0;
      vi.mocked(putFileUpload).mockImplementation(async () => {
        maxInFlight = Math.max(maxInFlight, ++inFlight);
        await new Promise((resolve) => setTimeout(resolve, 1));
        inFlight--;
      });
      const files = Array.from({ length: 6 }, (_, index) => ({
        source: { ...source(large + index), fileName: `${index}.json` },
      }));

      await configuredProject().uploadSourceFiles(files);

      expect(putFileUpload).toHaveBeenCalledTimes(6);
      expect(maxInFlight).toBe(4);
    });

    it('requests each group of upload URLs right before its PUTs', async () => {
      const events: string[] = [];
      vi.mocked(createFileUploads).mockImplementation((async ({
        body,
      }: {
        body: { files: { sha256: string }[] };
      }) => {
        events.push(`create ${body.files.length}`);
        return result({
          files: body.files.map(({ sha256: hash }) => ({
            sha256: hash,
            status: 'upload_required' as const,
            upload: presigned,
          })),
        });
      }) as never);
      vi.mocked(putFileUpload).mockImplementation(async () => {
        events.push('put');
      });
      const files = Array.from({ length: 6 }, (_, index) => ({
        source: { ...source(large + index), fileName: `${index}.json` },
      }));

      await configuredProject().uploadSourceFiles(files);

      expect(events).toEqual([
        'create 4',
        'put',
        'put',
        'put',
        'put',
        'create 2',
        'put',
        'put',
      ]);
    });

    it('skips the PUT for bytes the project already stores', async () => {
      vi.mocked(createFileUploads).mockResolvedValue(
        result({
          files: [{ sha256: hashOf(large), status: 'exists' as const }],
        })
      );

      await configuredProject().uploadSourceFiles([{ source: source(large) }]);

      expect(putFileUpload).not.toHaveBeenCalled();
      expect(bodyOf(uploadSourceFiles).data).toEqual([
        {
          source: expect.objectContaining({
            upload: { sha256: hashOf(large) },
          }),
        },
      ]);
    });

    it('keeps every other file of a translation upload inline, in place', async () => {
      await configuredProject().uploadTranslations([
        {
          source: source('{}'),
          translations: [
            { ...source('{"a":"b"}'), locale: 'es' },
            { ...source(large), locale: 'fr' },
          ],
        },
      ]);

      const [{ source: sent, translations }] = bodyOf(uploadTranslations)
        .data as {
        source: Record<string, unknown>;
        translations: Record<string, unknown>[];
      }[];
      expect(sent).toMatchObject({ content: btoa('{}') });
      expect(translations).toEqual([
        expect.objectContaining({ locale: 'es', content: btoa('{"a":"b"}') }),
        expect.objectContaining({
          locale: 'fr',
          upload: { sha256: hashOf(large) },
        }),
      ]);
      expect(translations[1]).not.toHaveProperty('content');
    });

    it('uploads files once inline content would push a request past the body limit', async () => {
      const files = Array.from({ length: 30 }, (_, index) =>
        source(`${index}`.padEnd(3_900_000, 'x'))
      );

      await configuredProject().uploadSourceFiles(
        files.map((file) => ({ source: file }))
      );

      const sent = bodyOf(uploadSourceFiles).data as {
        source: { content?: string };
      }[];
      const inline = sent.filter(({ source: file }) => 'content' in file);
      const inlineLength = inline.reduce(
        (sum, { source: file }) => sum + file.content!.length,
        0
      );
      expect(inline.length).toBeGreaterThan(0);
      expect(inline.length).toBeLessThan(files.length);
      expect(inlineLength).toBeLessThanOrEqual(90 * 1024 * 1024);
      expect(vi.mocked(putFileUpload)).toHaveBeenCalledTimes(
        files.length - inline.length
      );
    });
  });

  const createdProject = {
    id: 'project-id',
    name: 'Project',
    orgId: 'org-id',
    currentLocales: [],
    autoApprove: false,
    cdnEnabled: false,
  };

  it('creates a project under the organization with a canonical default locale', async () => {
    vi.mocked(createProject).mockResolvedValue(
      result({ ...createdProject, defaultLocale: 'en-US' })
    );
    const adapter = account();

    await expect(
      adapter.org('org-id').createProject({
        name: 'Project',
        defaultLocale: 'source',
      })
    ).resolves.toEqual({ ...createdProject, defaultLocale: 'source' });

    expect(createProject).toHaveBeenCalledWith(
      expect.objectContaining({
        path: { orgId: 'org-id' },
        body: { name: 'Project', defaultLocale: 'en-US' },
      })
    );
  });

  it.each(['first', 'second'])(
    'returns the requested alias %s when two aliases share a code',
    async (alias) => {
      vi.mocked(createProject).mockResolvedValue(
        result({ ...createdProject, defaultLocale: 'en-US' })
      );
      const org = new GeneralTranslation({
        apiKey: 'key',
        localeConfig: {
          customMapping: {
            first: { code: 'en-US' },
            second: { code: 'en-US' },
          },
        },
      }).org('org-id');

      await expect(
        org.createProject({ name: 'Project', defaultLocale: alias })
      ).resolves.toMatchObject({ defaultLocale: alias });
    }
  );

  it('lists projects across every cursor page', async () => {
    const listed = (id: string) => ({
      id,
      name: id,
      orgId: 'org-id',
      orgName: 'Org',
    });
    vi.mocked(listProjects)
      .mockResolvedValueOnce(
        result({ items: [listed('p1')], nextCursor: 'cursor-1' })
      )
      .mockResolvedValueOnce(
        result({ items: [listed('p2')], nextCursor: 'cursor-2' })
      )
      .mockResolvedValueOnce(
        result({ items: [listed('p3')], nextCursor: null })
      );
    const adapter = account();

    const projects = await adapter.listProjects();

    expect(projects.map((entry) => entry.id)).toEqual(['p1', 'p2', 'p3']);
    expect(
      vi.mocked(listProjects).mock.calls.map(([options]) => options.query)
    ).toEqual([
      { cursor: undefined },
      { cursor: 'cursor-1' },
      { cursor: 'cursor-2' },
    ]);
  });

  it('lists organizations across every cursor page', async () => {
    vi.mocked(listOrgs)
      .mockResolvedValueOnce(
        result({ items: [{ id: 'o1', name: 'Org 1' }], nextCursor: 'next' })
      )
      .mockResolvedValueOnce(
        result({ items: [{ id: 'o2', name: 'Org 2' }], nextCursor: null })
      );
    const adapter = account();

    const orgs = await adapter.listOrgs();

    expect(orgs.map((org) => org.id)).toEqual(['o1', 'o2']);
    expect(
      vi.mocked(listOrgs).mock.calls.map(([options]) => options.query)
    ).toEqual([{ cursor: undefined }, { cursor: 'next' }]);
  });

  it('creates a project API key with exactly the requested permissions', async () => {
    vi.mocked(createProjectApiKey).mockResolvedValue(
      result({
        id: 'key-id',
        name: 'Dev',
        key: 'gtx-secret',
        permissions: ['project:translations:generate' as const],
        createdAt: '2026-01-01T00:00:00.000Z',
        lastUsedAt: null,
      })
    );
    const adapter = account();

    const apiKey = await adapter.project('project-id').createApiKey({
      name: 'Dev',
      permissions: ['project:translations:generate'],
    });

    expect(apiKey.key).toBe('gtx-secret');
    expect(createProjectApiKey).toHaveBeenCalledWith(
      expect.objectContaining({
        path: { projectId: 'project-id' },
        body: { name: 'Dev', permissions: ['project:translations:generate'] },
      })
    );
  });
});
