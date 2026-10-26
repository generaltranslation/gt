import { readFileSync } from 'node:fs';
import { findSvelteTags } from '@generaltranslation/svelte-extractor';

/** A position in a file, in the shape of Svelte's compiler diagnostics. */
export type PreprocessLocation = {
  /** 1-based line. */
  line: number;
  /** 0-based column. */
  column: number;
  /** Offset in the file. */
  character: number;
};

/** Source text and a function that locates offsets of the preprocessed content in it. */
export type OriginalSource = {
  source: string;
  locate(contentOffset: number): PreprocessLocation;
};

const BYTE_ORDER_MARK = 0xfeff;

/**
 * Resolves offsets in the content a markup preprocessor received to the file
 * the developer wrote.
 *
 * Preprocessors that run earlier, such as `vitePreprocess()`, rewrite
 * `<script>` and `<style>` elements and can change their line counts, while
 * the markup between them stays the same and only moves. The original file
 * is read from `filename`, and when its markup matches, each offset is moved
 * by the length changes of the elements before it. Otherwise, such as when
 * the file cannot be read or a markup preprocessor changed it, locations
 * refer to the received content.
 */
export function getOriginalSource(
  content: string,
  filename: string | undefined
): OriginalSource {
  const original = filename === undefined ? undefined : readSource(filename);
  const mapOffset =
    original === undefined ? undefined : createOffsetMap(content, original);
  if (original === undefined || mapOffset === undefined) {
    return { source: content, locate: (offset) => locate(content, offset) };
  }
  return {
    source: original,
    locate: (offset) => locate(original, mapOffset(offset)),
  };
}

function readSource(filename: string): string | undefined {
  try {
    return readFileSync(filename, 'utf8');
  } catch {
    return undefined;
  }
}

type Segment = { start: number; text: string };

/** The markup around each `<script>` and `<style>` element. */
function getMarkupSegments(source: string, start: number): Segment[] {
  const segments: Segment[] = [];
  let cursor = start;
  // Matched like `svelte/compiler`'s preprocess, which only lets script and
  // style preprocessors rewrite those elements.
  const tags = findSvelteTags(source.slice(start), ['script', 'style']);
  for (const tag of tags) {
    const tagStart = start + tag.start;
    segments.push({ start: cursor, text: source.slice(cursor, tagStart) });
    cursor = start + tag.end;
  }
  segments.push({ start: cursor, text: source.slice(cursor) });
  return segments;
}

/**
 * Maps offsets in `content` to `original` when both have the same markup
 * around their `<script>` and `<style>` elements. An offset inside a
 * rewritten element maps to the start of that element. A byte order mark
 * may be present in either.
 */
function createOffsetMap(
  content: string,
  original: string
): ((offset: number) => number) | undefined {
  const from = getMarkupSegments(content, getBomLength(content));
  const to = getMarkupSegments(original, getBomLength(original));
  if (
    from.length !== to.length ||
    from.some((segment, index) => segment.text !== to[index].text)
  ) {
    return undefined;
  }
  return (offset) => {
    let index = from.length - 1;
    while (index > 0 && offset < from[index].start) index--;
    const delta = Math.max(0, offset - from[index].start);
    return to[index].start + Math.min(delta, to[index].text.length);
  };
}

function getBomLength(source: string): number {
  return source.charCodeAt(0) === BYTE_ORDER_MARK ? 1 : 0;
}

/**
 * Locates an offset, counting `\r\n`, `\n`, and a lone `\r` as line breaks.
 * Columns on the first line do not count a byte order mark.
 */
function locate(source: string, offset: number): PreprocessLocation {
  let line = 1;
  let lineStart = getBomLength(source);
  for (let i = lineStart; i < offset; i++) {
    const char = source[i];
    if (char === '\n' || (char === '\r' && source[i + 1] !== '\n')) {
      line++;
      lineStart = i + 1;
    }
  }
  return { line, column: offset - lineStart, character: offset };
}

/**
 * Formats the lines around a location like Svelte's compiler errors, which
 * Vite shows as a code frame.
 */
export function getCodeFrame(
  source: string,
  { line, column }: PreprocessLocation
): string {
  const lines = source.slice(getBomLength(source)).split(/\r\n|\r|\n/);
  const index = line - 1;
  const first = Math.max(0, index - 2);
  const last = Math.min(index + 3, lines.length);
  const digits = String(last).length;
  return lines
    .slice(first, last)
    .map((text, offset) => {
      const number = String(first + offset + 1).padStart(digits, ' ');
      const frameLine = `${number}: ${expandLeadingTabs(text)}`;
      if (first + offset !== index) return frameLine;
      const indent = expandLeadingTabs(text.slice(0, column)).length;
      return `${frameLine}\n${' '.repeat(digits + 2 + indent)}^`;
    })
    .join('\n');
}

function expandLeadingTabs(text: string): string {
  return text.replace(/^\t+/, (tabs) => '  '.repeat(tabs.length));
}
