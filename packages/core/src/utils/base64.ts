import { isBinaryFileFormat, type FileFormat } from '../types-dir/api/file';

// Encode a string to base64
export function encode(data: string): string {
  if (typeof Buffer !== 'undefined') {
    // Node.js path.
    return Buffer.from(data, 'utf8').toString('base64');
  }
  // Browser path.
  const bytes = new TextEncoder().encode(data);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Decode a base64 string to a string
export function decode(base64: string): string {
  if (typeof Buffer !== 'undefined') {
    // Node.js path.
    return Buffer.from(base64, 'base64').toString('utf8');
  }
  // Browser path.
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/** The bytes a base64 string encodes. */
export function decodeBytes(base64: string): Uint8Array<ArrayBuffer> {
  if (typeof Buffer !== 'undefined') {
    // Node.js path.
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  // Browser path.
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

/** The number of bytes a padded base64 string encodes. */
export function decodedByteLength(base64: string): number {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return (base64.length / 4) * 3 - padding;
}

export function encodeFileContent(
  content: string,
  fileFormat: FileFormat
): string {
  return isBinaryFileFormat(fileFormat) ? content : encode(content);
}

export function decodeFileContent(
  content: string,
  fileFormat: FileFormat
): string {
  return isBinaryFileFormat(fileFormat) ? content : decode(content);
}
