import { parse } from 'smol-toml';
import { Libraries } from '../../types/libraries.js';
import { resolveGtDependency } from './resolveGtDependency.js';

/**
 * Parse pyproject.toml for GT dependencies using a proper TOML parser.
 *
 * Checks the following locations:
 * - PEP 621: project.dependencies, project.optional-dependencies.*
 * - Poetry: tool.poetry.dependencies, tool.poetry.group.*.dependencies
 */
export function matchPyprojectDependency(
  content: string
): typeof Libraries.GT_FLASK | typeof Libraries.GT_FASTAPI | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let parsed: Record<string, any>;
  try {
    parsed = parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }

  // 1. PEP 621: project.dependencies = ["gt-flask>=1.0", ...]
  const projectDeps = parsed?.project?.dependencies;
  if (Array.isArray(projectDeps)) {
    const result = matchDependencyArray(projectDeps);
    if (result) return result;
  }

  // 2. PEP 621: project.optional-dependencies.* = ["gt-flask", ...]
  const optDeps = parsed?.project?.['optional-dependencies'];
  if (optDeps && typeof optDeps === 'object') {
    for (const group of Object.values(optDeps)) {
      if (Array.isArray(group)) {
        const result = matchDependencyArray(group as string[]);
        if (result) return result;
      }
    }
  }

  // 3. Poetry: tool.poetry.dependencies = { gt-flask = "^1.0", ... }
  const poetryDeps = parsed?.tool?.poetry?.dependencies;
  if (poetryDeps && typeof poetryDeps === 'object') {
    const result = matchDependencyKeys(poetryDeps);
    if (result) return result;
  }

  // 4. Poetry groups: tool.poetry.group.*.dependencies
  const poetryGroups = parsed?.tool?.poetry?.group;
  if (poetryGroups && typeof poetryGroups === 'object') {
    for (const group of Object.values(poetryGroups)) {
      if (group && typeof group === 'object' && 'dependencies' in group) {
        const result = matchDependencyKeys(
          (group as Record<string, unknown>).dependencies as Record<
            string,
            unknown
          >
        );
        if (result) return result;
      }
    }
  }

  return null;
}

/**
 * Check a PEP 508 dependency array (e.g. ["gt-flask>=1.0", "flask[extra]"])
 * for GT dependencies.
 */
function matchDependencyArray(
  deps: string[]
): typeof Libraries.GT_FLASK | typeof Libraries.GT_FASTAPI | null {
  for (const dep of deps) {
    if (typeof dep !== 'string') continue;
    // Extract package name before version specifiers, extras, or markers
    const pkgName = dep.split(/[><=!~;@\s[]/)[0].trim();
    if (pkgName) {
      const result = resolveGtDependency(pkgName);
      if (result) return result;
    }
  }
  return null;
}

/**
 * Check Poetry-style dependency keys (e.g. { gt-flask = "^1.0" })
 * for GT dependencies.
 */
function matchDependencyKeys(
  deps: Record<string, unknown>
): typeof Libraries.GT_FLASK | typeof Libraries.GT_FASTAPI | null {
  for (const key of Object.keys(deps)) {
    const result = resolveGtDependency(key);
    if (result) return result;
  }
  return null;
}
