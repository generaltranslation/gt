// Locale codes mapped with customMapping keep Payload's code end to end: the
// project handle sends GT's code and reports jobs under Payload's.
import { GT } from 'generaltranslation';
import type { Payload } from 'payload';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { startTranslation, translateDocument } from '../translation';
import { createTestPayload } from './support/createTestPayload';
import { fakeTranslate } from './support/fakeGt';
import { createPage } from './support/fixtures';

let payload: Payload;

beforeAll(async () => {
  payload = await createTestPayload();
});

afterAll(async () => {
  await payload.destroy();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

type Body = Record<string, { [key: string]: unknown }[]>;

// The GT API routes translation uses, keeping the uploaded source per file.
function stubGtApi() {
  const sources = new Map<string, string>();
  const bodies: Record<string, Body> = {};
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      const { pathname } = new URL(request.url);
      const route = pathname.replace('/v2/projects/project-id', '');
      const body = (await request.json()) as Body;
      bodies[route] = body;
      const ids = { branchId: 'branch-id', versionId: 'version-id' };
      switch (route) {
        case '/files': {
          const results = body.data.map(({ source }) => {
            const { fileId, fileName, fileFormat, content } = source as {
              [key: string]: string;
            };
            sources.set(fileId, Buffer.from(content, 'base64').toString());
            return {
              ...ids,
              fileId,
              fileName,
              fileFormat,
              status: 'succeeded',
            };
          });
          return Response.json({
            summary: { total: 1, succeeded: 1, failed: 0 },
            results,
          });
        }
        case '/files/translate':
          return Response.json({
            jobs: body.files.map(({ fileId }) => ({
              id: 'job-id',
              status: 'queued',
              subject: {
                type: 'file_translation',
                ...ids,
                fileId,
                locale: 'es-ES',
              },
            })),
          });
        case '/jobs/query':
          return Response.json({
            results: body.jobs.map(({ id }) => ({ id, status: 'completed' })),
          });
        case '/files/content/query':
          return Response.json({
            results: body.files.map(({ fileId, locale }) => ({
              status: 'ready',
              ...ids,
              fileId,
              locale,
              fileName: 'page.html',
              fileFormat: 'HTML',
              metadata: {},
              data: Buffer.from(
                fakeTranslate(sources.get(fileId as string)!)
              ).toString('base64'),
            })),
          });
      }
      return Response.json({ error: `No route ${route}` }, { status: 404 });
    })
  );
  return bodies;
}

const configuredProject = () =>
  new GT({
    apiKey: 'key',
    baseUrl: 'https://api.example.com',
    projectId: 'project-id',
    localeConfig: {
      defaultLocale: 'en',
      customMapping: { es: { code: 'es-ES' } },
    },
  });

describe('translateDocument: mapped locales', () => {
  it("queues jobs under Payload's code", async () => {
    stubGtApi();
    const page = await createPage(payload);

    const { jobs } = await startTranslation({
      payload,
      gt: configuredProject(),
      targets: [{ collection: 'pages', id: page.id }],
      locales: ['es'],
    });

    expect(jobs).toEqual([
      expect.objectContaining({ jobId: 'job-id', locale: 'es' }),
    ]);
  });

  it("sends GT's code and writes a mapped locale under Payload's code", async () => {
    const bodies = stubGtApi();
    const page = await createPage(payload);
    const gt = configuredProject();

    const result = await translateDocument({
      payload,
      gt,
      target: { collection: 'pages', id: page.id },
      locales: ['es'],
    });

    expect(bodies['/files/translate']).toMatchObject({
      sourceLocale: 'en',
      targetLocales: ['es-ES'],
    });
    expect(bodies['/files/content/query'].files).toEqual([
      expect.objectContaining({ locale: 'es-ES' }),
    ]);
    expect(Object.keys(result.locales)).toEqual(['es']);
    expect(result.locales.es).toMatchObject({ status: 'applied' });
    const es = await payload.findByID({
      collection: 'pages',
      id: page.id,
      locale: 'es',
      draft: true,
      fallbackLocale: false,
      depth: 0,
    });
    expect(es.title).toBe('HOME');
  });
});
