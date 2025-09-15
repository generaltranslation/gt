// Encode a string to base64
export function encode(data: string): string {
  if (typeof Buffer !== 'undefined') {
    // Node.js path
    return Buffer.from(data, 'utf8').toString('base64');
  }
  // Browser path
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
    // Node.js path
    return Buffer.from(base64, 'base64').toString('utf8');
  }
  // Browser path
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}
