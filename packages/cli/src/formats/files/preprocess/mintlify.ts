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
  if (fileType !== 'mdx') return content;

  let result = content;

  if (settings.options?.mintlify?.inferTitleFromFilename) {
    result = applyMintlifyTitleFallback(
      result,
      filePath,
      settings.defaultLocale
    ).content;
  }

  result = wrapPlainUrls(result);

  return result;
}
