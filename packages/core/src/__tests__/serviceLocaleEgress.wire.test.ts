import { afterEach, describe, expect, it, vi } from 'vitest';
import { GT } from '../index';

const baseUrl = 'https://example.test';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** The generated client calls fetch(Request); the body is on the request. */
async function readRequest(
  input: string | URL | Request,
  init?: RequestInit
): Promise<{ pathname: string; body: unknown }> {
  const url = new URL(
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url
  );
  const raw =
    input instanceof Request ? await input.text() : String(init?.body ?? '');
  return { pathname: url.pathname, body: raw ? JSON.parse(raw) : undefined };
}

describe.sequential('GT service locale egress', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends canonical locales across project and file API requests', async () => {
    const requests: { pathname: string; search: string; body: unknown }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const request = await readRequest(input, init);
        requests.push({
          ...request,
          search: new URL((input as Request).url).search,
        });
        const { pathname, body } = request;

        if (pathname.endsWith('/context/generate')) {
          return jsonResponse({ job: null });
        }
        if (pathname.endsWith('/files/translate')) {
          return jsonResponse({ jobs: [] });
        }
        if (pathname.endsWith('/query')) {
          const { files } = body as {
            files: { fileId: string; locale?: string }[];
          };
          return jsonResponse({
            results: files.map((file) => ({ ...file, status: 'not_found' })),
          });
        }
        if (pathname.endsWith('/content')) {
          return jsonResponse({
            fileId: 'file-id',
            branchId: 'branch-id',
            versionId: 'version-id',
            locale: 'fr-FR',
            fileName: 'messages.json',
            fileFormat: 'JSON',
            data: null,
            status: 'ready',
          });
        }
        return jsonResponse({
          summary: { total: 0, succeeded: 0, failed: 0 },
          results: [],
        });
      })
    );

    const gt = new GT({
      apiKey: 'test-api-key',
      baseUrl,
      projectId: 'test-project',
      localeConfig: {
        defaultLocale: 'en-us',
        customMapping: {
          'brand-english': { code: 'en-us' },
          'brand-french': { code: 'fr-fr' },
        },
      },
    });
    const ids = {
      fileId: 'file-id',
      versionId: 'version-id',
      branchId: 'branch-id',
    };

    await gt.generateProjectContext([ids], {
      locales: ['brand-french', 'es-es'],
    });
    await gt.translateFiles([ids], {
      sourceLocale: 'brand-english',
      targetLocales: ['brand-french', 'es-es'],
    });
    await gt.overwriteTranslations([
      { ...ids, locale: 'brand-french', diff: 'diff', localContent: '{}' },
    ]);
    await gt.queryFiles([{ ...ids, locale: 'brand-french' }]);
    await gt.getFileContent('file-id', { locale: 'brand-french' });
    await gt.queryFilesContent([
      { fileId: 'file-id', locale: 'brand-french' },
      { fileId: 'other-file-id', locale: 'es-es' },
    ]);
    await gt.uploadSourceFiles(
      [
        {
          source: {
            content: '{}',
            fileName: 'messages.json',
            fileFormat: 'JSON',
            locale: 'brand-english',
          },
        },
      ],
      { sourceLocale: 'en-us' }
    );

    const project = '/v2/projects/test-project';
    expect(requests).toEqual([
      expect.objectContaining({
        pathname: `${project}/context/generate`,
        body: expect.objectContaining({ locales: ['fr-FR', 'es-ES'] }),
      }),
      expect.objectContaining({
        pathname: `${project}/files/translate`,
        body: expect.objectContaining({
          sourceLocale: 'en-US',
          targetLocales: ['fr-FR', 'es-ES'],
        }),
      }),
      expect.objectContaining({
        pathname: `${project}/files/translations/overwrite`,
        body: { diffs: [expect.objectContaining({ locale: 'fr-FR' })] },
      }),
      expect.objectContaining({
        pathname: `${project}/files/query`,
        body: { files: [expect.objectContaining({ locale: 'fr-FR' })] },
      }),
      expect.objectContaining({
        pathname: `${project}/files/file-id/content`,
        search: '?locale=fr-FR',
      }),
      expect.objectContaining({
        pathname: `${project}/files/content/query`,
        body: {
          files: [
            expect.objectContaining({ locale: 'fr-FR' }),
            expect.objectContaining({ locale: 'es-ES' }),
          ],
        },
      }),
      expect.objectContaining({
        pathname: `${project}/files`,
        body: expect.objectContaining({
          sourceLocale: 'en-US',
          data: [
            expect.objectContaining({
              source: expect.objectContaining({ locale: 'en-US' }),
            }),
          ],
        }),
      }),
    ]);
  });
});
