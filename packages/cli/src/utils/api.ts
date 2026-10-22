import {
  GT,
  type GTAccountConfig,
  type GTCredentials,
  type OrgHandle,
  type ProjectHandle,
} from 'generaltranslation';
import {
  resolveCanonicalLocale,
  standardizeLocale,
} from '@generaltranslation/format';
import { snapshotLocaleConfig } from '@generaltranslation/format/internal';
import { defaultBaseUrl } from 'generaltranslation/internal';
import type { CustomMapping } from 'generaltranslation/types';
import { noProjectIdError } from '../console/index.js';
import { createUserTokenProvider } from '../auth/oauth.js';

type ApiClientConfig = GTCredentials & {
  projectId?: string;
  baseUrl?: string;
  customMapping?: CustomMapping;
};

let sharedConfig: ApiClientConfig | undefined;

export function configureApiClient(config: ApiClientConfig): void {
  sharedConfig = {
    ...config,
    customMapping: snapshotLocaleConfig(config).customMapping,
  };
}

// Reads the configuration at call time, so `api` keeps working after configureApiClient.
function accountParams(): GTAccountConfig {
  // Before configureApiClient, requests use the stored login, as without an API key.
  const {
    projectId: _projectId,
    customMapping,
    ...connection
  } = sharedConfig ?? {
    baseUrl: defaultBaseUrl,
    userTokenProvider: createUserTokenProvider({ baseUrl: defaultBaseUrl }),
  };
  return { ...connection, localeConfig: { customMapping } };
}

function project(projectId = sharedConfig?.projectId): ProjectHandle {
  if (!projectId) throw new Error(noProjectIdError);
  return new GT({ ...accountParams(), projectId });
}

function onProject<Name extends keyof ProjectHandle>(
  name: Name
): ProjectHandle[Name] {
  return (async (...args: unknown[]) => {
    const handle = project();
    return (handle[name] as (...args: unknown[]) => unknown).apply(
      handle,
      args
    );
  }) as ProjectHandle[Name];
}

export const api = {
  // Standardized so configured spellings such as en-us match catalog keys.
  resolveCanonicalLocale: (locale: string) =>
    standardizeLocale(
      resolveCanonicalLocale(locale, sharedConfig?.customMapping)
    ),

  getProject: onProject('get'),
  updateProject: onProject('update'),
  listBranches: onProject('listBranches'),
  createBranch: onProject('createBranch'),
  updateBranch: onProject('updateBranch'),
  moveFiles: onProject('moveFiles'),
  listBranchFiles: onProject('listBranchFiles'),
  generateProjectContext: onProject('generateProjectContext'),
  queryJobs: onProject('queryJobs'),
  awaitJobs: onProject('awaitJobs'),
  translateFiles: onProject('translateFiles'),
  setTag: onProject('setTag'),
  publishFiles: onProject('publishFiles'),
  overwriteTranslations: onProject('overwriteTranslations'),
  queryFiles: onProject('queryFiles'),
  queryFilesContent: onProject('queryFilesContent'),
  uploadSourceFiles: onProject('uploadSourceFiles'),
  uploadTranslations: onProject('uploadTranslations'),
  createProjectApiKey: async (
    projectId: string,
    ...args: Parameters<ProjectHandle['createApiKey']>
  ) => project(projectId).createApiKey(...args),

  upsertAssets: async (
    orgId: string,
    ...args: Parameters<OrgHandle['upsertAssets']>
  ) => new GT(accountParams()).org(orgId).upsertAssets(...args),
  createProject: async (
    orgId: string,
    ...args: Parameters<OrgHandle['createProject']>
  ) => new GT(accountParams()).org(orgId).createProject(...args),
  listProjects: async () => new GT(accountParams()).listProjects(),
  listOrgs: async () => new GT(accountParams()).listOrgs(),
};

export type ApiClient = typeof api;
