import pathModule from 'node:path';
import type { ParsingConfig } from '../types.js';
import { extractSourceCode } from '../../extractSourceCode.js';
import type { SourceCode } from '../../extractSourceCode.js';
import { SURROUNDING_LINE_COUNT } from '../../../../../utils/constants.js';

/** File path and, when enabled, the surrounding source code of a message. */
export function extractStringEntryMetadata({
  config,
  nodeLoc,
}: {
  config: ParsingConfig;
  nodeLoc?: {
    start?: { line: number } | null;
    end?: { line: number } | null;
  } | null;
}): {
  filePaths?: string[];
  sourceCode?: Record<string, SourceCode[]>;
} {
  const relativeFilepath = pathModule.relative(process.cwd(), config.file);

  let sourceCode: Record<string, SourceCode[]> | undefined;
  if (
    config.includeSourceCodeContext &&
    nodeLoc?.start?.line &&
    nodeLoc?.end?.line
  ) {
    const entry = extractSourceCode(
      config.file,
      nodeLoc.start.line,
      nodeLoc.end.line,
      SURROUNDING_LINE_COUNT
    );
    if (entry && relativeFilepath) {
      sourceCode = { [relativeFilepath]: [entry] };
    }
  }

  return {
    filePaths: relativeFilepath ? [relativeFilepath] : undefined,
    ...(sourceCode && { sourceCode }),
  };
}
