import type { ExtractionResult } from './types.js';
import { getParser } from './parser.js';
import { extractImports } from './extractImports.js';
import { extractCalls } from './extractCalls.js';

export type { ExtractionResult, ExtractionMetadata } from './types.js';
export type { ImportAlias } from './extractImports.js';
export {
  PYTHON_GT_PACKAGES,
  PYTHON_GT_DEPENDENCIES,
  PYTHON_T_FUNCTION,
  PYTHON_MSG_FUNCTION,
  PYTHON_DERIVE,
  PYTHON_DECLARE_STATIC,
  PYTHON_DECLARE_VAR,
  PYTHON_TRANSLATION_FUNCTIONS,
  PYTHON_METADATA_KWARGS,
} from './constants.js';

export async function extractFromPythonSource(
  sourceCode: string,
  filePath: string
): Promise<{
  results: ExtractionResult[];
  errors: string[];
  warnings: string[];
}> {
  const parser = await getParser();
  const tree = parser.parse(sourceCode);
  if (!tree) {
    return {
      results: [],
      errors: [`Failed to parse ${filePath}`],
      warnings: [],
    };
  }

  // Step 1: Extract GT imports
  const imports = extractImports(tree.rootNode);
  if (imports.length === 0) {
    return { results: [], errors: [], warnings: [] };
  }

  // Step 2: Extract translation calls
  const { calls, errors, warnings } = await extractCalls(
    tree.rootNode,
    imports,
    filePath
  );

  // Step 3: Map to ExtractionResult
  const results: ExtractionResult[] = calls.map((call) => ({
    dataFormat: 'ICU' as const,
    source: call.source,
    metadata: {
      ...(call.id && { id: call.id }),
      ...(call.context && { context: call.context }),
      ...(call.maxChars != null && { maxChars: call.maxChars }),
      ...(call.staticId && { staticId: call.staticId }),
      filePaths: [filePath],
    },
  }));

  return {
    results,
    errors: prefixErrors(errors, filePath),
    warnings: prefixErrors(warnings, filePath),
  };
}

function prefixErrors(messages: string[], filePath: string): string[] {
  return messages.map((msg) => `${filePath}: ${msg}`);
}
