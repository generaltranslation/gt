import { GT } from 'generaltranslation';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import type { Secrets } from '../types';
import type { IgnoreFields } from './types';

export const gt = new GT();

export function overrideConfig(secrets: Secrets | null) {
  gt.setConfig({
    ...(secrets?.project && { projectId: secrets?.project }),
    ...(secrets?.secret && { apiKey: secrets?.secret }),
  });
}

export class GTConfig {
  sourceLocale: string;
  locales: string[];
  singletons: string[];
  singletonMapping: (sourceDocumentId: string, locale: string) => string;
  ignoreFields: IgnoreFields[];

  private static instance: GTConfig;
  constructor(
    sourceLocale: string,
    locales: string[],
    singletons: string[],
    singletonMapping: (sourceDocumentId: string, locale: string) => string,
    ignoreFields: IgnoreFields[]
  ) {
    this.sourceLocale = sourceLocale;
    this.locales = locales;
    this.singletons = singletons;
    this.singletonMapping = singletonMapping;
    this.ignoreFields = ignoreFields;
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new GTConfig(
        gt.sourceLocale || libraryDefaultLocale,
        [],
        [],
        () => '',
        []
      );
    }
    return this.instance;
  }

  init(
    sourceLocale: string,
    locales: string[],
    singletons: string[],
    singletonMapping: (sourceDocumentId: string, locale: string) => string,
    ignoreFields: IgnoreFields[]
  ) {
    this.sourceLocale = sourceLocale;
    this.locales = locales;
    this.singletons = singletons;
    this.singletonMapping = singletonMapping;
    this.ignoreFields = ignoreFields;
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
}
export const gtConfig = GTConfig.getInstance();
