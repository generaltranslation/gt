import { Settings } from '../../types/index.js';
import { preprocessMdx } from './preprocess/mdx.js';
import { preprocessMintlify } from './preprocess/mintlify.js';
import sanitizeFileContent from '../../utils/sanitizeFileContent.js';

/**
 * Preprocesses file content before upload. Returns the processed content,
 * or { skip: reason } if the file should be skipped.
 */
export function preprocessContent(
  content: string,
  filePath: string,
  fileType: string,
  settings: Settings
): string | { skip: string } {
  let result = content;

  // File-type-specific
  if (fileType === 'mdx') {
    const skipReason = preprocessMdx(result, filePath, settings);
    if (skipReason) return { skip: skipReason };
  }

  // Framework-specific
  if (settings.framework === 'mintlify') {
    result = preprocessMintlify(result, filePath, fileType, settings);
  }

  // Universal
  result = sanitizeFileContent(result);

  return result;
}
