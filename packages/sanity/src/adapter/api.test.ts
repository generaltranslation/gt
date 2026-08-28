import { beforeEach, describe, expect, it, vi } from 'vitest';
import { enqueueFileTranslations } from 'generaltranslation/api';

import { api, configureApiClient } from './api';

vi.mock('generaltranslation/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('generaltranslation/api')>()),
  enqueueFileTranslations: vi.fn(),
}));

describe('Sanity API adapter', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    configureApiClient({
      baseUrl: 'https://api.example.com',
      customMapping: {
        source: { code: 'en-US' },
      },
    });
  });

  it('canonicalizes the optional source locale when enqueueing files', async () => {
    vi.mocked(enqueueFileTranslations).mockResolvedValue({
      data: { jobData: {}, locales: [], message: 'Enqueued files' },
      request: {} as Request,
      response: new Response(),
    });

    await api.enqueueFiles([{ fileId: 'file-id', versionId: 'version-id' }], {
      sourceLocale: 'source',
      targetLocales: ['es'],
    });

    expect(enqueueFileTranslations).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ sourceLocale: 'en-US' }),
      })
    );
  });
});
