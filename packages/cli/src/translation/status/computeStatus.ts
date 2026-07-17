import fs from 'node:fs';
import path from 'node:path';
import type { FileToUpload } from 'generaltranslation/types';
import type { FileMapping } from '../../types/files.js';
import type { EntryMap } from '../../fs/config/downloadedVersions.js';
import { TEMPLATE_FILE_NAME } from '../../utils/constants.js';
import { flattenJsonWithStringFilter } from '../../formats/json/flattenJson.js';
import { compareIcuMessages } from '../../formats/icu/compareMessages.js';
import { diffKeyedCatalog, flattenStringLeaves } from './catalogDiff.js';

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
      if (schema.kind !== 'composite') {
        diffJsonCatalog(row, file, translatedRel, translatedAbs, schema);
        if (fs.existsSync(translatedAbs) && isLockStale(lockEntries, file, locale)) {
          row.stale.push({ fileName: translatedRel });
        }
        continue;
      }
    }

    // Whole-file unit (documents, YAML, composite JSON)
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
  const sourceMap = JSON.parse(file.content) as Record<string, unknown>;
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
  accumulateDiff(row, diff, translatedRel);

  if (!translationMap) return;
  const metadata = (file.formatMetadata ?? {}) as Record<
    string,
    { dataFormat?: string } | undefined
  >;
  for (const [key, sourceValue] of Object.entries(sourceMap)) {
    const translatedValue = translationMap[key];
    if (
      metadata[key]?.dataFormat === 'ICU' &&
      typeof sourceValue === 'string' &&
      typeof translatedValue === 'string'
    ) {
      for (const issue of compareIcuMessages(sourceValue, translatedValue)) {
        row.errors.push({ fileName: translatedRel, key, message: issue.message });
      }
    }
  }
}

function diffJsonCatalog(
  row: LocaleStatus,
  file: FileToUpload,
  translatedRel: string,
  translatedAbs: string,
  schema: Exclude<JsonSchemaResolution, { kind: 'composite' }>
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
  const sourcePointers =
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
  const translatedPointers =
    read.state === 'ok'
      ? schema.kind === 'include'
        ? flattenJsonWithStringFilter(read.value, schema.include)
        : flattenStringLeaves(read.value)
      : null;

  const diff = diffKeyedCatalog(sourcePointers, translatedPointers);
  accumulateDiff(row, diff, translatedRel);

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
  diff: ReturnType<typeof diffKeyedCatalog>,
  translatedRel: string
): void {
  row.total += diff.total;
  row.translated += diff.translated;
  for (const key of diff.missing) {
    row.missing.push({ fileName: translatedRel, key });
  }
  for (const key of diff.stale) {
    row.stale.push({ fileName: translatedRel, key });
  }
}
