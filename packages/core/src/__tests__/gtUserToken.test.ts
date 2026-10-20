import { describe, expect, it, vi } from 'vitest';
import { createGtApiAdapter } from '../adapter/createGtApi';
import { GT } from '../index';

vi.mock('../adapter/createGtApi', () => ({
  createGtApiAdapter: vi.fn(() => ({
    setTag: vi.fn().mockResolvedValue({ tag: { tagId: 'release' } }),
  })),
}));

describe('GT user-token authentication', () => {
  it('accepts a user token provider in place of an API key', async () => {
    const userTokenProvider = {
      getAccessToken: async () => 'user-token',
      refreshAccessToken: async () => undefined,
    };
    const gt = new GT({
      baseUrl: 'https://api.example.com',
      projectId: 'project-id',
      userTokenProvider,
    });

    await gt.setTag('release', { files: [] });

    expect(createGtApiAdapter).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: undefined, userTokenProvider })
    );
  });
});
