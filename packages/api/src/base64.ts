export const BINARY_FILE_FORMATS: ReadonlySet<string> = new Set(['LOTTIE']);

export function encodeBase64(data: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(data, 'utf8').toString('base64');
  }

  const bytes = new TextEncoder().encode(data);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function decodeBase64(base64: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(base64, 'base64').toString('utf8');
  }

  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeFileContent(content: string, fileFormat: string): string {
  return BINARY_FILE_FORMATS.has(fileFormat) ? content : encodeBase64(content);
}

export function decodeFileContent(content: string, fileFormat: string): string {
  return BINARY_FILE_FORMATS.has(fileFormat) ? content : decodeBase64(content);
}
