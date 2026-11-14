import type { CreateFileUploadsResponse } from '../generated';
import type { ApiClientConfig } from './client';
import { ApiError } from './errors';
import { createRetryingFetch, createTimeoutFetch } from './transport';

export type PresignedFileUpload = NonNullable<
  CreateFileUploadsResponse['files'][number]['upload']
>;

/**
 * PUTs a file's bytes to a presigned URL from `createFileUploads`. The URL
 * authorizes the request, so `fetch` must not add API credentials. The whole
 * PUT, retries and their backoff included, times out when the URL expires.
 */
export async function putFileUpload(
  upload: PresignedFileUpload,
  bytes: Uint8Array<ArrayBuffer>,
  options: Pick<ApiClientConfig, 'fetch' | 'retryPolicy'> = {}
): Promise<void> {
  const fetch = createTimeoutFetch({
    fetch: createRetryingFetch(options),
    timeoutMs: Math.max(Date.parse(upload.expiresAt) - Date.now(), 0),
  });
  const response = await fetch(upload.url, {
    method: 'PUT',
    headers: upload.headers,
    body: bytes,
  });
  if (!response.ok) {
    throw new ApiError(
      `File upload failed with HTTP ${response.status}`,
      response.status
    );
  }
}
