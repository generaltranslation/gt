import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../console/logger.js';
import { Settings, JsonSchema, SourceObjectOptions } from '../types/index.js';
import type { RefMap } from './resolveMintlifyRefs.js';
import { validateJsonSchema } from '../formats/json/utils.js';
import { getStoredRefMap, clearStoredRefMap } from '../state/mintlifyRefMap.js';
import { JSONPath } from 'jsonpath-plus';
import { getLocaleProperties } from '@generaltranslation/format';

type JsonContainer = Record<string, unknown> | unknown[];

function isJsonContainer(value: unknown): value is JsonContainer {
  return typeof value === 'object' && value !== null;
}

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

    let fileJson: unknown;
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
  fileJson: unknown,
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
  const navRefEntry = parentPointer ? refMap?.get(parentPointer) : undefined;

  // Get the array from the file
  const arrayContainer = parentPointer
    ? getAtPointer(fileJson, parentPointer)
    : fileJson;
  if (!isJsonContainer(arrayContainer)) return;

  const entries = Array.isArray(arrayContainer)
    ? arrayContainer[Number(arrayKey)]
    : arrayContainer[arrayKey];
  if (!Array.isArray(entries) || entries.length <= 1) return;

  // Determine the default key value (the source entry)
  const defaultKeyValue = getDefaultKeyValue(
    settings.defaultLocale,
    splitConfig.sourceObjectOptions
  );

  const defaultIndex = entries.findIndex((e: unknown) => {
    if (!e || typeof e !== 'object') return false;
    const values = JSONPath({
      json: e,
      path: keyJsonPath,
      resultType: 'value',
      flatten: true,
      wrap: true,
    }) as unknown[];
    return values?.[0] === defaultKeyValue;
  });
  if (defaultIndex < 0) return;

  // Detect whether each language entry is itself a $ref (per-entry refs), as
  // opposed to the case where the *container* of the languages array is a $ref
  // (navRefEntry). With per-entry refs, the languages array still lives in the
  // composite file, but each entry's content lives in a separate ref file.
  const defaultEntryPointer = `${jsonPointer}/${defaultIndex}`;
  const defaultEntryRef = refMap?.get(defaultEntryPointer);

  // arrayHostDir: directory of the file that physically holds the languages
  //   array — entry $refs in the array are written relative to this.
  // entryBaseDir: directory under which per-entry ref files (and their nested
  //   refs) are written — mirrors the source entry file's location.
  // These coincide for the container-ref and fully-inline cases; they differ
  // only for per-entry refs, where the array lives in the composite file but
  // the entry files live next to the (default) entry's source ref.
  const arrayHostDir = navRefEntry
    ? path.dirname(navRefEntry.sourceFile)
    : docsDir;
  const entryBaseDir = navRefEntry
    ? path.dirname(navRefEntry.sourceFile)
    : defaultEntryRef
      ? path.dirname(defaultEntryRef.sourceFile)
      : docsDir;
  const navFileName = navRefEntry
    ? path.basename(navRefEntry.sourceFile)
    : defaultEntryRef
      ? path.basename(defaultEntryRef.sourceFile)
      : path.basename(compositeFilePath);

  // Restore $ref structure if the source used $ref
  if (refMap && refMap.size > 0) {
    const internalRefs = collectInternalRefs(refMap, defaultEntryPointer);

    if (internalRefs.length > 0) {
      // When the default entry is itself a $ref, it is restored to that single
      // $ref below and its source file is left untouched, so we must not restore
      // its nested refs in place. Otherwise (inlined default entry) we do.
      if (!defaultEntryRef) {
        const defaultEntry = entries[defaultIndex];
        for (const ref of internalRefs) {
          setAtPointer(defaultEntry, ref.relativePointer, {
            ...ref.siblings,
            $ref: ref.refPath,
          });
        }
      }

      // For each non-default entry, write localized copies of the nested ref
      // files (mirroring the source topology under the locale dir) and replace
      // the inlined subtrees with their $refs.
      for (let i = 0; i < entries.length; i++) {
        if (i === defaultIndex) continue;
        const entry = entries[i];

        const entryKeyValues = JSONPath({
          json: entry,
          path: keyJsonPath,
          resultType: 'value',
          flatten: true,
          wrap: true,
        }) as unknown[];
        if (entryKeyValues?.[0] === defaultKeyValue) continue;
        const keyValue =
          typeof entryKeyValues?.[0] === 'string'
            ? entryKeyValues[0]
            : 'unknown';

        for (const ref of internalRefs) {
          const subtree = getAtPointer(entry, ref.relativePointer);
          if (subtree === undefined) continue;

          const originalAbsPath = path.resolve(ref.resolvedDir, ref.refPath);
          const relToBaseDir = path.relative(entryBaseDir, originalAbsPath);
          const localeRelPath = path.join(keyValue, relToBaseDir);
          const outputPath = path.resolve(entryBaseDir, localeRelPath);

          const { siblings, content } = extractRefSiblings(subtree, ref);
          writeJsonFile(outputPath, content);

          setAtPointer(entry, ref.relativePointer, {
            ...siblings,
            $ref: ref.refPath,
          });
        }
      }

      logger.info(`Restored $ref structure for default entry`);
    }
  }

  // Get the actual property name from the key JSONPath (e.g., "$.language" → "language")
  const keyPropertyName = keyJsonPath.replace(/^\$\.?/, '');

  // Extract each non-default entry into its own ref file
  for (let i = 0; i < entries.length; i++) {
    if (i === defaultIndex) continue;
    const entry = entries[i];
    if (!entry || typeof entry !== 'object') continue;

    const keyValues = JSONPath({
      json: entry,
      path: keyJsonPath,
      resultType: 'value',
      flatten: true,
      wrap: true,
    }) as unknown[];
    const keyValue = keyValues?.[0];
    if (typeof keyValue !== 'string' || keyValue === defaultKeyValue) continue;

    if (!isJsonContainer(entry) || Array.isArray(entry)) continue;
    const { [keyPropertyName]: _, ...contentWithoutKey } = entry;

    // If the entry still carries a top-level $ref, it was never inlined this
    // run (e.g. the merge step didn't process this file). There is no content
    // to extract — writing would produce a self-referential stub that
    // overwrites or shadows the real ref file. Leave the entry untouched.
    if (typeof contentWithoutKey.$ref === 'string') {
      continue;
    }

    const entryFilePath = path.resolve(
      entryBaseDir,
      path.join(keyValue, navFileName)
    );
    writeJsonFile(entryFilePath, contentWithoutKey);

    entries[i] = {
      [keyPropertyName]: keyValue,
      $ref: toRelativeRefPath(arrayHostDir, entryFilePath),
    };
  }

  // When the default entry was itself a $ref, restore it to that single $ref;
  // its source file is the untouched English source already on disk.
  if (defaultEntryRef) {
    entries[defaultIndex] = {
      ...defaultEntryRef.siblings,
      $ref: defaultEntryRef.refPath,
    };
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
    (localeProperties as Record<string, string | undefined>)[localeProperty] ||
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
  fileJson: unknown,
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

    // If the value here is still an unresolved $ref placeholder, the referenced
    // file was never inlined at this pointer (e.g. mergeJson leaves non-composite
    // refs like `redirects` collapsed). Writing it back would overwrite the
    // source file with a self-referential stub and destroy its real contents —
    // the source already holds the correct data, so leave it untouched.
    if (
      isJsonContainer(subtree) &&
      !Array.isArray(subtree) &&
      typeof (subtree as Record<string, unknown>).$ref === 'string'
    ) {
      continue;
    }

    const { siblings, content } = extractRefSiblings(subtree, entry);
    writeJsonFile(entry.sourceFile, content);
    setAtPointer(fileJson, pointer, { ...siblings, $ref: entry.refPath });
  }
}

/**
 * Mintlify merges keys placed next to a `$ref` on top of the referenced file's
 * content, so ref resolution folds them into the inlined subtree. When
 * restoring the `$ref`, lift those keys back out: they stay next to the `$ref`
 * (with their possibly translated values) and are dropped from the content
 * written to the ref file — unless the referenced file also defined the key,
 * in which case it stays in both, preserving the source topology and
 * Mintlify's sibling-precedence semantics.
 */
function extractRefSiblings(
  subtree: unknown,
  ref: {
    siblings?: Record<string, unknown>;
    originalContent?: unknown;
    refPath?: string;
  }
): { siblings: Record<string, unknown>; content: unknown } {
  const originalSiblings = ref.siblings ?? {};
  const siblingKeys = Object.keys(originalSiblings);
  if (siblingKeys.length === 0) {
    return { siblings: {}, content: subtree };
  }
  if (!isJsonContainer(subtree) || Array.isArray(subtree)) {
    // Non-object content cannot carry merged siblings; restore the originals
    return { siblings: { ...originalSiblings }, content: subtree };
  }
  const content = { ...subtree };
  const siblings: Record<string, unknown> = {};
  const original = ref.originalContent;
  const originalContentHasKey = (key: string) =>
    isJsonContainer(original) && !Array.isArray(original) && key in original;
  for (const key of siblingKeys) {
    if (key in content) {
      siblings[key] = content[key];
      if (!originalContentHasKey(key)) {
        delete content[key];
      }
    } else {
      // Object resolutions always merge siblings into the subtree, so this
      // only fires if that invariant breaks upstream. Restoring the source
      // value keeps the output schema-valid, but it skips translation — warn
      // so the regression is visible.
      logger.warn(
        `Sibling key "${key}" missing from translated content for $ref ${ref.refPath ?? '(unknown)'}; restoring source value`
      );
      siblings[key] = originalSiblings[key];
    }
  }
  return { siblings, content };
}

/**
 * Collect refMap entries that describe an entry's internal $ref chain.
 * Sorted deepest-first so nested content is extracted before parents.
 */
function collectInternalRefs(
  refMap: RefMap,
  entryPointerPrefix: string
): {
  relativePointer: string;
  refPath: string;
  resolvedDir: string;
  siblings?: Record<string, unknown>;
  originalContent?: unknown;
}[] {
  const refs: {
    relativePointer: string;
    refPath: string;
    resolvedDir: string;
    siblings?: Record<string, unknown>;
    originalContent?: unknown;
  }[] = [];

  for (const [pointer, entry] of refMap.entries()) {
    if (!pointer.startsWith(entryPointerPrefix + '/')) continue;
    refs.push({
      relativePointer: pointer.slice(entryPointerPrefix.length),
      refPath: entry.refPath,
      resolvedDir: entry.containingDir,
      siblings: entry.siblings,
      originalContent: entry.originalContent,
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

/**
 * Build a relative $ref path (POSIX separators, "./"-prefixed when it isn't
 * already a relative or absolute path) from the directory that hosts the
 * languages array to a written entry file.
 */
function toRelativeRefPath(fromDir: string, toPath: string): string {
  const rel = path.relative(fromDir, toPath).split(path.sep).join('/');
  return rel.startsWith('.') || rel.startsWith('/') ? rel : `./${rel}`;
}

function getAtPointer(obj: unknown, pointer: string): unknown {
  if (!pointer || pointer === '/') return obj;
  const parts = pointer.split('/').filter(Boolean);
  let current = obj;
  for (const part of parts) {
    if (!isJsonContainer(current)) return undefined;
    const index = /^\d+$/.test(part) ? parseInt(part) : part;
    current = Array.isArray(current)
      ? current[index as number]
      : current[index];
  }
  return current;
}

function setAtPointer(obj: unknown, pointer: string, value: unknown): void {
  if (!pointer || pointer === '/') return;
  const parts = pointer.split('/').filter(Boolean);
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!isJsonContainer(current)) return;
    const index = /^\d+$/.test(parts[i]) ? parseInt(parts[i]) : parts[i];
    const next = Array.isArray(current)
      ? current[index as number]
      : current[index];
    if (next === undefined) return;
    current = next;
  }
  const lastPart = parts[parts.length - 1];
  const lastIndex = /^\d+$/.test(lastPart) ? parseInt(lastPart) : lastPart;
  if (!isJsonContainer(current)) return;
  if (Array.isArray(current)) {
    current[lastIndex as number] = value;
  } else {
    current[lastIndex] = value;
  }
}
