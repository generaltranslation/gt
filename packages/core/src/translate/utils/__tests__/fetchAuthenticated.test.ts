import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TranslationRequestConfig } from '../../../types';
import { fetchAuthenticated } from '../fetchAuthenticated';
import { fetchWithTimeout } from '../fetchWithTimeout';

vi.mock('../fetchWithTimeout');

const userTokenProvider = {
  getAccessToken: vi.fn().mockResolvedValue('access-token'),
  refreshAccessToken: vi.fn().mockResolvedValue('refreshed-token'),
};

const config: TranslationRequestConfig = {
  projectId: 'project-id',
  userTokenProvider,
};

describe.sequential('fetchAuthenticated', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the current user token and refreshes once after a 401', async () => {
    const authorizationHeaders: Array<string | null> = [];
    vi.mocked(fetchWithTimeout).mockImplementation(async (_input, init) => {
      authorizationHeaders.push(new Headers(init.headers).get('Authorization'));
      return authorizationHeaders.length === 1
        ? new Response('unauthorized', { status: 401 })
        : new Response('{}', { status: 200 });
    });

    const response = await fetchAuthenticated(
      config,
      'https://api.example/test',
      { method: 'GET' },
      1_000
    );

    expect(response.status).toBe(200);
    expect(fetchWithTimeout).toHaveBeenCalledTimes(2);
    expect(authorizationHeaders).toEqual([
      'Bearer access-token',
      'Bearer refreshed-token',
    ]);
    expect(userTokenProvider.refreshAccessToken).toHaveBeenCalledOnce();
  });

  it('keeps API keys ahead of the user-token provider', async () => {
    vi.mocked(fetchWithTimeout).mockResolvedValue(
      new Response('{}', { status: 200 })
    );

    await fetchAuthenticated(
      { ...config, apiKey: 'api-key' },
      'https://api.example/test',
      { headers: { Authorization: 'Bearer api-key' } }
    );

    expect(userTokenProvider.getAccessToken).not.toHaveBeenCalled();
    expect(userTokenProvider.refreshAccessToken).not.toHaveBeenCalled();
  });
});
