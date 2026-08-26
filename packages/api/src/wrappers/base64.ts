import type { FileFormat } from '../generated/types.gen';

// Buffer is faster in Node; atob/btoa is the browser fallback.
// Checked per-call (not at module load) so tests can stub Buffer out.
export function encodeBase64(data: string): string {
  if (typeof Buffer !== 'undefined')
    return Buffer.from(data, 'utf-8').toString('base64');
  const bytes = new TextEncoder().encode(data);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function decodeBase64(base64: string): string {
  if (typeof Buffer !== 'undefined')
    return Buffer.from(base64, 'base64').toString('utf-8');
  const bytes = Uint8Array.from(atob(base64), (character) =>
    character.charCodeAt(0)
  );
  return new TextDecoder().decode(bytes);
}

export function encodeFileContent(
  content: string,
  fileFormat: FileFormat
): string {
  return fileFormat === 'LOTTIE' ? content : encodeBase64(content);
}

export function decodeFileContent(
  content: string,
  fileFormat: FileFormat
): string {
  return fileFormat === 'LOTTIE' ? content : decodeBase64(content);
}
