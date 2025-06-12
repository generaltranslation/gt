import {
  readdirSync,
  statSync,
  existsSync,
  mkdirSync,
  unlinkSync,
  rmSync,
} from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { logger } from '../../logging/logger.js';

// Mutex for thread-safe file operations
const fileMutexes = new Map<string, Promise<void>>();

export interface FileEntry {
  path: string;
  addedAt: string;
  setToInProgressAt: string | null;
  setToEditedAt: string | null;
  status: 'pending' | 'in_progress' | 'edited';
}

function getFileList(filePath: string): FileEntry[] {
  if (!existsSync(filePath)) {
    return [];
  }
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return [];
  }
}

function saveFileList(files: FileEntry[], filePath: string): void {
  writeFileSync(filePath, JSON.stringify(files, null, 2));
}

async function withFileMutex<T>(
  filePath: string,
  operation: () => T
): Promise<T> {
  const existingMutex = fileMutexes.get(filePath) || Promise.resolve();
  const newMutex = existingMutex
    .then(() => operation())
    .catch((error) => {
      throw error;
    });
  fileMutexes.set(
    filePath,
    newMutex.then(() => {}).catch(() => {})
  ); // Store the promise but ignore errors for the next operation
  return newMutex;
}

function addFileToList(
  filePath: string,
  stateFilePath: string,
  status: 'pending' | 'in_progress' | 'edited' = 'pending'
): void {
  const files = getFileList(stateFilePath);
  const existingIndex = files.findIndex((f) => f.path === filePath);
  const now = new Date().toISOString();

  if (existingIndex >= 0) {
    const file = files[existingIndex];
    const previousStatus = file.status;
    file.status = status;

    if (status === 'in_progress' && previousStatus !== 'in_progress') {
      file.setToInProgressAt = now;
    } else if (status === 'edited' && previousStatus !== 'edited') {
      file.setToEditedAt = now;
    }
  } else {
    files.push({
      path: filePath,
      addedAt: now,
      setToInProgressAt: status === 'in_progress' ? now : null,
      setToEditedAt: status === 'edited' ? now : null,
      status,
    });
  }

  saveFileList(files, stateFilePath);
}

function isTypeScriptFile(filePath: string): boolean {
  const fileName = filePath.split('/').pop() || '';
  return fileName.endsWith('.ts') || fileName.endsWith('.tsx');
}

function scanDirectory(dirPath: string, basePath: string): string[] {
  const files: string[] = [];

  if (!existsSync(dirPath)) {
    return files;
  }

  try {
    const items = readdirSync(dirPath);

    for (const item of items) {
      const fullPath = join(dirPath, item);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        // Skip node_modules, .next, and other common directories to ignore
        if (
          !['node_modules', '.next', '.git', 'dist', 'build', 'out'].includes(
            item
          )
        ) {
          files.push(...scanDirectory(fullPath, basePath));
        }
      } else if (stat.isFile()) {
        const relativePath = relative(basePath, fullPath);
        if (isTypeScriptFile(relativePath)) {
          files.push(relativePath);
        }
      }
    }
  } catch (error) {
    logger.warning(`Warning: Could not read directory ${dirPath}: ${error}`);
  }

  return files;
}

// Used by dag command
export function addFilesToManager(
  filesStateFilePath: string,
  files: string[]
): string {
  const existingFiles = getFileList(filesStateFilePath);
  const existingPaths = new Set(existingFiles.map((f) => f.path));
  files = files.filter((f) => !existingPaths.has(f));

  files.forEach((filePath) =>
    addFileToList(filePath, filesStateFilePath, 'pending')
  );

  return filesStateFilePath;
}

// Used by dag command
export async function markFileAsInProgress(
  filePath: string,
  stateFilePath: string
): Promise<void> {
  return withFileMutex(stateFilePath, () => {
    addFileToList(filePath, stateFilePath, 'in_progress');
  });
}

// Used by dag command
export async function markFileAsEdited(
  filePath: string,
  stateFilePath: string
): Promise<void> {
  return withFileMutex(stateFilePath, () => {
    addFileToList(filePath, stateFilePath, 'edited');
  });
}

export function getCurrentFileList(stateFilePath: string): {
  path: string;
  addedAt: string;
  setToInProgressAt: string | null;
  setToEditedAt: string | null;
  status: 'pending' | 'in_progress' | 'edited';
}[] {
  return getFileList(stateFilePath);
}
