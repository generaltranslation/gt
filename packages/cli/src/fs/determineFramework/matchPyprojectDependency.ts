import { Libraries } from '../../types/libraries.js';
import { resolveGtDependency } from './resolveGtDependency.js';

/**
 * Parse pyproject.toml for GT dependencies.
 *
 * Looks in dependency sections ([project], [project.dependencies],
 * [project.optional-dependencies.*], [tool.poetry.dependencies],
 * [tool.poetry.group.*.dependencies]) and extracts quoted package names
 * from array entries or bare key names from poetry-style `pkg = "version"` lines.
 */
export function matchPyprojectDependency(
  content: string
): typeof Libraries.GT_FLASK | typeof Libraries.GT_FASTAPI | null {
  const lines = content.split('\n');
  // Track which section we're in to determine valid dependency locations
  let currentSection = '';
  let inDependencyArray = false;

  for (const line of lines) {
    const trimmed = line.split('#')[0].trim();
    if (!trimmed) continue;

    // Detect section headers
    if (trimmed.startsWith('[')) {
      currentSection = trimmed.toLowerCase();
      inDependencyArray = false;
      continue;
    }

    // Sections where dependency arrays or key-value pairs are valid:
    // - [project] contains `dependencies = [...]` and `optional-dependencies`
    // - [project.dependencies] (less common but valid)
    // - [project.optional-dependencies.*]
    // - [tool.poetry.dependencies]
    // - [tool.poetry.group.*.dependencies]
    const isProjectSection = currentSection === '[project]';
    const isDependencySection =
      currentSection === '[project.dependencies]' ||
      currentSection.startsWith('[project.optional-dependencies') ||
      currentSection === '[tool.poetry.dependencies]' ||
      (currentSection.startsWith('[tool.poetry.group.') &&
        currentSection.endsWith('.dependencies]'));

    if (!isProjectSection && !isDependencySection) continue;

    // Detect start of a dependencies array (e.g., dependencies = ["pkg", ...])
    // Extract the key name precisely to avoid matching keys like dependencies_list
    if (!inDependencyArray) {
      const keyMatch = trimmed.match(/^(dependencies|optional-dependencies)\s*=/);
      if (keyMatch && trimmed.includes('[')) {
        inDependencyArray = true;
      }
    }

    if (inDependencyArray) {
      // Extract quoted package names from array entries like "gt-flask>=1.0.0"
      const matches = trimmed.match(/["']([^"']+)["']/g);
      if (matches) {
        for (const match of matches) {
          const value = match.slice(1, -1); // remove quotes
          // Extract package name before version specifiers
          const pkgName = value.split(/[><=!~;@\s[]/)[0].trim();
          if (pkgName) {
            const result = resolveGtDependency(pkgName);
            if (result) return result;
          }
        }
      }
      if (trimmed.includes(']')) {
        inDependencyArray = false;
      }
      continue;
    }

    // Handle Poetry style: gt-flask = "^1.0.0" or gt_flask = {version = "^1.0"}
    // Only valid in dedicated dependency sections, not under [project]
    if (isDependencySection) {
      const poetryKeyMatch = trimmed.match(/^([a-zA-Z0-9_\-.]+)\s*=/);
      if (poetryKeyMatch) {
        const result = resolveGtDependency(poetryKeyMatch[1]);
        if (result) return result;
      }
    }
  }

  return null;
}
