/**
 * Normalizes JSX text exactly like Babel's `cleanJSXElementLiteralChild`, the
 * transform React's runtime hashes are computed from.
 *
 * - Tabs become spaces.
 * - Spaces touching a line break are trimmed.
 * - Lines that are empty after trimming are dropped.
 * - Remaining lines are joined with a single space.
 *
 * Runs of spaces within a line are preserved, and non-breaking spaces are
 * never treated as whitespace.
 *
 * @returns The normalized text, or an empty string when the text disappears.
 */
export function normalizeJsxText(text: string): string {
  const lines = text.split(/\r\n|\n|\r/);
  let lastNonEmptyLine = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/[^ \t]/.test(lines[i])) {
      lastNonEmptyLine = i;
    }
  }

  let result = '';
  for (let i = 0; i < lines.length; i++) {
    const isFirstLine = i === 0;
    const isLastLine = i === lines.length - 1;
    let trimmedLine = lines[i].replace(/\t/g, ' ');
    if (!isFirstLine) {
      trimmedLine = trimmedLine.replace(/^ +/, '');
    }
    if (!isLastLine) {
      trimmedLine = trimmedLine.replace(/ +$/, '');
    }
    if (trimmedLine) {
      if (i !== lastNonEmptyLine) {
        trimmedLine += ' ';
      }
      result += trimmedLine;
    }
  }
  return result;
}
