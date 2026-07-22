import type { PromptResult } from './inkTypes.js';
import { stripAnsi } from './logging.js';
export { stripAnsi };

const MIN_CONTENT_WIDTH = 20;
const MAX_CONTENT_WIDTH = 96;
const INPUT_HORIZONTAL_PADDING = 4;
const MAX_VISIBLE_LOCALES = 7;

export const CANCELLED: PromptResult<never> = { cancelled: true };
export const SELECTED_TAG_ROW_INDEX = -1;

export function normalizedMessage(message: string): string {
  return stripAnsi(message).trim();
}

export function wrapText(text: string, width: number) {
  const safeWidth = Math.max(1, width);
  const lines: string[] = [];

  for (const paragraph of text.split('\n')) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    let currentLine = '';

    if (words.length === 0) {
      lines.push('');
      continue;
    }

    for (const word of words) {
      if (word.length > safeWidth) {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = '';
        }
        for (let index = 0; index < word.length; index += safeWidth) {
          lines.push(word.slice(index, index + safeWidth));
        }
        continue;
      }

      const nextLine = currentLine ? `${currentLine} ${word}` : word;
      if (nextLine.length > safeWidth) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = nextLine;
      }
    }

    if (currentLine) lines.push(currentLine);
  }

  return lines;
}

export function complete<T>(
  result: PromptResult<T>,
  onComplete: (result: PromptResult<T>) => void
) {
  onComplete(result);
}

export function getContentWidth(columns: number) {
  const terminalWidth = Math.max(1, columns);
  return Math.min(
    Math.max(MIN_CONTENT_WIDTH, terminalWidth - 4),
    MAX_CONTENT_WIDTH,
    terminalWidth
  );
}

export function getInputWidth(columns: number) {
  return Math.max(1, getContentWidth(columns) - INPUT_HORIZONTAL_PADDING);
}

export function getOptionWidth(columns: number) {
  return Math.max(1, getContentWidth(columns) - 2);
}

export function getVisibleCount(rows: number, reservedRows: number) {
  return Math.min(MAX_VISIBLE_LOCALES, Math.max(1, rows - reservedRows));
}

export function previousIndex(index: number, length: number) {
  if (length === 0) return 0;
  return index === 0 ? length - 1 : index - 1;
}

export function nextIndex(index: number, length: number) {
  if (length === 0) return 0;
  return (index + 1) % length;
}

export function truncate(value: string, width: number) {
  if (value.length <= width) return value;
  if (width <= 1) return value.slice(0, width);
  if (width <= 3) return '.'.repeat(width);
  return `${value.slice(0, width - 3)}...`;
}

export function limitLines(lines: string[], maxLines: number, width: number) {
  const safeMaxLines = Math.max(1, maxLines);
  const visibleLines = lines.slice(0, safeMaxLines);
  if (lines.length > safeMaxLines) {
    const lastIndex = visibleLines.length - 1;
    visibleLines[lastIndex] = truncate(`${visibleLines[lastIndex]}...`, width);
  }
  return visibleLines;
}

export function getScrollWindow<T>({
  items,
  index,
  visibleCount,
}: {
  items: T[];
  index: number;
  visibleCount: number;
}) {
  const safeVisibleCount = Math.max(1, visibleCount);
  const half = Math.floor(safeVisibleCount / 2);
  const start = Math.min(
    Math.max(0, index - half),
    Math.max(0, items.length - safeVisibleCount)
  );
  const end = start + safeVisibleCount;
  return {
    start,
    visibleItems: items.slice(start, end),
  };
}

export function getSafeIndex(index: number, length: number) {
  if (length === 0) return 0;
  return Math.max(0, Math.min(index, length - 1));
}
