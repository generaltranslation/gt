import { decode, encode } from '@jridgewell/sourcemap-codec';
import MagicString, { type SourceMap } from 'magic-string';

/**
 * `code.replace(pattern, replacer)`: how a rewrite of a chunk's code replaces
 * what it finds.
 */
export type ReplaceInChunk = (
  code: string,
  pattern: RegExp,
  replacer: (...match: string[]) => string
) => string;

export const replaceInChunk: ReplaceInChunk = (code, pattern, replacer) =>
  code.replace(pattern, replacer);

/**
 * What a rewrite replaced: a range of the code before any rewrite, and what
 * is there now. Only what differs: not what a match and its replacement
 * start and end with alike.
 */
export type Replacement = { start: number; end: number; content: string };

/**
 * Follows the rewrites of a chunk's code, each of which replaces in the code
 * the one before it returned, so the source map of what they did together
 * can be written.
 *
 * `replace` replaces as `replaceInChunk` does and keeps what it replaced.
 * `replacements` is undefined when nothing was replaced, and when the
 * rewrites cannot be followed: one replaced in other code than the last one
 * returned, or in what an earlier one had written.
 */
export function trackReplacements(code: string): {
  replace: ReplaceInChunk;
  readonly replacements: Replacement[] | undefined;
} {
  // In the order of their place in the code
  let replacements: Replacement[] = [];
  let current = code;
  let followed = true;
  const replace: ReplaceInChunk = (replacedIn, pattern, replacer) => {
    const found: Replacement[] = [];
    // A replacer gets the match, its groups, then where the match starts
    const replaced = replacedIn.replace(pattern, (...match: unknown[]) => {
      const groups = match.findIndex((value) => typeof value === 'number');
      const [text] = match as [string];
      const start = match[groups] as number;
      const content = replacer(...(match.slice(0, groups) as string[]));
      const shorter = Math.min(text.length, content.length);
      let same = 0;
      while (same < shorter && text[same] === content[same]) same++;
      let sameEnd = 0;
      while (
        sameEnd < shorter - same &&
        text[text.length - 1 - sameEnd] ===
          content[content.length - 1 - sameEnd]
      ) {
        sameEnd++;
      }
      if (same + sameEnd < Math.max(text.length, content.length)) {
        found.push({
          start: start + same,
          end: start + text.length - sameEnd,
          content: content.slice(same, content.length - sameEnd),
        });
      }
      return content;
    });
    if (replaced === replacedIn) return replaced;
    if (replacedIn !== current) followed = false;
    current = replaced;
    // What was found is in the code this rewrite received: `grown` is how much longer that is, up to there
    let grown = 0;
    let earlier = 0;
    for (const range of found) {
      for (; earlier < replacements.length; earlier++) {
        const { start, end, content } = replacements[earlier];
        if (start + grown + content.length > range.start) break;
        grown += content.length - (end - start);
      }
      const next = replacements[earlier];
      if (next && next.start + grown < range.end) followed = false;
      range.start -= grown;
      range.end -= grown;
    }
    replacements = [...replacements, ...found].sort(
      (a, b) => a.start - b.start
    );
    return replaced;
  };
  return {
    replace,
    get replacements() {
      return followed && replacements.length ? replacements : undefined;
    },
  };
}

/**
 * The source map from a chunk's code after `replacements` to `code`, the
 * code before them, for a bundler to put after the maps it has of `code`.
 */
export function generateReplacementsMap(
  code: string,
  file: string,
  replacements: readonly Replacement[]
): SourceMap {
  const edited = new MagicString(code);
  for (const { start, end, content } of replacements) {
    if (start === end) edited.appendLeft(start, content);
    else edited.overwrite(start, end, content);
  }
  // A segment at each word and at each other character, so every token keeps its own position
  return edited.generateMap({ hires: 'boundary', source: file });
}

function getLineStarts(code: string): number[] {
  const starts = [0];
  for (
    let at = code.indexOf('\n');
    at !== -1;
    at = code.indexOf('\n', at + 1)
  ) {
    starts.push(at + 1);
  }
  return starts;
}

type Position = { line: number; column: number };

const CODE_START: Position = { line: 0, column: 0 };

/**
 * Moves positions of `code`, each no earlier than the one before it, to
 * where they are after `replacements`: a position keeps its place in its
 * code, and a position inside what was replaced moves to where the
 * replacement starts.
 */
function createPositionMover(
  code: string,
  replacements: readonly Replacement[]
): (position: Position) => Position & { isReplaced: boolean } {
  const lineStarts = getLineStarts(code);
  let replaced = '';
  let copied = 0;
  for (const { start, end, content } of replacements) {
    replaced += code.slice(copied, start) + content;
    copied = end;
  }
  const movedLineStarts = getLineStarts(replaced + code.slice(copied));
  let grown = 0;
  let next = 0;
  let line = 0;
  return (position) => {
    const at = lineStarts[position.line] + position.column;
    for (; next < replacements.length; next++) {
      const { start, end, content } = replacements[next];
      if (end > at) break;
      grown += content.length - (end - start);
    }
    const around = replacements[next];
    const isReplaced = around !== undefined && around.start < at;
    const movedTo = isReplaced ? around.start + grown : at + grown;
    while (movedLineStarts[line + 1] <= movedTo) line++;
    return { line, column: movedTo - movedLineStarts[line], isReplaced };
  };
}

/**
 * Moves the mappings of a map whose generated code starts at `offset` in
 * the code `move` moves positions of, to a map that starts at `movedOffset`.
 */
function moveSectionMappings(
  mappings: string,
  move: ReturnType<typeof createPositionMover>,
  offset: Position,
  movedOffset: Position
): string {
  const lines = decode(mappings);
  const moved: typeof lines = lines.map(() => []);
  let previous: { index: number; column: number; isWritten: boolean } = {
    index: -1,
    column: -1,
    isWritten: false,
  };
  lines.forEach((segments, index) => {
    for (const segment of segments) {
      const position = move({
        line: offset.line + index,
        column: index ? segment[0] : offset.column + segment[0],
      });
      const line = position.line - movedOffset.line;
      const column =
        line === 0 ? position.column - movedOffset.column : position.column;
      while (moved.length <= line) moved.push([]);
      const written = moved[line];
      const movedSegment = [...segment] as typeof segment;
      movedSegment[0] = column;
      let isWritten = true;
      // Segments a map already has at one column stay together
      if (previous.index === index && previous.column === segment[0]) {
        isWritten = previous.isWritten;
      } else if (written[written.length - 1]?.[0] === column) {
        // What follows something deleted is at the column where that started
        if (position.isReplaced) isWritten = false;
        else {
          while (written[written.length - 1]?.[0] === column) written.pop();
        }
      }
      if (isWritten) written.push(movedSegment);
      previous = { index, column: segment[0], isWritten };
    }
  });
  return encode(moved);
}

/**
 * The mappings of a source map of `code` as those of the code after
 * `replacements`: every position keeps what it maps to and moves with its
 * code, and a position inside what was replaced moves to where the
 * replacement starts, unless code that was not replaced is there now.
 */
export function moveMappings(
  mappings: string,
  code: string,
  replacements: readonly Replacement[]
): string {
  return moveSectionMappings(
    mappings,
    createPositionMover(code, replacements),
    CODE_START,
    CODE_START
  );
}

type Section = { offset: Position; map: { mappings?: unknown } };

/**
 * The source map file `source` of `code` moved with `replacements`, which
 * were made in `code`, or undefined when it is not a version 3 map, or is
 * an index map with a section that is not a map with mappings.
 */
export function moveSourceMapFile(
  source: string,
  code: string,
  replacements: readonly Replacement[]
): string | undefined {
  const map = JSON.parse(source);
  if (map.version !== 3) return undefined;
  if (!('sections' in map)) {
    if (typeof map.mappings !== 'string') return undefined;
    return JSON.stringify({
      ...map,
      mappings: moveMappings(map.mappings, code, replacements),
    });
  }
  const sections: Section[] = map.sections;
  if (sections.some((section) => typeof section.map?.mappings !== 'string')) {
    return undefined;
  }
  const move = createPositionMover(code, replacements);
  return JSON.stringify({
    ...map,
    // Sections are in the order of their offsets, as `move` takes positions
    sections: sections.map((section) => {
      const { line, column } = move(section.offset);
      const offset = { line, column };
      return {
        ...section,
        offset,
        map: {
          ...section.map,
          mappings: moveSectionMappings(
            section.map.mappings as string,
            move,
            section.offset,
            offset
          ),
        },
      };
    }),
  });
}

/** A chunk of a bundle, with the source map a bundler holds for it. */
export type BundledChunk = {
  fileName: string;
  code?: string;
  map?: { mappings: string; toString(): string } | null;
  sourcemapFileName?: string | null;
};

const INLINE_MAP =
  /(\/\/# sourceMappingURL=data:application\/json;(?:charset=utf-8;)?base64,)[^\n]*/;

/**
 * Moves the source map of a chunk of a bundle with `replacements`, which
 * were made in `code`, the chunk's code before them. The map is moved in
 * each place a bundler keeps it: on the chunk, in the chunk's map file, and
 * in the comment of a chunk whose map is inline.
 */
export function moveChunkMap(
  bundle: Record<string, { type: string; source?: unknown }>,
  chunk: BundledChunk,
  code: string,
  replacements: readonly Replacement[]
): void {
  const { map } = chunk;
  if (!map) return;
  map.mappings = moveMappings(map.mappings, code, replacements);
  // Assigned again, as a bundler may only see what is assigned to the chunk
  chunk.map = map;
  const mapFile = bundle[chunk.sourcemapFileName ?? `${chunk.fileName}.map`];
  if (mapFile?.type === 'asset' && typeof mapFile.source === 'string') {
    mapFile.source = map.toString();
  }
  if (chunk.code !== undefined && INLINE_MAP.test(chunk.code)) {
    chunk.code = chunk.code.replace(
      INLINE_MAP,
      (_match, comment: string) =>
        `${comment}${Buffer.from(map.toString(), 'utf-8').toString('base64')}`
    );
  }
}
