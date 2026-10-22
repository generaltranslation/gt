import { beforeEach, describe, expect, it, vi } from 'vitest';
import { uploadTranslations } from '@generaltranslation/api';
import { GT } from '../index';

vi.mock('@generaltranslation/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@generaltranslation/api')>()),
  uploadTranslations: vi.fn(),
}));

describe('GT.uploadTranslations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(uploadTranslations).mockResolvedValue({
      data: {
        summary: { total: 1, succeeded: 1, failed: 0 },
        results: [
          {
            branchId: 'branch-id',
            fileId: 'file-id',
            versionId: 'version-id',
            fileName: 'messages.json',
            fileFormat: 'JSON',
            locale: 'fr',
            status: 'succeeded',
          },
        ],
      },
      request: new Request('https://api.example.com'),
      response: new Response(),
    });
  });

  it('canonicalizes upload locales and sends no sourceLocale', async () => {
    const gt = new GT({
      apiKey: 'test-api-key',
      projectId: 'test-project',
      sourceLocale: 'brand-english',
      customMapping: {
        'brand-english': {
          code: 'en-US',
          name: 'Brand English',
        },
      },
    });
    const files = [
      {
        source: {
          content: '',
          fileName: 'messages.json',
          fileFormat: 'JSON' as const,
          locale: 'brand-english',
        },
        translations: [
          {
            content: '{}',
            fileName: 'messages.json',
            fileFormat: 'JSON' as const,
            locale: 'fr',
          },
        ],
      },
    ];

    const result = await gt.uploadTranslations(files);

    const { body } = vi.mocked(uploadTranslations).mock.calls[0][0];
    expect(body).not.toHaveProperty('sourceLocale');
    expect(body.data[0].source.locale).toBe('en-US');
    expect(result).toMatchObject({
      summary: { total: 1, succeeded: 1, failed: 0 },
      results: [{ fileId: 'file-id', locale: 'fr' }],
    });
  });

  it('uploads without a configured source locale', async () => {
    const gt = new GT({ apiKey: 'test-api-key', projectId: 'test-project' });

    await expect(
      gt.uploadTranslations([
        {
          source: {
            content: '',
            fileName: 'messages.json',
            fileFormat: 'JSON',
            locale: 'en',
          },
          translations: [
            {
              content: '{}',
              fileName: 'messages.json',
              fileFormat: 'JSON',
              locale: 'fr',
            },
          ],
        },
      ])
    ).resolves.toMatchObject({ summary: { succeeded: 1 } });
  });
});
