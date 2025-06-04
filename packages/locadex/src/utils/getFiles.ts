import { readdirSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { fromPackageRoot } from './getPaths.js';

// Default file path - can be overridden for concurrent instances
export const DEFAULT_FILE_LIST_PATH = fromPackageRoot(
  '.tmp/locadex-files.json'
);

// Global variable to store the current session's file path
let currentFileListPath = DEFAULT_FILE_LIST_PATH;

// Initialize file path from environment variable if available (for MCP server)
function initializeFileListPath() {
  const uniqueId = process.env.LOCADEX_FILE_LIST_ID;
  if (uniqueId) {
    currentFileListPath = fromPackageRoot(
      `.tmp/locadex-files-${uniqueId}.json`
    );
    console.log(
      `[getFiles] Initialized file list path from env: ${currentFileListPath}`
    );
  }
}

// Call initialization when module loads
initializeFileListPath();

export function setFileListPath(uniqueId: string): string {
  currentFileListPath = fromPackageRoot(`.tmp/locadex-files-${uniqueId}.json`);
  return currentFileListPath;
}

export function getFileListPath(): string {
  return currentFileListPath;
}

interface FileEntry {
  path: string;
  addedAt: string;
  status: 'pending' | 'in_progress' | 'edited';
}

function getFileList(): FileEntry[] {
  if (!existsSync(currentFileListPath)) {
    return [];
  }
  try {
    return JSON.parse(readFileSync(currentFileListPath, 'utf8'));
  } catch {
    return [];
  }
}

function saveFileList(files: FileEntry[]): void {
  // Ensure the directory exists before writing the file
  const dir = dirname(currentFileListPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(currentFileListPath, JSON.stringify(files, null, 2));
}

function addFileToList(
  filePath: string,
  status: 'pending' | 'in_progress' | 'edited' = 'pending'
): void {
  const files = getFileList();
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

  saveFileList(files);
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
    console.warn(`Warning: Could not read directory ${dirPath}:`, error);
  }

  return files;
}

export function scanNextJsAppFiles(
  projectPath: string = process.cwd()
): string[] {
  return scanDirectory(projectPath, projectPath);
}

export function addNextJsFilesToManager(projectPath: string = process.cwd()): {
  added: string[];
  existing: string[];
} {
  const discoveredFiles = scanNextJsAppFiles(projectPath);
  const existingFiles = getFileList();
  const existingPaths = new Set(existingFiles.map((f) => f.path));

  const added: string[] = [];
  const existing: string[] = [];

  for (const filePath of discoveredFiles) {
    if (existingPaths.has(filePath)) {
      existing.push(filePath);
    } else {
      addFileToList(filePath, 'pending');
      added.push(filePath);
    }
  }

  return { added, existing };
}

export function getCurrentFileList(): {
  path: string;
  addedAt: string;
  status: 'pending' | 'in_progress' | 'edited';
}[] {
  return getFileList();
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
