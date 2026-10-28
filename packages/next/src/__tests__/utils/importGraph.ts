import { existsSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

// Shared by the RSC and compat leak tests, which walk the source import graph.

/**
 * Specifiers of static runtime imports, re-exports, side-effect imports and
 * require() calls. Type-only imports are skipped.
 */
export function getRuntimeImports(code: string): string[] {
  const pattern =
    /(?:^|\n)\s*(?:import|export)\s+(type\s+)?[^'";]*?from\s*['"]([^'"]+)['"]|(?:^|\n)\s*import\s*['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)/g;
  const specifiers: string[] = [];
  for (const match of code.matchAll(pattern)) {
    if (match[1]) continue;
    const specifier = match[2] ?? match[3] ?? match[4];
    if (specifier) specifiers.push(specifier);
  }
  return specifiers;
}

/**
 * Resolves a relative specifier to a repo-relative source file, or null.
 */
export function resolveRelative(
  repoRoot: string,
  specifier: string,
  fromFile: string
): string | null {
  const base = resolve(repoRoot, dirname(fromFile), specifier);
  for (const suffix of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
    const candidate = base + suffix;
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return relative(repoRoot, candidate).split('\\').join('/');
    }
  }
  return null;
}
