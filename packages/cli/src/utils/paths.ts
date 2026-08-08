/**
 * Converts a filesystem path or glob to the slash-separated form expected by
 * glob matchers and used for cross-platform persisted paths.
 */
export function toPosixPath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}
