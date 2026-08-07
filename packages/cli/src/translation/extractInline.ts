import path from 'node:path';
import fg from 'fast-glob';
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
  const cwd = process.cwd();
  if (pkg === Libraries.GT_VUE) {
    return extractVueProject(filePatterns, parsingFlags, parsingOptions, cwd);
  }

  const inspectionPromise = inspectVueProject(cwd);
  const extractPrimary = (primaryPatterns: string[] | undefined) =>
    isPythonLibrary(pkg)
      ? createPythonInlineUpdates(primaryPatterns)
      : createInlineUpdates(
          pkg,
          validate,
          primaryPatterns,
          parsingFlags,
          parsingOptions
        );

  let inspection: VueProjectInspection;
  let primary: InlineExtractionOutput;
  let vuePatterns = filePatterns;
  if (filePatterns) {
    inspection = await inspectionPromise;
    const partition = inspection.hasVueScopes
      ? await partitionVueSourcePatterns(inspection, filePatterns)
      : { primaryExclusionPatterns: [], vueExclusionPatterns: [] };
    const stablePrimaryPatterns =
      process.cwd() === cwd
        ? filePatterns
        : anchorFilePatterns(cwd, filePatterns);
    const primaryPatterns =
      partition.primaryExclusionPatterns.length > 0
        ? [...stablePrimaryPatterns, ...partition.primaryExclusionPatterns]
        : stablePrimaryPatterns;
    vuePatterns =
      partition.vueExclusionPatterns.length > 0
        ? [...filePatterns, ...partition.vueExclusionPatterns]
        : filePatterns;
    primary = await extractPrimary(primaryPatterns);
  } else {
    [inspection, primary] = await Promise.all([
      inspectionPromise,
      extractPrimary(filePatterns),
    ]);
  }
  if (!inspection.hasVueScopes) return primary;

  const vue = await extractVueProject(
    vuePatterns,
    parsingFlags,
    parsingOptions,
    cwd,
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
  cwd: string,
  inspection?: VueProjectInspection
): Promise<VueProjectExtractionOutput> {
  const { extractFromVueProject } =
    await import('@generaltranslation/vue-extractor/project');
  const output = await extractFromVueProject({
    cwd,
    filePatterns,
    inspection,
    includeSourceCodeContext: parsingFlags.includeSourceCodeContext,
    conditionNames: parsingOptions.conditionNames,
    vueCompilerOptions: parsingFlags.vueCompilerOptions,
    viteConfigPath: parsingFlags.viteConfigPath,
  });
  return output;
}

/** Loads workspace inspection without loading the Vue compiler or analyzer. */
async function inspectVueProject(cwd: string): Promise<VueProjectInspection> {
  const { inspectVueProjectAsync: inspect } =
    await import('@generaltranslation/vue-extractor/inspect');
  return inspect(cwd);
}

/** Lets the package partition Vue SFCs from legacy JSX `.vue` modules. */
async function partitionVueSourcePatterns(
  inspection: VueProjectInspection,
  filePatterns: readonly string[]
): Promise<{
  primaryExclusionPatterns: string[];
  vueExclusionPatterns: string[];
}> {
  const { partitionVueSourcePatterns: partition } =
    await import('@generaltranslation/vue-extractor/inspect');
  return partition(inspection, filePatterns);
}

/**
 * Preserves explicit file selection when another task changes the process cwd
 * while Vue workspace inspection is pending.
 *
 * The historical extractor still owns matching and parsing. Only its relative
 * glob base is made explicit, including negative patterns; normal calls whose
 * cwd has not changed continue receiving their original patterns byte-for-byte.
 */
function anchorFilePatterns(cwd: string, filePatterns: readonly string[]) {
  const rootPattern = fg.convertPathToPattern(cwd).replace(/\/$/, '');
  return filePatterns.map((pattern) => {
    const negative = pattern.startsWith('!') && pattern[1] !== '(';
    const positivePattern = negative ? pattern.slice(1) : pattern;
    if (path.isAbsolute(positivePattern)) return pattern;
    const relativePattern = positivePattern.startsWith('./')
      ? positivePattern.slice(2)
      : positivePattern;
    const anchoredPattern = `${rootPattern}/${relativePattern}`;
    return negative ? `!${anchoredPattern}` : anchoredPattern;
  });
}
