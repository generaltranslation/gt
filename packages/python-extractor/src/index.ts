import type { ExtractionResult } from './types.js';

export type { ExtractionResult, ExtractionMetadata } from './types.js';
export {
  PYTHON_GT_PACKAGES,
  PYTHON_GT_DEPENDENCIES,
  PYTHON_T_FUNCTION,
  PYTHON_METADATA_KWARGS,
} from './constants.js';

export function extractFromPythonSource(
  sourceCode: string,
  filePath: string
): { results: ExtractionResult[]; errors: string[]; warnings: string[] } {
  throw new Error('Not implemented: Python extraction is under development');
}
