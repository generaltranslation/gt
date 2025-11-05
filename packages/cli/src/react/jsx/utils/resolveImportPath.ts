import { createMatchPath, loadConfig } from 'tsconfig-paths';
import { ParsingConfigOptions } from '../../../types/parsing.js';
import fs from 'node:fs';
import path from 'node:path';
import resolve from 'resolve';
import enhancedResolve from 'enhanced-resolve';
const { ResolverFactory } = enhancedResolve;

/**
 * Resolves import paths to absolute file paths using battle-tested libraries.
 * Handles relative paths, TypeScript paths, and node module resolution.
 *
 * Examples:
 * - './constants' -> '/full/path/to/constants.ts'
 * - '@/components/ui/button' -> '/full/path/to/src/components/ui/button.tsx'
 * - '@shared/utils' -> '/full/path/to/packages/utils/index.ts'
 */
export function resolveImportPath(
  currentFile: string,
  importPath: string,
  parsingOptions: ParsingConfigOptions,
  resolveImportPathCache: Map<string, string | null>
): string | null {
  // Check cache first
  const cacheKey = `${currentFile}::${importPath}`;
  if (resolveImportPathCache.has(cacheKey)) {
    return resolveImportPathCache.get(cacheKey)!;
  }

  const basedir = path.dirname(currentFile);
  const extensions = ['.tsx', '.ts', '.jsx', '.js'];
  const mainFields = ['module', 'main'];

  let result: string | null = null;

  // 1. Try tsconfig-paths resolution first (handles TypeScript path mapping)
  const tsConfigResult = loadConfig(basedir);
  if (tsConfigResult.resultType === 'success') {
    const matchPath = createMatchPath(
      tsConfigResult.absoluteBaseUrl,
      tsConfigResult.paths,
      mainFields
    );

    // First try without any extension
    let tsResolved = matchPath(importPath);
    if (tsResolved && fs.existsSync(tsResolved)) {
      result = tsResolved;
      resolveImportPathCache.set(cacheKey, result);
      return result;
    }

    // Then try with each extension
    for (const ext of extensions) {
      tsResolved = matchPath(importPath + ext);
      if (tsResolved && fs.existsSync(tsResolved)) {
        result = tsResolved;
        resolveImportPathCache.set(cacheKey, result);
        return result;
      }

      // Also try the resolved path with extension
      tsResolved = matchPath(importPath);
      if (tsResolved) {
        const resolvedWithExt = tsResolved + ext;
        if (fs.existsSync(resolvedWithExt)) {
          result = resolvedWithExt;
          resolveImportPathCache.set(cacheKey, result);
          return result;
        }
      }
    }
  }

  // 2. Try enhanced-resolve (handles package.json exports field and modern resolution)
  try {
    const resolver = ResolverFactory.createResolver({
      useSyncFileSystemCalls: true,
      fileSystem: fs as any,
      extensions,
      // Include 'development' condition to resolve to source files in monorepos
      conditionNames: parsingOptions.conditionNames, // defaults to ['browser', 'module', 'import', 'require', 'default']. See generateSettings.ts for more details
      exportsFields: ['exports'],
      mainFields,
    });

    const resolved = resolver.resolveSync({}, basedir, importPath);
    if (resolved) {
      result = resolved;
      resolveImportPathCache.set(cacheKey, result);
      return result;
    }
  } catch {
    // Fall through to next resolution strategy
  }

  // 3. Fallback to Node.js resolution (handles relative paths and node_modules)
  try {
    result = resolve.sync(importPath, { basedir, extensions });
    resolveImportPathCache.set(cacheKey, result);
    return result;
  } catch {
    // If resolution fails, try to manually replace .js/.jsx with .ts/.tsx for source files
    if (importPath.endsWith('.js')) {
      const tsPath = importPath.replace(/\.js$/, '.ts');
      try {
        result = resolve.sync(tsPath, { basedir, extensions });
        resolveImportPathCache.set(cacheKey, result);
        return result;
      } catch {
        // Continue to return null
      }
    } else if (importPath.endsWith('.jsx')) {
      const tsxPath = importPath.replace(/\.jsx$/, '.tsx');
      try {
        result = resolve.sync(tsxPath, { basedir, extensions });
        resolveImportPathCache.set(cacheKey, result);
        return result;
      } catch {
        // Continue to return null
      }
    }
    resolveImportPathCache.set(cacheKey, null);
    return null;
  }
}
