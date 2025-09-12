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
export async function _uploadSourceFiles(
  files: { source: FileUpload }[],
  options: RequiredUploadFilesOptions,
  config: TranslationRequestConfig
): Promise<any> {
  const timeout = Math.min(options?.timeout || maxTimeout, maxTimeout);
  const url = `${config.baseUrl || defaultBaseUrl}/v2/project/files/uploadFiles`;

  const body = {
    data: files.map(({ source }) => ({
      source: {
        content: source.content,
        fileName: source.fileName,
        fileFormat: source.fileFormat,
        locale: source.locale,
        ...(source.dataFormat && { dataFormat: source.dataFormat }),
      },
    })),
    sourceLocale: options.sourceLocale,
    ...(options.modelProvider && { modelProvider: options.modelProvider }),
  } satisfies {
    data: Array<{ source: {
      content: string; fileName: string; fileFormat: FileUpload['fileFormat'];
      locale: string; dataFormat?: FileUpload['dataFormat'];
    }}>;
    sourceLocale: string;
    modelProvider?: string;
  };

  let response: Response | undefined;
  try {
    response = await fetchWithTimeout(
      url,
      { method: 'POST', headers: generateRequestHeaders(config, false), body: JSON.stringify(body) },
      timeout
    );
  } catch (err) {
    handleFetchError(err, timeout);
  }

  await validateResponse(response);
  return response!.json();
}

// Upload translations for existing sources
export async function _uploadTranslations(
  files: {
    source: FileUpload;
    translations: FileUpload[];
  }[],
  options: RequiredUploadFilesOptions,
  config: TranslationRequestConfig
): Promise<any> {
  const timeout = Math.min(options?.timeout || maxTimeout, maxTimeout);
  const url = `${config.baseUrl || defaultBaseUrl}/v2/project/files/uploadTranslations`;

  const body = {
    data: files.map(({ source, translations }) => ({
      source: {
        fileName: source.fileName,
        fileFormat: source.fileFormat,
        ...(source.dataFormat && { dataFormat: source.dataFormat }),
      },
      translations: translations.map((t) => ({
        content: t.content,
        fileName: t.fileName,
        fileFormat: t.fileFormat,
        ...(t.dataFormat && { dataFormat: t.dataFormat }),
        locale: t.locale,
      })),
    })),
    sourceLocale: options.sourceLocale,
    ...(options.modelProvider && { modelProvider: options.modelProvider }),
  };

  let response: Response | undefined;
  try {
    response = await fetchWithTimeout(
      url,
      { method: 'POST', headers: generateRequestHeaders(config, false), body: JSON.stringify(body) },
      timeout
    );
  } catch (err) {
    handleFetchError(err, timeout);
  }

  await validateResponse(response);
  return response!.json();
}
