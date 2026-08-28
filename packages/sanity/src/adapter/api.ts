import {
  awaitJobs as awaitApiJobs,
  createApiClient,
  createBranch,
  decodeFileContent,
  downloadFile,
  downloadFiles,
  encodeFileContent,
  enqueueFileTranslations,
  generateProjectContext,
  getFileInfo,
  getTranslationStatus,
  processBatches,
  uploadSourceFiles,
  uploadTranslations,
  type ApiClientConfig,
  type CreateBranchData,
  type DownloadFilesData,
  type EnqueueFileTranslationsData,
  type GenerateProjectContextData,
  type GetFileInfoData,
  type UploadSourceFilesData,
  type UploadTranslationsData,
} from 'generaltranslation/api';
import { resolveAliasLocale, resolveCanonicalLocale } from 'generaltranslation';
import {
  decode as decodeBase64,
  defaultBaseUrl,
  unwrapApiResult,
} from 'generaltranslation/internal';
import type { CustomMapping, DownloadedFile } from 'generaltranslation/types';

let client = createApiClient({ baseUrl: defaultBaseUrl });
let customMapping: CustomMapping | undefined;

export function configureApiClient(
  config: Omit<ApiClientConfig, 'baseUrl'> & {
    baseUrl?: string;
    customMapping?: CustomMapping;
  }
): void {
  const { customMapping: mapping, ...clientConfig } = config;
  client = createApiClient({
    baseUrl: defaultBaseUrl,
    ...clientConfig,
  });
  customMapping = mapping;
}

export const api = {
  async uploadSourceFiles(
    files: Array<{
      source: UploadSourceFilesData['body']['data'][number]['source'];
    }>,
    options: { sourceLocale: string }
  ) {
    const sourceLocale = resolveCanonicalLocale(
      options.sourceLocale,
      customMapping
    );
    const result = await processBatches(files, async (batch) => {
      const response = unwrapApiResult(
        await uploadSourceFiles({
          body: {
            data: batch.map(({ source }) => ({
              source: {
                ...source,
                content: encodeFileContent(source.content, source.fileFormat),
                locale: resolveCanonicalLocale(source.locale, customMapping),
              },
            })),
            sourceLocale,
          },
          client,
        })
      );
      return response.uploadedFiles;
    });
    return { uploadedFiles: result };
  },

  async uploadTranslations(
    files: UploadTranslationsData['body']['data'],
    options: { sourceLocale: string }
  ) {
    const result = await processBatches(files, async (batch) => {
      const response = unwrapApiResult(
        await uploadTranslations({
          body: {
            data: batch.map(({ source, translations }) => ({
              source: {
                ...source,
                content: encodeFileContent(source.content, source.fileFormat),
              },
              translations: translations.map((translation) => ({
                ...translation,
                content: encodeFileContent(
                  translation.content,
                  translation.fileFormat
                ),
                locale: resolveCanonicalLocale(
                  translation.locale,
                  customMapping
                ),
              })),
            })),
            sourceLocale: resolveCanonicalLocale(
              options.sourceLocale,
              customMapping
            ),
          },
          client,
        })
      );
      return response.uploadedFiles;
    });
    return { uploadedFiles: result };
  },

  async enqueueFiles(
    files: EnqueueFileTranslationsData['body']['files'],
    options: {
      sourceLocale?: string;
      targetLocales: string[];
      force?: boolean;
    }
  ) {
    const sourceLocale = options.sourceLocale
      ? resolveCanonicalLocale(options.sourceLocale, customMapping)
      : undefined;
    const targetLocales = options.targetLocales.map((locale) =>
      resolveCanonicalLocale(locale, customMapping)
    );
    const result = await processBatches(files, async (batch) => {
      const response = unwrapApiResult(
        await enqueueFileTranslations({
          body: {
            files: batch,
            sourceLocale,
            targetLocales,
            force: options.force,
          },
          client,
        })
      );
      return Object.entries(
        'jobData' in response ? response.jobData : response.data
      );
    });
    return { jobData: Object.fromEntries(result), locales: targetLocales };
  },

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
        client,
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
        client,
      })
    );
    // The single-file response omits fileFormat; Sanity downloads serialized
    // document translations here, which are always base64 text (never LOTTIE).
    return decodeBase64(response.data);
  },

  async downloadFileBatch(files: DownloadFilesData['body']) {
    if (files.length === 0) return { files: [], count: 0 };

    const request = async (batch: DownloadFilesData['body']) =>
      unwrapApiResult(
        await downloadFiles({
          body: batch.map((file) => ({
            ...file,
            locale: file.locale
              ? resolveCanonicalLocale(file.locale, customMapping)
              : undefined,
          })),
          client,
        })
      );
    const responses = await processBatches(files, async (batch) => [
      await request(batch),
    ]);
    return {
      files: responses.flatMap((response) =>
        response.files.map((file) => ({
          ...file,
          ...(file.locale && {
            locale: resolveAliasLocale(file.locale, customMapping),
          }),
          data: decodeFileContent(file.data, file.fileFormat),
          // OpenAPI currently types metadata as an open object; the API emits
          // JSON values here, matching DownloadedFile's public contract.
          metadata: file.metadata as DownloadedFile['metadata'],
        }))
      ),
      count: responses.reduce((count, response) => count + response.count, 0),
    };
  },

  async setupProject(
    files: GenerateProjectContextData['body']['files'],
    options: Omit<GenerateProjectContextData['body'], 'files'> = {}
  ) {
    return unwrapApiResult(
      await generateProjectContext({ body: { files, ...options }, client })
    );
  },

  async awaitJobs(
    jobIds: readonly string[],
    options?: Parameters<typeof awaitApiJobs>[2]
  ) {
    return awaitApiJobs(client, jobIds, options);
  },

  async queryFileData(body: GetFileInfoData['body']) {
    const result = unwrapApiResult(
      await getFileInfo({
        body: {
          ...body,
          translatedFiles: body.translatedFiles?.map((file) => ({
            ...file,
            locale: resolveCanonicalLocale(file.locale, customMapping),
          })),
        },
        client,
      })
    );
    return {
      ...result,
      translatedFiles: result.translatedFiles.map((file) => ({
        ...file,
        locale: resolveAliasLocale(file.locale, customMapping),
      })),
      sourceFiles: result.sourceFiles.map((file) => ({
        ...file,
        sourceLocale: resolveAliasLocale(file.sourceLocale, customMapping),
        locales: file.locales.map((locale) =>
          resolveAliasLocale(locale, customMapping)
        ),
      })),
    };
  },

  async createBranch(body: CreateBranchData['body']) {
    return unwrapApiResult(await createBranch({ body, client }));
  },
};
