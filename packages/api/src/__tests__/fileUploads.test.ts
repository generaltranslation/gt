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
    expiresAt: '2026-11-05T00:00:00.000Z',
  };

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
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

  it('gives each attempt one more second per 256 KiB of the file', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(
        (input, init) =>
          new Promise((_, reject) => {
            const { signal } = new Request(input, init);
            signal.addEventListener('abort', () => reject(signal.reason));
          })
      )
    );

    const put = putFileUpload(upload, new Uint8Array(2 * 256 * 1024), {
      timeoutMs: 100,
      retryPolicy: 'none',
    });
    const settled = expect(put).rejects.toThrow(
      'Request timed out after 2100ms'
    );
    await vi.advanceTimersByTimeAsync(2100);
    await settled;
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
