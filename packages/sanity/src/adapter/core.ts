import {
  GT,
  GTIntl,
  type LocaleConfig,
  type ProjectHandle,
} from 'generaltranslation';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import type { Secrets } from '../types';
import type {
  TranslateDocumentFilter,
  DedupeFields,
  IgnoreFields,
  SkipFields,
  FieldLevelTranslationMode,
  TranslationPreferences,
} from './types';
import { SECRETS_NAMESPACE } from '../utils/shared';
import type { PortableTextHtmlComponents } from '@portabletext/to-html';
import type { CustomDeserializers } from '../serialization/types';
/** The plugin's source locale and custom mapping; no credentials. */
export let gt = new GTIntl();

/** Replaces `gt` with one built from the plugin options. */
export function configureGt(localeConfig: LocaleConfig) {
  gt = new GTIntl(localeConfig);
}

/**
 * Built-in defaults for the automatic actions.
 *
 * The line is whether an action can put content in front of readers, or write
 * to something already in front of them:
 * - `autoRefresh` only polls for status, and auto-import depends on it.
 * - `autoImport` writes drafts, which are cheap to discard.
 * - `autoPatchReferences` normally writes a draft too, but rewrites references
 *   on an already-published translation when that document has no draft, so it
 *   is opt-in.
 * - `autoPublish` publishes, which no switch can undo.
 */
export const DEFAULT_TRANSLATION_PREFERENCES: TranslationPreferences = {
  autoRefresh: true,
  autoImport: true,
  autoPatchReferences: false,
  autoPublish: false,
  // Opt-in: turning this on means Sanity overwrites whatever General
  // Translation holds for that source version, including a completed
  // translation that has not been imported yet.
  preserveExistingTranslations: false,
};

/** The project in the Studio secrets, authenticated with their API key. */
export function projectFor(secrets: Secrets | null): ProjectHandle {
  if (!secrets?.secret) throw new Error(missingSecretDiagnostic);
  return new GT({
    apiKey: secrets.secret,
    projectId: secrets.project ?? '',
    localeConfig: {
      defaultLocale: gt.defaultLocale,
      customMapping: gt.customMapping,
    },
  });
}

const missingSecretDiagnostic = createDiagnosticMessage({
  source: 'gt-sanity',
  severity: 'Error',
  whatHappened: 'Translation needs a General Translation API key',
  fix: 'Add the API key to the plugin secrets in the Studio',
});

export class GTConfig {
  secretsNamespace: string;
  languageField: string;
  sourceLocale: string;
  locales: string[];
  singletons: string[];
  singletonMapping: (sourceDocumentId: string, locale: string) => string;
  ignoreFields: IgnoreFields[];
  dedupeFields: DedupeFields[];
  skipFields: SkipFields[];
  translateDocuments: TranslateDocumentFilter[];
  additionalStopTypes: string[];
  additionalSerializers: Partial<PortableTextHtmlComponents>;
  additionalDeserializers: CustomDeserializers;
  additionalBlockDeserializers: unknown[];
  translationLevel: FieldLevelTranslationMode;
  fieldLevelDocuments: TranslateDocumentFilter[];
  preferences: TranslationPreferences;

  private static instance: GTConfig;
  constructor(
    secretsNamespace: string,
    languageField: string,
    sourceLocale: string,
    locales: string[],
    singletons: string[],
    singletonMapping: (sourceDocumentId: string, locale: string) => string,
    ignoreFields: IgnoreFields[],
    dedupeFields: DedupeFields[],
    skipFields: SkipFields[],
    translateDocuments: TranslateDocumentFilter[],
    additionalStopTypes: string[] = [],
    additionalSerializers: Partial<PortableTextHtmlComponents> = {},
    additionalDeserializers: CustomDeserializers = { types: {} },
    additionalBlockDeserializers: unknown[] = [],
    translationLevel: FieldLevelTranslationMode = 'document',
    fieldLevelDocuments: TranslateDocumentFilter[] = [],
    preferences: TranslationPreferences = DEFAULT_TRANSLATION_PREFERENCES
  ) {
    this.secretsNamespace = secretsNamespace;
    this.languageField = languageField;
    this.sourceLocale = sourceLocale;
    this.locales = locales;
    this.singletons = singletons;
    this.singletonMapping = singletonMapping;
    this.ignoreFields = ignoreFields;
    this.dedupeFields = dedupeFields;
    this.skipFields = skipFields;
    this.translateDocuments = translateDocuments;
    this.additionalStopTypes = additionalStopTypes;
    this.additionalSerializers = additionalSerializers;
    this.additionalDeserializers = additionalDeserializers;
    this.additionalBlockDeserializers = additionalBlockDeserializers;
    this.translationLevel = translationLevel;
    this.fieldLevelDocuments = fieldLevelDocuments;
    this.preferences = preferences;
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new GTConfig(
        SECRETS_NAMESPACE,
        'language',
        gt.defaultLocale,
        [],
        [],
        () => '',
        [],
        [],
        [],
        [],
        [],
        { types: {} },
        {},
        []
      );
    }
    return this.instance;
  }

  init(
    secretsNamespace: string,
    languageField: string,
    sourceLocale: string,
    locales: string[],
    singletons: string[],
    singletonMapping: (sourceDocumentId: string, locale: string) => string,
    ignoreFields: IgnoreFields[],
    dedupeFields: DedupeFields[],
    skipFields: SkipFields[],
    translateDocuments: TranslateDocumentFilter[],
    additionalStopTypes: string[] = [],
    additionalSerializers: Partial<PortableTextHtmlComponents> = {},
    additionalDeserializers: CustomDeserializers = { types: {} },
    additionalBlockDeserializers: unknown[] = [],
    translationLevel: FieldLevelTranslationMode = 'document',
    fieldLevelDocuments: TranslateDocumentFilter[] = [],
    preferences: TranslationPreferences = DEFAULT_TRANSLATION_PREFERENCES
  ) {
    this.secretsNamespace = secretsNamespace;
    this.languageField = languageField;
    this.sourceLocale = sourceLocale;
    this.locales = locales;
    this.singletons = singletons;
    this.singletonMapping = singletonMapping;
    this.ignoreFields = ignoreFields;
    this.dedupeFields = dedupeFields;
    this.skipFields = skipFields;
    this.translateDocuments = translateDocuments;
    this.additionalStopTypes = additionalStopTypes;
    this.additionalSerializers = additionalSerializers;
    this.additionalDeserializers = additionalDeserializers;
    this.additionalBlockDeserializers = additionalBlockDeserializers;
    this.translationLevel = translationLevel;
    this.fieldLevelDocuments = fieldLevelDocuments;
    this.preferences = preferences;
  }

  getSecretsNamespace() {
    return this.secretsNamespace;
  }

  getLanguageField() {
    return this.languageField;
  }

  getSourceLocale() {
    return this.sourceLocale;
  }
  getLocales() {
    return this.locales;
  }
  getSingletons() {
    return this.singletons;
  }
  getSingletonMapping() {
    return this.singletonMapping;
  }
  getIgnoreFields() {
    return this.ignoreFields;
  }
  getDedupeFields() {
    return this.dedupeFields;
  }
  getSkipFields() {
    return this.skipFields;
  }
  getTranslateDocuments() {
    return this.translateDocuments;
  }
  getAdditionalStopTypes() {
    return this.additionalStopTypes;
  }
  getAdditionalSerializers() {
    return this.additionalSerializers;
  }
  getAdditionalDeserializers() {
    return this.additionalDeserializers;
  }
  getAdditionalBlockDeserializers() {
    return this.additionalBlockDeserializers;
  }
  getTranslationLevel() {
    return this.translationLevel;
  }
  getFieldLevelDocuments() {
    return this.fieldLevelDocuments;
  }
  getPreferences() {
    return this.preferences;
  }
}
export const pluginConfig = GTConfig.getInstance();
