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

// Upload only source files
export default async function _uploadSourceFiles(
  files: { source: FileUpload }[],
  options: RequiredUploadFilesOptions,
  config: TranslationRequestConfig
): Promise<any> {
  const timeout = Math.min(options?.timeout || maxTimeout, maxTimeout);
  const url = `${config.baseUrl || defaultBaseUrl}/v2/project/files/upload-files`;

  const body = {
    data: files.map(({ source }) => ({
      source: {
        content: Buffer.from(source.content).toString('base64'),
        fileName: source.fileName,
        fileFormat: source.fileFormat,
        locale: source.locale,
        ...(source.dataFormat && { dataFormat: source.dataFormat }),
      },
    })),
    sourceLocale: options.sourceLocale,
  } satisfies {
    data: Array<{
      source: {
        content: string;
        fileName: string;
        fileFormat: FileUpload['fileFormat'];
        locale: string;
        dataFormat?: FileUpload['dataFormat'];
      };
    }>;
    sourceLocale: string;
    modelProvider?: string;
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
