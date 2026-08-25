import * as fs from 'fs';
import type { Settings } from '../../types/index.js';
import { getRelative } from '../../fs/findFilepath.js';
import {
  resolveMintlifyRefs,
  shouldResolveRefs,
} from '../../utils/resolveMintlifyRefs.js';
import { extractJson } from '../json/extractJson.js';
import { mergeJson } from '../json/mergeJson.js';
import { validateJsonSchema } from '../json/utils.js';
import { extractYaml } from '../yaml/extractYaml.js';
import mergeYaml from '../yaml/mergeYaml.js';
import { validateYamlSchema } from '../yaml/utils.js';
import { SUPPORTED_FILE_EXTENSIONS } from './supportedFiles.js';
import { hasNonIdentityFileFormatTransformForType } from './transformFormat.js';

type SourceSchema = 'json' | 'yaml' | null;

function getSourceSchema(inputPath: string, settings: Settings): SourceSchema {
  if (!settings.options) return null;
  if (
    settings.options.jsonSchema &&
    validateJsonSchema(settings.options, inputPath)
  ) {
    return 'json';
  }
  if (
    settings.options.yamlSchema &&
    validateYamlSchema(settings.options, inputPath)
  ) {
    return 'yaml';
  }
  return null;
}

function mergeWithSchema(
  translatedContent: string,
  locale: string,
  inputPath: string,
  settings: Settings,
  schema: Exclude<SourceSchema, null>,
  sourceContent = getSourceContent(inputPath, settings, schema)
): string {
  if (!sourceContent || !settings.options) return translatedContent;

  if (schema === 'yaml') {
    return mergeYaml(
      sourceContent,
      inputPath,
      settings.options,
      [{ translatedContent, targetLocale: locale }],
      settings.defaultLocale
    )[0];
  }

  return mergeJson(
    sourceContent,
    inputPath,
    settings.options,
    [{ translatedContent, targetLocale: locale }],
    settings.defaultLocale,
    settings.locales
  )[0];
}

function getSourceContent(
  inputPath: string,
  settings: Settings,
  schema: Exclude<SourceSchema, null>
): string {
  const sourceContent = fs.readFileSync(inputPath, 'utf8');
  if (schema === 'yaml' || !shouldResolveRefs(inputPath, settings.options)) {
    return sourceContent;
  }

  try {
    const { resolved } = resolveMintlifyRefs(
      JSON.parse(sourceContent),
      inputPath
    );
    return JSON.stringify(resolved, null, 2);
  } catch {
    return sourceContent;
  }
}

/** Merges translated schema data with its current source file. */
export function mergeWithSource(
  translatedContent: string,
  locale: string,
  inputPath: string,
  settings: Settings
): string {
  if (shouldSkipSourceFormatMerge(inputPath, settings)) {
    return translatedContent;
  }
  const schema = getSourceSchema(inputPath, settings);
  return schema
    ? mergeWithSchema(translatedContent, locale, inputPath, settings, schema)
    : translatedContent;
}

/** Creates source-populated content when a file has schema transformations. */
export function createSourceTemplate(
  locale: string,
  inputPath: string,
  settings: Settings
): string | undefined {
  if (shouldSkipSourceFormatMerge(inputPath, settings)) return undefined;
  const schema = getSourceSchema(inputPath, settings);
  if (!schema || !settings.options) return undefined;

  const sourceContent = getSourceContent(inputPath, settings, schema);
  const extractedSource =
    schema === 'json'
      ? extractJson(
          sourceContent,
          inputPath,
          settings.options,
          settings.defaultLocale,
          settings.defaultLocale
        )
      : extractYaml(sourceContent, inputPath, settings.options);
  if (extractedSource === null) return undefined;
  return mergeWithSchema(
    extractedSource,
    locale,
    inputPath,
    settings,
    schema,
    sourceContent
  );
}

function shouldSkipSourceFormatMerge(
  inputPath: string,
  settings: Settings
): boolean {
  for (const fileType of SUPPORTED_FILE_EXTENSIONS) {
    if (!hasNonIdentityFileFormatTransformForType(settings, fileType)) continue;

    const transformedSourcePaths = settings.files.resolvedPaths[fileType] || [];
    if (
      transformedSourcePaths.some(
        (sourcePath) => getRelative(sourcePath) === inputPath
      )
    ) {
      return true;
    }
  }
  return false;
}
