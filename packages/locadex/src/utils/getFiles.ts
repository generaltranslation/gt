import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { fromPackageRoot } from './getPaths.js';

export const FILE_LIST_PATH = fromPackageRoot('.locadex-files.json');

interface FileEntry {
  path: string;
  addedAt: string;
  status: 'pending' | 'in_progress' | 'completed';
}

function getFileList(): FileEntry[] {
  if (!existsSync(FILE_LIST_PATH)) {
    return [];
  }
  try {
    return JSON.parse(readFileSync(FILE_LIST_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function saveFileList(files: FileEntry[]): void {
  writeFileSync(FILE_LIST_PATH, JSON.stringify(files, null, 2));
}

function addFileToList(
  filePath: string,
  status: 'pending' | 'in_progress' | 'completed' = 'pending'
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
  // Look for app directory (Next.js app router)
  const appDir = join(projectPath, 'app');
  const srcAppDir = join(projectPath, 'src', 'app');

  let targetDir: string;

  if (existsSync(appDir)) {
    targetDir = appDir;
  } else if (existsSync(srcAppDir)) {
    targetDir = srcAppDir;
  } else {
    throw new Error(
      'No Next.js app router directory found. Looking for "app" or "src/app" directory.'
    );
  }

  return scanDirectory(targetDir, projectPath);
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
