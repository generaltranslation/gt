import {
  GenMapping,
  maybeAddSegment,
  setIgnore,
  setSourceContent,
  toEncodedMap,
} from '@jridgewell/gen-mapping';
import {
  TraceMap,
  traceSegment,
  type SourceMapInput,
} from '@jridgewell/trace-mapping';
import type { DecodedSourceMap } from 'magic-string';

/**
 * Composes an edit map (twin → original chunk, from magic-string) with the
 * original chunk's map (original chunk → sources) into twin → sources.
 * Returns the composed map as JSON text.
 *
 * (Implemented on trace-mapping/gen-mapping rather than
 * `@jridgewell/remapping` because remapping's CJS type declarations do not
 * parse under this package's `moduleResolution: node`.)
 */
export function composeSourceMaps(
  edits: DecodedSourceMap,
  original: SourceMapInput,
  file: string
): string {
  const originalMap = new TraceMap(original);
  const composed = new GenMapping({
    file,
    sourceRoot: originalMap.sourceRoot,
  });
  edits.mappings.forEach((segments, line) => {
    for (const segment of segments) {
      if (segment.length === 1) continue;
      const traced = traceSegment(originalMap, segment[2], segment[3]);
      if (!traced || traced.length === 1) continue;
      const source = originalMap.sources[traced[1]] ?? '';
      if (traced.length === 5) {
        maybeAddSegment(
          composed,
          line,
          segment[0],
          source,
          traced[2],
          traced[3],
          originalMap.names[traced[4]]
        );
      } else {
        maybeAddSegment(
          composed,
          line,
          segment[0],
          source,
          traced[2],
          traced[3]
        );
      }
    }
  });
  originalMap.sources.forEach((source, index) => {
    if (source === null) return;
    const content = originalMap.sourcesContent?.[index];
    if (content != null) setSourceContent(composed, source, content);
    if (originalMap.ignoreList?.includes(index)) setIgnore(composed, source);
  });
  return JSON.stringify(toEncodedMap(composed));
}
