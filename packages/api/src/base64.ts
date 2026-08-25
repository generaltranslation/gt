export function encodeBase64(data: string): string {
  const bytes = new TextEncoder().encode(data);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function decodeBase64(base64: string): string {
  const bytes = Uint8Array.from(atob(base64), (character) =>
    character.charCodeAt(0)
  );
  return new TextDecoder().decode(bytes);
}

export function encodeFileContent(content: string, fileFormat: string): string {
  return fileFormat === 'LOTTIE' ? content : encodeBase64(content);
}

export function decodeFileContent(content: string, fileFormat: string): string {
  return fileFormat === 'LOTTIE' ? content : decodeBase64(content);
}
