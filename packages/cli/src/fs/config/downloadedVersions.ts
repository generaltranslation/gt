import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../../console/logger.js';
import type { Settings } from '../../types/index.js';
import { hashStringSync } from '../../utils/hash.js';

const GT_LOCK_FILE = 'gt-lock.json';

// ── V2 types (internal working format) ──────────────────────────────

export type DownloadedTranslation = {
  updatedAt?: string;
  postProcessHash?: string;
  fileName?: string; // output path for this locale, e.g. "es-US/my/file/path.mdx"
};

export type DownloadedVersionEntry = {
  fileId: string;
  previousFileId?: string; // server ID retained until a path migration succeeds
  versionId: string;
  fileName?: string; // source file path
  staged?: boolean; // true if this entry was staged but not yet downloaded
  translations: {
    [locale: string]: DownloadedTranslation;
  };
};

export type DownloadedVersions = {
  version: 2;
  branchId: string;
  entries: DownloadedVersionEntry[];
};

export type NormalizeLockfilePathOptions = {
  portableSourcePathEvidence?: ReadonlySet<string>;
  portableTranslationPathEvidence?: ReadonlySet<string>;
  preserveAmbiguousPaths?: boolean;
};

// ── V1 types (backwards compatibility) ──────────────────────────────

export type DownloadedVersionEntryV1 = {
  fileName?: string;
  updatedAt?: string;
  postProcessHash?: string;
  sourceHash?: string;
};

export type DownloadedVersionsV1 = {
  version: number;
  entries: {
    [branchId: string]: {
      [fileId: string]: {
        [versionId: string]: { [locale: string]: DownloadedVersionEntryV1 };
      };
    };
  };
};

/**
 * Normalizes serialized v2 lockfile paths to portable forward slashes.
 * This is intentionally platform-independent because a lockfile written on
 * Windows may later be read on POSIX. Legacy file IDs are re-keyed only when
 * they can be proven to be the hash of the original backslash path, and the
 * previous server identity is retained until the migration succeeds.
 */
export function normalizeLockfilePaths(
  data: DownloadedVersions,
  options: NormalizeLockfilePathOptions = {}
): void {
  const existingFileIds = new Set(data.entries.map((entry) => entry.fileId));
  const plannedFileIds = new Map<string, number>();
  const plans = data.entries.map((entry) => {
    const originalFileName = entry.fileName;
    const normalizedFileName =
      typeof originalFileName === 'string'
        ? normalizeSerializedLockfilePath(
            originalFileName,
            options,
            options.portableSourcePathEvidence
          )
        : originalFileName;
    const nextFileId =
      typeof originalFileName === 'string' &&
      typeof normalizedFileName === 'string' &&
      originalFileName !== normalizedFileName &&
      entry.fileId === hashStringSync(originalFileName)
        ? hashStringSync(normalizedFileName)
        : undefined;

    if (nextFileId) {
      plannedFileIds.set(nextFileId, (plannedFileIds.get(nextFileId) ?? 0) + 1);
    }

    return { entry, normalizedFileName, nextFileId };
  });

  for (const { entry, normalizedFileName, nextFileId } of plans) {
    let normalizedSourcePath = false;
    if (typeof entry.fileName === 'string') {
      const collides =
        nextFileId !== undefined &&
        ((existingFileIds.has(nextFileId) && nextFileId !== entry.fileId) ||
          (plannedFileIds.get(nextFileId) ?? 0) > 1);

      if (!collides) {
        if (nextFileId) {
          entry.previousFileId ??= entry.fileId;
          entry.fileId = nextFileId;
        }
        normalizedSourcePath = entry.fileName !== normalizedFileName;
        entry.fileName = normalizedFileName;
      }
    }
    if (!entry.translations || typeof entry.translations !== 'object') {
      continue;
    }
    for (const translation of Object.values(entry.translations)) {
      if (translation && typeof translation.fileName === 'string') {
        translation.fileName = normalizeSerializedLockfilePath(
          translation.fileName,
          options,
          options.portableTranslationPathEvidence,
          normalizedSourcePath
        );
      }
    }
  }
}

function normalizeSerializedLockfilePath(
  fileName: string,
  options: NormalizeLockfilePathOptions,
  portablePathEvidence: ReadonlySet<string> | undefined,
  forceWindowsPath: boolean = false
): string {
  if (!fileName.includes('\\')) return fileName;

  // A pre-normalization Windows CLI emitted only native separators. Mixed
  // separators therefore indicate a POSIX filename containing a literal
  // backslash, which must not be rewritten.
  if (fileName.includes('/')) return fileName;

  if (forceWindowsPath) {
    return fileName.replace(/\\/g, '/');
  }

  const portableFileName = fileName.replace(/\\/g, '/');
  if (portablePathEvidence?.has(portableFileName)) {
    return portableFileName;
  }

  // Merge drivers must produce the same result on every host. Without
  // evidence in the three lockfile inputs, keep an ambiguous path unchanged.
  if (options.preserveAmbiguousPaths) return fileName;

  if (path.sep === '\\') return portableFileName;

  // The all-backslash form is ambiguous on POSIX. Prefer a real literal path
  // over a speculative Windows migration when the file still exists.
  if (fs.existsSync(path.resolve(fileName))) {
    return fileName;
  }

  return portableFileName;
}

// ── Conversion helpers ──────────────────────────────────────────────

function convertV1ToV2(
  v1: DownloadedVersionsV1,
  branchId: string
): DownloadedVersions {
  const branchEntries = v1.entries?.[branchId];
  if (!branchEntries) {
    return { version: 2, branchId, entries: [] };
  }

  const entries: DownloadedVersionEntry[] = [];

  for (const [fileId, versions] of Object.entries(branchEntries)) {
    const versionIds = Object.keys(versions);
    if (versionIds.length === 0) continue;

    // Pick the versionId with the most recent updatedAt, defaulting to the first
    let latestVersionId = versionIds[0];
    let latestTime = 0;

    for (const [versionId, locales] of Object.entries(versions)) {
      for (const entry of Object.values(locales)) {
        const t = entry.updatedAt ? Date.parse(entry.updatedAt) : 0;
        if (t > latestTime) {
          latestTime = t;
          latestVersionId = versionId;
        }
      }
    }

    const localeEntries = versions[latestVersionId];
    const translations: { [locale: string]: DownloadedTranslation } = {};

    for (const [locale, entry] of Object.entries(localeEntries)) {
      translations[locale] = {
        ...(entry.updatedAt ? { updatedAt: entry.updatedAt } : {}),
        ...(entry.postProcessHash
          ? { postProcessHash: entry.postProcessHash }
          : {}),
      };
    }

    entries.push({
      fileId,
      versionId: latestVersionId,
      translations,
    });
  }

  return { version: 2, branchId, entries };
}

function convertV2ToV1Branch(
  v2: DownloadedVersions
): DownloadedVersionsV1['entries'][string] {
  const branch: DownloadedVersionsV1['entries'][string] = {};

  for (const entry of v2.entries) {
    if (!branch[entry.fileId]) {
      branch[entry.fileId] = {};
    }
    if (!branch[entry.fileId][entry.versionId]) {
      branch[entry.fileId][entry.versionId] = {};
    }

    for (const [locale, translation] of Object.entries(entry.translations)) {
      branch[entry.fileId][entry.versionId][locale] = {
        ...(translation.updatedAt ? { updatedAt: translation.updatedAt } : {}),
        ...(translation.postProcessHash
          ? { postProcessHash: translation.postProcessHash }
          : {}),
      };
    }
  }

  return branch;
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Reads the lockfile and returns v2 data regardless of the on-disk format.
 * If the file is v1, `originalV1` contains the full v1 data so that
 * `writeLockfile` can merge changes back without losing other branches.
 */
export function readLockfile(settings: Pick<Settings, '_branchId'>): {
  data: DownloadedVersions;
  entryMap: EntryMap;
  originalV1: DownloadedVersionsV1 | null;
} {
  let branchId = settings._branchId ?? '';

  let data: DownloadedVersions;
  let originalV1: DownloadedVersionsV1 | null = null;

  try {
    const rootPath = path.join(process.cwd(), GT_LOCK_FILE);
    if (!fs.existsSync(rootPath)) {
      data = { version: 2, branchId, entries: [] };
    } else {
      const raw = JSON.parse(fs.readFileSync(rootPath, 'utf8'));
      if (!raw || typeof raw !== 'object' || !raw.entries) {
        data = { version: 2, branchId, entries: [] };
      } else if (raw.version === 2 && Array.isArray(raw.entries)) {
        data = raw as DownloadedVersions;
        if (branchId) data.branchId = branchId;
      } else {
        originalV1 = raw as DownloadedVersionsV1;
        if (!branchId) {
          const branches = Object.keys(originalV1.entries);
          if (branches.length > 0) branchId = branches[0];
        }
        data = convertV1ToV2(originalV1, branchId);
      }
    }
  } catch (error) {
    logger.error(`An error occurred while reading ${GT_LOCK_FILE}: ${error}`);
    data = { version: 2, branchId, entries: [] };
  }

  normalizeLockfilePaths(data);

  return { data, entryMap: buildEntryMap(data.entries), originalV1 };
}

/**
 * Writes the lockfile. If `originalV1` is provided, merges the current
 * branch's data back into the v1 structure (preserving other branches)
 * and writes v1 format. Otherwise writes v2.
 */
export function writeLockfile(
  data: DownloadedVersions,
  originalV1: DownloadedVersionsV1 | null
): void {
  try {
    const normalizedData = cloneDownloadedVersions(data);
    normalizeLockfilePaths(normalizedData);
    // Normalization can add previousFileId to an existing object. Re-clone so
    // migrated and already-normalized entries serialize in the same key order.
    const serializedData = cloneDownloadedVersions(normalizedData);
    const filepath = path.join(process.cwd(), GT_LOCK_FILE);
    fs.mkdirSync(path.dirname(filepath), { recursive: true });

    // V1 format can't represent the staged flag — upgrade to V2 if any entries are staged
    if (originalV1 && !serializedData.entries.some((e) => e.staged)) {
      const mergedV1: DownloadedVersionsV1 = {
        ...originalV1,
        entries: {
          ...originalV1.entries,
          [serializedData.branchId]: convertV2ToV1Branch(serializedData),
        },
      };
      fs.writeFileSync(filepath, JSON.stringify(mergedV1, null, 2));
    } else {
      fs.writeFileSync(filepath, JSON.stringify(serializedData, null, 2));
    }
  } catch (error) {
    logger.error(`An error occurred while updating ${GT_LOCK_FILE}: ${error}`);
  }
}

function cloneDownloadedVersions(data: DownloadedVersions): DownloadedVersions {
  return {
    ...data,
    entries: data.entries.map((entry) => {
      const cloned: DownloadedVersionEntry = {
        fileId: entry.fileId,
        ...(entry.previousFileId
          ? { previousFileId: entry.previousFileId }
          : {}),
        versionId: entry.versionId,
        translations: cloneDownloadedTranslations(entry.translations),
      };
      if (entry.fileName !== undefined) cloned.fileName = entry.fileName;
      if (entry.staged !== undefined) cloned.staged = entry.staged;
      return cloned;
    }),
  };
}

function cloneDownloadedTranslations(
  translations: DownloadedVersionEntry['translations']
): DownloadedVersionEntry['translations'] {
  return cloneLockfileValue(
    translations as unknown
  ) as DownloadedVersionEntry['translations'];
}

function cloneLockfileValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneLockfileValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        cloneLockfileValue(child),
      ])
    );
  }
  return value;
}

export type FileIdMigration = {
  oldFileId: string;
  newFileId: string;
  newFileName: string;
};

/**
 * Updates lockfile identities after the server accepts the corresponding file
 * move. V1 entries without source filenames are migrated here as well.
 */
export function migrateLockfileFileIds(
  branchId: string,
  migrations: FileIdMigration[]
): number {
  if (migrations.length === 0) return 0;

  const { data, originalV1 } = readLockfile({ _branchId: branchId });
  if (originalV1) {
    return migrateV1LockfileFileIds(originalV1, data.branchId, migrations);
  }
  let migrated = 0;

  for (const migration of migrations) {
    const source = data.entries.find(
      (entry) =>
        entry.fileId === migration.oldFileId ||
        entry.previousFileId === migration.oldFileId
    );
    if (!source) continue;

    const target = data.entries.find(
      (entry) => entry !== source && entry.fileId === migration.newFileId
    );
    if (target) {
      if (target.versionId === source.versionId) {
        target.translations = mergeDownloadedTranslations(
          target.translations,
          source.translations
        );
        target.staged = target.staged || source.staged || undefined;
      }
      target.fileName = migration.newFileName;
      delete target.previousFileId;
      data.entries.splice(data.entries.indexOf(source), 1);
    } else {
      source.fileId = migration.newFileId;
      source.fileName = migration.newFileName;
      delete source.previousFileId;
    }
    migrated++;
  }

  if (migrated > 0) writeLockfile(data, originalV1);
  return migrated;
}

function migrateV1LockfileFileIds(
  data: DownloadedVersionsV1,
  branchId: string,
  migrations: FileIdMigration[]
): number {
  const branchEntries = data.entries?.[branchId];
  if (!branchEntries) return 0;

  let migrated = 0;
  for (const migration of migrations) {
    if (migration.oldFileId === migration.newFileId) continue;
    const source = branchEntries[migration.oldFileId];
    if (!source) continue;

    const target = branchEntries[migration.newFileId];
    branchEntries[migration.newFileId] = target
      ? mergeV1FileVersions(target, source)
      : source;
    delete branchEntries[migration.oldFileId];
    migrated++;
  }

  if (migrated > 0) {
    try {
      const filepath = path.join(process.cwd(), GT_LOCK_FILE);
      fs.mkdirSync(path.dirname(filepath), { recursive: true });
      fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    } catch (error) {
      logger.error(
        `An error occurred while updating ${GT_LOCK_FILE}: ${error}`
      );
    }
  }
  return migrated;
}

function mergeV1FileVersions(
  target: DownloadedVersionsV1['entries'][string][string],
  source: DownloadedVersionsV1['entries'][string][string]
): DownloadedVersionsV1['entries'][string][string] {
  const merged = { ...source, ...target };
  for (const [versionId, sourceLocales] of Object.entries(source)) {
    const targetLocales = target[versionId];
    if (!targetLocales) continue;

    const locales = { ...sourceLocales, ...targetLocales };
    for (const [locale, sourceEntry] of Object.entries(sourceLocales)) {
      const targetEntry = targetLocales[locale];
      if (!targetEntry) continue;
      const sourceTimestamp = Date.parse(sourceEntry.updatedAt ?? '');
      const targetTimestamp = Date.parse(targetEntry.updatedAt ?? '');
      const sourceIsNewer =
        !Number.isNaN(sourceTimestamp) &&
        (Number.isNaN(targetTimestamp) || sourceTimestamp > targetTimestamp);
      locales[locale] = sourceIsNewer
        ? { ...targetEntry, ...sourceEntry }
        : { ...sourceEntry, ...targetEntry };
    }
    merged[versionId] = locales;
  }
  return merged;
}

function mergeDownloadedTranslations(
  target: Record<string, DownloadedTranslation>,
  source: Record<string, DownloadedTranslation>
): Record<string, DownloadedTranslation> {
  const merged = { ...source, ...target };
  for (const locale of Object.keys(source)) {
    const targetTimestamp = Date.parse(target[locale]?.updatedAt ?? '');
    const sourceTimestamp = Date.parse(source[locale]?.updatedAt ?? '');
    if (
      !target[locale] ||
      (!Number.isNaN(sourceTimestamp) &&
        (Number.isNaN(targetTimestamp) || sourceTimestamp > targetTimestamp))
    ) {
      merged[locale] = source[locale];
    }
  }
  return merged;
}

// ── Lookup helpers ──────────────────────────────────────────────────

export type EntryMap = Map<string, DownloadedVersionEntry>;

export function buildEntryMap(entries: DownloadedVersionEntry[]): EntryMap {
  const entryMap = new Map(entries.map((entry) => [entry.fileId, entry]));
  for (const entry of entries) {
    if (entry.previousFileId && !entryMap.has(entry.previousFileId)) {
      entryMap.set(entry.previousFileId, entry);
    }
  }
  return entryMap;
}

/**
 * Marks metadata as belonging to the current server file identity. Until this
 * point, translations on an aliased entry describe the legacy server file.
 */
export function activateCurrentFileIdentity(
  entry: DownloadedVersionEntry,
  fileId: string,
  entryMap?: EntryMap
): void {
  if (!entry.previousFileId || entry.fileId !== fileId) return;
  if (entryMap?.get(entry.previousFileId) === entry) {
    entryMap.delete(entry.previousFileId);
  }
  delete entry.previousFileId;
  entry.translations = {};
}

/**
 * Finds or creates an entry, keeping the map and backing array in sync.
 * If the fileId exists but versionId changed, replaces it in-place.
 */
export function findOrCreateEntry(
  entryMap: EntryMap,
  entries: DownloadedVersionEntry[],
  fileId: string,
  versionId: string
): DownloadedVersionEntry {
  const existing = entryMap.get(fileId);
  if (existing) {
    if (existing.versionId === versionId) return existing;
    // Version changed — replace in array and map
    const updated: DownloadedVersionEntry = {
      fileId: existing.fileId,
      ...(existing.previousFileId
        ? { previousFileId: existing.previousFileId }
        : {}),
      versionId,
      translations: {},
    };
    const idx = entries.indexOf(existing);
    if (idx !== -1) entries[idx] = updated;
    for (const [key, entry] of entryMap) {
      if (entry === existing) entryMap.set(key, updated);
    }
    return updated;
  }
  const entry: DownloadedVersionEntry = {
    fileId,
    versionId,
    translations: {},
  };
  entries.push(entry);
  entryMap.set(fileId, entry);
  return entry;
}

// ── Staging helpers ─────────────────────────────────────────────────

/**
 * Writes staged file entries into the lockfile.
 * Each entry is marked with `staged: true` and empty translations.
 */
export function writeStagedEntries(
  settings: Settings,
  stagedFiles: { fileId: string; versionId: string; fileName: string }[],
  branchId?: string
): void {
  const { data, entryMap, originalV1 } = readLockfile(settings);

  if (branchId) {
    data.branchId = branchId;
  }

  for (const file of stagedFiles) {
    const entry = findOrCreateEntry(
      entryMap,
      data.entries,
      file.fileId,
      file.versionId
    );
    activateCurrentFileIdentity(entry, file.fileId, entryMap);
    entry.fileName = file.fileName;
    entry.staged = true;
  }

  writeLockfile(data, originalV1);
}

/**
 * Reads staged entries from the lockfile.
 * Returns the same shape as FileTranslationData for compatibility
 * with the download workflow.
 */
export function getStagedEntriesFromLockfile(
  settings: Settings
): Record<string, { versionId: string; fileName: string }> {
  const { data } = readLockfile(settings);
  const result: Record<string, { versionId: string; fileName: string }> = {};

  for (const entry of data.entries) {
    if (entry.staged && entry.fileName) {
      result[entry.previousFileId ?? entry.fileId] = {
        versionId: entry.versionId,
        fileName: entry.fileName,
      };
    }
  }

  return result;
}
