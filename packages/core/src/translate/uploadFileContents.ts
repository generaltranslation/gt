import {
  createBatches,
  createFileUploads,
  jsonByteLength,
  MAX_REQUEST_BODY_BYTES,
  putFileUpload,
  type Client,
  type FileFormat,
  type UploadSourceFilesData,
} from '@generaltranslation/api';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { decodeBytes, encodeFileContent } from '../utils/base64';
import type { apiVersionHeaders } from '../client/apiClient';
import { unwrapApiResult } from './utils/unwrapApiResult';

// Room for a file's reference to its bytes and one to its `formatMetadata`, which is more than the keys of inline content take.
const FILE_REFERENCE_BYTES = 200;
// Bounds the bytes in flight.
const PARALLEL_FILE_UPLOADS = 4;
// The API reads at most 150MB of uploads per request; this is what a byte of them takes of the body limit, so one size bounds both.
const UPLOAD_BYTE_SHARE = MAX_REQUEST_BODY_BYTES / 150_000_000;

type FormatMetadataSent = NonNullable<
  UploadSourceFilesData['body']['data'][number]['source']['formatMetadata']
>;

type FileContent = {
  content: string;
  fileFormat: FileFormat;
  formatMetadata?: Extract<FormatMetadataSent, { content: object }>['content'];
};

type UploadedFileContent = (
  | { content: string }
  | { upload: { sha256: string } }
) & { formatMetadata?: FormatMetadataSent };

function encodeFile({ content, fileFormat, formatMetadata }: FileContent) {
  const encoded = encodeFileContent(content, fileFormat);
  const metadata =
    formatMetadata && new TextEncoder().encode(JSON.stringify(formatMetadata));
  return {
    encoded,
    metadata,
    // Measured as JSON, which escapes the line breaks base64 may carry, unless already too long to go inline.
    length:
      (encoded.length > MAX_REQUEST_BODY_BYTES
        ? encoded.length
        : jsonByteLength(encoded)) + (metadata?.byteLength ?? 0),
  };
}

/**
 * What `files` take of a request: their content and `formatMetadata`, or for
 * a file that no request holds inline, the references and its share of the
 * uploads a request may name.
 */
export function fileContentBytes(files: readonly FileContent[]): number {
  return files.reduce((bytes, file) => {
    const { length } = encodeFile(file);
    return (
      bytes +
      FILE_REFERENCE_BYTES +
      (length > MAX_REQUEST_BODY_BYTES ? length * UPLOAD_BYTE_SHARE : length)
    );
  }, 0);
}

/** `files` in parts whose uploads one request may name along with those of `shared`, which goes with every part. */
export function splitByUploads<File extends FileContent>(
  shared: FileContent,
  files: readonly File[]
): File[][] {
  const uploadShare = (file: FileContent) =>
    encodeFile(file).length * UPLOAD_BYTE_SHARE;
  const parts = createBatches(
    files,
    Infinity,
    MAX_REQUEST_BODY_BYTES - uploadShare(shared),
    uploadShare
  );
  return parts.length > 0 ? parts : [[...files]];
}

/**
 * Each file's request content and `formatMetadata`: inline while the request
 * body, `bodyBytes` before any of them, stays within the API's limit,
 * otherwise references to their bytes, PUT through `createFileUploads` unless
 * the project already stores them.
 */
export async function uploadFileContents(
  request: {
    client: Client;
    headers: ReturnType<typeof apiVersionHeaders>;
    path: { projectId: string };
  },
  files: readonly FileContent[],
  bodyBytes: number
): Promise<UploadedFileContent[]> {
  let inlineBytes =
    MAX_REQUEST_BODY_BYTES - bodyBytes - files.length * FILE_REFERENCE_BYTES;
  const uploads = new Map<
    string,
    { fileFormat: FileFormat; bytes: Uint8Array<ArrayBuffer> }
  >();
  const stage = (bytes: Uint8Array<ArrayBuffer>, fileFormat: FileFormat) => {
    const hash = bytesToHex(sha256(bytes));
    uploads.set(hash, { fileFormat, bytes });
    return { sha256: hash };
  };
  const contents = files.map((file): UploadedFileContent => {
    const { encoded, metadata, length } = encodeFile(file);
    if (length <= inlineBytes) {
      inlineBytes -= length;
      return {
        content: encoded,
        ...(file.formatMetadata && {
          formatMetadata: { content: file.formatMetadata },
        }),
      };
    }
    return {
      upload: stage(decodeBytes(encoded), file.fileFormat),
      ...(metadata && {
        formatMetadata: { upload: stage(metadata, 'JSON') },
      }),
    };
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
