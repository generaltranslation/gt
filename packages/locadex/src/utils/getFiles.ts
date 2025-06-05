import { readdirSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { logger } from '../logging/logger.js';

export interface FileEntry {
  path: string;
  addedAt: string;
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

function addFileToList(
  filePath: string,
  stateFilePath: string,
  status: 'pending' | 'in_progress' | 'edited' = 'pending'
): void {
  const files = getFileList(stateFilePath);
  const existingIndex = files.findIndex((f) => f.path === filePath);

  if (existingIndex >= 0) {
    files[existingIndex].status = status;
    files[existingIndex].addedAt = new Date().toISOString();
  } else {
    files.push({
      path: filePath,
      addedAt: new Date().toISOString(),
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

export function scanNextJsAppFiles(
  projectPath: string = process.cwd()
): string[] {
  return scanDirectory(projectPath, projectPath);
}

// Used by dag command
export function addFilesToManager(
  projectPath: string = process.cwd(),
  files: string[] = []
): string {
  const stateFilePath = join(projectPath, 'locadex-files-state.json');
  const existingFiles = getFileList(stateFilePath);
  const existingPaths = new Set(existingFiles.map((f) => f.path));
  files = files.filter((f) => !existingPaths.has(f));

  files.forEach((filePath) =>
    addFileToList(filePath, stateFilePath, 'pending')
  );

  return stateFilePath;
}

// Used by dag command
export function markFileAsInProgress(
  filePath: string,
  stateFilePath: string
): void {
  addFileToList(filePath, stateFilePath, 'in_progress');
}

// Used by dag command
export function markFileAsEdited(
  filePath: string,
  stateFilePath: string
): void {
  addFileToList(filePath, stateFilePath, 'edited');
}

export function addNextJsFilesToManager(
  stateFilePath: string,
  projectPath: string = process.cwd()
): {
  added: string[];
  existing: string[];
} {
  const discoveredFiles = scanNextJsAppFiles(projectPath);
  const existingFiles = getFileList(stateFilePath);
  const existingPaths = new Set(existingFiles.map((f) => f.path));

  const added: string[] = [];
  const existing: string[] = [];

  for (const filePath of discoveredFiles) {
    if (existingPaths.has(filePath)) {
      existing.push(filePath);
    } else {
      addFileToList(filePath, stateFilePath, 'pending');
      added.push(filePath);
    }
  }

  return { added, existing };
}

export function getCurrentFileList(stateFilePath: string): {
  path: string;
  addedAt: string;
  status: 'pending' | 'in_progress' | 'edited';
}[] {
  return getFileList(stateFilePath);
}

export function getNextJsAppRouterStats(projectPath: string = process.cwd()): {
  totalFiles: number;
  tsFiles: number;
  tsxFiles: number;
  directories: Set<string>;
} {
  const files = scanNextJsAppFiles(projectPath);

  let tsFiles = 0;
  let tsxFiles = 0;
  const directories = new Set<string>();

  for (const filePath of files) {
    const fileName = filePath.split('/').pop() || '';
    const dirPath = filePath.split('/').slice(0, -1).join('/');

    if (dirPath) {
      directories.add(dirPath);
    }

    if (fileName.endsWith('.ts')) {
      tsFiles++;
    } else if (fileName.endsWith('.tsx')) {
      tsxFiles++;
    }
  }

  return {
    totalFiles: files.length,
    tsFiles,
    tsxFiles,
    directories,
  };
}
