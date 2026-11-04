import type { CreateFileUploadsResponse } from '../generated';
import { ApiError } from './errors';
import {
  createRetryingFetch,
  createTimeoutFetch,
  DEFAULT_TIMEOUT_MS,
  type RetryPolicy,
} from './transport';

// Each attempt gets one extra second per 256 KiB, so slow connections can
// finish large files.
const MIN_UPLOAD_BYTES_PER_SECOND = 256 * 1024;

export type PresignedFileUpload = NonNullable<
  CreateFileUploadsResponse['files'][number]['upload']
>;

/**
 * PUTs a file's bytes to a presigned URL from `createFileUploads`. The URL
 * authorizes the request, so it carries no API credentials. Each attempt's
 * timeout is `timeoutMs` (default `DEFAULT_TIMEOUT_MS`) plus one second per
 * 256 KiB of `bytes`; `false` disables it.
 */
export async function putFileUpload(
  upload: PresignedFileUpload,
  bytes: Uint8Array<ArrayBuffer>,
  options: { timeoutMs?: number | false; retryPolicy?: RetryPolicy } = {}
): Promise<void> {
  const fetch = createRetryingFetch({
    fetch: createTimeoutFetch({
      timeoutMs:
        options.timeoutMs === false
          ? false
          : (options.timeoutMs ?? DEFAULT_TIMEOUT_MS) +
            Math.ceil(bytes.byteLength / MIN_UPLOAD_BYTES_PER_SECOND) * 1000,
    }),
    retryPolicy: options.retryPolicy,
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
