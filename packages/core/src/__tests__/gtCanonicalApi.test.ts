import { afterEach, describe, expect, it, vi } from 'vitest';
import { API_VERSION } from '@generaltranslation/api';
import { GT } from '../index';

const project = {
  id: 'p',
  name: 'Project',
  orgId: 'org',
  defaultLocale: 'en',
  currentLocales: ['es'],
  autoApprove: true,
  cdnEnabled: false,
};
const branch = { id: 'b', name: 'main', isDefault: true };
const branchFile = { fileId: 'f', versionId: 'v', fileName: 'f.json' };
const ids = { fileId: 'f', versionId: 'v', branchId: 'b' };
const tag = {
  id: 'tag',
  tagId: 'release',
  message: null,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};
const job = {
  id: 'job',
  status: 'queued',
  subject: { type: 'file_translation', ...ids, locale: 'es' },
};
const sourceFile = {
  ...ids,
  fileName: 'f.json',
  fileFormat: 'JSON',
  dataFormat: null,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  publishedAt: null,
  locales: ['es'],
  sourceLocale: 'en',
};
const fileStatus = {
  translations: [
    {
      locale: 'es',
      completedAt: null,
      approvedAt: null,
      publishedAt: null,
      createdAt: null,
      updatedAt: null,
    },
  ],
  sourceFile: { ...sourceFile, id: 'row' },
};
const content = {
  ...ids,
  locale: 'es',
  fileName: 'f.json',
  data: Buffer.from('hello').toString('base64'),
  fileFormat: 'JSON',
};
const decodedContent = { ...content, data: 'hello', metadata: {} };
const uploaded = { ...ids, fileName: 'f.json', fileFormat: 'JSON' };
const asset = { id: 'asset', assetKey: 'key', fileName: 'font.woff2' };

function succeeded<T>(results: T[]) {
  return {
    summary: { total: results.length, succeeded: results.length, failed: 0 },
    results,
  };
}

const routes: Record<string, unknown> = {
  'GET /v2/projects/p': project,
  'PATCH /v2/projects/p': { ...project, cdnEnabled: true },
  'GET /v2/projects/p/branches': { items: [branch], nextCursor: null },
  'POST /v2/projects/p/branches': { branch },
  'PATCH /v2/projects/p/branches/b': branch,
  'GET /v2/projects/p/branches/b/files': {
    items: [branchFile],
    nextCursor: null,
  },
  'POST /v2/projects/p/files/move': succeeded([
    { oldFileId: 'a', newFileId: 'f', status: 'succeeded' },
  ]),
  'POST /v2/projects/p/context/generate': { job: null },
  'POST /v2/projects/p/jobs/query': {
    results: [{ id: 'job', status: 'not_found' }],
  },
  'GET /v2/projects/p/jobs/job': { ...job, error: null },
  'POST /v2/projects/p/files/translate': { jobs: [job] },
  'PUT /v2/projects/p/tags/release': { created: true, tag },
  'POST /v2/projects/p/files/publish': succeeded([
    {
      ...ids,
      status: 'succeeded',
      translations: [{ locale: 'es', status: 'succeeded' }],
    },
  ]),
  'POST /v2/projects/p/files/translations/overwrite': succeeded([
    { ...ids, locale: 'es', status: 'succeeded' },
  ]),
  'POST /v2/projects/p/files/query': {
    results: [{ ...sourceFile, status: 'found' }],
  },
  'GET /v2/projects/p/files/f/status': fileStatus,
  'GET /v2/projects/p/files/f/content': { ...content, status: 'ready' },
  'POST /v2/projects/p/files/content/query': {
    results: [{ ...content, status: 'ready' }],
  },
  'POST /v2/orgs/org/assets': succeeded([{ ...asset, status: 'succeeded' }]),
  'POST /v2/projects/p/files': succeeded([
    { ...uploaded, status: 'succeeded' },
  ]),
  'POST /v2/projects/p/files/translations': succeeded([
    { ...uploaded, locale: 'es', status: 'succeeded' },
  ]),
};

const requests: Request[] = [];
vi.stubGlobal(
  'fetch',
  vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    requests.push(request.clone());
    const route = `${request.method} ${new URL(request.url).pathname}`;
    return route in routes
      ? Response.json(routes[route])
      : Response.json({ error: `No route ${route}` }, { status: 404 });
  })
);

const gt = new GT({
  apiKey: 'key',
  baseUrl: 'https://api.example.com',
  projectId: 'p',
  localeConfig: { defaultLocale: 'en' },
});

describe.sequential('GT canonical API methods', () => {
  it('return canonical shapes from canonical routes', async () => {
    await expect(gt.get()).resolves.toEqual(project);
    await expect(gt.update({ cdnEnabled: true })).resolves.toEqual({
      ...project,
      cdnEnabled: true,
    });
    await expect(gt.listBranches({ isDefault: 'true' })).resolves.toEqual({
      items: [branch],
      nextCursor: null,
    });
    await expect(gt.createBranch({ name: 'main' })).resolves.toEqual({
      branch,
    });
    await expect(gt.updateBranch('b', { isDefault: true })).resolves.toEqual(
      branch
    );
    await expect(gt.listBranchFiles('b')).resolves.toEqual({
      items: [branchFile],
      nextCursor: null,
    });
    await expect(
      gt.moveFiles([{ oldFileId: 'a', newFileId: 'f', newFileName: 'f.json' }])
    ).resolves.toEqual(routes['POST /v2/projects/p/files/move']);
    await expect(gt.generateProjectContext([ids])).resolves.toEqual({
      job: null,
    });
    await expect(gt.queryJobs(['job'])).resolves.toEqual({
      results: [{ id: 'job', status: 'not_found' }],
    });
    await expect(gt.getJob('job')).resolves.toEqual({ ...job, error: null });
    await expect(gt.translateFiles([ids])).resolves.toEqual({ jobs: [job] });
    await expect(gt.setTag('release', { files: [ids] })).resolves.toEqual({
      created: true,
      tag,
    });
    await expect(
      gt.overwriteTranslations([
        { ...ids, locale: 'es', diff: '@@', localContent: '{}' },
      ])
    ).resolves.toEqual(
      routes['POST /v2/projects/p/files/translations/overwrite']
    );
    await expect(gt.queryFiles([ids])).resolves.toEqual({
      results: [{ ...sourceFile, status: 'found' }],
    });
    await expect(gt.getFileStatus('f')).resolves.toEqual(fileStatus);
    await expect(gt.getFileContent('f', { locale: 'es' })).resolves.toEqual({
      ...decodedContent,
      metadata: undefined,
      status: 'ready',
    });
    await expect(
      gt.queryFilesContent([{ ...ids, locale: 'es' }])
    ).resolves.toEqual({
      results: [{ ...decodedContent, metadata: undefined, status: 'ready' }],
    });
    await expect(
      new GT({ apiKey: 'key', baseUrl: 'https://api.example.com' })
        .org('org')
        .upsertAssets([
          { assetType: 'FONT', content: 'x', fileName: 'font.woff2' },
        ])
    ).resolves.toEqual(succeeded([{ ...asset, status: 'succeeded' }]));
  });

  it('sends every request the pinned version without gt-project-id', () => {
    expect(requests.length).toBeGreaterThan(0);
    for (const request of requests) {
      expect(new URL(request.url).pathname).toMatch(
        /^\/v2\/(projects\/p|orgs\/org)(\/|$)/
      );
      expect(request.headers.get('gt-api-version')).toBe(API_VERSION);
      expect(request.headers.has('gt-project-id')).toBe(false);
    }
  });
});

describe.sequential('GT requests over fetch', () => {
  const customMapping = {
    source: { code: 'en-US' },
    target: { code: 'es-ES' },
  };

  // The API client reads the global fetch when GT is constructed.
  function projectWith(fetch: typeof globalThis.fetch) {
    vi.stubGlobal('fetch', fetch);
    return new GT({
      apiKey: 'key',
      baseUrl: 'https://api.example.com',
      projectId: 'p',
      localeConfig: { customMapping },
    });
  }

  function hangingFetch(): typeof globalThis.fetch {
    return (input, init) =>
      new Promise((_resolve, reject) => {
        const { signal } = new Request(input, init);
        if (signal.aborted) reject(signal.reason);
        else signal.addEventListener('abort', () => reject(signal.reason));
      });
  }

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('honors an explicit zero timeout', async () => {
    vi.useFakeTimers();
    const pending = expect(
      projectWith(hangingFetch()).get({ timeout: 0 })
    ).rejects.toThrow('Request timed out after 0ms');
    await vi.advanceTimersByTimeAsync(10_000);
    await pending;
  });

  it('forwards an abort signal to in-flight queryJobs requests', async () => {
    const fetch = vi.fn(hangingFetch());
    const controller = new AbortController();
    const pending = projectWith(fetch).queryJobs(['job'], {
      signal: controller.signal,
    });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());

    controller.abort(new Error('poll deadline exceeded'));

    await expect(pending).rejects.toThrow('poll deadline exceeded');
  });

  it('passes network errors through unchanged', async () => {
    const networkError = new Error('connection reset');
    const project = projectWith(async () => {
      throw networkError;
    });

    await expect(project.queryFiles([{ fileId: 'f' }])).rejects.toBe(
      networkError
    );
  });

  it('decodes text content and keeps binary content base64', async () => {
    const project = projectWith(async () =>
      Response.json({
        results: [
          { ...content, status: 'ready', fileId: 'text', locale: undefined },
          {
            ...content,
            status: 'ready',
            fileId: 'binary',
            locale: undefined,
            data: 'binary-base64',
            fileFormat: 'LOTTIE',
          },
        ],
      })
    );

    const { results } = await project.queryFilesContent([
      { fileId: 'text' },
      { fileId: 'binary' },
    ]);

    expect(results.map(({ data }) => data)).toEqual(['hello', 'binary-base64']);
  });

  it('sends no request for an empty content query', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();

    await expect(projectWith(fetch).queryFilesContent([])).resolves.toEqual({
      results: [],
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('restores configured aliases in file status locales', async () => {
    const project = projectWith(async () =>
      Response.json({
        ...fileStatus,
        translations: [{ ...fileStatus.translations[0], locale: 'es-ES' }],
        sourceFile: {
          ...fileStatus.sourceFile,
          sourceLocale: 'en-US',
          locales: ['es-ES'],
        },
      })
    );

    const response = await project.getFileStatus('f');

    expect(response.translations[0].locale).toBe('target');
    expect(response.sourceFile).toMatchObject({
      sourceLocale: 'source',
      locales: ['target'],
    });
  });

  it('canonicalizes source upload locales without changing the input', async () => {
    const bodies: unknown[] = [];
    const project = projectWith(async (input, init) => {
      bodies.push(await new Request(input, init).json());
      return Response.json(succeeded([]));
    });
    const files = [
      {
        source: {
          content: '{}',
          fileName: 'f.json',
          fileFormat: 'JSON' as const,
          locale: 'source',
        },
      },
    ];

    await project.uploadSourceFiles(files, { sourceLocale: 'source' });

    expect(bodies).toEqual([
      expect.objectContaining({
        sourceLocale: 'en-US',
        data: [{ source: expect.objectContaining({ locale: 'en-US' }) }],
      }),
    ]);
    expect(files[0].source.locale).toBe('source');
  });
});
