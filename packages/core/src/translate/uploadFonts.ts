import { TranslationRequestConfig } from '../types';
import { apiRequest } from './utils/apiRequest';
import { processBatches } from './utils/batch';

import {
  AssetUpload,
  UploadAssetsResponse,
} from '../types-dir/api/uploadAssets';

// Fonts are large binary payloads (often hundreds of KB each once
// base64-encoded), so batches are kept smaller than the default of 100 used
// for text-file uploads to bound the request body size.
const FONT_UPLOAD_BATCH_SIZE = 50;

/**
 * @internal
 * Uploads project fonts to the General Translation API in batches. Idempotent
 * on the server (re-running only stores genuinely new fonts). `content` is
 * already base64-encoded by the caller (fonts are binary).
 */
export async function _uploadFonts(
  fonts: AssetUpload[],
  options: { timeout?: number },
  config: TranslationRequestConfig
) {
  return processBatches(
    fonts,
    async (batch) => {
      const body = {
        assets: batch.map((font) => ({
          assetType: font.assetType,
          content: font.content,
          fileName: font.fileName,
        })),
      };

      const result = await apiRequest<UploadAssetsResponse>(
        config,
        '/v2/project/assets',
        { body, timeout: options.timeout }
      );

      return result.assets || [];
    },
    { batchSize: FONT_UPLOAD_BATCH_SIZE }
  );
}
