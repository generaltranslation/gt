import {
  createFileUploads,
  putFileUpload,
  type Client,
  type FileFormat,
} from '@generaltranslation/api';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import {
  decodeBytes,
  decodedByteLength,
  encodeFileContent,
} from '../utils/base64';
import type { apiVersionHeaders } from '../apiClient';
import { unwrapApiResult } from './utils/unwrapApiResult';

// The API rejects inline `content` over 4MB and request bodies over 100 MiB.
const MAX_INLINE_FILE_BYTES = 4_000_000;
const MAX_INLINE_REQUEST_LENGTH = 90 * 1024 * 1024;
// Bounds the bytes in flight and keeps each upload's bandwidth, and so its
// timeout, predictable.
const PARALLEL_FILE_UPLOADS = 4;

export type StagedFileContent =
  | { content: string }
  | { upload: { sha256: string } };

/**
 * Each file's request content: inline base64 while the file and the request
 * stay under the API's limits, otherwise a reference to its bytes, PUT through
 * `createFileUploads` unless the project already stores them.
 */
export async function stageFileContents(
  request: {
    client: Client;
    headers: ReturnType<typeof apiVersionHeaders>;
    path: { projectId: string };
  },
  files: readonly { content: string; fileFormat: FileFormat }[],
  timeoutMs?: number
): Promise<StagedFileContent[]> {
  let inlineLength = 0;
  const uploads = new Map<
    string,
    { fileFormat: FileFormat; bytes: Uint8Array<ArrayBuffer> }
  >();
  const contents = files.map(({ content, fileFormat }): StagedFileContent => {
    const encoded = encodeFileContent(content, fileFormat);
    if (
      decodedByteLength(encoded) <= MAX_INLINE_FILE_BYTES &&
      inlineLength + encoded.length <= MAX_INLINE_REQUEST_LENGTH
    ) {
      inlineLength += encoded.length;
      return { content: encoded };
    }
    const bytes = decodeBytes(encoded);
    const hash = bytesToHex(sha256(bytes));
    uploads.set(hash, { fileFormat, bytes });
    return { upload: { sha256: hash } };
  });

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
    await Promise.all(
      created.map(
        ({ sha256: hash, upload }) =>
          upload &&
          putFileUpload(upload, uploads.get(hash)!.bytes, { timeoutMs })
      )
    );
  }
  return contents;
}
