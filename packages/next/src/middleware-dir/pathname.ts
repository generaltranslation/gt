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

/** Removes trailing slashes while keeping the root pathname distinct. */
export function stripTrailingSlashes(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') || '/' : pathname;
}

/** Applies the request pathname's trailing-slash style to a target path. */
export function applyTrailingSlash(
  pathname: string,
  targetPathname: string
): string {
  const sourceHasTrailingSlash = pathname.length > 1 && pathname.endsWith('/');
  if (sourceHasTrailingSlash) {
    return targetPathname === '/' || targetPathname.endsWith('/')
      ? targetPathname
      : `${targetPathname}/`;
  }
  return stripTrailingSlashes(targetPathname);
}
