import type { Client } from '../generated/client';
import type {
  DataFormat,
  FileFormat,
  UploadSourceFilesData,
} from '../generated/types.gen';
import { ApiError } from './errors';
import {
  createRetryingFetch,
  createTimeoutFetch,
  type RetryPolicy,
} from './transport';

// shortcut: hand-written from the 2026-10-08.v1 contract because this SDK's spec
// stops at 2026-03-06.v1; replace with the generated operations once it moves on.
const FILE_UPLOADS_API_VERSION = '2026-10-08.v1';

export type PresignedFileUpload = {
  url: string;
  headers: { 'x-amz-checksum-sha256': string };
  expiresAt: string;
};

export type CreateFileUploadsResponse = {
  files: Array<{
    sha256: string;
    status: 'exists' | 'upload_required';
    upload?: PresignedFileUpload;
  }>;
};

export type SourceFileReference = Omit<
  UploadSourceFilesData['body']['data'][number]['source'],
  'content'
> & { upload: { sha256: string } };

export type UploadSourceFileReferencesResponse = {
  summary: { total: number; succeeded: number; failed: number };
  results: Array<{
    branchId: string;
    fileId: string;
    versionId: string;
    fileName: string;
    fileFormat: FileFormat;
    dataFormat?: DataFormat;
    status: 'succeeded' | 'failed';
    error?: string;
    code?: string;
  }>;
};

const fileUploadsHeaders = {
  'Content-Type': 'application/json',
  'gt-api-version': FILE_UPLOADS_API_VERSION,
};

/** Presigned URLs to PUT files to before `uploadSourceFileReferences` names them by sha256; files the project already stores come back as `exists`. */
export function createFileUploads(options: {
  client: Client;
  path: { projectId: string };
  body: {
    files: Array<{ sha256: string; fileFormat: FileFormat; size: number }>;
  };
}) {
  return options.client.post<{ 200: CreateFileUploadsResponse }>({
    url: '/v2/projects/{projectId}/files/uploads',
    path: options.path,
    body: options.body,
    headers: fileUploadsHeaders,
  });
}

/** Uploads source files whose bytes were PUT through `createFileUploads`; a file that fails reports `status: 'failed'` in a 200 response. */
export function uploadSourceFileReferences(options: {
  client: Client;
  path: { projectId: string };
  body: { data: Array<{ source: SourceFileReference }>; sourceLocale: string };
}) {
  return options.client.post<{ 200: UploadSourceFileReferencesResponse }>({
    url: '/v2/projects/{projectId}/files',
    path: options.path,
    body: options.body,
    headers: fileUploadsHeaders,
  });
}

/**
 * PUTs a file's bytes to a presigned URL from `createFileUploads`. The URL
 * authorizes the request, so it carries no API credentials, and the PUT times
 * out when the URL expires.
 */
export async function putFileUpload(
  upload: PresignedFileUpload,
  bytes: Uint8Array<ArrayBuffer>,
  options: { retryPolicy?: RetryPolicy } = {}
): Promise<void> {
  const fetch = createRetryingFetch({
    fetch: createTimeoutFetch({
      timeoutMs: Math.max(Date.parse(upload.expiresAt) - Date.now(), 0),
    }),
    retryPolicy: options.retryPolicy,
  });
  const response = await fetch(upload.url, {
    method: 'PUT',
    headers: upload.headers,
    body: bytes,
  });
  if (!response.ok) {
    const message = `File upload failed with HTTP ${response.status}`;
    throw new ApiError(message, response.status, message);
  }
}
