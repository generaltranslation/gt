import { describe, it, expect, vi } from 'vitest';
import { createRemoteTranslationLoader } from '../createRemoteTranslationLoader';

global.fetch = vi.fn();

describe('createRemoteTranslationLoader', () => {
  it('returns loader function', () => {
    const loader = createRemoteTranslationLoader({
      cacheUrl: 'https://example.com',
      projectId: 'test-project',
    });
    expect(typeof loader).toBe('function');
  });

  it('fetches translations from remote URL', async () => {
    const mockResponse = { hello: 'Hello, World!' };
    (fetch as any).mockResolvedValueOnce({
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
