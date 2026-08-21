import {
  planVueExtraction,
  type InlineExtractionOutput,
  type PrimaryInlineExtractor,
} from '@generaltranslation/vue-extractor/integration';
import { createDiagnosticMessage } from 'generaltranslation/internal';
import type { InlineLibrary } from '../types/libraries.js';
import type { GTParsingFlags, ParsingConfigOptions } from '../types/parsing.js';

export type { PrimaryInlineExtractor } from '@generaltranslation/vue-extractor/integration';

const missingVueExtractorDiagnostic = createDiagnosticMessage({
  source: 'gt',
  severity: 'Error',
  whatHappened: 'The gt-vue extractor did not claim this project',
  fix: 'Install compatible versions of gt and @generaltranslation/vue-extractor',
});

/**
 * Adds package-owned Vue extraction around the existing inline extractor.
 *
 * Non-Vue projects immediately call the historical extractor with the same
 * arguments. The standalone Vue package owns activation, source partitioning,
 * compiler resolution, extraction, and cross-framework result merging.
 */
export function extractInlineFromProject(
  library: InlineLibrary,
  filePatterns: string[] | undefined,
  parsingFlags: GTParsingFlags,
  parsingOptions: ParsingConfigOptions,
  extractPrimary?: PrimaryInlineExtractor,
  tsconfigPath?: string
): Promise<InlineExtractionOutput> {
  const plan = planVueExtraction({
    library,
    projectRoot: process.cwd(),
    filePatterns,
    includeSourceCodeContext: parsingFlags.includeSourceCodeContext,
    conditionNames: parsingOptions.conditionNames,
    vueCompilerOptions: parsingFlags.vueCompilerOptions,
    viteConfigPath: parsingFlags.viteConfigPath,
    tsconfigPath,
  });

  if (!plan.handled) {
    if (!extractPrimary) {
      throw new Error(missingVueExtractorDiagnostic);
    }
    return extractPrimary(filePatterns);
  }

  return plan.run({ extractPrimary });
}
