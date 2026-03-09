import type { ExtractionResult } from '@generaltranslation/python-extractor';
import type { Updates } from '../types/index.js';

/**
 * Maps ExtractionResult[] to Updates[] format used by the CLI pipeline
 */
export function mapExtractionResultsToUpdates(
  results: ExtractionResult[]
): Updates {
  return results.map((result) => ({
    dataFormat: result.dataFormat,
    source: result.source,
    metadata: {
      ...(result.metadata.id && { id: result.metadata.id }),
      ...(result.metadata.context && { context: result.metadata.context }),
      ...(result.metadata.maxChars != null && {
        maxChars: result.metadata.maxChars,
      }),
      ...(result.metadata.filePaths && {
        filePaths: result.metadata.filePaths,
      }),
      ...(result.metadata.staticId && { staticId: result.metadata.staticId }),
    },
  }));
}
