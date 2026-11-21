import {
  createApiClient,
  createAssetUploads,
  createOrgApiKey,
  createProject,
  ErrorCode,
  jsonByteLength,
  MAX_REQUEST_BODY_BYTES,
  upsertAssets,
  type CreateOrgApiKeyData,
  type CreateOrgApiKeyResponse,
  type CreateProjectData,
  type CreateProjectResponse,
  type UpsertAssetsResponse,
} from '@generaltranslation/api';
import {
  apiVersionHeaders,
  resolveServiceLocale,
  writeInBatches,
  type ApiClientSettings,
  type BatchWriteResponse,
} from './apiClient';
import type { CustomMapping } from '@generaltranslation/format';
import {
  base64Content,
  contentBytes,
  contentOrUpload,
  uploadContents,
} from '../translate/uploadContents';
import { unwrapApiResult } from '../translate/utils/unwrapApiResult';
import type { AssetUpload } from '../types-dir/api/uploadFiles';

// The server accepts at most 10 fonts per request.
const UPSERT_ASSETS_BATCH_SIZE = 10;

/**
 * Operations on one organization. Created by `account.org()`.
 */
export class OrgHandle {
  /** @internal */
  constructor(
    private readonly clientSettings: ApiClientSettings,
    private readonly customMapping: CustomMapping | undefined,
    private readonly orgId: string
  ) {}

  /**
   * Uploads fonts used when translating formats that need the source font.
   * Persistent and reused across translation jobs for the organization's
   * projects, in batches the server accepts. A font can fail on its own;
   * check `summary.failed` and each result's `status`.
   *
   * @param assets - Fonts to upload (`content` base64-encoded).
   * @returns The summary and one result per font, in request order.
   */
  async upsertAssets(
    assets: AssetUpload[],
    options: { timeout?: number } = {}
  ): Promise<BatchWriteResponse<UpsertAssetsResponse>> {
    const request = {
      client: createApiClient({
        ...this.clientSettings,
        timeoutMs: options.timeout ?? this.clientSettings.timeoutMs,
      }),
      headers: apiVersionHeaders(),
      path: { orgId: this.orgId },
    };
    return writeInBatches(
      assets,
      UPSERT_ASSETS_BATCH_SIZE,
      async (batch) => {
        const fields = batch.map(({ content: _, ...asset }) => asset);
        const contents = batch.map(({ content }) => [base64Content(content)]);
        const uploaded = await uploadContents(
          async (files) =>
            unwrapApiResult(
              await createAssetUploads({
                ...request,
                body: {
                  files: files.map(({ sha256, size }) => ({ sha256, size })),
                },
              })
            ).files,
          contents,
          jsonByteLength({ assets: fields }),
          options.timeout
        );
        return unwrapApiResult(
          await upsertAssets({
            ...request,
            body: {
              assets: fields.map((asset, index) => ({
                ...asset,
                ...contentOrUpload(contents[index][0], uploaded[index][0]),
              })),
            },
          })
        );
      },
      ({ fileName }, { error, code = ErrorCode.INTERNAL_ERROR }) => [
        { fileName, status: 'failed' as const, error, code },
      ],
      {
        // One batch at a time bounds the bytes in flight, as for file uploads.
        parallel: false,
        // A font sent by upload gets a request of its own, because the API refuses a whole request for one font over its size limit.
        byteLength: ({ content, ...asset }) => {
          const font = base64Content(content);
          return font.inlineBytes > MAX_REQUEST_BODY_BYTES
            ? Infinity
            : jsonByteLength(asset) + contentBytes([[font]]);
        },
      }
    );
  }

  /**
   * Creates a project in the organization.
   *
   * @param body - The project `name`, `defaultLocale`, and settings.
   * @returns The created project, with `defaultLocale` as passed.
   */
  async createProject(
    body: CreateProjectData['body']
  ): Promise<CreateProjectResponse> {
    const project = unwrapApiResult(
      await createProject({
        path: { orgId: this.orgId },
        body: {
          ...body,
          defaultLocale: resolveServiceLocale(
            body.defaultLocale,
            this.customMapping
          ),
        },
        client: createApiClient(this.clientSettings),
      })
    );
    return { ...project, defaultLocale: body.defaultLocale };
  }

  /**
   * Creates an API key for the organization with exactly the requested
   * permissions. The returned `key` is shown only once.
   *
   * @param body - The key `name` and `permissions`.
   */
  async createApiKey(
    body: CreateOrgApiKeyData['body']
  ): Promise<CreateOrgApiKeyResponse> {
    return unwrapApiResult(
      await createOrgApiKey({
        path: { orgId: this.orgId },
        body,
        client: createApiClient(this.clientSettings),
      })
    );
  }
}
