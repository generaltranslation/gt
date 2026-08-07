import type { Updates } from '../types/index.js';
import type { GTParsingFlags, ParsingConfigOptions } from '../types/parsing.js';
import {
  isPythonLibrary,
  Libraries,
  type InlineLibrary,
} from '../types/libraries.js';
import { createPythonInlineUpdates } from '../python/parse/createPythonInlineUpdates.js';
import { createInlineUpdates } from '../react/parse/createInlineUpdates.js';
import type {
  VueProjectExtractionOutput,
  VueProjectInspection,
} from '@generaltranslation/vue-extractor/types';

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

  const inspection = await inspectVueProject();
  const vueSfcExclusions =
    filePatterns && inspection.hasVueScopes
      ? await readVueSfcExclusionPatterns(inspection, filePatterns)
      : [];
  const primaryPatterns =
    filePatterns && vueSfcExclusions.length > 0
      ? [...filePatterns, ...vueSfcExclusions]
      : filePatterns;
  const primary = isPythonLibrary(pkg)
    ? await createPythonInlineUpdates(primaryPatterns)
    : await createInlineUpdates(
        pkg,
        validate,
        primaryPatterns,
        parsingFlags,
        parsingOptions
      );
  if (!inspection.hasVueScopes) return primary;

  const vue = await extractVueProject(
    filePatterns,
    parsingFlags,
    parsingOptions,
    inspection
  );
  const { mergeVueProjectExtraction } =
    await import('@generaltranslation/vue-extractor/project');
  return mergeVueProjectExtraction(primary, vue);
}

/** Loads the heavy Vue graph only after lightweight ownership detection. */
async function extractVueProject(
  filePatterns: string[] | undefined,
  parsingFlags: GTParsingFlags,
  parsingOptions: ParsingConfigOptions,
  inspection?: VueProjectInspection
): Promise<VueProjectExtractionOutput> {
  const { extractFromVueProject } =
    await import('@generaltranslation/vue-extractor/project');
  const output = await extractFromVueProject({
    filePatterns,
    inspection,
    includeSourceCodeContext: parsingFlags.includeSourceCodeContext,
    conditionNames: parsingOptions.conditionNames,
    vueCompilerOptions: parsingFlags.vueCompilerOptions,
    viteConfigPath: parsingFlags.viteConfigPath,
  });
  return output;
}

/** Loads workspace inspection without loading the Vue source parser. */
async function inspectVueProject(): Promise<VueProjectInspection> {
  const { inspectVueProject: inspect } =
    await import('@generaltranslation/vue-extractor/inspect');
  return inspect();
}

/** Lets the package distinguish Vue SFCs from legacy JSX `.vue` modules. */
async function readVueSfcExclusionPatterns(
  inspection: VueProjectInspection,
  filePatterns: readonly string[]
): Promise<string[]> {
  const { readVueSfcExclusionPatterns: readExclusions } =
    await import('@generaltranslation/vue-extractor/inspect');
  return readExclusions(inspection, filePatterns);
}
