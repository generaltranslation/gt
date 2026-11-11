import fs from 'node:fs';

export type SourceCode = {
  before: string;
  target: string;
  after: string;
};

// Cache file contents to avoid re-reading the same file for multiple translation sites
const fileContentCache = new Map<string, string>();

/**
 * Extracts the surrounding lines of source code around a target node.
 *
 * @param filePath - Absolute path to the source file
 * @param startLine - 1-based start line of the target node
 * @param endLine - 1-based end line of the target node
 * @param n - Number of surrounding lines before and after to capture
 * @returns The surrounding lines, or undefined if the file can't be read
 */
export function extractSourceCode(
  filePath: string,
  startLine: number,
  endLine: number,
  n: number
): SourceCode | undefined {
  let fileContent = fileContentCache.get(filePath);

  if (fileContent === undefined) {
    try {
      const result = fs.readFileSync(filePath, 'utf8');
      if (typeof result !== 'string') {
        return undefined;
      }
      fileContent = result;
      fileContentCache.set(filePath, fileContent);
    } catch {
      return undefined;
    }
  }

  const lines = fileContent.split('\n');
  const totalLines = lines.length;

  // Clamp to valid line ranges (convert to 0-based)
  const targetStart = Math.max(0, startLine - 1);
  const targetEnd = Math.min(totalLines - 1, endLine - 1);

  const beforeStart = Math.max(0, targetStart - n);
  const afterEnd = Math.min(totalLines - 1, targetEnd + n);

  const before = lines.slice(beforeStart, targetStart).join('\n');
  const target = lines.slice(targetStart, targetEnd + 1).join('\n');
  const after = lines.slice(targetEnd + 1, afterEnd + 1).join('\n');

  return { before, target, after };
}
