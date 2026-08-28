import type { CustomMapping } from '@generaltranslation/format/types';
import {
  createApiClient,
  createProject,
  createTag,
  getBranchInfo,
  getOrphanedFiles,
  getProjectInfo,
  getTranslationJobInfo,
  processBatches,
  processFileMoves,
  publishFiles,
  submitUserEditDiffs,
  type ApiClientConfig,
  type CreateProjectData,
  type CreateTagData,
  type GetBranchInfoData,
  type ProcessFileMovesData,
  type PublishFilesData,
  type SubmitUserEditDiffsData,
} from 'generaltranslation/api';
import {
  createGtApiAdapter,
  unwrapApiResult,
} from 'generaltranslation/internal';

const {
  configure: configureSharedApi,
  getClient,
  getClientConfig,
  ...sharedApi
} = createGtApiAdapter();

export function configureApiClient(
  config: ApiClientConfig & { customMapping?: CustomMapping }
): void {
  configureSharedApi(config);
}

export function createNonRetryingApiClient(config: ApiClientConfig) {
  return createApiClient({ ...config, retryPolicy: 'none' });
}

export const api = {
  ...sharedApi,
  async queryBranchData(body: GetBranchInfoData['body']) {
    return unwrapApiResult(await getBranchInfo({ body, client: getClient() }));
  },

  async checkJobStatus(jobIds: string[]) {
    return unwrapApiResult(
      await getTranslationJobInfo({
        body: { jobIds },
        client: getClient(),
      })
    );
  },

  async getProjectInfo(timeoutMs?: number) {
    const config = getClientConfig();
    if (!config.projectId) {
      throw new Error('Project ID is required to fetch project information');
    }
    const projectInfoClient = timeoutMs
      ? createApiClient({ ...config, timeoutMs })
      : getClient();
    return unwrapApiResult(
      await getProjectInfo({
        client: projectInfoClient,
        path: { projectId: config.projectId },
      })
    );
  },

  async publishFiles(files: PublishFilesData['body']['files']) {
    return unwrapApiResult(
      await publishFiles({ body: { files }, client: getClient() })
    );
  },

  async submitUserEditDiffs(body: SubmitUserEditDiffsData['body']) {
    return processBatches(body.diffs, async (diffs) => [
      unwrapApiResult(
        await submitUserEditDiffs({
          body: {
            projectId: body.projectId,
            diffs: diffs.map((diff) => ({
              ...diff,
              locale: sharedApi.resolveCanonicalLocale(diff.locale),
            })),
          },
          client: getClient(),
        })
      ),
    ]);
  },

  async createTag(body: CreateTagData['body']) {
    return unwrapApiResult(await createTag({ body, client: getClient() }));
  },

  async createProject(body: CreateProjectData['body']) {
    return unwrapApiResult(
      await createProject({
        body: {
          ...body,
          defaultLocale: sharedApi.resolveCanonicalLocale(body.defaultLocale),
        },
        client: getClient(),
      })
    );
  },

  // ponytail: duplicates core/src/translate/getOrphanedFiles.ts batching +
  // intersection; delete one copy when utils/gt.ts is removed.
  async getOrphanedFiles(branchId: string, fileIds: string[]) {
    const request = async (batch: string[]) =>
      unwrapApiResult(
        await getOrphanedFiles({
          body: { branchId, fileIds: batch },
          client: getClient(),
        })
      );

    if (fileIds.length === 0) return request([]);

    const results = await processBatches(fileIds, async (batch) => [
      await request(batch),
    ]);
    const orphanedFiles = new Map(
      results[0].orphanedFiles.map((file) => [file.fileId, file])
    );
    for (const result of results.slice(1)) {
      const batchFileIds = new Set(
        result.orphanedFiles.map((file) => file.fileId)
      );
      for (const fileId of orphanedFiles.keys()) {
        if (!batchFileIds.has(fileId)) orphanedFiles.delete(fileId);
      }
    }
    return { orphanedFiles: [...orphanedFiles.values()] };
  },

  async processFileMoves(
    moves: ProcessFileMovesData['body']['moves'],
    options: Pick<ProcessFileMovesData['body'], 'branchId'>
  ) {
    const result = await processBatches(moves, async (batch) => {
      const response = unwrapApiResult(
        await processFileMoves({
          body: { branchId: options.branchId, moves: batch },
          client: getClient(),
        })
      );
      return response.results;
    });
    const succeeded = result.filter(({ success }) => success).length;

    return {
      results: result,
      summary: {
        total: moves.length,
        succeeded,
        failed: result.length - succeeded,
      },
    };
  },
};

export type ApiClient = typeof api;
