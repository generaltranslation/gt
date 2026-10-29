/**
 * Serializes JSON for writing to disk. Keeps the trailing newline convention
 * of the file being overwritten, and ends new files with a newline.
 * @param data - The value to serialize.
 * @param original - The current contents of the file being overwritten, if any.
 */
export function stringifyJson(data: unknown, original?: string): string {
  const finalNewline = original === undefined || original.endsWith('\n');
  return JSON.stringify(data, null, 2) + (finalNewline ? '\n' : '');
}
