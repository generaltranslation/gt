import { decode, encode } from '../utils/base64';

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]*$/;

/** Encodes UTF-8 text as unpadded base64url. */
export function encodeBase64Url(text: string): string {
  return encode(text)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Decodes unpadded base64url into UTF-8 text. Returns undefined when invalid. */
export function decodeBase64Url(value: string): string | undefined {
  if (!BASE64URL_PATTERN.test(value) || value.length % 4 === 1) {
    return undefined;
  }
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  try {
    return decode(padded);
  } catch {
    return undefined;
  }
}
