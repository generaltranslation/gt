import { TranslationRequestConfig } from '../types';
import { defaultBaseUrl } from '../settings/settingsUrls';
import fetchWithTimeout from './utils/fetchWithTimeout';
import { maxTimeout } from '../settings/settings';
import validateResponse from './utils/validateResponse';
import handleFetchError from './utils/handleFetchError';
import generateRequestHeaders from './utils/generateRequestHeaders';

import {
  FileUpload,
  RequiredUploadFilesOptions,
} from '../types-dir/uploadFiles';

// Upload translations for existing sources
export default async function _uploadTranslations(
  files: {
    source: FileUpload;
    translations: FileUpload[];
  }[],
  options: RequiredUploadFilesOptions,
  config: TranslationRequestConfig
): Promise<any> {
  const timeout = Math.min(options?.timeout || maxTimeout, maxTimeout);
  const url = `${config.baseUrl || defaultBaseUrl}/v2/project/files/upload-translations`;

  const body = {
    data: files.map(({ source, translations }) => ({
      source: {
        content: Buffer.from(source.content).toString('base64'),
        fileName: source.fileName,
        fileFormat: source.fileFormat,
        locale: source.locale,
        ...(source.dataFormat && { dataFormat: source.dataFormat }),
      },
      translations: translations.map((t) => ({
        content: Buffer.from(t.content).toString('base64'),
        fileName: t.fileName,
        fileFormat: t.fileFormat,
        ...(t.dataFormat && { dataFormat: t.dataFormat }),
        locale: t.locale,
      })),
    })),
    sourceLocale: options.sourceLocale,
  };

  let response: Response | undefined;
  try {
    response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: generateRequestHeaders(config, false),
        body: JSON.stringify(body),
      },
      timeout
    );
  } catch (err) {
    handleFetchError(err, timeout);
  }

  await validateResponse(response);
  return response!.json();
}
