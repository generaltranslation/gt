import { describe, it, expect, vi } from 'vitest';
import { createRemoteTranslationLoader } from '../createRemoteTranslationLoader';

global.fetch = vi.fn();

describe('createRemoteTranslationLoader', () => {
  it.each(['en-gb', 'british'])(
    'canonicalizes %s at the service boundary',
    async (locale) => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);
      const loader = createRemoteTranslationLoader({
        cacheUrl: 'https://example.com',
        projectId: 'test-project',
        customMapping: { british: { code: 'en-gb' } },
      });
      await loader(locale);
      expect(fetch).toHaveBeenLastCalledWith(
        'https://example.com/test-project/en-GB'
      );
    }
  );
  it('returns loader function', () => {
    const loader = createRemoteTranslationLoader({
      cacheUrl: 'https://example.com',
      projectId: 'test-project',
    });
    expect(typeof loader).toBe('function');
  });

  it('fetches translations from remote URL', async () => {
    const mockResponse = { hello: 'Hello, World!' };
    (fetch as unknown).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const loader = createRemoteTranslationLoader({
      cacheUrl: 'https://example.com',
      projectId: 'test-project',
    });

    const result = await loader('en');
    expect(fetch).toHaveBeenCalledWith('https://example.com/test-project/en');
    expect(result).toEqual(mockResponse);
  });
});
