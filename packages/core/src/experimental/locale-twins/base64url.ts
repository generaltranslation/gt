import { decode, encode } from '../../utils/base64';

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]*$/;

/** Encodes UTF-8 text as unpadded base64url. */
export function encodeBase64Url(text: string): string {
  const base64 = encode(text).replace(/\+/g, '-').replace(/\//g, '_');
  // Trim the padding without a regex (base64 ends in at most two '=')
  let end = base64.length;
  while (end > 0 && base64[end - 1] === '=') end--;
  return base64.slice(0, end);
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
