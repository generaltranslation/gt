import { detectVueProject } from '@generaltranslation/vue-extractor/detect';
import type { Updates } from '../types/index.js';
import type { GTParsingFlags, ParsingConfigOptions } from '../types/parsing.js';
import {
  isPythonLibrary,
  Libraries,
  type InlineLibrary,
} from '../types/libraries.js';
import { dedupeUpdates } from '../extraction/postProcess.js';
import { createPythonInlineUpdates } from '../python/parse/createPythonInlineUpdates.js';
import { createInlineUpdates } from '../react/parse/createInlineUpdates.js';

type InlineExtractionOutput = {
  updates: Updates;
  errors: string[];
  warnings: string[];
};

/**
 * Preserves the existing primary extractor and appends package-owned Vue work.
 *
 * Pure React, Node, and Python projects call their historical extractor with
 * exactly the same arguments and return its object unchanged. Vue project
 * discovery and extraction remain inside `@generaltranslation/vue-extractor`.
 */
export async function extractInlineFromProject(
  pkg: InlineLibrary,
  validate: boolean,
  filePatterns: string[] | undefined,
  parsingFlags: GTParsingFlags,
  parsingOptions: ParsingConfigOptions
): Promise<InlineExtractionOutput> {
  if (pkg === Libraries.GT_VUE) {
    return extractVueProject(filePatterns, parsingFlags, parsingOptions);
  }

  const includesVue = detectVueProject();
  const primaryPatterns =
    includesVue && filePatterns ? [...filePatterns, '!**/*.vue'] : filePatterns;
  const primary = isPythonLibrary(pkg)
    ? await createPythonInlineUpdates(primaryPatterns)
    : await createInlineUpdates(
        pkg,
        validate,
        primaryPatterns,
        parsingFlags,
        parsingOptions
      );
  if (!includesVue) return primary;

  const vue = await extractVueProject(
    filePatterns,
    parsingFlags,
    parsingOptions
  );
  const updates: Updates = [...primary.updates, ...vue.updates];
  dedupeUpdates(updates);
  return {
    updates,
    errors: [...primary.errors, ...vue.errors],
    warnings: [...new Set([...primary.warnings, ...vue.warnings])],
  };
}

/** Loads the heavy Vue graph only after lightweight ownership detection. */
async function extractVueProject(
  filePatterns: string[] | undefined,
  parsingFlags: GTParsingFlags,
  parsingOptions: ParsingConfigOptions
): Promise<InlineExtractionOutput> {
  const { extractFromVueProject } =
    await import('@generaltranslation/vue-extractor/project');
  const output = await extractFromVueProject({
    filePatterns,
    includeSourceCodeContext: parsingFlags.includeSourceCodeContext,
    conditionNames: parsingOptions.conditionNames,
    vueCompilerOptions: parsingFlags.vueCompilerOptions,
    viteConfigPath: parsingFlags.viteConfigPath,
  });
  return { ...output, updates: output.updates as Updates };
}
