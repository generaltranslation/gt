import {
  createFileUploads,
  putFileUpload,
  type Client,
  type FileFormat,
  type UploadSourceFilesData,
} from '@generaltranslation/api';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import {
  decodeBytes,
  decodedByteLength,
  encodeFileContent,
} from '../utils/base64';
import type { apiVersionHeaders } from '../client/apiClient';
import { unwrapApiResult } from './utils/unwrapApiResult';

// The API rejects inline `content` over 4MB and request bodies over 100 MiB,
// which counts inline `formatMetadata` too.
const MAX_INLINE_FILE_BYTES = 4_000_000;
const MAX_INLINE_REQUEST_LENGTH = 90 * 1024 * 1024;
// Bounds the bytes in flight.
const PARALLEL_FILE_UPLOADS = 4;

type FormatMetadataSent = NonNullable<
  UploadSourceFilesData['body']['data'][number]['source']['formatMetadata']
>;

type UploadedFileContent = (
  | { content: string }
  | { upload: { sha256: string } }
) & { formatMetadata?: FormatMetadataSent };

/**
 * Each file's request content and `formatMetadata`: inline while the file and
 * the request stay under the API's limits, otherwise references to their
 * bytes, PUT through `createFileUploads` unless the project already stores
 * them.
 */
export async function uploadFileContents(
  request: {
    client: Client;
    headers: ReturnType<typeof apiVersionHeaders>;
    path: { projectId: string };
  },
  files: readonly {
    content: string;
    fileFormat: FileFormat;
    formatMetadata?: Extract<
      FormatMetadataSent,
      { content: object }
    >['content'];
  }[]
): Promise<UploadedFileContent[]> {
  let inlineLength = 0;
  const uploads = new Map<
    string,
    { fileFormat: FileFormat; bytes: Uint8Array<ArrayBuffer> }
  >();
  const stage = (bytes: Uint8Array<ArrayBuffer>, fileFormat: FileFormat) => {
    const hash = bytesToHex(sha256(bytes));
    uploads.set(hash, { fileFormat, bytes });
    return { sha256: hash };
  };
  const contents = files.map(
    ({ content, fileFormat, formatMetadata }): UploadedFileContent => {
      const encoded = encodeFileContent(content, fileFormat);
      const metadata =
        formatMetadata &&
        new TextEncoder().encode(JSON.stringify(formatMetadata));
      const length = encoded.length + (metadata?.byteLength ?? 0);
      if (
        decodedByteLength(encoded) <= MAX_INLINE_FILE_BYTES &&
        inlineLength + length <= MAX_INLINE_REQUEST_LENGTH
      ) {
        inlineLength += length;
        return {
          content: encoded,
          ...(formatMetadata && {
            formatMetadata: { content: formatMetadata },
          }),
        };
      }
      return {
        upload: stage(decodeBytes(encoded), fileFormat),
        ...(metadata && {
          formatMetadata: { upload: stage(metadata, 'JSON') },
        }),
      };
    }
  );

  // Each group's URLs are requested right before its PUTs, so none expires
  // while earlier groups upload.
  const pending = Array.from(uploads);
  for (let start = 0; start < pending.length; start += PARALLEL_FILE_UPLOADS) {
    const group = pending.slice(start, start + PARALLEL_FILE_UPLOADS);
    const { files: created } = unwrapApiResult(
      await createFileUploads({
        ...request,
        body: {
          files: group.map(([hash, { fileFormat, bytes }]) => ({
            sha256: hash,
            fileFormat,
            size: bytes.byteLength,
          })),
        },
      })
    );
    // A failed PUT waits for the rest of its group, so no upload outlives it.
    const puts = await Promise.allSettled(
      created.map(
        ({ sha256: hash, upload }) =>
          upload && putFileUpload(upload, uploads.get(hash)!.bytes)
      )
    );
    const failedPut = puts.find(
      (put): put is PromiseRejectedResult => put.status === 'rejected'
    );
    if (failedPut) throw failedPut.reason;
  }
  return contents;
}
