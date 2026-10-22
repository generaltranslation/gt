import {
  createProject,
  upsertAssets,
  type CreateProjectData,
  type CreateProjectResponse,
  type UpsertAssetsData,
  type UpsertAssetsResponse,
} from '@generaltranslation/api';
import {
  apiVersionHeaders,
  createGtApiClient,
  resolveServiceLocale,
  writeInBatches,
} from './apiClient';
import type { GTAccountConfig } from './clientConfig';
import { unwrapApiResult } from './translate/utils/unwrapApiResult';

// The server accepts at most 10 fonts per request.
const UPSERT_ASSETS_BATCH_SIZE = 10;

/**
 * Operations on one organization. Created by `account.org()`.
 */
export class OrgHandle {
  /** @internal */
  constructor(
    private readonly params: Readonly<GTAccountConfig>,
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
    assets: UpsertAssetsData['body']['assets'],
    options: { timeout?: number } = {}
  ): Promise<UpsertAssetsResponse> {
    const request = {
      client: createGtApiClient(this.params, options.timeout),
      headers: apiVersionHeaders(),
      path: { orgId: this.orgId },
    };
    return writeInBatches(assets, UPSERT_ASSETS_BATCH_SIZE, async (batch) =>
      unwrapApiResult(
        await upsertAssets({ ...request, body: { assets: batch } })
      )
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
    const { project } = unwrapApiResult(
      await createProject({
        path: { orgId: this.orgId },
        body: {
          ...body,
          defaultLocale: resolveServiceLocale(
            body.defaultLocale,
            this.params.localeConfig?.customMapping
          ),
        },
        client: createGtApiClient(this.params),
      })
    );
    return { project: { ...project, defaultLocale: body.defaultLocale } };
  }
}
