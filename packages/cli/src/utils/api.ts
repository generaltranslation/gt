import {
  createGtApiAdapter,
  type GtApiAdapterConfig,
} from 'generaltranslation/internal';

const sharedApi = createGtApiAdapter();

export function configureApiClient(config: GtApiAdapterConfig): void {
  sharedApi.configure(config);
}

export const api = {
  resolveAliasLocale: sharedApi.resolveAliasLocale,
  resolveCanonicalLocale: sharedApi.resolveCanonicalLocale,
  translate: sharedApi.translate,
  translateMany: sharedApi.translateMany,

  getProject: sharedApi.getProject,
  updateProject: sharedApi.updateProject,
  listBranches: sharedApi.listBranches,
  createBranch: sharedApi.createBranch,
  updateBranch: sharedApi.updateBranch,
  moveFiles: sharedApi.moveFiles,
  listBranchFiles: sharedApi.listBranchFiles,
  generateProjectContext: sharedApi.generateProjectContext,
  queryJobs: sharedApi.queryJobs,
  awaitJobs: sharedApi.awaitJobs,
  translateFiles: sharedApi.translateFiles,
  setTag: sharedApi.setTag,
  publishFiles: sharedApi.publishFiles,
  overwriteTranslations: sharedApi.overwriteTranslations,
  queryFiles: sharedApi.queryFiles,
  queryFilesContent: sharedApi.queryFilesContent,
  uploadSourceFiles: sharedApi.uploadSourceFiles,
  uploadTranslations: sharedApi.uploadTranslations,
  upsertAssets: sharedApi.upsertAssets,

  createProject: sharedApi.createProject,
  listProjects: sharedApi.listProjects,
  listOrgs: sharedApi.listOrgs,
  createProjectApiKey: sharedApi.createProjectApiKey,
};

export type ApiClient = typeof api;
