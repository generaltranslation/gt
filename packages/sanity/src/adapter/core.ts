import { GT } from 'generaltranslation';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import type { Secrets } from '../types';
import type {
  TranslateDocumentFilter,
  DedupeFields,
  IgnoreFields,
  SkipFields,
  FieldLevelTranslationMode,
} from './types';
import { SECRETS_NAMESPACE } from '../utils/shared';
import type { PortableTextHtmlComponents } from '@portabletext/to-html';
import type { CustomDeserializers } from '../serialization/types';
export const gt = new GT();

export function overrideConfig(secrets: Secrets | null) {
  gt.setConfig({
    ...(secrets?.project && { projectId: secrets?.project }),
    ...(secrets?.secret && { apiKey: secrets?.secret }),
  });
}

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
    fieldLevelDocuments: TranslateDocumentFilter[] = []
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
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new GTConfig(
        SECRETS_NAMESPACE,
        'language',
        gt.sourceLocale || libraryDefaultLocale,
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
    fieldLevelDocuments: TranslateDocumentFilter[] = []
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
}
export const pluginConfig = GTConfig.getInstance();
