import fs from 'node:fs';
import stringify from 'fast-json-stable-stringify';
import type {
  DownloadedTranslation,
  DownloadedVersionEntry,
  DownloadedVersions,
} from '../fs/config/downloadedVersions.js';

export type MergeDriverName = 'gt-lock' | 'gtjson';

export type MergeDriverResult =
  | {
      ok: true;
      content: string;
    }
  | {
      ok: false;
      reason: string;
    };

type ValueState = {
  exists: boolean;
  value?: unknown;
};

const LOCK_TOP_LEVEL_KEYS = new Set(['version', 'branchId', 'entries']);
const LOCK_ENTRY_KEYS = new Set([
  'fileId',
  'versionId',
  'fileName',
  'staged',
  'translations',
]);
const LOCK_TRANSLATION_KEYS = new Set([
  'updatedAt',
  'postProcessHash',
  'fileName',
]);

export function runMergeDriver(
  driverName: MergeDriverName,
  basePath: string,
  oursPath: string,
  theirsPath: string
): MergeDriverResult {
  const base = readMergeFile(basePath);
  const ours = readMergeFile(oursPath);
  const theirs = readMergeFile(theirsPath);

  const result =
    driverName === 'gt-lock'
      ? mergeGtLockJson(base, ours, theirs)
      : mergeGtJson(base, ours, theirs);

  if (result.ok) {
    fs.writeFileSync(oursPath, result.content, 'utf8');
  }
  return result;
}

export function mergeGtJson(
  baseRaw: string,
  oursRaw: string,
  theirsRaw: string
): MergeDriverResult {
  const base = parseRootObject(baseRaw, 'base');
  const ours = parseRootObject(oursRaw, 'ours');
  const theirs = parseRootObject(theirsRaw, 'theirs');

  if (!base.ok) return base;
  if (!ours.ok) return ours;
  if (!theirs.ok) return theirs;

  const merged: Record<string, unknown> = {};
  // Preserve ours-side key order to avoid reordering the whole file on merge.
  // Keys present only in base were deleted on both sides and never survive.
  const keys = [
    ...Object.keys(ours.value),
    ...Object.keys(theirs.value).filter(
      (key) => !Object.prototype.hasOwnProperty.call(ours.value, key)
    ),
  ];

  for (const key of keys) {
    const baseValue = getValueState(base.value, key);
    const oursValue = getValueState(ours.value, key);
    const theirsValue = getValueState(theirs.value, key);

    if (sameValueState(oursValue, theirsValue)) {
      if (oursValue.exists) merged[key] = oursValue.value;
      continue;
    }

    if (sameValueState(oursValue, baseValue)) {
      if (theirsValue.exists) merged[key] = theirsValue.value;
      continue;
    }

    if (sameValueState(theirsValue, baseValue)) {
      if (oursValue.exists) merged[key] = oursValue.value;
      continue;
    }

    return {
      ok: false,
      reason: `Conflicting GTJSON changes for key "${key}"`,
    };
  }

  return { ok: true, content: `${JSON.stringify(merged, null, 2)}\n` };
}

export function mergeGtLockJson(
  baseRaw: string,
  oursRaw: string,
  theirsRaw: string
): MergeDriverResult {
  const base = parseLockfile(baseRaw, 'base');
  const ours = parseLockfile(oursRaw, 'ours');
  const theirs = parseLockfile(theirsRaw, 'theirs');

  if (!base.ok) return base;
  if (!ours.ok) return ours;
  if (!theirs.ok) return theirs;

  const baseMap = buildEntryMap(base.value.entries);
  const oursMap = buildEntryMap(ours.value.entries);
  const theirsMap = buildEntryMap(theirs.value.entries);

  if (!baseMap.ok) return baseMap;
  if (!oursMap.ok) return oursMap;
  if (!theirsMap.ok) return theirsMap;

  const fileIds = new Set([
    ...baseMap.value.keys(),
    ...oursMap.value.keys(),
    ...theirsMap.value.keys(),
  ]);

  const entries: DownloadedVersionEntry[] = [];
  for (const fileId of Array.from(fileIds).sort()) {
    const entry = mergeLockEntry(
      baseMap.value.get(fileId),
      oursMap.value.get(fileId),
      theirsMap.value.get(fileId)
    );
    if (entry) entries.push(entry);
  }

  return {
    ok: true,
    content: formatJson({
      version: 2,
      branchId: ours.value.branchId || theirs.value.branchId,
      entries,
    } satisfies DownloadedVersions),
  };
}

function mergeLockEntry(
  base: DownloadedVersionEntry | undefined,
  ours: DownloadedVersionEntry | undefined,
  theirs: DownloadedVersionEntry | undefined
): DownloadedVersionEntry | undefined {
  if (sameJson(ours, theirs)) return clone(ours);
  if (!ours) return clone(theirs);
  if (!theirs) return clone(ours);

  if (ours.versionId !== theirs.versionId) {
    if (sameJson(ours, base)) return clone(theirs);
    if (sameJson(theirs, base)) return clone(ours);
    return clone(selectLatestEntry(ours, theirs));
  }

  const selected = selectLatestEntry(ours, theirs);
  const merged: DownloadedVersionEntry = {
    fileId: ours.fileId,
    versionId: ours.versionId,
    translations: mergeTranslations(
      base?.translations ?? {},
      ours.translations,
      theirs.translations
    ),
  };

  if (selected.fileName) merged.fileName = selected.fileName;
  if (selected.staged !== undefined) merged.staged = selected.staged;

  return merged;
}

function mergeTranslations(
  base: Record<string, DownloadedTranslation>,
  ours: Record<string, DownloadedTranslation>,
  theirs: Record<string, DownloadedTranslation>
): Record<string, DownloadedTranslation> {
  const result: Record<string, DownloadedTranslation> = {};
  const locales = new Set([
    ...Object.keys(base),
    ...Object.keys(ours),
    ...Object.keys(theirs),
  ]);

  for (const locale of Array.from(locales).sort()) {
    const oursValue = ours[locale];
    const theirsValue = theirs[locale];

    if (oursValue && theirsValue && !sameJson(oursValue, theirsValue)) {
      result[locale] = clone(selectLatestTranslation(oursValue, theirsValue))!;
    } else if (oursValue) {
      result[locale] = clone(oursValue)!;
    } else if (theirsValue) {
      result[locale] = clone(theirsValue)!;
    }
  }

  return result;
}

function parseRootObject(
  raw: string,
  label: string
):
  | {
      ok: true;
      value: Record<string, unknown>;
    }
  | {
      ok: false;
      reason: string;
    } {
  if (!raw.trim()) return { ok: true, value: {} };

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { ok: false, reason: `Could not parse ${label} JSON` };
  }

  if (!isRecord(value)) {
    return { ok: false, reason: `${label} JSON must be an object` };
  }

  return { ok: true, value };
}

function parseLockfile(
  raw: string,
  label: string
):
  | {
      ok: true;
      value: DownloadedVersions;
    }
  | {
      ok: false;
      reason: string;
    } {
  if (!raw.trim()) {
    return { ok: true, value: { version: 2, branchId: '', entries: [] } };
  }

  const parsed = parseRootObject(raw, label);
  if (!parsed.ok) return parsed;

  const validationError = validateLockfile(parsed.value, label);
  if (validationError) {
    return { ok: false, reason: validationError };
  }

  return { ok: true, value: parsed.value as DownloadedVersions };
}

function validateLockfile(
  value: Record<string, unknown>,
  label: string
): string | null {
  if (!hasOnlyKeys(value, LOCK_TOP_LEVEL_KEYS)) {
    return `${label} gt-lock.json contains unsupported top-level fields`;
  }
  if (value.version !== 2) {
    return `${label} gt-lock.json must use version 2`;
  }
  if (typeof value.branchId !== 'string') {
    return `${label} gt-lock.json must contain a branchId string`;
  }
  if (!Array.isArray(value.entries)) {
    return `${label} gt-lock.json must contain an entries array`;
  }

  for (const entry of value.entries) {
    if (!isRecord(entry)) {
      return `${label} gt-lock.json contains a non-object entry`;
    }
    if (!hasOnlyKeys(entry, LOCK_ENTRY_KEYS)) {
      return `${label} gt-lock.json entry contains unsupported fields`;
    }
    if (typeof entry.fileId !== 'string') {
      return `${label} gt-lock.json entry must contain a fileId string`;
    }
    if (typeof entry.versionId !== 'string') {
      return `${label} gt-lock.json entry must contain a versionId string`;
    }
    if (entry.fileName !== undefined && typeof entry.fileName !== 'string') {
      return `${label} gt-lock.json entry fileName must be a string`;
    }
    if (entry.staged !== undefined && typeof entry.staged !== 'boolean') {
      return `${label} gt-lock.json entry staged must be a boolean`;
    }
    if (!isRecord(entry.translations)) {
      return `${label} gt-lock.json entry translations must be an object`;
    }
    for (const translation of Object.values(entry.translations)) {
      if (!isRecord(translation)) {
        return `${label} gt-lock.json translation must be an object`;
      }
      if (!hasOnlyKeys(translation, LOCK_TRANSLATION_KEYS)) {
        return `${label} gt-lock.json translation contains unsupported fields`;
      }
      for (const field of LOCK_TRANSLATION_KEYS) {
        if (
          translation[field] !== undefined &&
          typeof translation[field] !== 'string'
        ) {
          return `${label} gt-lock.json translation ${field} must be a string`;
        }
      }
    }
  }

  return null;
}

function buildEntryMap(entries: DownloadedVersionEntry[]):
  | {
      ok: true;
      value: Map<string, DownloadedVersionEntry>;
    }
  | {
      ok: false;
      reason: string;
    } {
  const map = new Map<string, DownloadedVersionEntry>();
  for (const entry of entries) {
    if (map.has(entry.fileId)) {
      return {
        ok: false,
        reason: `gt-lock.json contains duplicate fileId "${entry.fileId}"`,
      };
    }
    map.set(entry.fileId, entry);
  }
  return { ok: true, value: map };
}

function selectLatestEntry(
  ours: DownloadedVersionEntry,
  theirs: DownloadedVersionEntry
): DownloadedVersionEntry {
  return maxEntryTimestamp(theirs) > maxEntryTimestamp(ours) ? theirs : ours;
}

function maxEntryTimestamp(entry: DownloadedVersionEntry): number {
  return Math.max(
    0,
    ...Object.values(entry.translations).map((translation) =>
      parseTimestamp(translation.updatedAt)
    )
  );
}

function selectLatestTranslation(
  ours: DownloadedTranslation,
  theirs: DownloadedTranslation
): DownloadedTranslation {
  return parseTimestamp(theirs.updatedAt) > parseTimestamp(ours.updatedAt)
    ? theirs
    : ours;
}

function parseTimestamp(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function readMergeFile(filepath: string): string {
  try {
    return fs.readFileSync(filepath, 'utf8');
  } catch {
    return '';
  }
}

function formatJson(value: unknown): string {
  const stable = stringify(value);
  return `${JSON.stringify(JSON.parse(stable), null, 2)}\n`;
}

function getValueState(
  record: Record<string, unknown>,
  key: string
): ValueState {
  return Object.prototype.hasOwnProperty.call(record, key)
    ? { exists: true, value: record[key] }
    : { exists: false };
}

function sameValueState(left: ValueState, right: ValueState): boolean {
  if (left.exists !== right.exists) return false;
  if (!left.exists) return true;
  return sameJson(left.value, right.value);
}

function sameJson(left: unknown, right: unknown): boolean {
  return stringify(left) === stringify(right);
}

function clone<T>(value: T | undefined): T | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: Set<string>
): boolean {
  return Object.keys(value).every((key) => allowedKeys.has(key));
}
