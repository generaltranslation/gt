import { Settings } from '../../../types/index.js';
import { isValidMdx } from '../../../utils/validateMdx.js';

/**
 * Runs MDX-specific preprocessing. Returns a skip reason if the file
 * should be skipped, or null if validation passed.
 */
export function preprocessMdx(
  content: string,
  filePath: string,
  settings: Settings
): string | null {
  if (!settings.options?.skipFileValidation?.mdx) {
    const validation = isValidMdx(content, filePath);
    if (!validation.isValid) {
      return `MDX file is not AST parsable${validation.error ? `: ${validation.error}` : ''}`;
    }
  }
  return null;
}
