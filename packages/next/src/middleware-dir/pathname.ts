/** Normalizes each segment without conflating escaped separators or encoding levels. */
export function normalizePathname(pathname: string): string {
  return pathname
    .split('/')
    .map((segment) => {
      try {
        return encodeURIComponent(decodeURIComponent(segment).normalize('NFC'));
      } catch {
        // Preserve malformed escape sequences without rejecting the request.
        return segment.normalize('NFC');
      }
    })
    .join('/');
}
