import {
  awaitJobs as awaitApiJobs,
  downloadFile,
  getTranslationStatus,
  type ApiClientConfig,
} from 'generaltranslation/api';
import { resolveAliasLocale, resolveCanonicalLocale } from 'generaltranslation';
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
  ...sharedApi
} = createGtApiAdapter({ baseUrl: defaultBaseUrl });
let customMapping: CustomMapping | undefined;

export function configureApiClient(
  config: Omit<ApiClientConfig, 'baseUrl'> & {
    baseUrl?: string;
    customMapping?: CustomMapping;
  }
): void {
  configureSharedApi({ baseUrl: defaultBaseUrl, ...config });
  customMapping = config.customMapping;
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
        locale: resolveAliasLocale(translation.locale, customMapping),
      })),
      sourceFile: {
        ...result.sourceFile,
        sourceLocale: resolveAliasLocale(
          result.sourceFile.sourceLocale,
          customMapping
        ),
        locales: result.sourceFile.locales.map((locale) =>
          resolveAliasLocale(locale, customMapping)
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
          locale: locale
            ? resolveCanonicalLocale(locale, customMapping)
            : undefined,
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

  async awaitJobs(
    jobIds: readonly string[],
    options?: Parameters<typeof awaitApiJobs>[2]
  ) {
    return awaitApiJobs(getClient(), jobIds, options);
  },
};
