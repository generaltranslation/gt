import { Settings } from '../../../types/index.js';
import { applyMintlifyTitleFallback } from '../../../utils/mintlifyTitleFallback.js';
import wrapPlainUrls from '../../../utils/wrapPlainUrls.js';

/**
 * Runs all Mintlify-specific preprocessing on file content.
 */
export function preprocessMintlify(
  content: string,
  filePath: string,
  fileType: string,
  settings: Settings
): string {
  let result = content;

  if (
    fileType === 'mdx' &&
    settings.options?.mintlify?.inferTitleFromFilename
  ) {
    result = applyMintlifyTitleFallback(
      result,
      filePath,
      settings.defaultLocale
    ).content;
  }

  if (fileType === 'mdx') {
    result = wrapPlainUrls(result);
  }

  return result;
}
