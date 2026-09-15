import {
  downloadFile,
  getTranslationStatus,
  type ApiClientConfig,
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

  async querySourceFile(query: {
    fileId: string;
    versionId?: string;
    branchId?: string;
  }) {
    const { fileId, ...queryParams } = query;
    const result = unwrapApiResult(
      await getTranslationStatus({
        path: { fileId },
        query: queryParams,
        client: getClient(),
      })
    );
    return {
      ...result,
      translations: result.translations.map((translation) => ({
        ...translation,
        locale: sharedApi.resolveAliasLocale(translation.locale),
      })),
      sourceFile: {
        ...result.sourceFile,
        sourceLocale: sharedApi.resolveAliasLocale(
          result.sourceFile.sourceLocale
        ),
        locales: result.sourceFile.locales.map((locale) =>
          sharedApi.resolveAliasLocale(locale)
        ),
      },
    };
  },

  async downloadFile(query: {
    fileId: string;
    versionId?: string;
    branchId?: string;
    locale?: string;
  }) {
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

  async downloadFileBatch(
    files: Parameters<typeof sharedApi.downloadFileBatch>[0]
  ) {
    const { pending: _pending, ...result } =
      await sharedApi.downloadFileBatch(files);
    return result;
  },
};
