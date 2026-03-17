import { Libraries } from '../../types/libraries.js';
import { resolveGtDependency } from './resolveGtDependency.js';

/**
 * Parse requirements.txt for GT dependencies.
 * Each line is a package specification: package[extras]>=version
 */
export function matchRequirementsTxtDependency(
  content: string
): typeof Libraries.GT_FLASK | typeof Libraries.GT_FASTAPI | null {
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.split('#')[0].trim();
    if (!trimmed || trimmed.startsWith('-')) continue;
    // Extract package name before version specifiers, extras, or markers
    const pkgName = trimmed.split(/[><=!~;@\s[]/)[0].trim();
    if (pkgName) {
      const result = resolveGtDependency(pkgName);
      if (result) return result;
    }
  }
  return null;
}
