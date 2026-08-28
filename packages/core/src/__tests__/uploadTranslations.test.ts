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
      data: { uploadedFiles: [], count: 0, message: 'Uploaded files' },
      request: new Request('https://api.example.com'),
      response: new Response(),
    });
  });

  it('canonicalizes the configured source locale', async () => {
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

    await gt.uploadTranslations(files, { sourceLocale: 'brand-english' });

    expect(uploadTranslations).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ sourceLocale: 'en-US' }),
      })
    );
  });
});
