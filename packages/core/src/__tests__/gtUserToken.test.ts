import { afterEach, describe, expect, it, vi } from 'vitest';
import { GT } from '../index';

describe('GT user-token authentication', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('accepts a user token provider in place of an API key', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({
        created: true,
        tag: {
          id: 'id',
          tagId: 'release',
          message: null,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    const userTokenProvider = {
      getAccessToken: async () => 'user-token',
      refreshAccessToken: async () => undefined,
    };
    const gt = new GT({
      baseUrl: 'https://api.example.com',
      userTokenProvider,
      projectId: 'project-id',
    });

    await gt.setTag('release', { files: [] });

    const request = new Request(...fetchMock.mock.calls[0]);
    expect(request.headers.get('authorization')).toBe('Bearer user-token');
  });
});
