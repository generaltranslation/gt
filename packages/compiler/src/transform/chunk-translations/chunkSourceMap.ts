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

/**
 * The mappings of a source map of `code` as those of the code after
 * `replacements`: every position keeps what it maps to and moves with its
 * code, and a position inside what was replaced moves to where the
 * replacement starts.
 */
export function moveMappings(
  mappings: string,
  code: string,
  replacements: readonly Replacement[]
): string {
  const lineStarts = getLineStarts(code);
  let replaced = '';
  let copied = 0;
  for (const { start, end, content } of replacements) {
    replaced += code.slice(copied, start) + content;
    copied = end;
  }
  const movedLineStarts = getLineStarts(replaced + code.slice(copied));
  const lines = decode(mappings);
  const moved: typeof lines = movedLineStarts.map(() => []);
  let grown = 0;
  let next = 0;
  let line = 0;
  lines.forEach((segments, index) => {
    for (const segment of segments) {
      const at = lineStarts[index] + segment[0];
      for (; next < replacements.length; next++) {
        const { start, end, content } = replacements[next];
        if (end > at) break;
        grown += content.length - (end - start);
      }
      const inside = replacements[next];
      const movedTo =
        inside && inside.start < at ? inside.start + grown : at + grown;
      while (movedLineStarts[line + 1] <= movedTo) line++;
      const column = movedTo - movedLineStarts[line];
      const last = moved[line][moved[line].length - 1];
      if (last?.[0] === column) continue;
      const movedSegment = [...segment] as typeof segment;
      movedSegment[0] = column;
      moved[line].push(movedSegment);
    }
  });
  // Lines without a mapping at the end of the code are not written
  while (moved.length > lines.length && !moved[moved.length - 1].length) {
    moved.pop();
  }
  return encode(moved);
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
