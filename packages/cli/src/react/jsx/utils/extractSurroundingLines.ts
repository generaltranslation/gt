import fs from 'node:fs';

export type SurroundingLines = {
  above: string;
  target: string;
  below: string;
};

/**
 * Extracts the surrounding lines of source code around a target node.
 *
 * @param filePath - Absolute path to the source file
 * @param startLine - 1-based start line of the target node
 * @param endLine - 1-based end line of the target node
 * @param n - Number of surrounding lines above and below to capture
 * @returns The surrounding lines, or undefined if the file can't be read
 */
export function extractSurroundingLines(
  filePath: string,
  startLine: number,
  endLine: number,
  n: number
): SurroundingLines | undefined {
  let fileContent: string;
  try {
    fileContent = fs.readFileSync(filePath, 'utf8');
  } catch {
    return undefined;
  }

  if (typeof fileContent !== 'string') {
    return undefined;
  }

  const lines = fileContent.split('\n');
  const totalLines = lines.length;

  // Clamp to valid line ranges (convert to 0-based)
  const targetStart = Math.max(0, startLine - 1);
  const targetEnd = Math.min(totalLines - 1, endLine - 1);

  const aboveStart = Math.max(0, targetStart - n);
  const belowEnd = Math.min(totalLines - 1, targetEnd + n);

  const above = lines.slice(aboveStart, targetStart).join('\n');
  const target = lines.slice(targetStart, targetEnd + 1).join('\n');
  const below = lines.slice(targetEnd + 1, belowEnd + 1).join('\n');

  return { above, target, below };
}
