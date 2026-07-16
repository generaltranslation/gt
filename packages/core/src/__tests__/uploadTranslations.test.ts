import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GT } from '../index';
import { _uploadTranslations } from '../translate/uploadTranslations';

vi.mock('../translate/uploadTranslations', () => ({
  _uploadTranslations: vi.fn(),
}));

describe('GT.uploadTranslations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(_uploadTranslations).mockResolvedValue({
      data: [],
      count: 0,
      batchCount: 0,
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

    expect(_uploadTranslations).toHaveBeenCalledWith(
      expect.any(Array),
      { sourceLocale: 'en-US' },
      expect.any(Object)
    );
  });
});
