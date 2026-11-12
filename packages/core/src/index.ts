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
import { createGtApiClient } from './client/apiClient';
import { OrgHandle } from './client/orgHandle';
import { ProjectHandle } from './client/projectHandle';
import { snapshotLocaleConfig } from '@generaltranslation/format/internal';
import {
  credentialScope,
  type GTAccountConfig,
  type GTProjectConfig,
} from './client/clientConfig';
import {
  noScopeIdProvidedError,
  projectKeyWithoutProjectIdError,
} from './logging/errors';

export { GTRuntime, type LocaleConfig } from './runtime';
export type {
  GTAccountConfig,
  GTCredentials,
  GTProjectConfig,
} from './client/clientConfig';
export { decodeVars } from './derive/decodeVars';
export { declareVar } from './derive/declareVar';
export { derive } from './derive/derive';

// `@generaltranslation/format` takes every argument. These resolve what a
// caller leaves out, and nothing outside this package does.
export { GTIntl } from './intl/GTIntl';
export {
  formatCurrency,
  formatCutoff,
  formatDateTime,
  formatList,
  formatListToParts,
  formatMessage,
  formatNum,
  formatRelativeTime,
  formatRelativeTimeFromDate,
} from './formatting/formatting';

/**
 * The account-scoped General Translation client: lists organizations and
 * projects, and scopes work with `project(id)` and `org(id)`.
 */
class GTAccount {
  private readonly params: Readonly<GTAccountConfig>;

  /** @throws {Error} If `apiKey` is a project key (`gtx-api-`), which needs `projectId`. */
  constructor(params: GTAccountConfig) {
    if (credentialScope(params) === 'project') {
      throw new Error(projectKeyWithoutProjectIdError);
    }
    this.params = Object.freeze({
      ...params,
      localeConfig: snapshotLocaleConfig(params.localeConfig ?? {}),
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
  [Symbol.hasInstance](value: unknown): value is ProjectHandle | GTAccount;
};

// A function, because a class constructor can only build its own class. It is
// one pure expression so bundlers can drop it, and both clients, when unused.
/**
 * `GeneralTranslation` is the General Translation API client. With `projectId` it is
 * project-scoped ({@link ProjectHandle}); without, it is account-scoped
 * ({@link GTAccount}). Browser-facing SDK code should construct `GTRuntime`
 * instead so production bundles do not ship the file management client.
 *
 * @example
 * const project = new GeneralTranslation({ apiKey, projectId, localeConfig });
 * await project.uploadSourceFiles(files, { sourceLocale: 'en' });
 *
 * @example
 * const account = new GeneralTranslation({ apiKey: orgKey });
 * const projects = await account.listProjects();
 * const project = account.project('prj_123');
 */
export const GeneralTranslation = /* @__PURE__ */ Object.defineProperty(
  function GeneralTranslation(
    params: GTProjectConfig | GTAccountConfig
  ): ProjectHandle | GTAccount {
    return params.projectId !== undefined
      ? new ProjectHandle(params)
      : new GTAccount(params);
  },
  Symbol.hasInstance,
  {
    value: (value: unknown) =>
      value instanceof ProjectHandle || value instanceof GTAccount,
  }
) as unknown as GTConstructor;
export type GeneralTranslation = ProjectHandle | GTAccount;

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of iterable) items.push(item);
  return items;
}

export { ProjectHandle, GTAccount };
export type { OrgHandle };
