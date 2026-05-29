import type { Settings } from '../../../types/index.js';
import localizeMintlifyFrontmatterUrls from '../../../utils/localizeMintlifyFrontmatterUrls.js';
import processOpenApi from '../../../utils/processOpenApi.js';

/**
 * Runs all Mintlify-specific postprocessing on translated files.
 */
export async function postprocessMintlify(
  settings: Settings,
  includeFiles?: Set<string>
) {
  if (settings.framework !== 'mintlify' && !settings.options?.mintlify?.openapi)
    return;

  await processOpenApi(settings, includeFiles);

  if (settings.framework !== 'mintlify') return;

  await localizeMintlifyFrontmatterUrls(settings, includeFiles);
}
