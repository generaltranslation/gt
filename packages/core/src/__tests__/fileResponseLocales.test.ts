import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CustomMapping } from '@generaltranslation/format/types';
import { GT } from '../index';
import { createGtApiAdapter } from '../adapter/createGtApi';

const config = {
  baseUrl: 'https://example.test',
  projectId: 'test-project',
  apiKey: 'test-api-key',
};

const clients = [
  {
    name: 'GT',
    create: (customMapping?: CustomMapping) =>
      new GT({ ...config, customMapping }),
  },
  {
    name: 'shared adapter',
    create: (customMapping?: CustomMapping) => {
      const adapter = createGtApiAdapter();
      adapter.configure({ ...config, customMapping });
      return adapter;
    },
  },
];

const localeCases = [
  { locale: 'en-gb', customMapping: { 'en-gb': { code: 'en-GB' } } },
  { locale: 'british', customMapping: { british: { code: 'en-GB' } } },
  { locale: 'en-GB', customMapping: undefined },
];

const uploadedFile = {
  branchId: 'branch-id',
  fileId: 'file-id',
  versionId: 'version-id',
  fileName: 'messages.json',
  fileFormat: 'JSON' as const,
};

function mockResponse(body: unknown) {
  const requests: Request[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      requests.push(new Request(input, init));
      return Response.json(body);
    })
  );
  return requests;
}

describe.sequential('file response locale aliases', () => {
  afterEach(() => vi.unstubAllGlobals());

  for (const { name, create } of clients) {
    describe.sequential(name, () => {
      it.each(localeCases)(
        'round-trips source upload locale $locale',
        async ({ locale, customMapping }) => {
          const requests = mockResponse({
            uploadedFiles: [{ ...uploadedFile, locale: 'en-GB' }],
            count: 1,
            message: 'Uploaded',
          });
          const files = [
            {
              source: {
                content: '{}',
                fileName: 'messages.json',
                fileFormat: 'JSON' as const,
                locale,
              },
            },
          ];

          const result = await create(customMapping).uploadSourceFiles(files, {
            sourceLocale: locale,
          });

          expect(requests).toHaveLength(1);
          expect(new URL(requests[0].url).pathname).toBe(
            '/v2/project/files/upload-files'
          );
          expect(await requests[0].json()).toMatchObject({
            sourceLocale: 'en-GB',
            data: [{ source: { locale: 'en-GB' } }],
          });
          expect(result.uploadedFiles).toEqual([{ ...uploadedFile, locale }]);
          expect(files[0].source.locale).toBe(locale);
        }
      );

      it('preserves absent and unmapped source upload locales', async () => {
        const uploadedFiles = [
          uploadedFile,
          { ...uploadedFile, fileId: 'french-file', locale: 'fr' },
        ];
        mockResponse({ uploadedFiles, count: 2, message: 'Uploaded' });
        const client = create({ 'en-gb': { code: 'en-GB' } });
        const result = await client.uploadSourceFiles(
          uploadedFiles.map((file) => ({
            source: { ...file, content: '{}', locale: 'en-gb' },
          })),
          { sourceLocale: 'en-gb' }
        );

        expect(result.uploadedFiles).toEqual(uploadedFiles);
        expect(result.uploadedFiles[0]).not.toHaveProperty('locale');
      });

      it.each(localeCases)(
        'round-trips translation upload locale $locale',
        async ({ locale, customMapping }) => {
          const requests = mockResponse({
            uploadedFiles: [{ ...uploadedFile, locale: 'en-GB' }],
            count: 1,
            message: 'Uploaded',
          });
          const files = [
            {
              source: { ...uploadedFile, content: '{}', locale: 'fr' },
              translations: [{ ...uploadedFile, content: '{}', locale }],
            },
          ];

          const result = await create(customMapping).uploadTranslations(files, {
            sourceLocale: 'fr',
          });

          expect(requests).toHaveLength(1);
          expect(new URL(requests[0].url).pathname).toBe(
            '/v2/project/files/upload-translations'
          );
          expect(await requests[0].json()).toMatchObject({
            sourceLocale: 'fr',
            data: [
              {
                source: { locale: 'fr' },
                translations: [{ locale: 'en-GB' }],
              },
            ],
          });
          expect(result.uploadedFiles).toEqual([{ ...uploadedFile, locale }]);
          expect(files[0].translations[0].locale).toBe(locale);
        }
      );

      it('preserves absent and unmapped translation upload locales', async () => {
        const uploadedFiles = [
          uploadedFile,
          { ...uploadedFile, fileId: 'french-file', locale: 'fr' },
        ];
        mockResponse({ uploadedFiles, count: 2, message: 'Uploaded' });
        const client = create({ 'en-gb': { code: 'en-GB' } });
        const result = await client.uploadTranslations(
          [
            {
              source: { ...uploadedFile, content: '{}', locale: 'en-gb' },
              translations: uploadedFiles.map((file) => ({
                ...file,
                content: '{}',
                locale: 'fr',
              })),
            },
          ],
          { sourceLocale: 'en-gb' }
        );

        expect(result.uploadedFiles).toEqual(uploadedFiles);
        expect(result.uploadedFiles[0]).not.toHaveProperty('locale');
      });
    });
  }
});
