import { TranslationRequestConfig } from '../types';
import apiRequest from './utils/apiRequest';
import { processBatches } from './utils/batch';

import {
  FileUpload,
  UploadFilesResponse,
  RequiredUploadFilesOptions,
} from '../types-dir/api/uploadFiles';
import { encode } from '../utils/base64';

/**
 * @internal
 * Uploads multiple translations to the General Translation API in batches.
 * @param files - Translations to upload with their source
 * @param options - The options for the API call
 * @param config - The configuration for the API call
 * @returns Promise resolving to a BatchList with all uploaded files
 */
export default async function _uploadTranslations(
  files: {
    source: FileUpload;
    translations: FileUpload[];
  }[],
  options: RequiredUploadFilesOptions,
  config: TranslationRequestConfig
) {
  return processBatches(
    files,
    async (batch) => {
      const body = {
        data: batch.map(({ source, translations }) => ({
          source: {
            content: encode(source.content),
            fileName: source.fileName,
            fileFormat: source.fileFormat,
            locale: source.locale,
            dataFormat: source.dataFormat,
            formatMetadata: source.formatMetadata,
            fileId: source.fileId,
            versionId: source.versionId,
            branchId: source.branchId,
          },
          translations: translations.map((t) => ({
            content: encode(t.content),
            fileName: t.fileName,
            fileFormat: t.fileFormat,
            locale: t.locale,
            dataFormat: t.dataFormat,
            fileId: t.fileId,
            versionId: t.versionId,
            branchId: t.branchId,
          })),
        })),
        sourceLocale: options.sourceLocale,
      };

      const result = await apiRequest<UploadFilesResponse>(
        config,
        '/v2/project/files/upload-translations',
        { body, timeout: options.timeout }
      );

      return result.uploadedFiles || [];
    },
    { batchSize: 100 }
  );
}
