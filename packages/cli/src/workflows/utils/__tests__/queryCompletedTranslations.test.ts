import { describe, expect, it, vi } from 'vitest';
import { api, configureApiClient } from '../../../utils/api.js';
import {
  getFileTranslationKey,
  queryCompletedTranslationKeys,
} from '../queryCompletedTranslations.js';

describe('queryCompletedTranslationKeys', () => {
  it('queries a custom-mapped alias and its canonical locale as one selector the API accepts', async () => {
    const wireSelectors: unknown[][] = [];
    const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
      const { files } = (await new Request(input, init).json()) as {
        files: Array<Record<string, string>>;
      };
      wireSelectors.push(files);
      return Response.json({
        results: files.map((file) => ({
          ...file,
          status: 'found',
          completedAt: '2026-01-01T00:00:00Z',
        })),
      });
    });
    configureApiClient({
      apiKey: 'api-key',
      baseUrl: 'https://api.example.com',
      projectId: 'project-id',
      customMapping: { 'es-alt': { code: 'es' } },
      fetch,
    });
    const file = { branchId: 'branch', fileId: 'file', versionId: 'version' };
    const requested = ['es', 'es-alt'].map((locale) => ({ ...file, locale }));

    const completed = await queryCompletedTranslationKeys(api, requested);

    expect(wireSelectors).toEqual([[{ ...file, locale: 'es' }]]);
    expect(completed).toEqual(new Set(requested.map(getFileTranslationKey)));
  });
});
