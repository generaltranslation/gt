/** Normalizes segments independently so malformed params cannot block static normalization. */
export function normalizePathname(pathname: string): string {
  return pathname
    .split('/')
    .map((segment) => {
      let normalizedSegment = segment;
      try {
        normalizedSegment = decodeURI(segment);
      } catch {
        // Preserve malformed escape sequences without rejecting the request.
      }
      return normalizedSegment.normalize('NFC');
    })
    .join('/');
}

/** Removes trailing slashes while keeping the root pathname distinct. */
export function stripTrailingSlashes(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') || '/' : pathname;
}
