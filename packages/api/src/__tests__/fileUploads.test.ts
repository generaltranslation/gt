import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from '../wrappers/client';
import {
  createFileUploads,
  putFileUpload,
  uploadSourceFileReferences,
} from '../wrappers/fileUploads';

describe('file upload routes', () => {
  it.each([
    [
      'createFileUploads',
      (client: ReturnType<typeof createApiClient>) =>
        createFileUploads({
          client,
          path: { projectId: 'project-id' },
          body: {
            files: [{ sha256: 'a'.repeat(64), fileFormat: 'GTJSON', size: 1 }],
          },
        }),
      '/v2/projects/project-id/files/uploads',
    ],
    [
      'uploadSourceFileReferences',
      (client: ReturnType<typeof createApiClient>) =>
        uploadSourceFileReferences({
          client,
          path: { projectId: 'project-id' },
          body: {
            data: [
              {
                source: {
                  fileName: 'gt.json',
                  fileFormat: 'GTJSON',
                  locale: 'en',
                  upload: { sha256: 'a'.repeat(64) },
                },
              },
            ],
            sourceLocale: 'en',
          },
        }),
      '/v2/projects/project-id/files',
    ],
  ])(
    '%s calls its route on gt-api-version 2026-10-08.v1 with the client credentials',
    async (_name, call, pathname) => {
      const fetchMock = vi.fn<typeof fetch>(async () => Response.json({}));
      const client = createApiClient({
        baseUrl: 'https://api.example.com',
        apiKey: 'api-key',
        fetch: fetchMock,
      });

      await call(client);

      const request = new Request(...fetchMock.mock.calls[0]!);
      expect(request.method).toBe('POST');
      expect(new URL(request.url).pathname).toBe(pathname);
      expect(request.headers.get('gt-api-version')).toBe('2026-10-08.v1');
      expect(request.headers.get('authorization')).toBe('Bearer api-key');
    }
  );
});

describe('putFileUpload', () => {
  const upload = {
    url: 'https://bucket.example.com/staged?X-Amz-Signature=sig',
    headers: { 'x-amz-checksum-sha256': 'checksum' },
    expiresAt: '2099-01-01T00:00:00.000Z',
  };
  const expiresInMs = (ms: number) =>
    vi.useFakeTimers({ now: Date.parse(upload.expiresAt) - ms });
  const neverResponds = vi.fn<typeof fetch>(
    (input, init) =>
      new Promise((_, reject) => {
        const { signal } = new Request(input, init);
        signal.addEventListener('abort', () => reject(signal.reason));
      })
  );

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    neverResponds.mockClear();
  });

  it('PUTs the bytes with the presigned headers and no API credentials', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await putFileUpload(upload, new Uint8Array([1, 2, 3]));

    const request = new Request(...fetchMock.mock.calls[0]!);
    expect(request.method).toBe('PUT');
    expect(request.url).toBe(upload.url);
    expect(request.headers.get('x-amz-checksum-sha256')).toBe('checksum');
    expect(request.headers.has('authorization')).toBe(false);
    expect(new Uint8Array(await request.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3])
    );
  });

  it('PUTs through the given fetch and retry policy', async () => {
    const globalFetch = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', globalFetch);
    const configuredFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 503 }));

    await expect(
      putFileUpload(upload, new Uint8Array([1]), {
        fetch: configuredFetch,
        retryPolicy: 'none',
      })
    ).rejects.toMatchObject({ code: 503 });
    expect(configuredFetch).toHaveBeenCalledOnce();
    expect(globalFetch).not.toHaveBeenCalled();
  });

  it('times out when the presigned URL expires', async () => {
    expiresInMs(2000);
    vi.stubGlobal('fetch', neverResponds);

    const put = putFileUpload(upload, new Uint8Array([1]));
    const settled = expect(put).rejects.toThrow(
      'Request timed out after 2000ms'
    );
    await vi.advanceTimersByTimeAsync(2000);
    await settled;
    expect(neverResponds).toHaveBeenCalledOnce();
  });

  it('stops retrying when the URL expires during a backoff', async () => {
    expiresInMs(300);
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);

    const put = putFileUpload(upload, new Uint8Array([1]));
    const settled = expect(put).rejects.toThrow(
      'Request timed out after 300ms'
    );
    // The first backoff is 500ms, so the URL expires before the second attempt.
    await vi.advanceTimersByTimeAsync(300);
    await settled;
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('throws an ApiError with the HTTP status when storage rejects the PUT', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status: 403 }))
    );

    await expect(
      putFileUpload(upload, new Uint8Array([1]))
    ).rejects.toMatchObject({ name: 'ApiError', code: 403 });
  });
});
