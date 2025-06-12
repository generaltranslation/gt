import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../logging/logger.js';

export const LOCKFILE_VERSION = '1.0.0';
export const LOCKFILE_NAME = 'locadex-lock.json';

export interface LockfileEntry {
  path: string;
  lastModified: number;
}

export interface Lockfile {
  checksums: Record<string, LockfileEntry>; // checksum -> entry mapping
  version: string;
  updatedAt: string;
}

export function calculateFileHash(filePath: string): string {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return crypto.createHash('md5').update(content).digest('hex');
  } catch (error) {
    logger.debugMessage(`Failed to calculate hash for ${filePath}: ${error}`);
    return '';
  }
}

export function loadLockfile(lockfilePath: string): Lockfile {
  try {
    if (!fs.existsSync(lockfilePath)) {
      return {
        checksums: {},
        version: '1.0.0',
        updatedAt: new Date().toISOString(),
      };
    }

    const content = fs.readFileSync(lockfilePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    logger.debugMessage(`Failed to load lockfile ${lockfilePath}: ${error}`);
    return {
      checksums: {},
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
    };
  }
}

export function saveLockfile(lockfilePath: string, lockfile: Lockfile): void {
  try {
    lockfile.updatedAt = new Date().toISOString();
    fs.writeFileSync(lockfilePath, JSON.stringify(lockfile, null, 2));
  } catch (error) {
    logger.debugMessage(`Failed to save lockfile ${lockfilePath}: ${error}`);
  }
}

export function getChangedFiles(
  files: string[],
  lockfilePath: string
): string[] {
  const lockfile = loadLockfile(lockfilePath);
  const changedFiles: string[] = [];

  for (const filePath of files) {
    const currentHash = calculateFileHash(filePath);

    if (!currentHash) {
      // Skip files that can't be hashed (likely don't exist or can't be read)
      continue;
    }

    // Check if this content hash exists in the lockfile
    const lockfileEntry = lockfile.checksums[currentHash];

    if (!lockfileEntry) {
      // Content hash not found, this is new or changed content
      changedFiles.push(filePath);
    }
    // If hash exists, content hasn't changed regardless of file path
  }

  logger.debugMessage(
    `Found ${changedFiles.length} changed files out of ${files.length} total files`
  );

  return changedFiles;
}

export function updateLockfile(
  files: string[],
  lockfilePath: string,
  rootDirectory: string
): void {
  const lockfile = loadLockfile(lockfilePath);

  for (const filePath of files) {
    const relativePath = path.relative(rootDirectory, filePath);
    const currentHash = calculateFileHash(filePath);

    if (!currentHash) {
      continue;
    }

    const stats = fs.statSync(filePath);
    // Use hash as key, store current path and metadata
    lockfile.checksums[currentHash] = {
      path: relativePath,
      lastModified: stats.mtime.getTime(),
    };
  }

  saveLockfile(lockfilePath, lockfile);
  logger.debugMessage(`Updated lockfile with ${files.length} files`);
}

export function cleanupLockfile(
  lockfilePath: string,
  rootDirectory: string
): void {
  const lockfile = loadLockfile(lockfilePath);

  // Remove entries for files that no longer exist
  let removedCount = 0;
  for (const hash in lockfile.checksums) {
    const entry = lockfile.checksums[hash];
    const absolutePath = path.resolve(rootDirectory, entry.path);

    if (!fs.existsSync(absolutePath)) {
      delete lockfile.checksums[hash];
      removedCount++;
    }
  }

  if (removedCount > 0) {
    saveLockfile(lockfilePath, lockfile);
    logger.debugMessage(
      `Cleaned up ${removedCount} stale entries from lockfile`
    );
  }
}
