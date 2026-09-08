/** Normalizes segments independently so malformed params cannot block static normalization. */
export function normalizePathname(pathname: string): string {
  return pathname
    .split('/')
    .map((segment) => {
      try {
        // Re-encode each segment so escaped separators and encoding levels stay distinct.
        return encodeURIComponent(decodeURIComponent(segment).normalize('NFC'));
      } catch {
        // Preserve malformed escape sequences without rejecting the request.
        return segment.normalize('NFC');
      }
    })
    .join('/');
}
