import { createApiClient, translate } from '@generaltranslation/api';
import type { Content } from '@generaltranslation/format/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TranslationRequestConfig } from '../../types';
import { SharedMetadata } from '../../types-dir/api/entry';
import { _translateMany } from '../translateMany';

vi.mock('@generaltranslation/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@generaltranslation/api')>()),
  createApiClient: vi.fn(),
  translate: vi.fn(),
}));

const mockConfig: TranslationRequestConfig = {
  baseUrl: 'https://api.test.com',
  projectId: 'test-project',
  apiKey: 'test-api-key',
};
const globalMetadata: {
  targetLocale: string;
  sourceLocale: string;
} & SharedMetadata = {
  targetLocale: 'es',
  sourceLocale: 'en',
};

function createResponse(): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers(),
  } as Response;
}

describe.sequential('_translate (via _translateMany)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(createApiClient).mockReturnValue(
      {} as ReturnType<typeof createApiClient>
    );
  });

  it('translates simple string content', async () => {
    vi.mocked(translate).mockResolvedValue({
      data: {
        'some-hash': {
          success: true,
          translation: 'Hola mundo',
          dataFormat: 'ICU',
          locale: 'es',
        },
      },
      request: {} as Request,
      response: createResponse(),
    });

    const source: Content = 'Hello world';
    const result = await _translateMany(
      [{ source, metadata: { context: 'greeting' } }],
      globalMetadata,
      mockConfig
    );

    expect(translate).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          targetLocale: 'es',
          sourceLocale: 'en',
        }),
      })
    );
    expect(result).toHaveLength(1);
  });

  it('sends complex JSX content through the SDK', async () => {
    vi.mocked(translate).mockResolvedValue({
      data: {},
      request: {} as Request,
      response: createResponse(),
    });
    const source: Content = ['Welcome ', { t: 'strong', c: ['John'] }];

    await _translateMany(
      [{ source, metadata: { dataFormat: 'JSX' } }],
      globalMetadata,
      mockConfig
    );

    expect(
      Object.values(vi.mocked(translate).mock.calls[0][0].body.requests)[0]
    ).toMatchObject({ source });
  });

  it('propagates SDK errors', async () => {
    vi.mocked(translate).mockRejectedValue(
      new Error('Translation service unavailable')
    );

    await expect(
      _translateMany([{ source: 'Hello' }], globalMetadata, mockConfig)
    ).rejects.toThrow('Translation service unavailable');
  });
});
