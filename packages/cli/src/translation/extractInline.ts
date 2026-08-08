import {
  planVueExtraction,
  type InlineExtractionOutput,
  type PrimaryInlineExtractor,
} from '@generaltranslation/vue-extractor/integration';
import { createDiagnosticMessage } from 'generaltranslation/internal';
import type { InlineLibrary } from '../types/libraries.js';
import type { GTParsingFlags, ParsingConfigOptions } from '../types/parsing.js';

export type {
  InlineExtractionOutput,
  PrimaryInlineExtractor,
} from '@generaltranslation/vue-extractor/integration';

const missingPrimaryExtractorError = createDiagnosticMessage({
  source: 'gt',
  severity: 'Error',
  whatHappened: 'No inline extractor was available for this project',
  why: 'The installed Vue extractor did not claim a gt-vue project',
  fix: 'Install compatible versions of gt and @generaltranslation/vue-extractor',
});

/**
 * Gives the package-owned Vue integration the first chance to own extraction.
 *
 * When Vue does not own the request, this function immediately invokes the
 * caller's historical extractor with the original pattern array. The adapter
 * is deliberately synchronous until that invocation so existing return,
 * rejection, and thrown-error behavior remains unchanged.
 */
export function extractInlineFromProject(
  library: InlineLibrary,
  filePatterns: string[] | undefined,
  parsingFlags: GTParsingFlags,
  parsingOptions: ParsingConfigOptions,
  extractPrimary?: PrimaryInlineExtractor
): Promise<InlineExtractionOutput> {
  const projectRoot = process.cwd();
  const plan = planVueExtraction({
    library,
    projectRoot,
    filePatterns,
    includeSourceCodeContext: parsingFlags.includeSourceCodeContext,
    conditionNames: parsingOptions.conditionNames,
    vueCompilerOptions: parsingFlags.vueCompilerOptions,
    viteConfigPath: parsingFlags.viteConfigPath,
  });

  if (!plan.handled) {
    if (!extractPrimary) {
      throw new Error(missingPrimaryExtractorError);
    }
    return extractPrimary(filePatterns);
  }

  return plan.run({ extractPrimary });
}
