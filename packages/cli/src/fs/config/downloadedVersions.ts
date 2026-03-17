import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../../console/logger.js';
import type { Settings } from '../../types/index.js';

const GT_LOCK_FILE = 'gt-lock.json';

// ── V2 types (internal working format) ──────────────────────────────

export type DownloadedTranslation = {
  updatedAt?: string;
  postProcessHash?: string;
  fileName?: string; // output path for this locale, e.g. "es-US/my/file/path.mdx"
};

export type DownloadedVersionEntry = {
  fileId: string;
  versionId: string;
  fileName?: string; // source file path
  translations: {
    [locale: string]: DownloadedTranslation;
  };
};

export type DownloadedVersions = {
  version: 2;
  branchId: string;
  entries: DownloadedVersionEntry[];
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
export function readLockfile(settings: Settings): {
  data: DownloadedVersions;
  originalV1: DownloadedVersionsV1 | null;
} {
  let branchId = settings._branchId ?? '';
  const empty = {
    data: {
      version: 2 as const,
      branchId,
      entries: [] as DownloadedVersionEntry[],
    },
    originalV1: null,
  };

  try {
    const rootPath = path.join(process.cwd(), GT_LOCK_FILE);
    if (!fs.existsSync(rootPath)) return empty;

    const raw = JSON.parse(fs.readFileSync(rootPath, 'utf8'));
    if (!raw || typeof raw !== 'object' || !raw.entries) return empty;

    // V2 file
    if (raw.version === 2 && Array.isArray(raw.entries)) {
      const v2 = raw as DownloadedVersions;
      if (branchId) v2.branchId = branchId;
      return { data: v2, originalV1: null };
    }

    // V1 file — convert current branch to v2
    const v1 = raw as DownloadedVersionsV1;
    if (!branchId) {
      const branches = Object.keys(v1.entries);
      if (branches.length > 0) branchId = branches[0];
    }
    return { data: convertV1ToV2(v1, branchId), originalV1: v1 };
  } catch (error) {
    logger.error(`An error occurred while reading ${GT_LOCK_FILE}: ${error}`);
    return empty;
  }
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
    const filepath = path.join(process.cwd(), GT_LOCK_FILE);
    fs.mkdirSync(path.dirname(filepath), { recursive: true });

    if (originalV1) {
      const mergedV1: DownloadedVersionsV1 = {
        ...originalV1,
        entries: {
          ...originalV1.entries,
          [data.branchId]: convertV2ToV1Branch(data),
        },
      };
      fs.writeFileSync(filepath, JSON.stringify(mergedV1, null, 2));
    } else {
      fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    }
  } catch (error) {
    logger.error(`An error occurred while updating ${GT_LOCK_FILE}: ${error}`);
  }
}

// ── Lookup helpers ──────────────────────────────────────────────────

export function findEntry(
  entries: DownloadedVersionEntry[],
  fileId: string
): DownloadedVersionEntry | undefined {
  return entries.find((e) => e.fileId === fileId);
}

export function findOrCreateEntry(
  entries: DownloadedVersionEntry[],
  fileId: string,
  versionId: string
): DownloadedVersionEntry {
  const existingIndex = entries.findIndex((e) => e.fileId === fileId);
  if (existingIndex !== -1) {
    const existing = entries[existingIndex];
    if (existing.versionId === versionId) return existing;
    // Version changed — replace the old entry
    const updated = { fileId, versionId, translations: {} };
    entries[existingIndex] = updated;
    return updated;
  }
  const entry = { fileId, versionId, translations: {} };
  entries.push(entry);
  return entry;
}
