import type { FileFormat } from '../generated/types.gen';

// Compatibility shims: these were public in 0.x and are kept so the removal is
// not a breaking change. The canonical implementations live in
// `generaltranslation/internal`; this package must stay workspace-dependency-free.

// Buffer is faster in Node; atob/btoa is the browser fallback.
// Checked per-call (not at module load) so tests can stub Buffer out.
/** @deprecated Import `encode` from `generaltranslation/internal` instead. */
export function encodeBase64(data: string): string {
  if (typeof Buffer !== 'undefined')
    return Buffer.from(data, 'utf-8').toString('base64');
  const bytes = new TextEncoder().encode(data);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** @deprecated Import `decode` from `generaltranslation/internal` instead. */
export function decodeBase64(base64: string): string {
  if (typeof Buffer !== 'undefined')
    return Buffer.from(base64, 'base64').toString('utf-8');
  const bytes = Uint8Array.from(atob(base64), (character) =>
    character.charCodeAt(0)
  );
  return new TextDecoder().decode(bytes);
}

/** @deprecated Import `encodeFileContent` from `generaltranslation/internal` instead. */
export function encodeFileContent(
  content: string,
  fileFormat: FileFormat
): string {
  return fileFormat === 'LOTTIE' ? content : encodeBase64(content);
}

/** @deprecated Import `decodeFileContent` from `generaltranslation/internal` instead. */
export function decodeFileContent(
  content: string,
  fileFormat: FileFormat
): string {
  return fileFormat === 'LOTTIE' ? content : decodeBase64(content);
}
