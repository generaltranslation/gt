import {
  decodedMappings,
  TraceMap,
  type EncodedSourceMap,
  type SourceMapSegment,
} from '@jridgewell/trace-mapping';
import { computeLineStarts, forEachNode, type ESTree } from '../utils/ast.js';

/**
 * Generated `[generated, generated + length)` stands for source
 * `[source, source + sourceLength)`. Equal lengths are a copy, mapped character
 * by character; otherwise the whole generated range stands for the whole source range.
 */
export type Mapping = {
  generated: number;
  source: number;
  length: number;
  /** Default: `length`. */
  sourceLength?: number;
};

export type VolarMapping = {
  sourceOffsets: readonly number[];
  generatedOffsets: readonly number[];
  lengths: readonly number[];
  generatedLengths?: readonly number[];
};

type PositionedNode = { start: number; end: number };

type SourceMapTexts = {
  generatedCode: string;
  generatedLineStarts: readonly number[];
  sourceCode: string;
  sourceLineStarts: readonly number[];
};

/** The source position of generated-only text. */
export const UNMAPPED = -1;

/** Mappings of Volar's virtual code: `@vue/language-core`, `@mdx-js/language-service`, Glint. */
export function mappingsFromVolar(
  mappings: readonly VolarMapping[]
): Mapping[] {
  return mappings.flatMap(mappingsOfVolarMapping);
}

/**
 * Mappings of a source map (v3), e.g. from `svelte2tsx`. Each segment is a copy
 * that runs to the next one on its line, as far as the generated text equals the source.
 */
export function mappingsFromSourceMap(
  map: EncodedSourceMap | string,
  generatedCode: string,
  sourceCode: string
): Mapping[] {
  const texts: SourceMapTexts = {
    generatedCode,
    generatedLineStarts: computeLineStarts(generatedCode),
    sourceCode,
    sourceLineStarts: computeLineStarts(sourceCode),
  };
  const lines = decodedMappings(new TraceMap(map));

  return lines.flatMap((lineSegments, line) =>
    lineMappings(lineSegments, line, texts)
  );
}

/**
 * Moves every node of `program` to its source position. A node that starts in
 * generated-only text gets `start = end = -1` and is not a usage.
 */
export function remapProgram(
  program: ESTree.Program,
  mappings: readonly Mapping[],
  generatedLength: number
): void {
  // Longer mappings first, so that nested (more precise) ones win.
  const outermostFirst = [...mappings].sort((a, b) => b.length - a.length);
  const sourceStartAt = sourceOffsets(outermostFirst, generatedLength);
  const sourceEndAt = offsetTable(outermostFirst, generatedLength, sourceEndOf);

  forEachNode(program, (node) => {
    const start = sourceStartAt[node.start] ?? UNMAPPED;
    const end = lastMappedSourceEnd(node, sourceEndAt) ?? start;
    const isMapped = start !== UNMAPPED;

    node.start = start;
    node.end = isMapped ? Math.max(start, end) : UNMAPPED;
  });
}

/** The source offset of each generated offset; `UNMAPPED` for generated-only text. */
export function sourceOffsets(
  mappings: readonly Mapping[],
  generatedLength: number
): Int32Array {
  return offsetTable(mappings, generatedLength, sourceStartOf);
}

function mappingsOfVolarMapping(mapping: VolarMapping): Mapping[] {
  return mapping.sourceOffsets.map((source, index) => {
    const generated = mapping.generatedOffsets[index]!;
    const sourceLength = mapping.lengths[index]!;
    const length = mapping.generatedLengths?.[index] ?? sourceLength;

    return { generated, source, length, sourceLength };
  });
}

function lineMappings(
  lineSegments: readonly SourceMapSegment[],
  line: number,
  texts: SourceMapTexts
): Mapping[] {
  const { generatedCode, generatedLineStarts } = texts;

  const lineStart = generatedLineStarts[line];
  if (lineStart === undefined) return [];

  const nextLineStart = generatedLineStarts[line + 1] ?? generatedCode.length;
  const lineLength = nextLineStart - lineStart;

  // Astro's compiler adds a second segment at a column, pointing elsewhere: the first wins.
  const segments = lineSegments.filter(
    (segment, index) =>
      index === 0 || segment[0] !== lineSegments[index - 1]![0]
  );
  const mappings: Mapping[] = [];

  segments.forEach((segment, index) => {
    const nextColumn = segments[index + 1]?.[0] ?? lineLength;
    const mapping = segmentMapping(segment, lineStart, nextColumn, texts);

    if (mapping) mappings.push(mapping);
  });

  return mappings;
}

function segmentMapping(
  segment: SourceMapSegment,
  lineStart: number,
  nextColumn: number,
  texts: SourceMapTexts
): Mapping | undefined {
  const { generatedCode, sourceCode, sourceLineStarts } = texts;

  if (segment.length === 1) return undefined;

  const [column, , sourceLine, sourceColumn] = segment;
  const sourceLineStart = sourceLineStarts[sourceLine];
  if (sourceLineStart === undefined) return undefined;

  const nextSourceLineStart =
    sourceLineStarts[sourceLine + 1] ?? sourceCode.length + 1;
  const sourceLineEnd = nextSourceLineStart - 1;
  const generated = lineStart + column;
  const source = sourceLineStart + sourceColumn;

  // A copy ends where the texts differ: tools insert text after it (svelte2tsx's helpers).
  const longestCopy = Math.min(nextColumn - column, sourceLineEnd - source);
  const length = commonPrefixLength(
    generatedCode,
    generated,
    sourceCode,
    source,
    longestCopy
  );

  return length > 0 ? { generated, source, length } : undefined;
}

function offsetTable(
  mappings: readonly Mapping[],
  generatedLength: number,
  sourceOffsetOf: (mapping: Mapping, offset: number) => number
): Int32Array {
  const table = new Int32Array(generatedLength + 1).fill(UNMAPPED);

  for (const mapping of mappings) {
    fillOffsets(table, mapping, generatedLength, sourceOffsetOf);
  }

  return table;
}

function fillOffsets(
  table: Int32Array,
  mapping: Mapping,
  generatedLength: number,
  sourceOffsetOf: (mapping: Mapping, offset: number) => number
): void {
  const { generated, length } = mapping;

  for (
    let offset = 0;
    offset < length && generated + offset < generatedLength;
    offset++
  ) {
    table[generated + offset] = sourceOffsetOf(mapping, offset);
  }
}

function lastMappedSourceEnd(
  node: PositionedNode,
  sourceEndAt: Int32Array
): number | undefined {
  const lastOffset = node.end - 1;
  if (lastOffset === node.start) return sourceEndAt[lastOffset];

  for (let offset = lastOffset; offset > node.start; offset--) {
    const sourceEnd = sourceEndAt[offset];
    if (sourceEnd !== undefined && sourceEnd !== UNMAPPED) return sourceEnd;
  }

  return undefined;
}

function sourceStartOf(mapping: Mapping, offset: number): number {
  return isCopy(mapping) ? mapping.source + offset : mapping.source;
}

function sourceEndOf(mapping: Mapping, offset: number): number {
  return isCopy(mapping)
    ? mapping.source + offset + 1
    : mapping.source + sourceLengthOf(mapping);
}

function isCopy(mapping: Mapping): boolean {
  return sourceLengthOf(mapping) === mapping.length;
}

function sourceLengthOf(mapping: Mapping): number {
  return mapping.sourceLength ?? mapping.length;
}

function commonPrefixLength(
  left: string,
  leftStart: number,
  right: string,
  rightStart: number,
  limit: number
): number {
  let length = 0;
  while (
    length < limit &&
    left[leftStart + length] === right[rightStart + length]
  )
    length++;

  return length;
}
