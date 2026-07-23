import fs from 'node:fs';
import path from 'node:path';
import type { FileToUpload } from 'generaltranslation/types';
import type { FileMapping } from '../../types/files.js';
import type { EntryMap } from '../../fs/config/downloadedVersions.js';
import { TEMPLATE_FILE_NAME } from '../../utils/constants.js';
import {
  flattenJsonWithStringFilter,
  flattenStringLeaves,
} from '../../formats/json/flattenJson.js';
import { compareIcuMessages } from '../../formats/icu/compareMessages.js';
import {
  collapseI18nextPlurals,
  diffKeyedCatalog,
  type CatalogDiff,
} from './catalogDiff.js';

export type StatusUnitRef = {
  /** Translated file the unit belongs to (relative path) */
  fileName: string;
  /** Catalog key or JSON pointer, for key-level units */
  key?: string;
};

export type StatusIssue = StatusUnitRef & { message: string };

export type LocaleStatus = {
  locale: string;
  /** Translatable units in the current source (keys for catalogs, files otherwise) */
  total: number;
  /** Units with a local translation */
  translated: number;
  missing: StatusUnitRef[];
  /** Translations whose source entry changed or no longer exists */
  stale: StatusUnitRef[];
  /** Files whose per-locale coverage cannot be measured locally */
  unmeasured: StatusUnitRef[];
  /** ICU validation failures in translated catalogs */
  errors: StatusIssue[];
};

export type JsonSchemaResolution =
  | { kind: 'none' }
  | { kind: 'include'; include: string[] }
  | { kind: 'composite' };

export type ComputeStatusInput = {
  /** Current source of truth, as aggregated by collectFiles */
  sourceFiles: FileToUpload[];
  /** locale -> source relative path -> translated relative path */
  fileMapping: FileMapping;
  /** gt-lock.json entries, keyed by fileId */
  lockEntries: EntryMap;
  /** Target locales to report on */
  locales: string[];
  cwd: string;
  /** Resolves the configured JSON schema handling for a source file */
  resolveJsonSchema: (absoluteFilePath: string) => JsonSchemaResolution;
};

type JsonReadResult =
  | { state: 'ok'; value: unknown }
  | { state: 'absent' }
  | { state: 'invalid' };

function readJsonFile(absolutePath: string): JsonReadResult {
  if (!fs.existsSync(absolutePath)) return { state: 'absent' };
  try {
    return {
      state: 'ok',
      value: JSON.parse(fs.readFileSync(absolutePath, 'utf8')),
    };
  } catch {
    return { state: 'invalid' };
  }
}

function isLockStale(
  lockEntries: EntryMap,
  file: FileToUpload,
  locale: string
): boolean {
  const entry = lockEntries.get(file.fileId);
  return Boolean(
    entry && entry.translations?.[locale] && entry.versionId !== file.versionId
  );
}

/** Reads a per-key dataFormat out of untyped GT template metadata */
function entryDataFormat(
  metadata: FileToUpload['formatMetadata'],
  key: string
): string | undefined {
  const entry = (metadata as Record<string, unknown> | undefined)?.[key];
  if (entry && typeof entry === 'object' && 'dataFormat' in entry) {
    const dataFormat = (entry as { dataFormat?: unknown }).dataFormat;
    return typeof dataFormat === 'string' ? dataFormat : undefined;
  }
  return undefined;
}

/**
 * Computes per-locale translation status from the current local source of
 * truth: the aggregated source files (collectFiles), the configured output
 * mapping (createFileMapping), the downloaded-versions lockfile, and the
 * translated files on disk. Performs no network requests.
 */
export function computeStatus(input: ComputeStatusInput): LocaleStatus[] {
  return input.locales.map((locale) => computeLocaleStatus(input, locale));
}

function computeLocaleStatus(
  input: ComputeStatusInput,
  locale: string
): LocaleStatus {
  const { sourceFiles, fileMapping, lockEntries, cwd, resolveJsonSchema } =
    input;
  const mapping = fileMapping[locale] ?? {};
  const row: LocaleStatus = {
    locale,
    total: 0,
    translated: 0,
    missing: [],
    stale: [],
    unmeasured: [],
    errors: [],
  };

  for (const file of sourceFiles) {
    const translatedRel = mapping[file.fileName];
    // No local output configured for this locale — nothing to measure
    if (!translatedRel) continue;
    const translatedAbs = path.resolve(cwd, translatedRel);

    if (file.fileName === TEMPLATE_FILE_NAME) {
      diffGtCatalog(row, file, translatedRel, translatedAbs);
      continue;
    }

    if (file.fileFormat === 'JSON') {
      const schema = resolveJsonSchema(path.resolve(cwd, file.fileName));
      if (schema.kind === 'composite') {
        // Composite files keep every locale inside one file, so their
        // mapped output existing proves nothing about this locale
        row.unmeasured.push({ fileName: file.fileName });
        continue;
      }
      const lockStale =
        fs.existsSync(translatedAbs) && isLockStale(lockEntries, file, locale);
      diffJsonCatalog(row, file, translatedRel, translatedAbs, schema, {
        // A lock-stale file is reported once at file level; per-key
        // orphans inside it would double-count the same problem
        suppressKeyStale: lockStale,
      });
      if (lockStale) {
        row.stale.push({ fileName: translatedRel });
      }
      continue;
    }

    // Whole-file unit (documents, YAML)
    row.total += 1;
    if (fs.existsSync(translatedAbs)) {
      row.translated += 1;
      if (isLockStale(lockEntries, file, locale)) {
        row.stale.push({ fileName: translatedRel });
      }
    } else {
      row.missing.push({ fileName: translatedRel });
    }
  }

  // Lockfile entries whose source file no longer exists are stale leftovers
  const sourceFileIds = new Set(sourceFiles.map((file) => file.fileId));
  for (const entry of lockEntries.values()) {
    if (sourceFileIds.has(entry.fileId)) continue;
    const translation = entry.translations?.[locale];
    if (!translation) continue;
    row.stale.push({
      fileName: translation.fileName ?? entry.fileName ?? entry.fileId,
    });
  }

  return row;
}

function diffGtCatalog(
  row: LocaleStatus,
  file: FileToUpload,
  translatedRel: string,
  translatedAbs: string
): void {
  let sourceMap: Record<string, unknown>;
  try {
    sourceMap = JSON.parse(file.content) as Record<string, unknown>;
  } catch {
    // The template content is built internally; nothing to diff if it is
    // ever malformed
    return;
  }
  const read = readJsonFile(translatedAbs);
  if (read.state === 'invalid') {
    row.errors.push({
      fileName: translatedRel,
      message: 'translated catalog is not valid JSON',
    });
  }
  const translationMap =
    read.state === 'ok' && read.value && typeof read.value === 'object'
      ? (read.value as Record<string, unknown>)
      : null;

  const diff = diffKeyedCatalog(sourceMap, translationMap);
  accumulateDiff(row, diff, translatedRel, { suppressKeyStale: false });

  if (!translationMap) return;
  for (const [key, sourceValue] of Object.entries(sourceMap)) {
    const translatedValue = translationMap[key];
    if (
      entryDataFormat(file.formatMetadata, key) === 'ICU' &&
      typeof sourceValue === 'string' &&
      typeof translatedValue === 'string'
    ) {
      for (const issue of compareIcuMessages(sourceValue, translatedValue)) {
        row.errors.push({
          fileName: translatedRel,
          key,
          message: issue.message,
        });
      }
    }
  }
}

function diffJsonCatalog(
  row: LocaleStatus,
  file: FileToUpload,
  translatedRel: string,
  translatedAbs: string,
  schema: Exclude<JsonSchemaResolution, { kind: 'composite' }>,
  options: { suppressKeyStale: boolean }
): void {
  let sourceJson: unknown;
  try {
    sourceJson = JSON.parse(file.content);
  } catch {
    // aggregateFiles pre-validates source JSON; an unparsable content here
    // means the file was transformed into something we cannot diff
    return;
  }
  // Include-schema sources are already flat pointer maps of translatable
  // strings; otherwise every string leaf counts
  let sourcePointers =
    schema.kind === 'include'
      ? (sourceJson as Record<string, unknown>)
      : flattenStringLeaves(sourceJson);

  const read = readJsonFile(translatedAbs);
  if (read.state === 'invalid') {
    row.errors.push({
      fileName: translatedRel,
      message: 'translated file is not valid JSON',
    });
  }
  let translatedPointers =
    read.state === 'ok'
      ? schema.kind === 'include'
        ? flattenJsonWithStringFilter(read.value, schema.include)
        : flattenStringLeaves(read.value)
      : null;

  if (file.dataFormat === 'I18NEXT') {
    sourcePointers = collapseI18nextPlurals(sourcePointers);
    if (translatedPointers) {
      translatedPointers = collapseI18nextPlurals(translatedPointers) as Record<
        string,
        string
      >;
    }
  }

  const diff = diffKeyedCatalog(sourcePointers, translatedPointers);
  accumulateDiff(row, diff, translatedRel, options);

  if (!translatedPointers || file.dataFormat !== 'ICU') return;
  for (const [pointer, sourceValue] of Object.entries(sourcePointers)) {
    const translatedValue = translatedPointers[pointer];
    if (typeof sourceValue !== 'string' || typeof translatedValue !== 'string')
      continue;
    for (const issue of compareIcuMessages(sourceValue, translatedValue)) {
      row.errors.push({
        fileName: translatedRel,
        key: pointer,
        message: issue.message,
      });
    }
  }
}

function accumulateDiff(
  row: LocaleStatus,
  diff: CatalogDiff,
  translatedRel: string,
  options: { suppressKeyStale: boolean }
): void {
  row.total += diff.total;
  row.translated += diff.translated;
  for (const key of diff.missing) {
    row.missing.push({ fileName: translatedRel, key });
  }
  if (!options.suppressKeyStale) {
    for (const key of diff.stale) {
      row.stale.push({ fileName: translatedRel, key });
    }
  }
}
