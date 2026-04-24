import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../console/logger.js';
import { Settings, JsonSchema, SourceObjectOptions } from '../types/index.js';
import type { RefMap } from './resolveMintlifyRefs.js';
import { validateJsonSchema } from '../formats/json/utils.js';
import { getStoredRefMap, clearStoredRefMap } from '../state/mintlifyRefMap.js';
import { JSONPath } from 'jsonpath-plus';
import { getLocaleProperties } from 'generaltranslation';

/**
 * Post-processing step for composite JSON files with splitEntries enabled.
 *
 * After mergeJson writes a fully-inlined composite file, this function:
 * 1. Restores the original $ref structure (if the source used $ref / resolveRefs)
 * 2. Extracts non-default keyed entries into their own ref files
 *    to keep the source file compact
 *
 * Driven entirely by the jsonSchema config — reads the composite path,
 * key field, and splitEntries flag from the schema.
 */
export async function splitMintlifyLanguageRefs(
  settings: Settings
): Promise<void> {
  const refMap = getStoredRefMap();

  try {
    const resolvedJsonPaths = settings.files?.resolvedPaths?.json;
    if (!resolvedJsonPaths) return;

    // Find a JSON file that has splitEntries enabled or resolveRefs
    const targetFile = findTargetFile(resolvedJsonPaths, settings);
    if (!targetFile) return;

    const { filePath: compositeFilePath, splitConfig } = targetFile;
    if (!fs.existsSync(compositeFilePath)) return;

    let fileJson: any;
    try {
      fileJson = JSON.parse(fs.readFileSync(compositeFilePath, 'utf-8'));
    } catch {
      return;
    }

    const docsDir = path.dirname(compositeFilePath);

    // If splitEntries is configured, process it
    if (splitConfig) {
      processSplitEntries(
        fileJson,
        compositeFilePath,
        docsDir,
        splitConfig,
        settings,
        refMap
      );
    }

    // Restore top-level refs if any exist
    if (refMap && refMap.size > 0) {
      restoreTopLevelRefs(fileJson, refMap, splitConfig);
    }

    // Always write the composite file back — splitEntries modified the
    // languages array, and restoreTopLevelRefs may not have written it
    // (e.g., when all refs are inside language entries, not top-level)
    fs.writeFileSync(
      compositeFilePath,
      JSON.stringify(fileJson, null, 2),
      'utf-8'
    );
  } finally {
    clearStoredRefMap();
  }
}

type SplitConfig = {
  compositePath: string;
  jsonPointer: string;
  keyField: string;
  keyJsonPath: string;
  sourceObjectOptions: SourceObjectOptions;
};

/**
 * Find the target file and extract split configuration from the schema.
 */
function findTargetFile(
  resolvedPaths: string[],
  settings: Settings
): {
  filePath: string;
  schema: JsonSchema;
  splitConfig: SplitConfig | null;
} | null {
  if (!settings.options?.jsonSchema) return null;

  for (const filePath of resolvedPaths) {
    const schema = validateJsonSchema(settings.options, filePath);
    if (!schema) continue;

    const hasSplitEntries = schema.composite
      ? Object.entries(schema.composite).some(([, opts]) => opts.splitEntries)
      : false;

    const hasResolveRefs = schema.resolveRefs;

    if (!hasSplitEntries && !hasResolveRefs) continue;

    // Extract split config if available
    let splitConfig: SplitConfig | null = null;
    if (schema.composite) {
      for (const [compositePath, opts] of Object.entries(schema.composite)) {
        if (opts.splitEntries && opts.type === 'array' && opts.key) {
          splitConfig = {
            compositePath,
            jsonPointer: jsonPathToPointer(compositePath),
            keyField: opts.key,
            keyJsonPath: opts.key,
            sourceObjectOptions: opts,
          };
          break;
        }
      }
    }

    return { filePath, schema, splitConfig };
  }

  return null;
}

/**
 * Process splitEntries: extract non-default keyed entries into ref files.
 */
function processSplitEntries(
  fileJson: any,
  compositeFilePath: string,
  docsDir: string,
  splitConfig: SplitConfig,
  settings: Settings,
  refMap: RefMap | null
): void {
  const { jsonPointer, keyJsonPath } = splitConfig;

  // Find the composite array — may be behind a $ref
  const parentPointer = jsonPointer.split('/').slice(0, -1).join('/') || '';
  const arrayKey = jsonPointer.split('/').pop() || '';
  const navRefEntry = refMap?.get(parentPointer || (undefined as any));

  // Get the array from the file
  const arrayContainer = parentPointer
    ? getAtPointer(fileJson, parentPointer)
    : fileJson;
  if (!arrayContainer) return;

  const entries: any[] = arrayContainer[arrayKey];
  if (!Array.isArray(entries) || entries.length <= 1) return;

  // Determine the default key value (the source entry)
  const defaultKeyValue = getDefaultKeyValue(
    settings.defaultLocale,
    splitConfig.sourceObjectOptions
  );

  const defaultIndex = entries.findIndex((e: any) => {
    if (!e || typeof e !== 'object') return false;
    const values = JSONPath({
      json: e,
      path: keyJsonPath,
      resultType: 'value',
      flatten: true,
      wrap: true,
    });
    return values?.[0] === defaultKeyValue;
  });
  if (defaultIndex < 0) return;

  // Determine where the composite array actually lives on disk
  const navDir = navRefEntry ? path.dirname(navRefEntry.sourceFile) : docsDir;

  // Restore $ref structure if the source used $ref
  if (refMap && refMap.size > 0) {
    const defaultPointerPrefix = `${jsonPointer}/${defaultIndex}`;
    const internalRefs = collectInternalRefs(refMap, defaultPointerPrefix);

    if (internalRefs.length > 0) {
      const defaultEntry = entries[defaultIndex];
      for (const ref of internalRefs) {
        setAtPointer(defaultEntry, ref.relativePointer, {
          $ref: ref.refPath,
        });
      }

      for (const entry of entries) {
        const entryKeyValues = JSONPath({
          json: entry,
          path: keyJsonPath,
          resultType: 'value',
          flatten: true,
          wrap: true,
        });
        if (entryKeyValues?.[0] === defaultKeyValue) continue;

        for (const ref of internalRefs) {
          const subtree = getAtPointer(entry, ref.relativePointer);
          if (subtree === undefined) continue;

          const originalAbsPath = path.resolve(ref.resolvedDir, ref.refPath);
          const relToNavDir = path.relative(navDir, originalAbsPath);
          const keyValue = entryKeyValues?.[0] || 'unknown';
          const localeRelPath = path.join(keyValue, relToNavDir);
          const outputPath = path.resolve(navDir, localeRelPath);
          writeJsonFile(outputPath, subtree);

          setAtPointer(entry, ref.relativePointer, { $ref: ref.refPath });
        }
      }

      logger.info(`Restored $ref structure for default entry`);
    }
  }

  // Extract each non-default entry into its own ref file
  const navFileName = navRefEntry
    ? path.basename(navRefEntry.sourceFile)
    : path.basename(compositeFilePath);

  // Get the actual property name from the key JSONPath (e.g., "$.language" → "language")
  const keyPropertyName = keyJsonPath.replace(/^\$\.?/, '');

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry || typeof entry !== 'object') continue;

    const keyValues = JSONPath({
      json: entry,
      path: keyJsonPath,
      resultType: 'value',
      flatten: true,
      wrap: true,
    });
    const keyValue = keyValues?.[0];
    if (!keyValue || keyValue === defaultKeyValue) continue;

    const { [keyPropertyName]: _, ...contentWithoutKey } = entry;
    const entryFileName = `${keyValue}/${navFileName}`;
    const entryFilePath = path.resolve(navDir, entryFileName);
    writeJsonFile(entryFilePath, contentWithoutKey);

    entries[i] = { [keyPropertyName]: keyValue, $ref: `./${entryFileName}` };
  }

  logger.info(`Split keyed entries into ref files`);
}

/**
 * Get the identifying key value for the default locale.
 */
function getDefaultKeyValue(
  defaultLocale: string,
  sourceObjectOptions: SourceObjectOptions
): string {
  const localeProperty = sourceObjectOptions.localeProperty || 'code';
  const localeProperties = getLocaleProperties(defaultLocale);
  return (
    (localeProperties as any)[localeProperty] ||
    localeProperties.code ||
    defaultLocale
  );
}

/**
 * Convert a JSONPath like "$.navigation.languages" to a JSON pointer like "/navigation/languages".
 */
function jsonPathToPointer(jsonPath: string): string {
  return jsonPath
    .replace(/^\$\.?/, '')
    .split('.')
    .filter(Boolean)
    .map((segment) => `/${segment}`)
    .join('');
}

/**
 * Restore top-level $ref pointers in the composite file.
 * Sorted deepest-first so nested refs are written before parents.
 */
function restoreTopLevelRefs(
  fileJson: any,
  refMap: RefMap,
  splitConfig: SplitConfig | null
): void {
  // Build a regex to exclude entries inside the composite array
  const arrayPointerPattern = splitConfig
    ? new RegExp(
        `^${splitConfig.jsonPointer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\/\\d+`
      )
    : null;

  const entries = [...refMap.entries()]
    .filter(
      ([pointer]) => !arrayPointerPattern || !arrayPointerPattern.test(pointer)
    )
    .sort(([a], [b]) => b.length - a.length);

  for (const [pointer, entry] of entries) {
    const subtree = getAtPointer(fileJson, pointer);
    if (subtree === undefined) continue;

    writeJsonFile(entry.sourceFile, subtree);
    setAtPointer(fileJson, pointer, { $ref: entry.refPath });
  }
}

/**
 * Collect refMap entries that describe an entry's internal $ref chain.
 * Sorted deepest-first so nested content is extracted before parents.
 */
function collectInternalRefs(
  refMap: RefMap,
  entryPointerPrefix: string
): { relativePointer: string; refPath: string; resolvedDir: string }[] {
  const refs: {
    relativePointer: string;
    refPath: string;
    resolvedDir: string;
  }[] = [];

  for (const [pointer, entry] of refMap.entries()) {
    if (!pointer.startsWith(entryPointerPrefix + '/')) continue;
    refs.push({
      relativePointer: pointer.slice(entryPointerPrefix.length),
      refPath: entry.refPath,
      resolvedDir: entry.containingDir,
    });
  }

  refs.sort((a, b) => b.relativePointer.length - a.relativePointer.length);
  return refs;
}

function writeJsonFile(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function getAtPointer(obj: any, pointer: string): any {
  if (!pointer || pointer === '/') return obj;
  const parts = pointer.split('/').filter(Boolean);
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    const index = /^\d+$/.test(part) ? parseInt(part) : part;
    current = current[index];
  }
  return current;
}

function setAtPointer(obj: any, pointer: string, value: any): void {
  if (!pointer || pointer === '/') return;
  const parts = pointer.split('/').filter(Boolean);
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const index = /^\d+$/.test(parts[i]) ? parseInt(parts[i]) : parts[i];
    if (current[index] === undefined) return;
    current = current[index];
  }
  const lastPart = parts[parts.length - 1];
  const lastIndex = /^\d+$/.test(lastPart) ? parseInt(lastPart) : lastPart;
  current[lastIndex] = value;
}
