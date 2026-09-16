import { afterEach, describe, expect, it, vi } from 'vitest';
import { GT } from '../index';

const baseUrl = 'https://example.test';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe.sequential('GT service locale egress', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ['lowercase locale', 'en-us'],
    ['custom alias', 'brand-english'],
    ['canonical locale', 'en-US'],
  ])(
    'canonicalizes every locale in translation upload requests: %s',
    async (_name, configuredSourceLocale) => {
      const requests: unknown[] = [];
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
          requests.push(JSON.parse(String(init?.body)));
          return jsonResponse({ uploadedFiles: [] });
        })
      );

      const gt = new GT({
        apiKey: 'test-api-key',
        projectId: 'test-project',
        baseUrl,
        sourceLocale: configuredSourceLocale,
        customMapping: {
          'brand-english': { code: 'en-us' },
          'brand-french': { code: 'fr-fr' },
        },
      });
      const files = [
        {
          source: {
            content: '{}',
            fileName: 'messages.json',
            fileFormat: 'JSON' as const,
            locale: gt.sourceLocale,
          },
          translations: [
            {
              content: '{}',
              fileName: 'messages.json',
              fileFormat: 'JSON' as const,
              locale: 'brand-french',
            },
          ],
        },
      ];

      await gt.uploadTranslations(files, {
        sourceLocale: gt.sourceLocale,
      });

      expect(requests).toEqual([
        expect.objectContaining({
          sourceLocale: 'en-US',
          data: [
            expect.objectContaining({
              source: expect.objectContaining({ locale: 'en-US' }),
              translations: [expect.objectContaining({ locale: 'fr-FR' })],
            }),
          ],
        }),
      ]);
      expect(files[0].source.locale).toBe(configuredSourceLocale);
      expect(files[0].translations[0].locale).toBe('brand-french');
    }
  );

  it('sends canonical locales across project and file API requests', async () => {
    const requests: { pathname: string; body: unknown }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : input.url
        );
        requests.push({
          pathname: url.pathname,
          body: init?.body ? JSON.parse(String(init.body)) : undefined,
        });

        if (url.pathname.endsWith('/setup/generate')) {
          return jsonResponse({ status: 'completed' });
        }
        if (url.pathname.endsWith('/translations/enqueue')) {
          return jsonResponse({ jobData: {} });
        }
        if (url.pathname.endsWith('/files/info')) {
          return jsonResponse({ sourceFiles: [], translatedFiles: [] });
        }
        if (url.pathname.endsWith('/files/download')) {
          return jsonResponse({ files: [] });
        }
        if (url.pathname.endsWith('/files/upload-files')) {
          return jsonResponse({ uploadedFiles: [] });
        }
        return jsonResponse({ success: true });
      })
    );

    const gt = new GT({
      apiKey: 'test-api-key',
      projectId: 'test-project',
      baseUrl,
      sourceLocale: 'en-us',
      targetLocale: 'brand-french',
      customMapping: {
        'brand-english': { code: 'en-us' },
        'brand-french': { code: 'fr-fr' },
      },
    });

    await gt.setupProject([], { locales: ['brand-french', 'es-es'] });
    await gt.enqueueFiles(
      [
        {
          fileId: 'file-id',
          versionId: 'version-id',
          branchId: 'branch-id',
        },
      ],
      {
        sourceLocale: 'brand-english',
        targetLocales: ['brand-french', 'es-es'],
      }
    );
    await gt.submitUserEditDiffs({
      diffs: [
        {
          fileName: 'messages.json',
          locale: 'brand-french',
          diff: 'diff',
          branchId: 'branch-id',
          versionId: 'version-id',
          fileId: 'file-id',
          localContent: '{}',
        },
      ],
    });
    await gt.queryFileData({
      translatedFiles: [
        {
          fileId: 'file-id',
          versionId: 'version-id',
          branchId: 'branch-id',
          locale: 'brand-french',
        },
      ],
    });
    await gt.downloadFile({ fileId: 'file-id', locale: 'brand-french' });
    await gt.downloadFileBatch([
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

    expect(requests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pathname: '/v2/project/setup/generate',
          body: expect.objectContaining({ locales: ['fr-FR', 'es-ES'] }),
        }),
        expect.objectContaining({
          pathname: '/v2/project/translations/enqueue',
          body: expect.objectContaining({
            sourceLocale: 'en-US',
            targetLocales: ['fr-FR', 'es-ES'],
          }),
        }),
        expect.objectContaining({
          pathname: '/v2/project/files/diffs',
          body: {
            diffs: [expect.objectContaining({ locale: 'fr-FR' })],
          },
        }),
        expect.objectContaining({
          pathname: '/v2/project/files/info',
          body: expect.objectContaining({
            translatedFiles: [expect.objectContaining({ locale: 'fr-FR' })],
          }),
        }),
        expect.objectContaining({
          pathname: '/v2/project/files/download',
          body: [expect.objectContaining({ locale: 'fr-FR' })],
        }),
        expect.objectContaining({
          pathname: '/v2/project/files/download',
          body: [
            expect.objectContaining({ locale: 'fr-FR' }),
            expect.objectContaining({ locale: 'es-ES' }),
          ],
        }),
        expect.objectContaining({
          pathname: '/v2/project/files/upload-files',
          body: expect.objectContaining({
            sourceLocale: 'en-US',
            data: [
              expect.objectContaining({
                source: expect.objectContaining({ locale: 'en-US' }),
              }),
            ],
          }),
        }),
      ])
    );
  });
});
