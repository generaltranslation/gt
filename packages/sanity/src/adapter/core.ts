import { GT } from 'generaltranslation';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import type { Secrets } from '../types';
import type { TranslateDocumentFilter, IgnoreFields } from './types';
import { SECRETS_NAMESPACE } from '../utils/shared';

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
  translateDocuments: TranslateDocumentFilter[];
  private static instance: GTConfig;
  constructor(
    secretsNamespace: string,
    languageField: string,
    sourceLocale: string,
    locales: string[],
    singletons: string[],
    singletonMapping: (sourceDocumentId: string, locale: string) => string,
    ignoreFields: IgnoreFields[],
    translateDocuments: TranslateDocumentFilter[]
  ) {
    this.secretsNamespace = secretsNamespace;
    this.languageField = languageField;
    this.sourceLocale = sourceLocale;
    this.locales = locales;
    this.singletons = singletons;
    this.singletonMapping = singletonMapping;
    this.ignoreFields = ignoreFields;
    this.translateDocuments = translateDocuments;
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
    translateDocuments: TranslateDocumentFilter[]
  ) {
    this.secretsNamespace = secretsNamespace;
    this.languageField = languageField;
    this.sourceLocale = sourceLocale;
    this.locales = locales;
    this.singletons = singletons;
    this.singletonMapping = singletonMapping;
    this.ignoreFields = ignoreFields;
    this.translateDocuments = translateDocuments;
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
  getTranslateDocuments() {
    return this.translateDocuments;
  }
}
export const gtConfig = GTConfig.getInstance();
