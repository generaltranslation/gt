import { GT, type ProjectHandle } from 'generaltranslation';
import {
  resolveCanonicalLocale as resolveCanonicalCode,
  standardizeLocale,
} from '@generaltranslation/format';
import { snapshotLocaleConfig } from '@generaltranslation/format/internal';
import type { UserTokenProvider } from '@generaltranslation/api';
import { credentialScope } from 'generaltranslation/internal';
import type { CustomMapping } from '@generaltranslation/format/types';
import type { Settings } from '../types/index.js';

// Format modules resolve locales without settings, so the mapping is module state.
let sharedCustomMapping: CustomMapping | undefined;

/** Sets the custom mapping that `resolveCanonicalLocale` applies. */
export function configureCustomMapping(customMapping?: CustomMapping): void {
  sharedCustomMapping = snapshotLocaleConfig({ customMapping }).customMapping;
}

/** Standardized so configured spellings such as en-us match catalog keys. */
export function resolveCanonicalLocale(locale: string): string {
  return standardizeLocale(resolveCanonicalCode(locale, sharedCustomMapping));
}

/**
 * The project-scoped client when a project ID resolves, and the
 * account-scoped client unless the API key is a project key.
 */
export function createClients(
  settings: Pick<
    Settings,
    'apiKey' | 'userTokenProvider' | 'projectId' | 'baseUrl' | 'customMapping'
  >
): { project?: ProjectHandle; account?: GT } {
  const params = {
    ...(settings.apiKey
      ? { apiKey: settings.apiKey }
      : {
          // generateSettings always sets the provider.
          userTokenProvider: settings.userTokenProvider as UserTokenProvider,
        }),
    baseUrl: settings.baseUrl,
    localeConfig: { customMapping: settings.customMapping },
  };
  return {
    project: settings.projectId
      ? new GT({ ...params, projectId: settings.projectId })
      : undefined,
    account: credentialScope(params) === 'account' ? new GT(params) : undefined,
  };
}
