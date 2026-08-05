import { pluginConfig } from '../adapter/core';
import { version as PACKAGE_VERSION } from '../../package.json';
import type { Secrets } from '../types';
import type { TranslationPreferences } from '../adapter/types';
import type { TranslationSummary } from './translationSummary';

export type DebugInfo = {
  package: { name: 'gt-sanity'; version: string };
  sanity: { projectId?: string; dataset?: string };
  generalTranslation: {
    projectId?: string;
    /** Whether the secrets document supplied an API key. Never the key. */
    apiKeyConfigured: boolean;
    secretsNamespace: string;
    secretsDocumentFound: boolean;
    branchId?: string;
  };
  locales: { sourceLocale: string; targetLocales: string[] };
  documents: {
    translationLevel: string;
    translateDocuments: unknown[];
    fieldLevelDocuments: unknown[];
    languageField: string;
    singletons: string[];
  };
  fieldRules: {
    ignoreFields: unknown[];
    dedupeFields: unknown[];
    skipFields: unknown[];
    additionalStopTypes: string[];
  };
  /**
   * Where the translations actually are. A high `draftOnly` with `published`
   * at zero means they exist but are invisible to anything reading the
   * published perspective.
   */
  translations: TranslationSummary;
  /** Effective values, after any stored user choice overrides plugin config. */
  preferences: TranslationPreferences;
  customization: {
    additionalSerializers: string[];
    additionalDeserializers: string[];
    additionalBlockDeserializers: number;
  };
};

export type BuildDebugInfoInput = {
  secrets: Secrets | null;
  preferences: TranslationPreferences;
  translations: TranslationSummary;
  sanityProjectId?: string;
  sanityDataset?: string;
  branchId?: string;
};

/**
 * Collects the plugin's effective configuration for support and bug reports.
 *
 * The API key is never included, only whether one is set — the result is built
 * to be pasted into a ticket. Functions and serializer implementations are
 * reduced to names and counts so the result stays JSON-serializable.
 */
export function buildDebugInfo({
  secrets,
  preferences,
  translations,
  sanityProjectId,
  sanityDataset,
  branchId,
}: BuildDebugInfoInput): DebugInfo {
  const deserializers = pluginConfig.getAdditionalDeserializers();
  const deserializerTypes = deserializers?.types ?? {};

  return {
    package: { name: 'gt-sanity', version: PACKAGE_VERSION },
    sanity: { projectId: sanityProjectId, dataset: sanityDataset },
    generalTranslation: {
      projectId: secrets?.project,
      apiKeyConfigured: Boolean(secrets?.secret),
      secretsNamespace: pluginConfig.getSecretsNamespace(),
      secretsDocumentFound: secrets !== null,
      branchId,
    },
    locales: {
      sourceLocale: pluginConfig.getSourceLocale(),
      targetLocales: pluginConfig.getLocales(),
    },
    documents: {
      translationLevel: pluginConfig.getTranslationLevel(),
      translateDocuments: pluginConfig.getTranslateDocuments(),
      fieldLevelDocuments: pluginConfig.getFieldLevelDocuments(),
      languageField: pluginConfig.getLanguageField(),
      singletons: pluginConfig.getSingletons(),
    },
    fieldRules: {
      ignoreFields: pluginConfig.getIgnoreFields(),
      dedupeFields: pluginConfig.getDedupeFields(),
      skipFields: pluginConfig.getSkipFields(),
      additionalStopTypes: pluginConfig.getAdditionalStopTypes(),
    },
    translations,
    preferences,
    customization: {
      additionalSerializers: Object.keys(
        pluginConfig.getAdditionalSerializers()?.types ?? {}
      ),
      additionalDeserializers: Object.keys(deserializerTypes),
      additionalBlockDeserializers:
        pluginConfig.getAdditionalBlockDeserializers()?.length ?? 0,
    },
  };
}

export function formatDebugInfo(info: DebugInfo): string {
  return JSON.stringify(info, null, 2);
}
