import {
  downloadFile,
  type ApiClientConfig,
  type DownloadFileData,
  type GetTranslationStatusData,
} from 'generaltranslation/api';
import {
  createGtApiAdapter,
  decode as decodeBase64,
  defaultBaseUrl,
  unwrapApiResult,
} from 'generaltranslation/internal';
import type { CustomMapping } from 'generaltranslation/types';

const {
  configure: configureSharedApi,
  getClient,
  getClientConfig: _getClientConfig,
  ...sharedApi
} = createGtApiAdapter({ baseUrl: defaultBaseUrl });

export function configureApiClient(
  config: Omit<ApiClientConfig, 'baseUrl'> & {
    baseUrl?: string;
    customMapping?: CustomMapping;
  }
): void {
  configureSharedApi({ baseUrl: defaultBaseUrl, ...config });
}

export const api = {
  ...sharedApi,

  async querySourceFile(
    query: GetTranslationStatusData['path'] &
      NonNullable<GetTranslationStatusData['query']>
  ) {
    const { fileId, ...queryParams } = query;
    return sharedApi.querySourceFile({ fileId }, queryParams);
  },

  async downloadFile(
    query: DownloadFileData['path'] & NonNullable<DownloadFileData['query']>
  ) {
    const { fileId, locale, ...queryParams } = query;
    const response = unwrapApiResult(
      await downloadFile({
        path: { fileId },
        query: {
          ...queryParams,
          locale: locale ? sharedApi.resolveCanonicalLocale(locale) : undefined,
        },
        client: getClient(),
      })
    );
    // The single-file response omits fileFormat; Sanity downloads serialized
    // document translations here, which are always base64 text (never LOTTIE).
    return decodeBase64(response.data);
  },
};
