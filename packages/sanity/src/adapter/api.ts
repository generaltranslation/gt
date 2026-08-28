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
import { resolveCanonicalLocale } from 'generaltranslation';
import { defaultBaseUrl, unwrapApiResult } from 'generaltranslation/internal';
import type {
  CustomMapping,
  DownloadedFile,
  FileFormat,
} from 'generaltranslation/types';

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
    return unwrapApiResult(
      await getTranslationStatus({
        path: { fileId },
        query: queryParams,
        client,
      })
    );
  },

  async downloadFile(query: {
    fileId: string;
    versionId?: string;
    branchId?: string;
    locale?: string;
  }) {
    const { fileId, ...queryParams } = query;
    const response = unwrapApiResult(
      await downloadFile({ path: { fileId }, query: queryParams, client })
    );
    return decodeFileContent(response.data, 'HTML');
  },

  async downloadFileBatch(files: DownloadFilesData['body']) {
    const request = async (batch: DownloadFilesData['body']) =>
      unwrapApiResult(await downloadFiles({ body: batch, client }));
    const responses =
      files.length === 0
        ? [await request([])]
        : await processBatches(files, async (batch) => [await request(batch)]);
    return {
      files: responses.flatMap((response) =>
        response.files.map((file) => ({
          ...file,
          data: decodeFileContent(file.data, file.fileFormat),
          fileFormat: file.fileFormat as FileFormat,
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
    return unwrapApiResult(await getFileInfo({ body, client }));
  },

  async createBranch(body: CreateBranchData['body']) {
    return unwrapApiResult(await createBranch({ body, client }));
  },
};
