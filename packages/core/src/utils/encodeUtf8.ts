/**
 * Encode a string as UTF-8 bytes.
 *
 * Some Node-backed test environments, like older Jest jsdom setups, expose
 * Buffer but not global TextEncoder.
 */
export function encodeUtf8(string: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(string);
  }

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(string, 'utf8');
  }

  throw new Error('TextEncoder is required to encode strings as UTF-8.');
}
