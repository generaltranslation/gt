// `generaltranslation` language toolkit
// © 2026, General Translation, Inc.

// ----- IMPORTS ----- //

import {
  listOrgs,
  listProjects,
  paginate,
  type ListOrgsResponse,
  type ListProjectsResponse,
} from '@generaltranslation/api';
import { createGtApiClient } from './apiClient';
import { OrgHandle } from './orgHandle';
import { ProjectHandle } from './projectHandle';
import { snapshotLocaleConfig } from '@generaltranslation/format/internal';
import {
  credentialScope,
  type GTAccountConfig,
  type GTProjectConfig,
} from './clientConfig';
import {
  noScopeIdProvidedError,
  projectKeyWithoutProjectIdError,
} from './logging/errors';

export { GTRuntime } from './runtime';
export type { LocaleConfig } from '@generaltranslation/format';
export type {
  GTAccountConfig,
  GTCredentials,
  GTProjectConfig,
} from './clientConfig';
export { decodeVars } from './derive/decodeVars';
export { declareVar } from './derive/declareVar';
export { derive } from './derive/derive';

export { GTIntl } from '@generaltranslation/format';

/** Constructs `GT`: project-scoped with `projectId`, account-scoped without. */
type GTConstructor = {
  /**
   * A project-scoped client: every project operation, plus runtime translation.
   *
   * @throws {Error} If `projectId` is not a non-empty string.
   */
  new (params: GTProjectConfig): ProjectHandle;
  /**
   * An account-scoped client: list organizations and projects, and scope work
   * with `project(id)` and `org(id)`.
   *
   * @throws {Error} If `apiKey` is a project key (`gtx-api-`), which needs `projectId`.
   */
  new (params: GTAccountConfig): GTAccount;
  prototype: GTAccount;
};

/**
 * The account-scoped `GT`. Browser-facing SDK code should construct
 * `GTRuntime` instead so production bundles do not ship the file management
 * client.
 */
class GTAccount {
  // Unassigned only on the project-scoped path, which returns another object.
  private readonly params!: Readonly<GTAccountConfig>;

  /** @internal */
  constructor(params: GTProjectConfig | GTAccountConfig) {
    if (params.projectId !== undefined) {
      const project = new ProjectHandle(params);
      // A constructor may return another object; this one is the project-scoped GT.
      return project as unknown as GTAccount;
    }
    if (credentialScope(params) === 'project') {
      throw new Error(projectKeyWithoutProjectIdError);
    }
    this.params = Object.freeze({
      ...params,
      localeConfig: snapshotLocaleConfig(params.localeConfig),
    });
    Object.freeze(this);
  }

  /**
   * Scopes project operations and runtime translation to a project. Sends no request.
   *
   * @param projectId - The project to work on.
   * @throws {Error} If `projectId` is not a non-empty string.
   */
  project(projectId: string): ProjectHandle {
    return new ProjectHandle({ ...this.params, projectId });
  }

  /**
   * Scopes organization operations to an organization. Sends no request.
   * With only a project, read its organization first:
   * `account.org((await account.project(projectId).get()).orgId)`.
   *
   * @param orgId - The organization to work on.
   * @throws {Error} If `orgId` is not a non-empty string.
   */
  org(orgId: string): OrgHandle {
    if (typeof orgId !== 'string' || !orgId.trim())
      throw new Error(noScopeIdProvidedError('org'));
    const org = new OrgHandle(this.params, orgId);
    Object.freeze(org);
    return org;
  }

  /**
   * Lists the organizations the credentials can access, across every page.
   * Listing one does not grant project creation in it.
   */
  async listOrgs(): Promise<ListOrgsResponse['items']> {
    return collect(
      paginate(listOrgs, { client: createGtApiClient(this.params) })
    );
  }

  /**
   * Lists the projects the signed-in user is a member of, or the API key is
   * bound to, across every page.
   */
  async listProjects(): Promise<ListProjectsResponse['items']> {
    return collect(
      paginate(listProjects, { client: createGtApiClient(this.params) })
    );
  }
}

/**
 * GT is the General Translation API client. With `projectId` it is
 * project-scoped ({@link ProjectHandle}); without, it is account-scoped.
 *
 * @example
 * const gt = new GT({ apiKey, projectId, localeConfig });
 * await gt.uploadSourceFiles(files, { sourceLocale: 'en' });
 *
 * @example
 * const account = new GT({ apiKey: orgKey });
 * const projects = await account.listProjects();
 * const project = account.project('prj_123');
 */
export const GT = GTAccount as unknown as GTConstructor;
export type GT = GTAccount;

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of iterable) items.push(item);
  return items;
}

export type { ProjectHandle, OrgHandle };
