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
  versionId: string; // content hash of parsed source
  fileName?: string; // source file path, for user visibility
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

// ── Stashed V1 data (preserved across read→save cycle) ──────────────

let _stashedV1: DownloadedVersionsV1 | null = null;

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
    // Find the versionId with the latest updatedAt across all locales
    let latestVersionId: string | null = null;
    let latestTime = Number.NEGATIVE_INFINITY;

    for (const [versionId, locales] of Object.entries(versions)) {
      for (const entry of Object.values(locales)) {
        const t = entry.updatedAt
          ? Date.parse(entry.updatedAt)
          : Number.NEGATIVE_INFINITY;
        if (t > latestTime) {
          latestTime = t;
          latestVersionId = versionId;
        }
      }
    }

    if (!latestVersionId) continue;

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

export function getDownloadedVersions(settings: Settings): DownloadedVersions {
  let branchId = settings._branchId ?? '';
  try {
    const rootPath = path.join(process.cwd(), GT_LOCK_FILE);
    const filepath = fs.existsSync(rootPath) ? rootPath : null;
    if (!filepath) {
      _stashedV1 = null;
      return { version: 2, branchId, entries: [] };
    }

    const raw = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    if (!raw || typeof raw !== 'object' || !raw.entries) {
      _stashedV1 = null;
      return { version: 2, branchId, entries: [] };
    }

    // V2 file
    if (raw.version === 2 && Array.isArray(raw.entries)) {
      _stashedV1 = null;
      return raw as DownloadedVersions;
    }

    // V1 file — stash full data, convert current branch to v2
    _stashedV1 = raw as DownloadedVersionsV1;
    // If no branchId available (e.g. branching disabled), use the first branch in the v1 data
    if (!branchId) {
      const branches = Object.keys(_stashedV1.entries);
      if (branches.length > 0) {
        branchId = branches[0];
      }
    }
    return convertV1ToV2(_stashedV1, branchId);
  } catch (error) {
    logger.error(
      `An error occurred while getting downloaded versions: ${error}`
    );
    _stashedV1 = null;
    return { version: 2, branchId, entries: [] };
  }
}

export function saveDownloadedVersions(lock: DownloadedVersions): void {
  try {
    const filepath = path.join(process.cwd(), GT_LOCK_FILE);
    fs.mkdirSync(path.dirname(filepath), { recursive: true });

    if (_stashedV1) {
      // Merge current branch back into stashed v1, preserve other branches
      _stashedV1.entries[lock.branchId] = convertV2ToV1Branch(lock);
      fs.writeFileSync(filepath, JSON.stringify(_stashedV1, null, 2));
    } else {
      fs.writeFileSync(filepath, JSON.stringify(lock, null, 2));
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
  let entry = entries.find(
    (e) => e.fileId === fileId && e.versionId === versionId
  );
  if (!entry) {
    entry = { fileId, versionId, translations: {} };
    entries.push(entry);
  }
  return entry;
}
