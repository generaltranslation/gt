import {
  GT,
  GTIntl,
  GTRuntime,
  type GTAccountConfig,
  type GTCredentials,
  type GTProjectConfig,
  type OrgHandle,
  type ProjectHandle,
} from '../../index.js';
import type { UserTokenProvider } from '@generaltranslation/api';

declare const userTokenProvider: UserTokenProvider;
const localeConfig = { defaultLocale: 'en', locales: ['en', 'es'] };

// With projectId, GT is project-scoped: a ProjectHandle.
const gt = new GT({ apiKey: 'key', projectId: 'project', localeConfig });
const asProject: ProjectHandle = gt;
void asProject.uploadSourceFiles;
void gt.translateMany;
// @ts-expect-error the project form has no project().
void gt.project;
// @ts-expect-error the project form has no org().
void gt.org;
// @ts-expect-error the project form has no listOrgs().
void gt.listOrgs;

// Without projectId, GT is account-scoped.
const account: GT = new GT({ userTokenProvider });
const project: ProjectHandle = account.project('project');
const org: OrgHandle = account.org('org');
void account.listOrgs;
void account.listProjects;
void project.getJob;
void org.upsertAssets;
// @ts-expect-error project operations need a project.
void account.uploadSourceFiles;
// @ts-expect-error runtime translation needs a project.
void account.translate;
// @ts-expect-error API keys are created for a project.
void account.createApiKey;
void gt.createApiKey;

// GT and GTRuntime take exactly one credential: an API key or a user-token provider.
const withApiKey: GTAccountConfig = { apiKey: 'key' };
const withProvider: GTProjectConfig = {
  userTokenProvider,
  projectId: 'project',
};
const credentials: GTCredentials = { apiKey: 'key' };
new GT({ ...credentials, projectId: 'project' });
const accountWithProject: GTAccountConfig = {
  apiKey: 'key',
  // @ts-expect-error the account form takes no projectId.
  projectId: 'project',
};
// @ts-expect-error the project form requires projectId.
const projectWithoutId: GTProjectConfig = { apiKey: 'key' };
// @ts-expect-error pass an API key or a user-token provider, not both.
const bothCredentials: GTAccountConfig = { apiKey: 'key', userTokenProvider };
// @ts-expect-error credentials are required.
const noCredentials: GTProjectConfig = { projectId: 'project' };
void accountWithProject;
void projectWithoutId;
void bothCredentials;
void noCredentials;
// A projectId that may be undefined matches neither form; narrow it first.
declare const maybeProjectId: string | undefined;
// @ts-expect-error string | undefined is neither a project ID nor absent.
new GT({ apiKey: 'key', projectId: maybeProjectId });
// @ts-expect-error GTRuntime needs a string projectId.
new GTRuntime({ apiKey: 'key', projectId: maybeProjectId });
if (maybeProjectId) {
  const narrowed: ProjectHandle = new GT({
    apiKey: 'key',
    projectId: maybeProjectId,
  });
  void narrowed;
} else {
  const unscoped: GT = new GT({ apiKey: 'key' });
  void unscoped;
}
new GTRuntime({ apiKey: 'key', projectId: 'project', localeConfig });
new GTRuntime({ userTokenProvider, projectId: 'project' });
void withApiKey;
void withProvider;
// @ts-expect-error credentials are required.
new GT({ projectId: 'project' });
// @ts-expect-error credentials are required.
new GT({});
// @ts-expect-error credentials are required.
new GTRuntime({ projectId: 'project' });
// @ts-expect-error pass an API key or a user-token provider, not both.
new GT({ apiKey: 'key', userTokenProvider });
// @ts-expect-error pass an API key or a user-token provider, not both.
new GTRuntime({ apiKey: 'key', userTokenProvider, projectId: 'project' });
// @ts-expect-error GTRuntime requires projectId.
new GTRuntime({ apiKey: 'key' });

// GTIntl takes no credentials.
new GTIntl(localeConfig, { locale: 'es' }).formatNum(1);
// @ts-expect-error GTIntl takes no credentials.
new GTIntl({ apiKey: 'key' });

// GTIntl methods default to the instance locale; `{ locale }` overrides it per call.
const intl = new GTIntl(localeConfig, { locale: 'es' });
intl.getLocaleName();
intl.getLocaleName('fr', { locale: 'de' });
intl.getLocaleProperties(undefined, { locale: 'de' });
intl.getLocaleEmoji();
intl.getLocaleDirection(undefined, { locale: 'ar' });
intl.getRegionProperties('US', { locale: 'de' });
intl.requiresTranslation({ locale: 'fr', approvedLocales: [] });
// @ts-expect-error the display locale goes in the options object.
intl.getLocaleName('fr', 'de');
// @ts-expect-error getRegionProperties needs a region.
intl.getRegionProperties();

// Snapshotted locale configuration is readonly all the way down.
const runtime = new GTRuntime({
  apiKey: 'key',
  projectId: 'project',
  localeConfig: { locales: ['es'], customMapping: { brand: { code: 'es' } } },
});
// @ts-expect-error snapshot locales are readonly.
runtime.localeConfig.locales?.push('fr');
// @ts-expect-error the snapshot mapping is readonly.
runtime.localeConfig.customMapping!.brand = { code: 'de' };
const brandEntry = gt.localeConfig.customMapping?.brand;
if (typeof brandEntry === 'object') {
  // @ts-expect-error snapshot mapping entries are readonly.
  brandEntry.code = 'de';
}
// @ts-expect-error GTIntl locales are readonly.
intl.locales.push('fr');
// @ts-expect-error the GTIntl mapping is readonly.
intl.customMapping!.brand = 'Brand';
// @ts-expect-error instance fields are readonly.
runtime.apiKey = 'other';
// A snapshot can configure another instance.
new GTIntl(runtime.localeConfig);
