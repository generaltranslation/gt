import { Libraries } from '../../types/libraries.js';
import { PYTHON_GT_DEPENDENCIES } from '@generaltranslation/python-extractor';

/**
 * Resolve a dependency name (hyphenated or underscored) to a Python GT library.
 * Per PEP 503, Python package names are normalized: hyphens, underscores, and
 * periods are interchangeable. We match both gt-flask/gt_flask forms.
 */
export function resolveGtDependency(
  pkgName: string
): typeof Libraries.GT_FLASK | typeof Libraries.GT_FASTAPI | null {
  // Normalize: replace underscores/periods with hyphens, lowercase
  const normalized = pkgName.toLowerCase().replace(/[_.]/g, '-');
  for (const dep of PYTHON_GT_DEPENDENCIES) {
    if (normalized === dep) {
      return dep === 'gt-flask' ? Libraries.GT_FLASK : Libraries.GT_FASTAPI;
    }
  }
  return null;
}
