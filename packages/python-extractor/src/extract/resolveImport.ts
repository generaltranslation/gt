import fs from 'node:fs';
import path from 'node:path';

const resolveCache = new Map<string, string | null>();

/**
 * Resolves a Python import module path to a file path on disk.
 *
 * Handles:
 * - Relative imports: `.helpers` → sibling `helpers.py`
 * - Parent relative imports: `..utils` → parent dir `utils.py`
 * - Absolute imports: `utils` → `utils.py` in same/parent dirs
 * - Dotted paths: `myapp.utils` → `myapp/utils.py`
 */
export function resolveImportPath(
  moduleName: string,
  currentFilePath: string
): string | null {
  const cacheKey = `${currentFilePath}::${moduleName}`;
  if (resolveCache.has(cacheKey)) {
    return resolveCache.get(cacheKey)!;
  }

  const result = doResolve(moduleName, currentFilePath);
  resolveCache.set(cacheKey, result);
  return result;
}

function doResolve(moduleName: string, currentFilePath: string): string | null {
  const currentDir = path.dirname(currentFilePath);

  // Relative import: starts with dots
  if (moduleName.startsWith('.')) {
    // Count leading dots
    let dotCount = 0;
    while (dotCount < moduleName.length && moduleName[dotCount] === '.') {
      dotCount++;
    }

    // Go up (dotCount - 1) directories from current dir
    let baseDir = currentDir;
    for (let i = 1; i < dotCount; i++) {
      baseDir = path.dirname(baseDir);
    }

    const remainder = moduleName.slice(dotCount);
    if (!remainder) {
      // Bare dot import (e.g., "from . import X") — resolve to __init__.py
      const initPath = path.join(baseDir, '__init__.py');
      if (fs.existsSync(initPath)) return initPath;
      return null;
    }

    return resolveModulePath(baseDir, remainder);
  }

  // Absolute import: dotted or simple name
  return resolveModulePath(currentDir, moduleName);
}

/**
 * Resolves a dotted module name (e.g. "myapp.utils") relative to a base dir.
 * Tries: baseDir/myapp/utils.py, then baseDir/myapp/utils/__init__.py
 */
function resolveModulePath(baseDir: string, moduleName: string): string | null {
  const parts = moduleName.split('.');
  const filePath = path.join(baseDir, ...parts) + '.py';

  if (fs.existsSync(filePath)) {
    return filePath;
  }

  // Try as package: moduleName/__init__.py
  const initPath = path.join(baseDir, ...parts, '__init__.py');
  if (fs.existsSync(initPath)) {
    return initPath;
  }

  return null;
}

export function clearResolveCache(): void {
  resolveCache.clear();
}
