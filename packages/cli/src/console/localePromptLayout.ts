import type { Option } from '@clack/prompts';

/**
 * Clack redraws a prompt by moving the cursor up to the first line of the
 * previous frame. A frame taller than the terminal scrolls its top lines away,
 * the cursor stops at the top row, and every redraw leaves stale lines behind.
 * Clack 1.0.0-alpha.6 sizes the locale lists from the terminal height but
 * under-counts the lines drawn around them, and long labels wrap onto extra
 * rows. These helpers keep each option to one row and the frame within the
 * terminal height.
 */

// `│  ` before every option, then a `◻ ` or `● ` marker and a spare column.
const OPTION_PREFIX_WIDTH = 6;
const ELLIPSIS = '…';

const WIDE_CHARACTER =
  /[\u1100-\u115F\u2E80-\u303E\u3041-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uA000-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFF60\uFFE0-\uFFE6\u{1F300}-\u{1FAFF}\u{20000}-\u{3FFFD}]/u;
const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

export function getTerminalSize() {
  // Clack draws to process.stdout and falls back to 80x20 without a TTY.
  return {
    columns: process.stdout.columns || 80,
    rows: process.stdout.rows || 20,
  };
}

/**
 * Display width that never under-counts: wide East Asian characters take two
 * columns and every other code point, including combining marks, takes one.
 */
export function estimateDisplayWidth(text: string) {
  let width = 0;
  for (const character of text) {
    width += WIDE_CHARACTER.test(character) ? 2 : 1;
  }
  return width;
}

/**
 * Upper bound on the rows `text` takes when word-wrapped to `columns`: every
 * two consecutive wrapped rows hold at least `columns - 1` columns of text.
 */
function estimateRows(text: string, columns: number) {
  const width = estimateDisplayWidth(text);
  if (width <= columns) return 1;
  return 2 * Math.floor(width / Math.max(columns - 1, 1)) + 1;
}

/** How many option rows fit in the terminal beside the given prompt lines. */
export function getLocalePromptMaxItems(chrome: string[]) {
  const { columns, rows } = getTerminalSize();
  const chromeRows = chrome.reduce(
    (total, line) => total + estimateRows(line, columns),
    0
  );
  return Math.max(rows - chromeRows, 1);
}

function takeWidth(segments: string[], width: number) {
  const kept: string[] = [];
  let used = 0;
  for (const segment of segments) {
    used += estimateDisplayWidth(segment);
    if (used > width) break;
    kept.push(segment);
  }
  return kept;
}

/**
 * Truncate an option label so its row fits the terminal. Clack hides options
 * whose label stops matching the search, so when the search text falls in the
 * cut part, keep the leading locale code and the end of the label instead, or
 * the full label when no cut keeps the search visible.
 */
export function fitLocaleOptionLabel<T>(
  option: Option<T>,
  query: string,
  columns = getTerminalSize().columns
): Option<T> {
  const label = option.label ?? String(option.value);
  const hint = option.hint ? ` (${option.hint})` : '';
  const width =
    columns -
    OPTION_PREFIX_WIDTH -
    estimateDisplayWidth(hint) -
    ELLIPSIS.length;
  if (estimateDisplayWidth(label) <= width + ELLIPSIS.length) return option;

  const term = query.toLowerCase();
  const segments = Array.from(graphemes.segment(label), (part) => part.segment);
  const head = `${takeWidth(segments, width).join('')}${ELLIPSIS}`;
  if (head.toLowerCase().includes(term)) return { ...option, label: head };

  const gap = label.indexOf('  ');
  const code = gap === -1 ? '' : label.slice(0, gap + 2);
  const tail = takeWidth(
    segments.reverse(),
    width - estimateDisplayWidth(code)
  ).reverse();
  const kept = `${code}${ELLIPSIS}${tail.join('')}`;
  return kept.toLowerCase().includes(term)
    ? { ...option, label: kept }
    : option;
}
