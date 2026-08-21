import type { Settings } from '../../../types/index.js';
import localizeMintlifyFrontmatterUrls from '../../../utils/localizeMintlifyFrontmatterUrls.js';
import processOpenApi from '../../../utils/processOpenApi.js';

type MintlifyPostprocessOptions = {
  processDefaultLocaleFiles?: boolean;
};

/**
 * Runs all Mintlify-specific postprocessing on translated files.
 */
export async function postprocessMintlify(
  settings: Settings,
  includeFiles?: Set<string>,
  options: MintlifyPostprocessOptions = {}
) {
  if (settings.framework !== 'mintlify' && !settings.options?.mintlify?.openapi)
    return;

  await processOpenApi(settings, includeFiles, options);

  if (settings.framework !== 'mintlify') return;

  await localizeMintlifyFrontmatterUrls(settings, includeFiles);
}
