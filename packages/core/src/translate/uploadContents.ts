import {
  createBatches,
  jsonByteLength,
  MAX_REQUEST_BODY_BYTES,
  putFileUpload,
  type FileFormat,
} from '@generaltranslation/api';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { decodeBytes } from '../utils/base64';

// Room for a reference to uploaded bytes, which is more than the key of inline content takes.
const REFERENCE_BYTES = 110;
// Bounds the bytes in flight.
const PARALLEL_UPLOADS = 4;
// The API reads at most 150MB of uploads per request; this is what a byte of them takes of the body limit, so one size bounds both.
const UPLOAD_BYTE_SHARE = MAX_REQUEST_BODY_BYTES / 150_000_000;

/**
 * Content a request holds inline, or names by the sha256 of its uploaded
 * bytes when the request has no room for it.
 */
export type UploadableContent<Inline = unknown> = {
  inline: Inline;
  /** What `inline` takes of a request body. */
  inlineBytes: number;
  /** At most this many bytes are uploaded, known without reading them. */
  uploadBytes: number;
  /** The bytes to upload, read only for content that goes by reference. */
  bytes: () => Uint8Array<ArrayBuffer>;
  /** Set for a file in a format with its own upload limit. */
  fileFormat?: FileFormat;
};

/** Answers where to PUT each file, in order; a file already stored has no `upload`. */
export type CreateUploads = (
  files: { sha256: string; size: number; fileFormat?: FileFormat }[]
) => Promise<
  { sha256: string; upload?: Parameters<typeof putFileUpload>[0] }[]
>;

export function base64Content(
  encoded: string,
  fileFormat?: FileFormat
): UploadableContent<string> {
  return {
    inline: encoded,
    // Measured as JSON, which escapes the line breaks base64 may carry, unless already too long to go inline.
    inlineBytes:
      encoded.length > MAX_REQUEST_BODY_BYTES
        ? encoded.length
        : jsonByteLength(encoded),
    // Line breaks in base64 are not uploaded.
    uploadBytes: encoded.replace(/\s+/g, '').length * 0.75,
    bytes: () => decodeBytes(encoded),
    fileFormat,
  };
}

export function jsonContent<Value extends object>(
  value: Value
): UploadableContent<Value> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return {
    inline: value,
    inlineBytes: bytes.byteLength,
    uploadBytes: bytes.byteLength,
    bytes: () => bytes,
    fileFormat: 'JSON',
  };
}

/** The request field for `content`: inline, or the upload its bytes went to under `sha256`. */
export function contentOrUpload<Inline>(
  { inline }: UploadableContent<Inline>,
  sha256: string | undefined
) {
  return sha256 === undefined ? { content: inline } : { upload: { sha256 } };
}

/** Contents that go inline or by reference together, such as a file's content and its metadata. */
type ContentGroup = readonly UploadableContent[];

const inlineBytesOf = (group: ContentGroup) =>
  group.reduce((bytes, { inlineBytes }) => bytes + inlineBytes, 0);

const uploadShare = (share: number, { uploadBytes }: UploadableContent) =>
  share + uploadBytes * UPLOAD_BYTE_SHARE;

/** What `groups` take of a request: a group no request holds inline counts as its references and its share of the uploads a request may name. */
export function contentBytes(groups: readonly ContentGroup[]): number {
  return groups.reduce((bytes, group) => {
    const inline = inlineBytesOf(group);
    return (
      bytes +
      group.length * REFERENCE_BYTES +
      (inline > MAX_REQUEST_BODY_BYTES ? group.reduce(uploadShare, 0) : inline)
    );
  }, 0);
}

/** `items` in parts whose uploads one request may name along with those of `shared`, which goes with every part. */
export function splitByUploads<Item>(
  shared: UploadableContent,
  items: readonly Item[],
  contentOf: (item: Item) => UploadableContent
): Item[][] {
  const parts = createBatches(
    items,
    Infinity,
    MAX_REQUEST_BODY_BYTES - uploadShare(0, shared),
    (item) => uploadShare(0, contentOf(item))
  );
  return parts.length > 0 ? parts : [[...items]];
}

/**
 * For each content of each group, the sha256 its bytes are uploaded under, or
 * `undefined` while the request body, `bodyBytes` before any of them, has room
 * for its group inline. The bytes are PUT through `createUploads` unless
 * already stored, each PUT within `timeoutMs` when the call sets one.
 */
export async function uploadContents(
  createUploads: CreateUploads,
  groups: readonly ContentGroup[],
  bodyBytes: number,
  timeoutMs: number | undefined
): Promise<(string | undefined)[][]> {
  let room =
    MAX_REQUEST_BODY_BYTES - bodyBytes - groups.flat().length * REFERENCE_BYTES;
  const uploads = new Map<
    string,
    { fileFormat?: FileFormat; bytes: Uint8Array<ArrayBuffer> }
  >();
  const hashes = groups.map((group) => {
    const inline = inlineBytesOf(group);
    if (inline <= room) {
      room -= inline;
      return group.map(() => undefined);
    }
    return group.map(({ bytes, fileFormat }) => {
      const staged = bytes();
      const hash = bytesToHex(sha256(staged));
      uploads.set(hash, { fileFormat, bytes: staged });
      return hash;
    });
  });

  // Each group's URLs are requested right before its PUTs, so none expires
  // while earlier groups upload.
  const pending = Array.from(uploads);
  for (let start = 0; start < pending.length; start += PARALLEL_UPLOADS) {
    const created = await createUploads(
      pending
        .slice(start, start + PARALLEL_UPLOADS)
        .map(([hash, { fileFormat, bytes }]) => ({
          sha256: hash,
          size: bytes.byteLength,
          ...(fileFormat && { fileFormat }),
        }))
    );
    // A failed PUT waits for the rest of its group, so no upload outlives it.
    const puts = await Promise.allSettled(
      created.map(
        ({ sha256: hash, upload }) =>
          upload &&
          putFileUpload(upload, uploads.get(hash)!.bytes, { timeoutMs })
      )
    );
    const failedPut = puts.find(
      (put): put is PromiseRejectedResult => put.status === 'rejected'
    );
    if (failedPut) throw failedPut.reason;
  }
  return hashes;
}
